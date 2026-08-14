import { ApiSettings } from '../types';
import { DEFAULT_API_BASE_URL } from '../utils/constants';

export const normalizeBaseUrl = (url?: string): string => {
  if (!url || !url.trim()) return DEFAULT_API_BASE_URL;
  let trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    // If protocol is missing, default to http://
    trimmed = `http://${trimmed}`;
  }
  return trimmed;
};

export const testApiConnection = async (targetUrl: string): Promise<{ success: boolean; message: string; status?: number }> => {
  try {
    const baseUrl = normalizeBaseUrl(targetUrl);
    // Test endpoint using a lightweight fetch or head request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(`${baseUrl}/Select/QA_HOTEL_GUEST_COMMENT`, {
      method: 'OPTIONS',
      signal: controller.signal
    }).catch(async () => {
      // If OPTIONS fails, try a simple POST with empty object to test reachability
      return await fetch(`${baseUrl}/Select/QA_HOTEL_GUEST_COMMENT`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Action: 'Ping' }),
        signal: controller.signal
      });
    });

    clearTimeout(timeoutId);

    if (response && (response.status < 500 || response.status === 401 || response.status === 403 || response.status === 200)) {
      return { 
        success: true, 
        message: `Sunucuya başarıyla ulaşıldı (HTTP ${response.status}). Endpoint aktif.`, 
        status: response.status 
      };
    } else {
      return { 
        success: false, 
        message: `Sunucudan beklenmeyen yanıt alındı (HTTP ${response?.status || 'Bilinmiyor'}).`, 
        status: response?.status 
      };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, message: 'Zaman aşımı: Sunucu 6 saniye içinde yanıt vermedi.' };
    }
    return { success: false, message: `Bağlantı hatası: ${err.message || 'Sunucuya ulaşılamadı. Adresi ve ağ erişiminizi kontrol edin.'}` };
  }
};

export const executeElektraQuery = async (payload: any): Promise<any> => {
  const savedSettings = window.safeStorage.getItem('hotelApiSettings');
  if (!savedSettings) {
    throw new Error('API ayarları bulunamadı. Lütfen önce ayarları yapın.');
  }

  let settings: ApiSettings;
  try {
    settings = JSON.parse(savedSettings);
  } catch (e) {
    throw new Error('API ayarları okunamadı.');
  }

  const rawBaseUrl = settings.baseUrl?.trim() || DEFAULT_API_BASE_URL;
  if (!settings.hotelId) {
    throw new Error('API ayarları eksik (Hotel ID belirtilmelidir).');
  }

  const activeToken = window.safeStorage.getItem('loginToken') || settings.loginToken;
  if (!activeToken) {
    throw new Error('Geçerli bir oturum token\'ı bulunamadı.');
  }

  // Ensure payload has the necessary structure
  const finalPayload = {
    ...payload,
    Parameters: { HOTELID: Number(settings.hotelId), ...payload.Parameters },
    LoginToken: activeToken
  };

  // Construct dynamic endpoint using normalized user-defined baseUrl
  const baseUrl = normalizeBaseUrl(rawBaseUrl);
  const endpoint = `${baseUrl}/${payload.Action}/${payload.Object}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(finalPayload)
    });

    if (!response.ok) {
      let errorMsg = `API Hatası: ${response.status}`;
      try {
        const errText = await response.text();
        console.error('API Error Response:', response.status, errText);
        
        // Try to parse JSON error if possible
        try {
          const errJson = JSON.parse(errText);
          if (errJson.Message || errJson.ExceptionMessage) {
            errorMsg = errJson.Message || errJson.ExceptionMessage;
          }
        } catch (e) {
          // If it's HTML (like an IIS 403 page), just show a generic message
          if (errText.includes('<html')) {
            if (response.status === 403) {
              errorMsg = "403 Forbidden: Yetkisiz erişim veya yanlış endpoint. Lütfen Base URL'yi kontrol edin.";
            } else if (response.status === 404) {
              errorMsg = "404 Not Found: Endpoint bulunamadı. Lütfen Base URL'yi kontrol edin.";
            }
          } else if (errText) {
            errorMsg = errText;
          }
        }
      } catch (e) {
        // Ignore text parsing errors
      }

      if (response.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }
      
      // Only throw TOKEN_EXPIRED for 403 if the message actually hints at it
      if (response.status === 403 && (errorMsg.toLowerCase().includes('token') || errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('yetki'))) {
        throw new Error('TOKEN_EXPIRED');
      }

      throw new Error(errorMsg);
    }

    const data = await response.json();
    
    // Check if the API returned a logical error
    if (data && data.Success === false) {
      const msg = data.Message || data.ExceptionMessage || 'API İşlem Başarısız';
      if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('yetki')) {
        throw new Error('TOKEN_EXPIRED');
      }
      throw new Error(msg);
    }

    // The previous code expected data.ResultSets[0]
    if (data && data.ResultSets && data.ResultSets.length > 0) {
      return data.ResultSets[0];
    } else if (data && data.Success) {
        // Some actions might just return Success: true
        return data;
    } else {
      return [];
    }
  } catch (error: any) {
    throw error;
  }
};
