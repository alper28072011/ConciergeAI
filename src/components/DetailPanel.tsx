import React, { useState, useEffect, useRef } from 'react';
import { CommentData, UnifiedTimelineAction, LetterTemplate, CommentAnalytics, PhonebookContact } from '../types';
import { Sparkles, Printer, Download, Languages, User, Calendar, Globe, Building, CheckCircle2, MessageSquare, DoorOpen, Phone, Mail, ShieldCheck, MessageCircle, Smartphone, Save, Database, Brain, Plus, FileText, Send, Edit3, Trash2, X, PhoneCall } from 'lucide-react';
import { formatTRDate, parseElektraActions, buildUnifiedTimeline } from '../utils';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, where } from "firebase/firestore";
import { db } from '../firebase';
import { deleteCommentData } from '../services/firebaseService';
import { generateAIContent, analyzeCommentDeeply } from '../services/aiService';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { TimelineView } from './TimelineView';

interface DetailPanelProps {
  comment: CommentData | null;
}

export function DetailPanel({ comment }: DetailPanelProps) {
  const [timelineActions, setTimelineActions] = useState<UnifiedTimelineAction[]>([]);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  
  // Modals
  const [isAILetterModalOpen, setIsAILetterModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isManualNoteModalOpen, setIsManualNoteModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  
  // WhatsApp State
  const [selectedText, setSelectedText] = useState('');
  const [phonebook, setPhonebook] = useState<PhonebookContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectionPosition, setSelectionPosition] = useState<{ x: number, y: number } | null>(null);
  
  // AI Letter State
  const [targetLanguage, setTargetLanguage] = useState('İngilizce');
  const [generatedLetter, setGeneratedLetter] = useState('');
  const [translatedLetter, setTranslatedLetter] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [extraNotes, setExtraNotes] = useState('');
  const letterRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.action-dropdown-container')) {
        setShowActionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Template State
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templatePreview, setTemplatePreview] = useState('');
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);

  // Manual Note State
  const [manualActionText, setManualActionText] = useState('');

  // Preview Modal State
  const [selectedPreviewAction, setSelectedPreviewAction] = useState<UnifiedTimelineAction | null>(null);

  // Sentiment State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [sentimentScore, setSentimentScore] = useState<number | null>(null);
  const [deepAnalytics, setDeepAnalytics] = useState<CommentAnalytics | null>(null);
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);

  useEffect(() => {
    if (comment?.ID) {
      // Reset states
      setSentimentScore(null);
      setDeepAnalytics(null);
      setTimelineActions([]);
      setIsAILetterModalOpen(false);
      setIsTemplateModalOpen(false);
      setIsManualNoteModalOpen(false);
      setIsWhatsAppModalOpen(false);
      setSelectedText('');
      setSelectionPosition(null);
      setGeneratedLetter('');
      setTranslatedLetter('');
      setShowTranslation(false);
      setExtraNotes('');
      setSelectedTemplateId('');
      setTemplatePreview('');
      setManualActionText('');

      // Fetch Sentiment from agenda_notes (legacy or current)
      const fetchSentiment = async () => {
        try {
          const docRef = doc(db, "agenda_notes", String(comment.ID));
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSentimentScore(data.sentimentScore !== undefined ? data.sentimentScore : null);
          }
        } catch (error) {
          console.error("Error fetching sentiment:", error);
        }
      };
      fetchSentiment();

      // Fetch Deep Analytics
      const fetchDeepAnalytics = async () => {
        try {
          const docRef = doc(db, "comment_analytics", String(comment.ID));
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setDeepAnalytics(docSnap.data() as CommentAnalytics);
          } else {
            setDeepAnalytics(null);
          }
        } catch (error) {
          console.error("Error fetching deep analytics:", error);
        }
      };
      fetchDeepAnalytics();

      // Listen to comment_actions
      const actionsRef = collection(db, "comment_actions");
      const q = query(actionsRef, where("commentId", "==", String(comment.ID)));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fbActions: UnifiedTimelineAction[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fbActions.push({
            id: doc.id,
            date: data.date,
            description: data.description,
            type: data.type,
            source: 'App',
            content: data.content,
            commentId: data.commentId,
            resId: data.resId
          });
        });

        // Combine and sort using unified function
        const combinedActions = buildUnifiedTimeline(comment.ANSWER, fbActions);

        setTimelineActions(combinedActions);
      });

      return () => unsubscribe();
    }
  }, [comment?.ID, comment?.ANSWER]);

  // Fetch templates when template modal opens
  useEffect(() => {
    if (isTemplateModalOpen && templates.length === 0) {
      const fetchTemplates = async () => {
        setIsFetchingTemplates(true);
        try {
          const querySnapshot = await getDocs(collection(db, "letter_templates"));
          const fetchedTemplates: LetterTemplate[] = [];
          querySnapshot.forEach((doc) => {
            fetchedTemplates.push({ id: doc.id, ...doc.data() } as LetterTemplate);
          });
          setTemplates(fetchedTemplates);
        } catch (error) {
          console.error("Error fetching templates:", error);
        } finally {
          setIsFetchingTemplates(false);
        }
      };
      fetchTemplates();
    }
  }, [isTemplateModalOpen, templates.length]);

  // Handle template selection
  useEffect(() => {
    if (selectedTemplateId && comment) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        // Find the content for the selected language, fallback to first available
        const content = template.contents[targetLanguage] || Object.values(template.contents)[0] || '';
        
        // Merge variables
        let merged = content;
        merged = merged.replace(/{{GUESTNAMES}}/g, 'Misafir');
        merged = merged.replace(/{{ROOMNO}}/g, comment.ROOMNO || '');
        merged = merged.replace(/{{CHECKIN}}/g, formatTRDate(comment.CHECKIN || ''));
        merged = merged.replace(/{{CHECKOUT}}/g, formatTRDate(comment.CHECKOUT || ''));
        merged = merged.replace(/{{HOTELNAME}}/g, comment.COMMENTSOURCEID_NAME || 'Otelimiz');
        
        setTemplatePreview(merged);
      }
    } else {
      setTemplatePreview('');
    }
  }, [selectedTemplateId, targetLanguage, comment, templates]);

  // Fetch phonebook for WhatsApp routing
  useEffect(() => {
    const q = query(collection(db, 'phonebook'), orderBy('fullName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactList: PhonebookContact[] = [];
      snapshot.forEach((doc) => {
        contactList.push({ id: doc.id, ...doc.data() } as PhonebookContact);
      });
      setPhonebook(contactList);
    });
    return () => unsubscribe();
  }, []);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 0) {
      setSelectedText(text);
      
      // Get position for floating button
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (rect) {
        setSelectionPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + window.scrollY - 40
        });
      }
    } else {
      // Don't clear immediately to allow clicking the button
      // We'll clear when clicking elsewhere
    }
  };

  const handleSendWhatsApp = async () => {
    const contact = phonebook.find(c => c.id === selectedContactId);
    if (!contact || !comment) return;

    const message = `🚨 *Misafir Geri Bildirimi* 🚨
*Oda:* ${comment.ROOMNO || 'N/A'}
*Misafir:* Misafir
*Departman:* ${contact.department}

📌 *Odaklanılacak Alan:*
"_${selectedText}_"

*Yorumun Tamamı:*
${comment.COMMENT}`;

    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${contact.phoneNumber}?text=${encodedText}`;
    
    window.open(whatsappUrl, '_blank');

    // Log to timeline
    await addActionToTimeline(
      `WhatsApp İletisi: ${contact.department} (${contact.fullName})`, 
      'whatsapp_sent', 
      `Vurgulanan: ${selectedText}`
    );

    setIsWhatsAppModalOpen(false);
    setSelectedText('');
    setSelectionPosition(null);
  };

  const addActionToTimeline = async (description: string, type: 'ai_letter' | 'template' | 'manual' | 'whatsapp_sent', content?: string) => {
    if (!comment?.ID) return;
    try {
      const actionsRef = collection(db, "comment_actions");
      await addDoc(actionsRef, {
        commentId: String(comment.ID),
        resId: comment.RESNAMEID_LOOKUP || '', // Save resId if available
        type,
        description,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        ...(content ? { content } : {})
      });
    } catch (error) {
      console.error("Error adding action:", error);
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    if (window.confirm('Bu aksiyonu silmek istediğinize emin misiniz?')) {
      try {
        await deleteDoc(doc(db, "comment_actions", actionId));
      } catch (error) {
        console.error("Error deleting action:", error);
        alert("Aksiyon silinirken bir hata oluştu.");
      }
    }
  };

  const handleDeepAnalyze = async () => {
    if (!comment?.COMMENT) {
      alert("Analiz edilecek yorum bulunamadı.");
      return;
    }

    setIsDeepAnalyzing(true);
    try {
      const result = await analyzeCommentDeeply(comment.COMMENT);
      
      const analyticsData: CommentAnalytics = {
        commentId: String(comment.ID),
        resId: String(comment.RESNAMEID_LOOKUP || ''),
        date: comment.COMMENTDATE || '',
        rawText: comment.COMMENT,
        overallScore: result.overallScore || 0,
        topics: result.topics || [],
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "comment_analytics", String(comment.ID)), analyticsData);
      setDeepAnalytics(analyticsData);
      
      // Also update the legacy sentiment score for compatibility
      const legacyScore = analyticsData.overallScore / 100;
      setSentimentScore(legacyScore);
      await setDoc(doc(db, "agenda_notes", String(comment.ID)), {
        sentimentScore: legacyScore,
        sentimentAnalysisDate: new Date().toISOString()
      }, { merge: true });

    } catch (error: any) {
      console.error("Deep analysis error:", error);
      alert("Derin analiz sırasında bir hata oluştu: " + (error.message || 'Bilinmeyen hata'));
    } finally {
      setIsDeepAnalyzing(false);
    }
  };

  const handleResetAnalysis = async () => {
    if (!comment?.ID) return;
    
    if (!window.confirm("Bu yoruma ait tüm analiz verilerini (Duygu Analizi, Derin Analiz, Aksiyonlar) veritabanından silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) {
      return;
    }

    setIsResetting(true);
    try {
      await deleteCommentData(String(comment.ID));
      
      // Clear local state
      setDeepAnalytics(null);
      setSentimentScore(null);
      
      alert("Analiz verileri başarıyla sıfırlandı.");
    } catch (error: any) {
      console.error("Error resetting analysis:", error);
      alert("Sıfırlama sırasında bir hata oluştu: " + (error.message || 'Bilinmeyen hata'));
    } finally {
      setIsResetting(false);
    }
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

    setIsAnalyzing(true);
    try {
      const prompt = `Aşağıdaki otel misafir yorumunu analiz et ve misafirin genel memnuniyetini 0 ile 1 arasında bir sayı olarak ver. 
        0: Tamamen memnuniyetsiz, 1: Tamamen memnun.
        Yanıtını kesinlikle aşağıdaki JSON formatında ver:
        { "score": 0.8 }
        
        Yorum:
        ${comment.COMMENT}`;

      let text = await generateAIContent(prompt, 'Duygu Analizi', 'sentimentAnalysis');

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
    } catch (error: any) {
      console.error("Sentiment analysis error:", error);
      alert("Duygu analizi sırasında bir hata oluştu: " + (error.message || 'Bilinmeyen hata'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateLetter = async () => {
    setIsGenerating(true);
    setGeneratedLetter('');
    setTranslatedLetter('');
    setShowTranslation(false);

    try {
      const prompt = `You are a professional 5-star hotel Guest Relations Manager / Concierge. Write a polite and professional letter to a guest.
Guest Name: Misafir
Nationality: ${comment?.NATIONALITY}
Room Number: ${comment?.ROOMNO}
Check-In: ${formatTRDate(comment?.CHECKIN || '')}
Check-Out: ${formatTRDate(comment?.CHECKOUT || '')}
Guest Comment: ${comment?.COMMENT}
Action Taken by Hotel: ${comment?.ANSWER}
Extra Notes from Staff: ${extraNotes}
Target Language: ${targetLanguage}

The letter should be empathetic, professional, and address the guest's feedback and the actions taken. Do not include placeholders, write the final letter. Format with appropriate paragraphs.`;

      const text = await generateAIContent(prompt, 'Mektup Üretimi', 'letterGeneration');
      const formattedText = text ? text.replace(/\n/g, '<br>') : 'Mektup oluşturulamadı (Boş yanıt).';
      setGeneratedLetter(formattedText);
    } catch (error: any) {
      console.error('Error generating letter:', error);
      let errorMessage = 'Mektup oluşturulurken bir hata oluştu.';
      if (error.message) errorMessage += `<br><br>Hata Detayı: ${error.message}`;
      setGeneratedLetter(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranslateLetter = async () => {
    if (translatedLetter) {
      setShowTranslation(!showTranslation);
      return;
    }

    setIsTranslating(true);
    try {
      // Strip HTML tags for the translation prompt to avoid confusing the AI
      const plainText = generatedLetter.replace(/<[^>]*>?/gm, '\n');
      const prompt = `Translate the following hotel guest letter to Turkish. Maintain the professional, 5-star hotel concierge tone.\n\n${plainText}`;
      const text = await generateAIContent(prompt, 'Mektup Çevirisi', 'translation');
      const formattedText = text ? text.replace(/\n/g, '<br>') : 'Çeviri yapılamadı.';
      setTranslatedLetter(formattedText);
      setShowTranslation(true);
    } catch (error: any) {
      console.error('Error translating letter:', error);
      alert('Çeviri sırasında bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!templatePreview.trim()) return;
    await addActionToTimeline(`Şablon Gönderildi: ${templates.find(t => t.id === selectedTemplateId)?.name}`, 'template', templatePreview);
    setIsTemplateModalOpen(false);
  };

  const handleAddManualAction = async () => {
    if (!manualActionText.trim()) return;
    await addActionToTimeline(manualActionText, 'manual');
    setManualActionText('');
    setIsManualNoteModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = (content: string) => {
    const element = document.createElement('div');
    element.className = 'ql-editor';
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(content);
    element.innerHTML = isHtml ? content : content.replace(/\n/g, '<br>');
    element.style.padding = '40px';
    element.style.fontFamily = 'serif';
    element.style.fontSize = '16px';
    element.style.lineHeight = '1.6';
    element.style.color = '#000';
    element.style.background = '#fff';
    
    const opt: any = {
      margin: 10,
      filename: `Misafir_Mektubu_${comment?.ROOMNO || 'Misafir'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handlePrintPreview = (content: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const isHtml = /<\/?[a-z][\s\S]*>/i.test(content);
      const htmlContent = isHtml ? content : content.replace(/\n/g, '<br>');
      printWindow.document.write(`
        <html>
          <head>
            <title>Yazdır</title>
            <style>
              body { font-family: serif; padding: 40px; line-height: 1.6; color: #000; }
              h1, h2, h3 { margin-top: 1em; margin-bottom: 0.5em; font-weight: bold; }
              p { margin-bottom: 1em; }
              ul, ol { margin-bottom: 1em; padding-left: 2em; }
              ul { list-style-type: disc; }
              ol { list-style-type: decimal; }
              strong { font-weight: bold; }
              em { font-style: italic; }
            </style>
          </head>
          <body>
            ${htmlContent}
            <script>
              window.onload = () => { window.print(); window.close(); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

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

  return (
    <div className="flex-1 bg-white flex h-full overflow-hidden">
      {/* Left Column: Guest Details & Comment */}
      <div className="w-2/3 overflow-y-auto p-6 space-y-6 border-r border-slate-200 print:w-full print:border-none print:p-0 print:overflow-visible">
        
        {/* Guest Details & Consents (Moved to Top) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm print:hidden">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={18} className="text-slate-500" />
              Misafir Detayları & İzinler
            </h4>
            {comment.GUESTID && <span className="text-xs font-mono text-slate-400">ID: {comment.GUESTID}</span>}
          </div>
          
          {comment.RESNAMEID_LOOKUP && (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Rezervasyon Bilgisi</h5>
              <p className="text-slate-800 font-medium text-lg">{comment.RESNAMEID_LOOKUP}</p>
            </div>
          )}

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

        {/* Comment Details */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 relative print:hidden">
          <div className="flex flex-wrap gap-4 mb-4 text-sm text-slate-600">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><User size={16} className="text-slate-400"/> <span className="font-medium text-slate-900">Misafir</span></div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Globe size={16} className="text-slate-400"/> {comment.NATIONALITY}</div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Calendar size={16} className="text-slate-400"/> {formatTRDate(comment.COMMENTDATE)}</div>
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Building size={16} className="text-slate-400"/> {comment.COMMENTSOURCEID_NAME}</div>
            {comment.ROOMNO && <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><DoorOpen size={16} className="text-slate-400"/> {comment.ROOMNO}</div>}
            {comment.PHONE && <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Phone size={16} className="text-slate-400"/> {comment.PHONE}</div>}
            {comment.EMAIL && <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><Mail size={16} className="text-slate-400"/> {comment.EMAIL}</div>}
          </div>

          <div className="prose prose-slate max-w-none">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Orijinal Misafir Yorumu</h4>
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
                  onClick={handleDeepAnalyze}
                  disabled={isDeepAnalyzing || isResetting}
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeepAnalyzing ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-600 border-t-transparent" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {deepAnalytics !== null ? 'Yeniden Derin Analiz Et' : '✨ Derin Yapay Zeka Analizi Yap'}
                </button>
                {(deepAnalytics !== null || sentimentScore !== null) && (
                  <button
                    onClick={handleResetAnalysis}
                    disabled={isResetting}
                    className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isResetting ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-red-600 border-t-transparent" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Analizi Sıfırla
                  </button>
                )}
              </div>
            </div>
            <p 
              className="text-slate-800 text-lg leading-relaxed selection:bg-emerald-100 selection:text-emerald-900"
              onMouseUp={handleTextSelection}
            >
              {comment.COMMENT}
            </p>
            
            {/* Floating WhatsApp Button */}
            {selectionPosition && selectedText && (
              <div 
                className="fixed z-[100] animate-in fade-in zoom-in duration-200"
                style={{ left: selectionPosition.x, top: selectionPosition.y, transform: 'translateX(-50%)' }}
              >
                <button
                  onClick={() => setIsWhatsAppModalOpen(true)}
                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-full shadow-xl flex items-center gap-2 text-xs font-bold hover:bg-emerald-700 transition-all hover:scale-105"
                >
                  <MessageCircle size={14} />
                  WhatsApp ile İlet
                </button>
              </div>
            )}
            
            {/* Deep Analytics Tag Cloud */}
            {deepAnalytics && deepAnalytics.topics && deepAnalytics.topics.length > 0 && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Derin Analiz Etiketleri</div>
                <div className="flex flex-wrap gap-2">
                  {deepAnalytics.topics.map((topic, idx) => (
                    <span 
                      key={idx} 
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border shadow-sm ${
                        topic.score > 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        topic.score >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}
                      title={`${topic.department} - ${topic.sentiment}`}
                    >
                      #{topic.topic} %{topic.score} {topic.score > 70 ? '🟩' : topic.score >= 40 ? '🟨' : '🟥'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Grouped Details Badges */}
            {comment.details && comment.details.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {comment.details.map((detail, dIdx) => (
                  <span 
                    key={dIdx} 
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      detail.type === 'Positive' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      detail.type === 'Negative' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {detail.depName} {detail.groupName ? `- ${detail.groupName}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Timeline & Case Management */}
      <div className="w-1/3 flex flex-col h-full bg-slate-50 print:hidden relative border-l border-slate-200">
        <div className="p-5 border-b border-slate-200 bg-white flex justify-between items-center sticky top-0 z-10">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Database size={18} className="text-slate-500" />
            Vaka Takibi
          </h3>
          
          <div className="relative action-dropdown-container">
            <button 
              onClick={() => setShowActionDropdown(!showActionDropdown)}
              className="flex items-center gap-1.5 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-md"
            >
              <Plus size={16} />
              Aksiyon Ekle
            </button>

            {showActionDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                <div className="p-2 space-y-1">
                  <button 
                    onClick={() => {
                      setShowActionDropdown(false);
                      setIsTemplateModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-emerald-50 flex items-center gap-3 transition-colors group"
                  >
                    <div className="bg-emerald-100 p-1.5 rounded-md group-hover:bg-emerald-200 transition-colors">
                      <FileText size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-800 text-sm">Şablon Hazırla</div>
                      <div className="text-[10px] text-slate-500">Hazır şablonlardan yanıt seçin</div>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setShowActionDropdown(false);
                      setIsAILetterModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-purple-50 flex items-center gap-3 transition-colors group"
                  >
                    <div className="bg-purple-100 p-1.5 rounded-md group-hover:bg-purple-200 transition-colors">
                      <Sparkles size={16} className="text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-800 text-sm">AI Mektup Üret</div>
                      <div className="text-[10px] text-slate-500">Yapay zeka ile kişiselleştirin</div>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setShowActionDropdown(false);
                      setIsManualNoteModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-orange-50 flex items-center gap-3 transition-colors group"
                  >
                    <div className="bg-orange-100 p-1.5 rounded-md group-hover:bg-orange-200 transition-colors">
                      <Edit3 size={16} className="text-orange-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-800 text-sm">Manuel Not Ekle</div>
                      <div className="text-[10px] text-slate-500">Özel bir durumu kaydedin</div>
                    </div>
                  </button>

                  <button 
                    onClick={() => {
                      setShowActionDropdown(false);
                      setIsWhatsAppModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-emerald-50 flex items-center gap-3 transition-colors group"
                  >
                    <div className="bg-emerald-100 p-1.5 rounded-md group-hover:bg-emerald-200 transition-colors">
                      <MessageCircle size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-800 text-sm">WhatsApp Yönlendirme</div>
                      <div className="text-[10px] text-slate-500">Departmana anında iletin</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <TimelineView 
            actions={timelineActions} 
            onDeleteAction={handleDeleteAction} 
            onPreviewAction={setSelectedPreviewAction} 
          />
        </div>
      </div>

      {/* MODALS */}

      {/* AI Letter Modal */}
      {isAILetterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Sparkles size={18} className="text-purple-500" />
                AI Mektup Oluştur
              </h3>
              <button onClick={() => setIsAILetterModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Ekstra Notlar (AI'a Talimatlar)</label>
                  <textarea
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    placeholder="Örn: Odaya meyve sepeti ve şarap gönderildiğini de belirt..."
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none h-20 text-sm"
                  />
                </div>
                
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Hedef Dil</label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="İngilizce">İngilizce</option>
                      <option value="Almanca">Almanca</option>
                      <option value="Rusça">Rusça</option>
                      <option value="Türkçe">Türkçe</option>
                      <option value="Fransızca">Fransızca</option>
                    </select>
                  </div>
                  <button
                    onClick={handleGenerateLetter}
                    disabled={isGenerating}
                    className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-70"
                  >
                    {isGenerating ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> : <Sparkles size={18} />}
                    {isGenerating ? 'Oluşturuluyor...' : 'Üret'}
                  </button>
                </div>
              </div>

              {generatedLetter && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-700">Oluşturulan Mektup</h4>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleTranslateLetter}
                        disabled={isTranslating}
                        className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        <Languages size={16} />
                        {isTranslating ? 'Çevriliyor...' : showTranslation ? 'Orijinal Dilde Gör' : 'Kendi Dilimde Gör (Çevir)'}
                      </button>
                      
                      <button 
                        onClick={() => handleDownloadPDF(showTranslation ? translatedLetter : generatedLetter)}
                        className="flex items-center gap-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Download size={14} /> PDF
                      </button>
                      <button onClick={handlePrint} className="flex items-center gap-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                        <Printer size={14} /> Yazdır
                      </button>
                      <button 
                        onClick={async () => {
                          await addActionToTimeline('AI Mektup Oluşturuldu', 'ai_letter', showTranslation ? translatedLetter : generatedLetter);
                          setIsAILetterModalOpen(false);
                        }}
                        className="flex items-center gap-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg transition-colors"
                      >
                        <Save size={14} /> Sisteme Kaydet
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <ReactQuill
                      theme="snow"
                      value={showTranslation ? translatedLetter : generatedLetter}
                      onChange={(val) => {
                        if (showTranslation) setTranslatedLetter(val);
                        else setGeneratedLetter(val);
                      }}
                      className="h-[300px] pb-12 border-none font-serif"
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'color': [] }, { 'background': [] }],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                          ['link', 'clean']
                        ]
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-green-500" />
                Şablon Mesaj Gönder
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isFetchingTemplates ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent" />
                </div>
              ) : (
                <>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Şablon Seçin</label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="">-- Şablon Seç --</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-48">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Dil</label>
                      <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="İngilizce">İngilizce</option>
                        <option value="Türkçe">Türkçe</option>
                        <option value="Almanca">Almanca</option>
                        <option value="Rusça">Rusça</option>
                      </select>
                    </div>
                  </div>

                  {templatePreview && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-700">Mesaj Önizleme (Düzenlenebilir)</label>
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <ReactQuill
                          theme="snow"
                          value={templatePreview}
                          onChange={setTemplatePreview}
                          className="h-[300px] pb-12 border-none font-sans"
                          modules={{
                            toolbar: [
                              [{ 'header': [1, 2, 3, false] }],
                              ['bold', 'italic', 'underline', 'strike'],
                              [{ 'color': [] }, { 'background': [] }],
                              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                              ['link', 'clean']
                            ]
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                İptal
              </button>
              <button
                onClick={handleSendTemplate}
                disabled={!templatePreview.trim()}
                className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={16} />
                Gönder ve Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Routing Modal */}
      {isWhatsAppModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <MessageCircle size={18} className="text-emerald-600" />
                WhatsApp Departman Yönlendirme
              </h3>
              <button onClick={() => setIsWhatsAppModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Kime İletilecek?</label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Sorumlu Seçin --</option>
                  {phonebook.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.department} - {contact.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {selectedText && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vurgulanan Metin</label>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 text-sm italic">
                    "{selectedText}"
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mesaj Önizleme</label>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono whitespace-pre-wrap text-slate-600">
                  {`🚨 *Misafir Geri Bildirimi* 🚨\n*Oda:* ${comment?.ROOMNO || 'N/A'}\n*Misafir:* Misafir\n*Departman:* ${phonebook.find(c => c.id === selectedContactId)?.department || '...'}\n\n📌 *Odaklanılacak Alan:*\n"_${selectedText || '...'}_"\n\n*Yorumun Tamamı:*\n${comment?.COMMENT}`}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                İptal
              </button>
              <button
                onClick={handleSendWhatsApp}
                disabled={!selectedContactId}
                className="px-6 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={16} />
                Gönder ve Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Action Modal */}
      {isManualNoteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Edit3 size={18} className="text-orange-500" />
                Manuel Not / Aksiyon Ekle
              </h3>
              <button onClick={() => setIsManualNoteModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <textarea
                value={manualActionText}
                onChange={(e) => setManualActionText(e.target.value)}
                placeholder="Örn: Odaya meyve gönderildi, misafirle görüşüldü..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none h-32 text-sm"
              />
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsManualNoteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                İptal
              </button>
              <button
                onClick={handleAddManualAction}
                disabled={!manualActionText.trim()}
                className="px-6 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedPreviewAction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-500" />
                Döküman Önizleme
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => handleDownloadPDF(selectedPreviewAction.content || '')}
                  className="flex items-center gap-2 text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <Download size={14} /> PDF İndir
                </button>
                <button 
                  onClick={() => handlePrintPreview(selectedPreviewAction.content || '')}
                  className="flex items-center gap-2 text-sm font-medium bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <Printer size={14} /> Yazdır
                </button>
                <button onClick={() => setSelectedPreviewAction(null)} className="text-slate-400 hover:text-slate-600 p-1 ml-2">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50">
              <div className="bg-white p-8 rounded-xl shadow-sm min-h-[500px] border border-slate-200 font-serif ql-snow">
                <div 
                  className="ql-editor p-0"
                  dangerouslySetInnerHTML={{ 
                    __html: /<\/?[a-z][\s\S]*>/i.test(selectedPreviewAction.content || '') 
                      ? selectedPreviewAction.content || '' 
                      : (selectedPreviewAction.content || '').replace(/\n/g, '<br>') 
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
