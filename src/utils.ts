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
  if (!allComments || allComments.length === 0) return [];

  // Tarihlerden saat bilgisini temizleyip sadece YYYY-MM-DD formatını alan yardımcı fonksiyon
  const normalizeDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      // Parse edilemedi
    }
    
    return dateStr;
  };

  const guestRoom = String(guest.ROOMNO || '').trim().toUpperCase();
  const guestCheckIn = normalizeDate(guest.CHECKIN);
  const guestCheckOut = normalizeDate(guest.CHECKOUT);

  return allComments.filter(comment => {
    const commentRoom = String(comment.ROOMNO || '').trim().toUpperCase();
    
    // 1. Kriter: Oda Numarası Kesinlikle Eşleşmeli
    if (!guestRoom || !commentRoom || guestRoom !== commentRoom) return false;

    const commentCheckIn = normalizeDate(comment.CHECKIN);
    const commentCheckOut = normalizeDate(comment.CHECKOUT);
    const commentDate = normalizeDate(comment.COMMENTDATE);

    // 2. Kriter: Eğer yorumda CheckIn ve CheckOut varsa, BİREBİR eşleşme ara (En güvenilir)
    if (commentCheckIn && commentCheckOut) {
      if (guestCheckIn === commentCheckIn && guestCheckOut === commentCheckOut) {
        return true;
      }
    }

    // 3. Kriter (Fallback): Eğer yorumda CheckIn/CheckOut yoksa veya eşleşmediyse, 
    // Yorum Tarihi (COMMENTDATE), misafirin konaklama tarihleri arasında mı diye bak.
    // (Çıkıştan sonraki 14 gün içinde yapılmış yorumları da o konaklamaya say)
    if (guestCheckIn && guestCheckOut && commentDate) {
      const gIn = new Date(guestCheckIn).getTime();
      const gOut = new Date(guestCheckOut).getTime();
      const cDate = new Date(commentDate).getTime();
      
      // Çıkış tarihine 14 gün tolerans ekle (Misafir çıktıktan sonra yorum yapabilir)
      const gOutTolerated = gOut + (14 * 24 * 60 * 60 * 1000);

      if (cDate >= gIn && cDate <= gOutTolerated) {
        return true;
      }
    }

    return false;
  });
};
