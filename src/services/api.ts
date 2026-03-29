import { ApiSettings } from '../types';

export const executeElektraQuery = async (payload: any): Promise<any> => {
  const savedSettings = localStorage.getItem('hotelApiSettings');
  if (!savedSettings) {
    throw new Error('API ayarları bulunamadı. Lütfen önce ayarları yapın.');
  }

  let settings: ApiSettings;
  try {
    settings = JSON.parse(savedSettings);
  } catch (e) {
    throw new Error('API ayarları okunamadı.');
  }

  if (!settings.baseUrl || !settings.hotelId) {
    throw new Error('API ayarları eksik (Base URL veya Hotel ID).');
  }

  const activeToken = localStorage.getItem('loginToken') || settings.loginToken;
  if (!activeToken) {
    throw new Error('Geçerli bir oturum token\'ı bulunamadı.');
  }

  // Ensure payload has the necessary structure
  const finalPayload = {
    ...payload,
    Parameters: { HOTELID: Number(settings.hotelId), ...payload.Parameters },
    LoginToken: activeToken
  };

  // Construct dynamic endpoint
  const baseUrl = settings.baseUrl.replace(/\/+$/, '');
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
