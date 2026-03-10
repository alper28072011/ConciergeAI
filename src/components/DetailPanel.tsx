import React, { useState, useEffect, useRef } from 'react';
import { CommentData } from '../types';
import { Sparkles, Printer, Download, Languages, User, Calendar, Globe, Building, CheckCircle2, MessageSquare, DoorOpen, Phone, Mail, ShieldCheck, MessageCircle, Smartphone, Save, Database, Brain } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { formatTRDate } from '../utils';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../firebase';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface DetailPanelProps {
  comment: CommentData | null;
}

export function DetailPanel({ comment }: DetailPanelProps) {
  const [extraNotes, setExtraNotes] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('İngilizce');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [translatedLetter, setTranslatedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sentimentScore, setSentimentScore] = useState<number | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingDB, setIsFetchingDB] = useState(false);
  const [savedInAgenda, setSavedInAgenda] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (comment?.ID) {
      // Reset states
      setExtraNotes('');
      setGeneratedLetter('');
      setTranslatedLetter('');
      setShowTranslation(false);
      setTargetLanguage('İngilizce');
      setSavedInAgenda(false);

      // Fetch from Firebase
      const fetchData = async () => {
        setIsFetchingDB(true);
        try {
          const docRef = doc(db, "agenda_notes", String(comment.ID));
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            setExtraNotes(data.extraNotes || '');
            setGeneratedLetter(data.generatedLetter || '');
            setTargetLanguage(data.targetLanguage || 'İngilizce');
            setSentimentScore(data.sentimentScore !== undefined ? data.sentimentScore : null);
            setSavedInAgenda(true);
          }
        } catch (error) {
          console.error("Error fetching document:", error);
        } finally {
          setIsFetchingDB(false);
        }
      };

      fetchData();
    }
  }, [comment?.ID]);

  if (!comment) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center h-full">
        <div className="text-center text-slate-400">
          <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
          <p>Detayları görmek için sol taraftan bir yorum seçin.</p>
        </div>
      </div>
    );
  }

  const handleSaveToAgenda = async () => {
    if (!comment?.ID) return;
    setIsSaving(true);
    try {
      const payload: any = {
        extraNotes,
        generatedLetter,
        targetLanguage,
        updatedAt: new Date().toISOString()
      };
      
      if (sentimentScore !== null && sentimentScore !== undefined) {
        payload.sentimentScore = sentimentScore;
      }

      await setDoc(doc(db, "agenda_notes", String(comment.ID)), payload, { merge: true });
      setSavedInAgenda(true);
      alert('Ajandaya başarıyla kaydedildi.');
    } catch (error) {
      console.error("Error saving document:", error);
      alert('Kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  const getApiKey = (): string | null => {
    let key: string | null = null;
    let source = '';

    // 1. Try to get from LocalStorage (User Settings) - Priority #1
    try {
      const savedSettings = localStorage.getItem('hotelApiSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.geminiApiKey && typeof parsed.geminiApiKey === 'string') {
          key = parsed.geminiApiKey;
          source = 'Settings';
        }
      }
    } catch (e) {
      console.error('Error parsing settings for API key:', e);
    }

    // 2. Try to get from Environment Variables - Priority #2
    if (!key) {
      const envKey = process.env.GEMINI_API_KEY;
      if (envKey && typeof envKey === 'string') {
        key = envKey;
        source = 'Environment';
      }
    }

    if (key) {
      // Clean the key: remove whitespace and surrounding quotes if present
      key = key.trim();
      if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
      }
      
      if (key.length > 0) {
        console.log(`Using Gemini API Key from ${source} (Length: ${key.length}, Starts with: ${key.substring(0, 4)}...)`);
        return key;
      }
    }

    return null;
  };

  const handleAnalyzeSentiment = async () => {
    if (!comment?.COMMENT) {
      alert("Analiz edilecek yorum bulunamadı.");
      return;
    }

    if (sentimentScore !== null) {
      const confirmReanalyze = window.confirm("Bu yorum için daha önce duygu analizi yapılmış. Tekrar analiz etmek istiyor musunuz? (Token tüketimi artacaktır)");
      if (!confirmReanalyze) return;
    }

    const apiKey = getApiKey();

    if (!apiKey) {
      alert("Gemini API anahtarı bulunamadı. Lütfen ayarlardan yapılandırın.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: String(apiKey) });
      
      const prompt = `Aşağıdaki otel misafir yorumunu analiz et ve misafirin genel memnuniyetini 0 ile 1 arasında bir sayı olarak ver. 
        0: Tamamen memnuniyetsiz, 1: Tamamen memnun.
        Yanıtını kesinlikle aşağıdaki JSON formatında ver:
        { "score": 0.8 }
        
        Yorum:
        ${comment.COMMENT}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      let text = response.text;
      if (!text) {
        throw new Error("AI yanıtı boş döndü.");
      }

      // Clean markdown code blocks if present
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      const result = JSON.parse(text);
      let score: number;
      
      if (typeof result === 'number') {
        score = result;
      } else if (result && typeof result.score === 'number') {
        score = result.score;
      } else {
        throw new Error("Geçersiz format döndü.");
      }

      setSentimentScore(score);

      // Save to Firebase immediately
      await setDoc(doc(db, "agenda_notes", String(comment.ID)), {
        sentimentScore: score,
        sentimentAnalysisDate: new Date().toISOString()
      }, { merge: true });

      alert(`Analiz tamamlandı. Memnuniyet Oranı: %${(score * 100).toFixed(0)}`);
    } catch (error) {
      console.error("Sentiment analysis error:", error);
      alert("Duygu analizi sırasında bir hata oluştu.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedLetter('');
    setTranslatedLetter('');
    setShowTranslation(false);
    
    const apiKey = getApiKey();

    if (!apiKey) {
      const msg = 'Gemini API Anahtarı bulunamadı. Lütfen sağ üstteki "Ayarlar" butonuna tıklayıp geçerli bir Gemini API Anahtarı giriniz.';
      alert(msg);
      setGeneratedLetter(msg);
      setIsGenerating(false);
      return;
    }

    try {
      console.log('Initializing Gemini AI...');
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are a professional 5-star hotel Guest Relations Manager / Concierge. Write a polite and professional letter to a guest.
Guest Name: ${comment.RESNAMEID_LOOKUP || 'Misafir'}
Nationality: ${comment.NATIONALITY}
Room Number: ${comment.ROOMNO}
Check-In: ${formatTRDate(comment.CHECKIN || '')}
Check-Out: ${formatTRDate(comment.CHECKOUT || '')}
Guest Comment: ${comment.COMMENT}
Action Taken by Hotel: ${comment.ANSWER}
Extra Notes from Staff: ${extraNotes}
Target Language: ${targetLanguage}

The letter should be empathetic, professional, and address the guest's feedback and the actions taken. Do not include placeholders, write the final letter. Format with appropriate paragraphs.`;

      console.log('Sending request to Gemini...');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setGeneratedLetter(response.text || 'Mektup oluşturulamadı (Boş yanıt).');
    } catch (error: any) {
      console.error('Error generating letter:', error);
      let errorMessage = 'Mektup oluşturulurken bir hata oluştu.';
      
      if (error.message) {
        errorMessage += `\n\nHata Detayı: ${error.message}`;
      }
      
      if (error.message?.includes('403') || error.status === 403) {
        errorMessage += '\n\n(403 Yetki Hatası: API Anahtarınız geçersiz veya yetkisiz. Lütfen Ayarlar panelinden anahtarınızı kontrol edin.)';
      }

      setGeneratedLetter(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranslate = async () => {
    if (translatedLetter) {
      setShowTranslation(!showTranslation);
      return;
    }

    setIsTranslating(true);

    const apiKey = getApiKey();

    if (!apiKey) {
      alert('Gemini API Anahtarı bulunamadı. Lütfen Ayarlar panelinden giriniz.');
      setIsTranslating(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `Translate the following hotel guest letter to Turkish. Maintain the professional, 5-star hotel concierge tone.\n\n${generatedLetter}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setTranslatedLetter(response.text || 'Çeviri yapılamadı.');
      setShowTranslation(true);
    } catch (error: any) {
      console.error('Error translating letter:', error);
      alert('Çeviri sırasında bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!letterRef.current) return;
    
    // Create a temporary element for PDF generation to avoid textarea issues
    const element = document.createElement('div');
    element.innerHTML = letterRef.current.value.replace(/\n/g, '<br>');
    element.style.padding = '40px';
    element.style.fontFamily = 'serif';
    element.style.fontSize = '16px';
    element.style.lineHeight = '1.6';
    element.style.color = '#000';
    element.style.background = '#fff';
    
    const opt: any = {
      margin: 10,
      filename: `Misafir_Mektubu_${comment.RESNAMEID_LOOKUP || 'Misafir'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        onclone: (clonedDoc: Document) => {
          const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach(s => s.remove());
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0 print:overflow-visible">
        
        {/* Top: Comment Details */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 relative print:hidden">
          {savedInAgenda && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-green-200">
              <Database size={12} />
              Ajandada Kayıtlı
            </div>
          )}
          <div className="flex flex-wrap gap-4 mb-4 text-sm text-slate-600">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><User size={16} className="text-slate-400"/> <span className="font-medium text-slate-900">{comment.RESNAMEID_LOOKUP || 'Misafir'}</span></div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Globe size={16} className="text-slate-400"/> {comment.NATIONALITY}</div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Calendar size={16} className="text-slate-400"/> {formatTRDate(comment.COMMENTDATE)}</div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Building size={16} className="text-slate-400"/> {comment.COMMENTSOURCEID_NAME}</div>
            {comment.ROOMNO && <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><DoorOpen size={16} className="text-slate-400"/> {comment.ROOMNO}</div>}
            {comment.PHONE && <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Phone size={16} className="text-slate-400"/> {comment.PHONE}</div>}
            {comment.EMAIL && <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Mail size={16} className="text-slate-400"/> {comment.EMAIL}</div>}
          </div>

          <div className="prose prose-slate max-w-none">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Misafir Yorumu</h4>
              <div className="flex items-center gap-3">
                {sentimentScore !== null && (
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-slate-500">
                      Memnuniyet: %{(sentimentScore * 100).toFixed(0)}
                    </div>
                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          sentimentScore > 0.7 ? 'bg-emerald-500' : 
                          sentimentScore > 0.4 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${sentimentScore * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <button
                  onClick={handleAnalyzeSentiment}
                  disabled={isAnalyzing}
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-600 border-t-transparent" />
                  ) : (
                    <Brain size={14} />
                  )}
                  {sentimentScore !== null ? 'Yeniden Analiz Et' : 'Duygu Analizi Yap'}
                </button>
              </div>
            </div>
            <p className="text-slate-800 text-lg leading-relaxed">{comment.COMMENT}</p>
          </div>
        </div>

        {/* Guest Details & Consents */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:hidden">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={18} className="text-slate-500" />
              Misafir Detayları & İzinler
            </h4>
            {comment.GUESTID && <span className="text-xs font-mono text-slate-400">ID: {comment.GUESTID}</span>}
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${comment.WHATSAPPCONFIRMED ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                <MessageCircle size={16} />
              </div>
              <span className={`text-sm ${comment.WHATSAPPCONFIRMED ? 'text-slate-700' : 'text-slate-400 line-through'}`}>WhatsApp</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${comment.SMSCONFIRMED ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                <Smartphone size={16} />
              </div>
              <span className={`text-sm ${comment.SMSCONFIRMED ? 'text-slate-700' : 'text-slate-400 line-through'}`}>SMS</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${comment.EMAILCONFIRMED ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                <Mail size={16} />
              </div>
              <span className={`text-sm ${comment.EMAILCONFIRMED ? 'text-slate-700' : 'text-slate-400 line-through'}`}>Email</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${comment.PHONECONFIRMED ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                <Phone size={16} />
              </div>
              <span className={`text-sm ${comment.PHONECONFIRMED ? 'text-slate-700' : 'text-slate-400 line-through'}`}>Telefon</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className={`w-2 h-2 rounded-full ${comment.GDPRCONFIRMED ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs font-medium text-slate-500">KVKK / GDPR</span>
            </div>
          </div>
        </div>

        {/* Middle: Action & Notes */}
        <div className="space-y-4 print:hidden">
          <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100">
            <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Alınan Aksiyon
            </h4>
            <p className="text-emerald-900">{comment.ANSWER || 'Henüz aksiyon alınmamış.'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ekstra Notlar (AI'a Talimatlar)</label>
            <textarea
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="Örn: Odaya meyve sepeti ve şarap gönderildiğini de belirt..."
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none h-24 text-sm"
            />
          </div>
        </div>

        {/* Bottom: AI Generator */}
        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg print:bg-white print:shadow-none print:p-0 print:text-black">
          <div className="flex flex-wrap items-end gap-4 mb-6 print:hidden">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Hedef Dil</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-white/20 appearance-none"
              >
                <option value="İngilizce">İngilizce</option>
                <option value="Almanca">Almanca</option>
                <option value="Rusça">Rusça</option>
                <option value="Türkçe">Türkçe</option>
                <option value="Fransızca">Fransızca</option>
              </select>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex-1 min-w-[200px] bg-white text-slate-900 px-6 py-2.5 rounded-xl font-medium hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isGenerating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-900 border-t-transparent" />
              ) : (
                <Sparkles size={18} />
              )}
              {isGenerating ? 'Oluşturuluyor...' : 'AI Mektup Oluştur'}
            </button>
          </div>

          {generatedLetter && (
            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 print:mt-0 print:animate-none">
              <div className="relative">
                <textarea
                  ref={letterRef as any}
                  value={showTranslation ? translatedLetter : generatedLetter}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    if (showTranslation) {
                      setTranslatedLetter(newVal);
                    } else {
                      setGeneratedLetter(newVal);
                    }
                  }}
                  className="w-full bg-white text-slate-900 rounded-none shadow-lg p-12 font-serif text-base leading-relaxed border border-slate-200 min-h-[297mm] resize-none focus:outline-none focus:ring-1 focus:ring-slate-300 print:shadow-none print:border-none print:absolute print:inset-0 print:w-full print:h-full print:p-12 print:m-0"
                  placeholder="Mektup içeriği burada görünecek..."
                />
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 print:hidden">
                <button
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  <Languages size={16} />
                  {isTranslating ? 'Çevriliyor...' : showTranslation ? 'Orijinal Dilde Gör' : 'Kendi Dilimde Gör (Çevir)'}
                </button>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleSaveToAgenda}
                    disabled={isSaving}
                    className="flex items-center gap-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg transition-colors"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Save size={16} />
                    )}
                    Ajandaya Kaydet
                  </button>
                  <button 
                    onClick={handleDownloadPDF}
                    className="flex items-center gap-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Download size={16} />
                    PDF Kaydet
                  </button>
                  <button onClick={handlePrint} className="flex items-center gap-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors">
                    <Printer size={16} />
                    Yazdır
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
