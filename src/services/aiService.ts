import { GoogleGenAI, Type } from '@google/genai';
import { collection, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { ApiSettings, AIFeature, CommentData, CommentAnalytics, HotelTaxonomy, UnifiedTopicAnalysis } from '../types';
import { HOTEL_MAIN_CATEGORIES } from '../utils/constants';

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

export async function analyzeCommentComprehensive(comment: CommentData): Promise<CommentAnalytics> {
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

  // Step A: Fetch current taxonomy from Firebase
  let currentTaxonomy: HotelTaxonomy = { categories: {} };
  try {
    const taxonomyDoc = await getDoc(doc(db, 'system_memory', 'taxonomy'));
    if (taxonomyDoc.exists()) {
      currentTaxonomy = taxonomyDoc.data() as HotelTaxonomy;
    }
  } catch (error) {
    console.error("Error fetching taxonomy:", error);
  }

  // Step B: System Prompt
  const prompt = `Sen 5 yıldızlı bir otelin Misafir Deneyimi Analistisin. Amacın misafir yorumunu parçalayarak konuları standartlaştırmaktır.
Şu ana kadar öğrenilmiş Alt Konu Hafızası (Taxonomy) şudur: 
${JSON.stringify(currentTaxonomy, null, 2)}

KURALLAR:
1. Yorumdaki her bir farklı konu için, ŞU SABİT ANA KATEGORİLERDEN (mainCategory) EN UYGUN OLANINI SEÇMEK ZORUNDASIN: [${HOTEL_MAIN_CATEGORIES.join(', ')}]. Başka bir ana kategori ASLA uydurma.
2. 'subCategory' (Alt Konu) için ise hafızayı kontrol et. Eğer hafızada o Ana Kategori altında uygun bir alt konu varsa KESİNLİKLE onu kullan. Eğer yorum TAMAMEN YENİ bir detaydan bahsediyorsa yeni bir alt konu icat edebilirsin.
3. Her eşleşme için 0-100 arası 'score' ve 'sentiment' (positive/negative/neutral) ata.
Sonucu SADECE şu JSON formatında dön: { "overallScore": 85, "topics": [ { "mainCategory": "Yiyecek Deneyimi", "subCategory": "Yemek Sıcaklığı", "score": 30, "sentiment": "negative" } ] }

Yorum:
${comment.COMMENT || ''}`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            topics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  mainCategory: { type: Type.STRING },
                  subCategory: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  sentiment: { type: Type.STRING }
                },
                required: ["mainCategory", "subCategory", "score", "sentiment"]
              }
            }
          },
          required: ["overallScore", "topics"]
        }
      }
    });

    const text = response.text || '{}';
    const result = JSON.parse(text);
    
    // Extract token usage
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;

    // Calculate cost
    const rates = COST_RATES[model as keyof typeof COST_RATES] || COST_RATES['gemini-2.5-flash'];
    const costUSD = (inputTokens / 1000000) * rates.input + (outputTokens / 1000000) * rates.output;

    // Log to Firebase asynchronously
    addDoc(collection(db, 'ai_usage_logs'), {
      action: 'Comprehensive Comment Analysis',
      model: model,
      inputTokens,
      outputTokens,
      costUSD,
      timestamp: new Date().toISOString()
    }).catch(err => console.error("Error logging AI usage:", err));

    // Step 3: Auto-Updating Taxonomy
    let taxonomyUpdated = false;
    const newTaxonomy = { ...currentTaxonomy };
    if (!newTaxonomy.categories) newTaxonomy.categories = {};

    const topics: UnifiedTopicAnalysis[] = result.topics || [];
    
    topics.forEach(topic => {
      const { mainCategory, subCategory } = topic;
      
      // Ensure mainCategory is one of the allowed ones (AI should follow rules but we guard)
      if (HOTEL_MAIN_CATEGORIES.includes(mainCategory as any)) {
        if (!newTaxonomy.categories[mainCategory]) {
          newTaxonomy.categories[mainCategory] = [];
          taxonomyUpdated = true;
        }
        
        if (!newTaxonomy.categories[mainCategory].includes(subCategory)) {
          newTaxonomy.categories[mainCategory].push(subCategory);
          taxonomyUpdated = true;
        }
      }
    });

    if (taxonomyUpdated) {
      await setDoc(doc(db, 'system_memory', 'taxonomy'), newTaxonomy, { merge: true });
    }

    // Save analysis result to comment_analytics
    const analyticsData: CommentAnalytics = {
      commentId: String(comment.ID),
      resId: comment.RESNAMEID_LOOKUP || '',
      date: comment.COMMENTDATE || new Date().toISOString(),
      source: comment.COMMENTSOURCEID_NAME || 'Bilinmiyor',
      nationality: comment.NATIONALITY || 'Bilinmiyor',
      overallScore: result.overallScore || 0,
      topics: topics,
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'comment_analytics', String(comment.ID)), analyticsData);

    return analyticsData;
  } catch (error: any) {
    console.error('AI Generation Error:', error);
    throw error;
  }
}
