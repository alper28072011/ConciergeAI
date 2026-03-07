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
  // Assuming the standard pattern is BaseURL/Action/Object
  // However, the previous implementation used just BaseURL and sent Action/Object in the body.
  // Wait, looking at the previous App.tsx:
  // const response = await fetch(settings.baseUrl, { ... body: JSON.stringify(payload) ... });
  // The payload contained Action and Object.
  // The user prompt says: "Dinamik endpoint'i payload.Action ve payload.Object değerlerine göre oluştursun (Örn: ${baseUrl}/${payload.Action}/${payload.Object})."
  // But Elektraweb API usually works by posting to a single endpoint or by following the Action/Object path.
  // If the previous code was working by posting to `settings.baseUrl` (which might be just the root API URL), then we should stick to that or follow the new instruction.
  // The prompt explicitly says: "Dinamik endpoint'i ... oluştursun".
  // Let's assume the user wants to modernize the URL structure too, OR the previous `baseUrl` was actually the full endpoint and now we are making it dynamic.
  // Let's check the previous `baseUrl` example in SettingsModal: "https://4001.hoteladvisor.net"
  // If `baseUrl` is "https://4001.hoteladvisor.net", then `${baseUrl}/${payload.Action}/${payload.Object}` would be "https://4001.hoteladvisor.net/Select/QA_HOTEL_GUEST_COMMENT".
  // This is a common REST pattern.
  
  // However, the payload ALSO needs to contain Action and Object for some APIs.
  // Let's include them in the body as well to be safe, or just follow the instruction.
  
  const endpoint = `${settings.baseUrl}/${payload.Action}/${payload.Object}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(finalPayload)
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('TOKEN_EXPIRED');
      }
      throw new Error(`API Hatası: ${response.status}`);
    }

    const data = await response.json();
    
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
