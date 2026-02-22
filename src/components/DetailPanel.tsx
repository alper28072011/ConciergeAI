import React, { useState, useEffect } from 'react';
import { CommentData } from '../types';
import { Sparkles, Printer, Download, Languages, User, Calendar, Globe, Building, CheckCircle2, MessageSquare, DoorOpen, Phone, Mail, ShieldCheck, MessageCircle, Smartphone, Save, Database } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { formatTRDate } from '../utils';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../firebase';

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
  const [showTranslation, setShowTranslation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingDB, setIsFetchingDB] = useState(false);
  const [savedInAgenda, setSavedInAgenda] = useState(false);

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
      await setDoc(doc(db, "agenda_notes", String(comment.ID)), {
        extraNotes,
        generatedLetter,
        targetLanguage,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setSavedInAgenda(true);
      alert('Ajandaya başarıyla kaydedildi.');
    } catch (error) {
      console.error("Error saving document:", error);
      alert('Kaydedilirken bir hata oluştu.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedLetter('');
    setTranslatedLetter('');
    setShowTranslation(false);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setGeneratedLetter(response.text || 'Mektup oluşturulamadı.');
    } catch (error) {
      console.error('Error generating letter:', error);
      setGeneratedLetter('Mektup oluşturulurken bir hata oluştu. Lütfen API anahtarınızı kontrol edin.');
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
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Translate the following hotel guest letter to Turkish. Maintain the professional, 5-star hotel concierge tone.\n\n${generatedLetter}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setTranslatedLetter(response.text || 'Çeviri yapılamadı.');
      setShowTranslation(true);
    } catch (error) {
      console.error('Error translating letter:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Top: Comment Details */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 relative">
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
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Misafir Yorumu</h4>
            <p className="text-slate-800 text-lg leading-relaxed">{comment.COMMENT}</p>
          </div>
        </div>

        {/* Guest Details & Consents */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
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
        <div className="space-y-4">
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
        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-end gap-4 mb-6">
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
            <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white text-slate-900 rounded-xl p-6 shadow-inner whitespace-pre-wrap font-serif text-base leading-relaxed border border-slate-200">
                {showTranslation ? translatedLetter : generatedLetter}
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
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
                  <button className="flex items-center gap-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors">
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
