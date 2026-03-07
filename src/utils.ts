import { ApiSettings } from './types';

export const buildDynamicPayload = (
  templateString: string,
  activeSettings: ApiSettings,
  startDate: string,
  endDate: string
): any => {
  if (!templateString) {
    throw new Error("Payload şablonu boş olamaz.");
  }

  let payload;
  try {
    payload = JSON.parse(templateString);
  } catch (e) {
    throw new Error("Payload şablonu geçerli bir JSON değil.");
  }

  // Inject LoginToken
  if (activeSettings.loginToken) {
    payload.LoginToken = activeSettings.loginToken;
  }

  // Update Where conditions
  if (payload.Where && Array.isArray(payload.Where)) {
    payload.Where = payload.Where.map((condition: any) => {
      // Update HOTELID
      if (condition.Column === "HOTELID") {
        return { ...condition, Value: Number(activeSettings.hotelId) };
      }

      // Update Date Filters
      // We look for common date columns like CHECKIN, CHECKOUT, COMMENTDATE
      const dateColumns = ["CHECKIN", "CHECKOUT", "COMMENTDATE", "DATE"];
      if (dateColumns.includes(condition.Column)) {
        if (condition.Operator === ">=") {
          return { ...condition, Value: startDate };
        }
        if (condition.Operator === "<=") {
          return { ...condition, Value: endDate };
        }
      }

      return condition;
    });
  }
  
  // Also update Parameters.HOTELID if it exists
  if (payload.Parameters && payload.Parameters.HOTELID) {
      payload.Parameters.HOTELID = Number(activeSettings.hotelId);
  } else if (payload.Parameters) {
      // If Parameters exists but HOTELID is missing, maybe add it? 
      // Better stick to what's in the template, but the prompt said "Where dizisi içinde dönerek..."
      // However, usually HOTELID is also in Parameters for some calls. Let's be safe.
      payload.Parameters.HOTELID = Number(activeSettings.hotelId);
  }

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
