import { GoogleGenAI } from '@google/genai';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ApiSettings, AIFeature } from '../types';

const COST_RATES = {
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
  'gemini-3.1-pro-preview': { input: 2.00, output: 12.00 }
};

export async function generateAIContent(prompt: string, actionName: string, featureKey?: AIFeature): Promise<string> {
  let settings: Partial<ApiSettings> = {};
  try {
    const savedSettings = localStorage.getItem('hotelApiSettings');
    if (savedSettings) {
      settings = JSON.parse(savedSettings);
    }
  } catch (e) {
    console.error('Error parsing settings:', e);
  }

  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Anahtarı bulunamadı. Lütfen ayarlardan yapılandırın.');
  }

  const model = (featureKey && settings.featureModels?.[featureKey]) || settings.geminiModel || 'gemini-2.5-flash';
  const ai = new GoogleGenAI({ apiKey: String(apiKey).trim().replace(/^["']|["']$/g, '') });

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    const text = response.text || '';
    
    // Extract token usage
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;

    // Calculate cost
    const rates = COST_RATES[model as keyof typeof COST_RATES] || COST_RATES['gemini-2.5-flash'];
    const costUSD = (inputTokens / 1000000) * rates.input + (outputTokens / 1000000) * rates.output;

    // Log to Firebase asynchronously
    addDoc(collection(db, 'ai_usage_logs'), {
      action: actionName,
      model: model,
      inputTokens,
      outputTokens,
      costUSD,
      timestamp: new Date().toISOString()
    }).catch(err => console.error("Error logging AI usage:", err));

    return text;
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    throw error;
  }
}

export async function analyzeCommentDeeply(commentText: string): Promise<any> {
  let settings: Partial<ApiSettings> = {};
  try {
    const savedSettings = localStorage.getItem('hotelApiSettings');
    if (savedSettings) {
      settings = JSON.parse(savedSettings);
    }
  } catch (e) {
    console.error('Error parsing settings:', e);
  }

  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API Anahtarı bulunamadı. Lütfen ayarlardan yapılandırın.');
  }

  const model = settings.featureModels?.deepAnalysis || settings.geminiModel || 'gemini-2.5-flash';
  const ai = new GoogleGenAI({ apiKey: String(apiKey).trim().replace(/^["']|["']$/g, '') });

  const prompt = `Sen 5 yıldızlı bir otelin uzman veri analistisin. Verilen misafir yorumunu analiz et. Yorumdaki her bir farklı konuyu (Örn: Temizlik, Yemek Lezzeti, Servis Hızı, Personel İlgisi), bu konunun ait olduğu otel departmanını (Örn: Kat Hizmetleri, Yiyecek & İçecek, Ön Büro, Teknik Servis, Spa) ve misafirin bu konudaki memnuniyetini 0 ile 100 arasında puanlayarak bul. Sonucu KESİNLİKLE sadece aşağıdaki JSON formatında döndür, başka hiçbir metin ekleme:
{ "overallScore": 85, "topics": [ { "topic": "Servis Hızı", "department": "Yiyecek & İçecek", "score": 30, "sentiment": "negative" }, { "topic": "Oda Temizliği", "department": "Kat Hizmetleri", "score": 100, "sentiment": "positive" } ] }

Yorum:
${commentText}`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || '{}';
    
    // Extract token usage
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;

    // Calculate cost
    const rates = COST_RATES[model as keyof typeof COST_RATES] || COST_RATES['gemini-2.5-flash'];
    const costUSD = (inputTokens / 1000000) * rates.input + (outputTokens / 1000000) * rates.output;

    // Log to Firebase asynchronously
    addDoc(collection(db, 'ai_usage_logs'), {
      action: 'Deep Comment Analysis',
      model: model,
      inputTokens,
      outputTokens,
      costUSD,
      timestamp: new Date().toISOString()
    }).catch(err => console.error("Error logging AI usage:", err));

    return JSON.parse(text);
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    throw error;
  }
}
