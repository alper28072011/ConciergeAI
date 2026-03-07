import { ApiSettings, GuestData, CommentData } from './types';

export const buildDynamicPayload = (
  templateString: string,
  activeSettings: ApiSettings,
  startDate: string,
  endDate: string
): any => {
  if (!templateString) {
    throw new Error("Payload şablonu boş olamaz.");
  }

  let processedString = templateString;

  // 0. Auto-fix Legacy Hardcoded Dates (User Request Fix)
  // If the user has old templates with hardcoded 2024 dates, we replace them dynamically
  // This ensures the filter works even if they haven't updated their settings
  processedString = processedString.replace(/"Value":\s*"2024-01-01"/g, `"Value": "{{START_DATE}}"`);
  processedString = processedString.replace(/"Value":\s*"2024-12-31"/g, `"Value": "{{END_DATE}}"`);

  // 1. Replace Placeholders
  // Use a global regex replacement to ensure all instances are replaced
  processedString = processedString.replace(/{{LOGIN_TOKEN}}/g, activeSettings.loginToken || '');
  processedString = processedString.replace(/{{HOTELID}}/g, activeSettings.hotelId || '');
  processedString = processedString.replace(/{{START_DATE}}/g, startDate || '');
  processedString = processedString.replace(/{{END_DATE}}/g, endDate || '');

  // 2. Parse JSON
  try {
    const payload = JSON.parse(processedString);
    return payload;
  } catch (e) {
    console.error("JSON Parse Error in buildDynamicPayload:", e);
    console.error("Processed String was:", processedString);
    return null;
  }
};

export const formatTRDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  }).format(date);
};

export const findGuestComments = (guest: GuestData, allComments: CommentData[]): CommentData[] => {
  return allComments.filter(comment => {
    // 1. ALTIN ANAHTAR (Kesin Eşleşme): GUESTID
    if (comment.GUESTID && (guest.RESGUESTID === comment.GUESTID || guest.CONTACTGUESTID === comment.GUESTID)) return true;

    // 2. Email Eşleşmesi (Boşlukları silip küçük harfe çevirerek)
    const gEmail = guest.CONTACTEMAIL?.toLowerCase().trim();
    const cEmail = comment.EMAIL?.toLowerCase().trim();
    if (gEmail && cEmail && gEmail === cEmail) return true;

    // 3. Telefon Eşleşmesi (Tüm boşluk, +, -, (, ) karakterlerini temizleyerek)
    const cleanPhone = (p?: string) => p ? p.replace(/[\s\-\+\(\)]/g, '') : '';
    const gPhone = cleanPhone(guest.CONTACTPHONE);
    const cPhone = cleanPhone(comment.PHONE);
    if (gPhone && cPhone && gPhone === cPhone) return true;

    // 4. Lookup String Parçalama ve İsim/Oda Analizi
    if (comment.RESNAMEID_LOOKUP && guest.ROOMNO) {
      const parts = comment.RESNAMEID_LOOKUP.split('-');
      const lookupRoom = parts[0];
      const lookupName = parts[1] ? parts[1].toLowerCase().trim() : '';
      const guestNames = (guest.GUESTNAMES || guest.CONTACTPERSON || '').toLowerCase();

      if (lookupRoom === String(guest.ROOMNO)) {
        // Oda aynıysa ve isim de içeriyorsa kesin bu kişidir
        if (lookupName && guestNames.includes(lookupName)) return true;
      }
    }

    // 5. Fallback: Sadece Oda No ve CheckIn Tarihi (Sadece YYYY-MM-DD kısmını alarak saatleri yoksay)
    if (guest.ROOMNO && comment.ROOMNO && String(guest.ROOMNO) === String(comment.ROOMNO)) {
      const guestCheckIn = guest.CHECKIN?.split(' ')[0]?.split('T')[0];
      const commentCheckIn = comment.CHECKIN?.split(' ')[0]?.split('T')[0];
      
      if (guestCheckIn && commentCheckIn && guestCheckIn === commentCheckIn) return true;
    }

    return false;
  });
};
