import { ApiSettings, GuestData, CommentData } from './types';

export const buildDynamicPayload = (
  templateString: string,
  activeSettings: ApiSettings,
  columnFilters: Record<string, string> = {},
  startDate?: string,
  endDate?: string
): any => {
  if (!templateString) {
    throw new Error("Payload şablonu boş olamaz.");
  }

  let processedString = templateString;

  // 0. Auto-fix Legacy Hardcoded Dates
  processedString = processedString.replace(/"Value":\s*"2024-01-01"/g, `"Value": "{{START_DATE}}"`);
  processedString = processedString.replace(/"Value":\s*"2024-12-31"/g, `"Value": "{{END_DATE}}"`);

  // 1. Replace Placeholders
  processedString = processedString.replace(/{{LOGIN_TOKEN}}/g, activeSettings.loginToken || '');
  processedString = processedString.replace(/{{HOTELID}}/g, activeSettings.hotelId || '');
  
  if (startDate !== undefined) processedString = processedString.replace(/{{START_DATE}}/g, startDate || '');
  if (endDate !== undefined) processedString = processedString.replace(/{{END_DATE}}/g, endDate || '');

  // 2. Parse JSON
  let payload: any;
  try {
    payload = JSON.parse(processedString);
  } catch (e) {
    console.error("JSON Parse Error in buildDynamicPayload:", e);
    console.error("Processed String was:", processedString);
    return null;
  }

  // 3. Clean up existing Filters (remove empty values or unresolved placeholders)
  const filterKey = payload.Where ? 'Where' : 'Filters';
  if (payload[filterKey] && Array.isArray(payload[filterKey])) {
    payload[filterKey] = payload[filterKey].filter((f: any) => {
      // If startDate/endDate were not provided, remove filters that still have the placeholder
      if (typeof f.Value === 'string' && (f.Value.includes('{{START_DATE}}') || f.Value.includes('{{END_DATE}}'))) {
        return false;
      }
      // Also remove empty filters that might be left over
      if (f.Value === "" || f.Value === null || f.Value === undefined) {
        return false;
      }
      return true;
    });
  } else {
    payload.Where = [];
  }

  const targetKey = payload.Where ? 'Where' : 'Filters';

  // 4. Append dynamic column filters
  Object.entries(columnFilters).forEach(([key, value]) => {
    if (value && typeof value === 'string' && value.trim() !== '') {
      let finalValue = value.trim();
      let operator = "=";
      
      // If the user types a wildcard, use 'like'
      if (finalValue.includes('%')) {
        operator = "like";
      }

      payload[targetKey].push({
        Column: key,
        Operator: operator,
        Value: finalValue
      });
    }
  });

  return payload;
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
