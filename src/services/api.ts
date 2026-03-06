import { ApiSettings, ElektraQueryPayload } from '../types';

export const executeElektraQuery = async (payload: ElektraQueryPayload): Promise<any> => {
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

  const finalPayload = {
    ...payload,
    Parameters: { HOTELID: Number(settings.hotelId), ...payload.Parameters },
    LoginToken: activeToken
  };

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

    if (data && data.ResultSets && data.ResultSets.length > 0) {
      return data.ResultSets[0];
    } else if (data && data.Success) {
      return data;
    } else {
      return [];
    }
  } catch (error: any) {
    throw error;
  }
};
