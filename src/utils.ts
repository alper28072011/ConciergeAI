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
    // Kriter 1: Email (Kesin Eşleşme)
    if (guest.CONTACTEMAIL && comment.EMAIL && 
        guest.CONTACTEMAIL.trim() !== '' && comment.EMAIL.trim() !== '' &&
        guest.CONTACTEMAIL.trim().toLowerCase() === comment.EMAIL.trim().toLowerCase()) {
      return true;
    }

    // Kriter 2: Phone (Kesin Eşleşme - Sadece rakamlar)
    if (guest.CONTACTPHONE && comment.PHONE) {
      const guestPhone = guest.CONTACTPHONE.replace(/\D/g, '');
      const commentPhone = comment.PHONE.replace(/\D/g, '');
      if (guestPhone !== '' && commentPhone !== '' && guestPhone === commentPhone) {
        return true;
      }
    }

    // Kriter 3: Tarih ve Oda
    if (guest.ROOMNO && comment.ROOMNO && guest.ROOMNO === comment.ROOMNO) {
      const guestCheckIn = guest.CHECKIN ? guest.CHECKIN.split('T')[0] : null;
      const commentCheckIn = comment.CHECKIN ? comment.CHECKIN.split('T')[0] : null;
      const commentDate = comment.COMMENTDATE ? comment.COMMENTDATE.split('T')[0] : null;

      if (guestCheckIn && (guestCheckIn === commentCheckIn || guestCheckIn === commentDate)) {
        return true;
      }
    }

    // Kriter 4: Lookup Parse
    if (comment.RESNAMEID_LOOKUP) {
      const parts = comment.RESNAMEID_LOOKUP.split('-');
      if (parts.length >= 2) {
        const roomPart = parts[0].trim();
        const namePart = parts[1].trim().toLowerCase();

        if (roomPart === guest.ROOMNO && guest.GUESTNAMES.toLowerCase().includes(namePart)) {
          return true;
        }
      }
    }

    return false;
  });
};
