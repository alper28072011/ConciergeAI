import React, { useState } from 'react';
import { CommentData } from '../types';
import { Sparkles, Printer, Download, Languages, User, Calendar, Globe, Building, CheckCircle2, MessageSquare } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

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

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedLetter('');
    setTranslatedLetter('');
    setShowTranslation(false);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `You are a professional 5-star hotel Guest Relations Manager / Concierge. Write a polite and professional letter to a guest.
Guest Name: ${comment.GUESTNAME}
Nationality: ${comment.NATIONALITY}
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
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
          <div className="flex flex-wrap gap-4 mb-4 text-sm text-slate-600">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><User size={16} className="text-slate-400"/> <span className="font-medium text-slate-900">{comment.GUESTNAME || 'Misafir'}</span></div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Globe size={16} className="text-slate-400"/> {comment.NATIONALITY}</div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Calendar size={16} className="text-slate-400"/> {comment.COMMENTDATE}</div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Building size={16} className="text-slate-400"/> {comment.SOURCENAME}</div>
          </div>

          {comment.TAGS && comment.TAGS.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {comment.TAGS.map((tag, idx) => {
                const lower = tag.toLowerCase();
                let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
                if (lower.includes('temizlik') || lower.includes('housekeeping')) colorClass = 'bg-red-100 text-red-700 border-red-200';
                else if (lower.includes('restoran') || lower.includes('yemek')) colorClass = 'bg-green-100 text-green-700 border-green-200';
                else if (lower.includes('öneri')) colorClass = 'bg-blue-100 text-blue-700 border-blue-200';
                
                return (
                  <span key={idx} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colorClass}`}>
                    {tag}
                  </span>
                );
              })}
            </div>
          )}

          <div className="prose prose-slate max-w-none">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Misafir Yorumu</h4>
            <p className="text-slate-800 text-lg leading-relaxed">{comment.COMMENT}</p>
          </div>
        </div>

        {/* Middle: Action & Notes */}
        <div className="space-y-4">
          <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100">
            <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              Alınan Aksiyon
            </h4>
            <p className="text-emerald-900">{comment.ANSWER}</p>
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
