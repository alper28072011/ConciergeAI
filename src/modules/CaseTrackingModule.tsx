import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Filter, MessageSquare, Clock, CheckCircle2, AlertCircle, Send, X, User, Briefcase, FileText, Printer, Save, Trash2, Edit3, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { CaseTracker, CaseAction, GuestData, ApiSettings } from '../types';
import { listenToCases, createCase, updateCaseStatus, addCaseAction } from '../services/firebaseService';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { generateAIContent } from '../services/aiService';
import { executeElektraQuery } from '../services/api';
import { buildDynamicPayload, formatTRDate, formatHtmlContent } from '../utils';
import { auth, db } from '../firebase';
import ReactQuillModule from 'react-quill-new';
const ReactQuill = (ReactQuillModule as any).default || ReactQuillModule;
import 'react-quill-new/dist/quill.snow.css';

export function CaseTrackingModule() {
  const [cases, setCases] = useState<CaseTracker[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('open');
  
  // New Case Modal State
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [newCaseRoom, setNewCaseRoom] = useState('');
  const [newCaseGuest, setNewCaseGuest] = useState('');
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  
  // Smart Selection State
  const [isFetchingGuests, setIsFetchingGuests] = useState(false);
  const [inHouseGuests, setInHouseGuests] = useState<GuestData[]>([]);
  const [showGuestDropdown, setShowGuestDropdown] = useState(false);
  const [guestSearchTerm, setGuestSearchTerm] = useState('');

  // Action State
  const [newActionText, setNewActionText] = useState('');
  const [isAddingAction, setIsAddingAction] = useState(false);

  // Edit Action State
  const [editingAction, setEditingAction] = useState<CaseAction | null>(null);
  const [editActionDate, setEditActionDate] = useState('');
  const [editActionTime, setEditActionTime] = useState('');
  const [editActionText, setEditActionText] = useState('');
  const [editActionContent, setEditActionContent] = useState('');

  // Edit Initial Case State
  const [isEditingInitialCase, setIsEditingInitialCase] = useState(false);
  const [editInitialCaseDesc, setEditInitialCaseDesc] = useState('');

  // AI State
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [caseSummary, setCaseSummary] = useState('');
  const [isAILetterFormOpen, setIsAILetterFormOpen] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('Turkish');
  const [extraNotes, setExtraNotes] = useState('');
  const [isGeneratingAILetter, setIsGeneratingAILetter] = useState(false);
  const [generatedAILetter, setGeneratedAILetter] = useState('');
  const [translatedAILetter, setTranslatedAILetter] = useState('');
  const [showAITranslation, setShowAITranslation] = useState(false);
  const [isTranslatingAILetter, setIsTranslatingAILetter] = useState(false);
  const [isSavingLetter, setIsSavingLetter] = useState(false);
  const [selectedPreviewAction, setSelectedPreviewAction] = useState<CaseAction | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = listenToCases((fetchedCases) => {
      setCases(fetchedCases);
    });
    return () => unsubscribe();
  }, []);

  const selectedCase = cases.find(c => c.id === selectedCaseId);

  const filteredCases = cases.filter(c => {
    const matchesSearch = c.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ? true : c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fetchInHouseGuests = async () => {
    setIsFetchingGuests(true);
    try {
      const savedSettings = localStorage.getItem('hotelApiSettings');
      if (!savedSettings) throw new Error('API ayarları bulunamadı.');
      const settings: ApiSettings = JSON.parse(savedSettings);
      
      if (!settings.inhousePayloadTemplate) throw new Error('Konaklayanlar şablonu eksik.');
      
      const guestPayload = buildDynamicPayload(settings.inhousePayloadTemplate, settings, {});
      if (guestPayload.Select && Array.isArray(guestPayload.Select)) {
        const requiredFields = ['ROOMNO', 'GUESTNAMES', 'RESID'];
        requiredFields.forEach(field => {
          if (!guestPayload.Select.includes(field)) guestPayload.Select.push(field);
        });
      }
      guestPayload.Paging = { ItemsPerPage: 500, Current: 1 };
      
      const guestRes = await executeElektraQuery(guestPayload);
      setInHouseGuests(Array.isArray(guestRes) ? guestRes : []);
      setShowGuestDropdown(true);
    } catch (error: any) {
      console.error('Error fetching guests:', error);
      alert('Misafirler çekilirken hata oluştu: ' + error.message);
    } finally {
      setIsFetchingGuests(false);
    }
  };

  useEffect(() => {
    if (isNewCaseModalOpen) {
      fetchInHouseGuests();
    } else {
      setInHouseGuests([]);
      setShowGuestDropdown(false);
      setGuestSearchTerm('');
      setNewCaseRoom('');
      setNewCaseGuest('');
      setNewCaseDesc('');
    }
  }, [isNewCaseModalOpen]);

  const handleCreateCase = async () => {
    if (!newCaseRoom.trim() || !newCaseGuest.trim() || !newCaseDesc.trim()) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }
    setIsCreatingCase(true);
    try {
      const newId = await createCase({
        roomNumber: newCaseRoom,
        guestName: newCaseGuest,
        description: newCaseDesc,
        status: 'open',
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Sistem Kullanıcısı'
      });
      setIsNewCaseModalOpen(false);
      setNewCaseRoom('');
      setNewCaseGuest('');
      setNewCaseDesc('');
      setSelectedCaseId(newId);
    } catch (error) {
      console.error('Error creating case:', error);
      alert('Vaka oluşturulurken hata oluştu.');
    } finally {
      setIsCreatingCase(false);
    }
  };

  const handleAddAction = async () => {
    if (!selectedCase || !newActionText.trim()) return;
    setIsAddingAction(true);
    try {
      await addCaseAction(selectedCase.id, {
        date: new Date().toISOString(),
        actionText: newActionText,
        performedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Sistem Kullanıcısı'
      }, selectedCase.actions || []);
      setNewActionText('');
    } catch (error) {
      console.error('Error adding action:', error);
      alert('Aksiyon eklenirken hata oluştu.');
    } finally {
      setIsAddingAction(false);
    }
  };

  const handleDeleteCase = async (id: string) => {
    if (window.confirm('Bu vakayı tamamen silmek istediğinize emin misiniz?')) {
      try {
        await deleteDoc(doc(db, 'cases', id));
        if (selectedCaseId === id) setSelectedCaseId(null);
      } catch (error) {
        console.error('Error deleting case:', error);
        alert('Vaka silinirken hata oluştu.');
      }
    }
  };

  const handleDeleteAction = async (actionId: string) => {
    if (!selectedCase) return;
    if (window.confirm('Bu aksiyonu silmek istediğinize emin misiniz?')) {
      try {
        const updatedActions = selectedCase.actions.filter(a => a.id !== actionId);
        await updateDoc(doc(db, 'cases', selectedCase.id), { actions: updatedActions });
      } catch (error) {
        console.error('Error deleting action:', error);
        alert('Aksiyon silinirken hata oluştu.');
      }
    }
  };

  const handleMoveAction = async (index: number, direction: 'up' | 'down') => {
    if (!selectedCase) return;
    const newActions = [...selectedCase.actions];
    if (direction === 'up' && index > 0) {
      [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
    } else if (direction === 'down' && index < newActions.length - 1) {
      [newActions[index + 1], newActions[index]] = [newActions[index], newActions[index + 1]];
    } else {
      return;
    }
    try {
      await updateDoc(doc(db, 'cases', selectedCase.id), { actions: newActions });
    } catch (error) {
      console.error('Error moving action:', error);
      alert('Sıralama değiştirilirken hata oluştu.');
    }
  };

  const openEditActionModal = (action: CaseAction) => {
    setEditingAction(action);
    const dateObj = new Date(action.date);
    const localDate = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    setEditActionDate(localDate);
    setEditActionTime(dateObj.toTimeString().split(' ')[0].slice(0, 5));
    setEditActionText(action.actionText);
    setEditActionContent(action.content || '');
  };

  const handleSaveEditAction = async () => {
    if (!selectedCase || !editingAction) return;
    try {
      const newDate = new Date(`${editActionDate}T${editActionTime}`).toISOString();
      const updatedActions = selectedCase.actions.map(a => {
        if (a.id === editingAction.id) {
          const updatedAction = { ...a, date: newDate, actionText: editActionText };
          if (a.type === 'letter') {
            updatedAction.content = editActionContent;
          }
          return updatedAction;
        }
        return a;
      });
      await updateDoc(doc(db, 'cases', selectedCase.id), { actions: updatedActions });
      setEditingAction(null);
    } catch (error) {
      console.error('Error updating action:', error);
      alert('Aksiyon güncellenirken hata oluştu.');
    }
  };

  const openEditInitialCaseModal = () => {
    if (!selectedCase) return;
    setEditInitialCaseDesc(selectedCase.description);
    setIsEditingInitialCase(true);
  };

  const handleSaveInitialCase = async () => {
    if (!selectedCase) return;
    try {
      await updateDoc(doc(db, 'cases', selectedCase.id), { description: editInitialCaseDesc });
      setIsEditingInitialCase(false);
    } catch (error) {
      console.error('Error updating initial case:', error);
      alert('Vaka açıklaması güncellenirken hata oluştu.');
    }
  };

  const handleToggleStatus = async () => {
    if (!selectedCase) return;
    const newStatus = selectedCase.status === 'open' ? 'resolved' : 'open';
    try {
      await updateCaseStatus(selectedCase.id, newStatus);
      // Also add an action for status change
      await addCaseAction(selectedCase.id, {
        date: new Date().toISOString(),
        actionText: `Vaka durumu "${newStatus === 'resolved' ? 'Çözüldü' : 'Açık'}" olarak değiştirildi.`,
        performedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Sistem Kullanıcısı'
      }, selectedCase.actions || []);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Durum güncellenirken hata oluştu.');
    }
  };

  const handleSummarizeCase = async () => {
    if (!selectedCase) return;
    setIsGeneratingSummary(true);
    setCaseSummary('');
    try {
      const prompt = `Aşağıdaki otel misafir vakasını ve yapılan işlemleri özetle. Profesyonel bir dil kullan.
Vaka: ${selectedCase.description}
Misafir: ${selectedCase.guestName} (Oda: ${selectedCase.roomNumber})
Aksiyonlar:
${selectedCase.actions?.map(a => `- ${new Date(a.date).toLocaleString('tr-TR')}: ${a.actionText}`).join('\n') || 'Henüz aksiyon yok.'}`;
      
      const summary = await generateAIContent(prompt, 'Vaka Özeti', 'caseSummary');
      setCaseSummary(summary ? summary.replace(/\n/g, '<br>') : 'Özet oluşturulamadı.');
    } catch (error: any) {
      console.error('Error summarizing case:', error);
      setCaseSummary('Özet oluşturulurken hata oluştu: ' + error.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGenerateAILetter = async () => {
    if (!selectedCase) return;
    setIsGeneratingAILetter(true);
    setGeneratedAILetter('');
    setTranslatedAILetter('');
    setShowAITranslation(false);
    try {
      const prompt = `You are a professional 5-star hotel Guest Relations Manager / Concierge. Write a polite, empathetic, and solution-oriented letter to a guest regarding a recent case/issue.
Guest Name: ${selectedCase.guestName}
Room Number: ${selectedCase.roomNumber}
Case Description: ${selectedCase.description}
Actions Taken:
${selectedCase.actions?.map(a => `- ${a.actionText}`).join('\n') || 'No actions taken yet.'}
Extra Notes/Instructions: ${extraNotes}
Target Language: ${targetLanguage}

CRITICAL INSTRUCTIONS:
1. Start the letter by addressing the guest by their name (e.g., "Dear ${selectedCase.guestName}," translated to the Target Language).
2. Acknowledge the issue (${selectedCase.description}) and apologize for any inconvenience caused.
3. Briefly mention the actions taken to resolve the issue, but DO NOT list them hour-by-hour or use timestamps. Summarize them professionally.
4. At the end of the letter, include a sentence stating that they can contact the Guest Relations team in any situation, translated to the Target Language.
5. Sign off the letter with "Guest Relations Team" translated to the Target Language.
6. The tone must be highly professional, empathetic, and solution-oriented. Make the guest feel we genuinely care about their comfort.
7. Do not include placeholders, write the final letter. Format with appropriate HTML paragraphs (<p>, <br>, <b>).`;
      
      const letter = await generateAIContent(prompt, 'Vaka Mektubu', 'caseLetter');
      const formattedText = letter ? letter.replace(/\n/g, '<br>') : 'Mektup oluşturulamadı (Boş yanıt).';
      setGeneratedAILetter(formattedText);
    } catch (error: any) {
      console.error('Error generating letter:', error);
      setGeneratedAILetter('Mektup oluşturulurken hata oluştu: ' + error.message);
    } finally {
      setIsGeneratingAILetter(false);
    }
  };

  const handleTranslateAILetter = async () => {
    if (translatedAILetter) {
      setShowAITranslation(!showAITranslation);
      return;
    }

    setIsTranslatingAILetter(true);
    try {
      const plainText = generatedAILetter.replace(/<[^>]*>?/gm, '\n');
      const prompt = `Translate the following hotel guest letter to Turkish. Maintain the professional, 5-star hotel concierge tone.\n\n${plainText}`;
      const text = await generateAIContent(prompt, 'Mektup Çevirisi', 'translation');
      const formattedText = text ? text.replace(/\n/g, '<br>') : 'Çeviri yapılamadı.';
      setTranslatedAILetter(formattedText);
      setShowAITranslation(true);
    } catch (error) {
      console.error('Translation error:', error);
      alert('Çeviri sırasında bir hata oluştu.');
    } finally {
      setIsTranslatingAILetter(false);
    }
  };

  const handleSaveLetter = async () => {
    if (!selectedCase || !generatedAILetter.trim()) return;
    setIsSavingLetter(true);
    try {
      await addCaseAction(selectedCase.id, {
        date: new Date().toISOString(),
        actionText: 'Yapay zeka ile mektup oluşturuldu.',
        performedBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Sistem Kullanıcısı',
        type: 'letter',
        content: generatedAILetter
      }, selectedCase.actions || []);
      setGeneratedAILetter('');
      alert('Mektup başarıyla kaydedildi.');
    } catch (error) {
      console.error('Error saving letter:', error);
      alert('Mektup kaydedilirken hata oluştu.');
    } finally {
      setIsSavingLetter(false);
    }
  };

  const handlePrintLetter = (content: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      // VERİ TEMİZLEME (Kırılmaz Boşlukları ve Gizli Karakterleri Temizle)
      let safeContent = formatHtmlContent(content);
      safeContent = safeContent.replace(/&nbsp;/g, ' '); 
      safeContent = safeContent.replace(/\u200B/g, ''); 
      safeContent = safeContent.replace(/&shy;/g, '');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="tr">
          <head>
            <title>Mektup Yazdır</title>
            <meta charset="utf-8">
            <style>
              @page { size: A4 portrait; margin: 70mm 20mm 20mm 20mm; }
              body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: black; background: white; margin: 0; padding: 0; }
              
              .document-content { width: 170mm !important; max-width: 170mm !important; margin: 0 auto; text-align: left; }
              
              /* Kelime Kesilmesini Engelle (Ama Hizalamaya Dokunma!) */
              .document-content * {
                word-wrap: break-word !important;
                overflow-wrap: break-word !important;
                word-break: normal !important;
                hyphens: none !important;
              }

              /* DEV BOŞLUKLARI ENGELLEYEN PARAGRAF MOTORU */
              .document-content p {
                margin: 0 !important; /* Quill her satırı P yaptığı için margin SIFIR olmalı */
                padding: 0 !important;
                min-height: 1em; /* Boş enter satırlarının kaybolmaması için */
              }

              /* REACT QUILL HİZALAMA (ALIGN) DESTEĞİ */
              .ql-align-center { text-align: center !important; }
              .ql-align-right { text-align: right !important; }
              .ql-align-justify { text-align: justify !important; }

              /* Liste ve Girinti Desteği */
              .ql-indent-1 { padding-left: 3em !important; }
              .ql-indent-2 { padding-left: 6em !important; }
              .document-content ul, .document-content ol { margin: 0 !important; padding-left: 24pt !important; }
              .document-content li { margin-bottom: 2pt !important; }
            </style>
          </head>
          <body>
            <div class="document-content">
              ${safeContent}
            </div>
            <script>
              window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 300); };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      alert("Lütfen açılır pencerelere (pop-up) izin verin.");
    }
  };

  const filteredGuests = inHouseGuests.filter(g => 
    (g.GUESTNAMES || '').toLowerCase().includes(guestSearchTerm.toLowerCase()) ||
    (g.ROOMNO || '').toLowerCase().includes(guestSearchTerm.toLowerCase())
  );

  return (
    <div className="flex w-full h-full bg-slate-50 overflow-hidden">
      {/* Left Column: Case List */}
      <div className="w-[400px] bg-white border-r border-slate-200 flex flex-col shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-6 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 tracking-tight">
              <Briefcase className="text-emerald-600" size={24} />
              Vaka Takibi
            </h2>
            <button 
              onClick={() => setIsNewCaseModalOpen(true)}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
              title="Yeni Vaka Ekle"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Oda, İsim veya Vaka ara..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setStatusFilter('all')}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-colors ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Tümü
            </button>
            <button 
              onClick={() => setStatusFilter('open')}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-colors ${statusFilter === 'open' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
            >
              Açık
            </button>
            <button 
              onClick={() => setStatusFilter('resolved')}
              className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-colors ${statusFilter === 'resolved' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
            >
              Çözüldü
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/50">
          {filteredCases.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <AlertCircle size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">Vaka bulunamadı.</p>
            </div>
          ) : (
            filteredCases.map(c => (
              <div 
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${selectedCaseId === c.id ? 'bg-white border-emerald-500 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500' : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                      {c.roomNumber}
                    </span>
                    <span className="text-sm font-bold text-slate-800 line-clamp-1">{c.guestName}</span>
                  </div>
                  {c.status === 'open' ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"></span>
                  ) : (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  )}
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                  {c.description}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(c.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={12} />
                    {c.actions?.length || 0} İşlem
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Case Details & Timeline */}
      <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden relative">
        {selectedCase ? (
          <>
            {/* Header */}
            <div className="bg-white px-8 py-6 border-b border-slate-200 shrink-0 shadow-sm z-10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-lg font-bold bg-slate-100 text-slate-800 px-3 py-1 rounded-lg border border-slate-200">
                      {selectedCase.roomNumber}
                    </span>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{selectedCase.guestName}</h2>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${selectedCase.status === 'open' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                      {selectedCase.status === 'open' ? 'Açık Vaka' : 'Çözüldü'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-3xl">
                    <span className="font-semibold text-slate-700 mr-2">Vaka Tanımı:</span>
                    {selectedCase.description}
                  </p>
                  <div className="flex items-center gap-4 mt-4 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <User size={14} />
                      Açan: {selectedCase.createdBy}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {new Date(selectedCase.createdAt).toLocaleString('tr-TR')}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={handleToggleStatus}
                      className={`flex-1 px-4 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${selectedCase.status === 'open' ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md' : 'bg-amber-500 text-white hover:bg-amber-600 hover:shadow-md'}`}
                    >
                      {selectedCase.status === 'open' ? (
                        <><CheckCircle2 size={16} /> Çözüldü Olarak İşaretle</>
                      ) : (
                        <><AlertCircle size={16} /> Yeniden Aç</>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteCase(selectedCase.id)}
                      className="px-4 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      title="Vakayı Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSummarizeCase}
                      disabled={isGeneratingSummary}
                      className="flex-1 px-3 py-2 bg-purple-50 text-purple-700 text-xs font-bold rounded-lg hover:bg-purple-100 transition-colors border border-purple-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isGeneratingSummary ? <span className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></span> : <FileText size={14} />}
                      Özetle
                    </button>
                    <button 
                      onClick={() => setIsAILetterFormOpen(!isAILetterFormOpen)}
                      className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-colors border flex items-center justify-center gap-1.5 ${isAILetterFormOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100'}`}
                    >
                      <MessageSquare size={14} />
                      AI Mektup
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Outputs */}
              <AnimatePresence>
                {(caseSummary || isAILetterFormOpen) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 flex flex-col gap-4"
                  >
                    {caseSummary && (
                      <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 relative">
                        <button onClick={() => setCaseSummary('')} className="absolute top-2 right-2 text-purple-400 hover:text-purple-600"><X size={16} /></button>
                        <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={14} /> Vaka Özeti</h4>
                        <div className="text-sm text-purple-900 leading-relaxed" dangerouslySetInnerHTML={{ __html: caseSummary }} />
                      </div>
                    )}
                    {isAILetterFormOpen && (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 relative">
                        <button onClick={() => { setIsAILetterFormOpen(false); setGeneratedAILetter(''); }} className="absolute top-4 right-4 text-blue-400 hover:text-blue-600 z-10"><X size={16} /></button>
                        <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-4 flex items-center gap-1.5"><MessageSquare size={16} /> AI Özür/Bilgi Mektubu Asistanı</h4>
                        
                        {!generatedAILetter ? (
                          <div className="space-y-4">
                            <div className="flex gap-4">
                              <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Hedef Dil</label>
                                <select
                                  value={targetLanguage}
                                  onChange={(e) => setTargetLanguage(e.target.value)}
                                  className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-white"
                                >
                                  <option value="English">İngilizce (English)</option>
                                  <option value="Turkish">Türkçe (Turkish)</option>
                                  <option value="German">Almanca (Deutsch)</option>
                                  <option value="Russian">Rusça (Русский)</option>
                                  <option value="French">Fransızca (Français)</option>
                                  <option value="Arabic">Arapça (العربية)</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ekstra Talimatlar (Opsiyonel)</label>
                              <textarea
                                value={extraNotes}
                                onChange={(e) => setExtraNotes(e.target.value)}
                                placeholder="Örn: Odaya meyve sepeti ve şarap gönderildiğini de belirt..."
                                className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none h-20 text-sm bg-white"
                              />
                            </div>
                            <div className="flex justify-end pt-2">
                              <button 
                                onClick={handleGenerateAILetter}
                                disabled={isGeneratingAILetter}
                                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                              >
                                {isGeneratingAILetter ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <MessageSquare size={16} />}
                                Mektubu Oluştur
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h4 className="font-medium text-slate-800 text-sm">Üretilen Mektup</h4>
                              <button
                                onClick={handleTranslateAILetter}
                                disabled={isTranslatingAILetter}
                                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5"
                              >
                                {isTranslatingAILetter ? (
                                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <RefreshCw size={12} />
                                )}
                                {showAITranslation ? 'Orijinali Göster' : 'Türkçe Çeviriyi Gör'}
                              </button>
                            </div>
                            
                            <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
                              <div 
                                className="p-4 bg-slate-50 border-b border-slate-200 text-sm text-slate-600 italic ql-snow"
                                style={{ display: showAITranslation ? 'block' : 'none' }}
                              >
                                <div 
                                  className="ql-editor"
                                  style={{ padding: 0 }}
                                  dangerouslySetInnerHTML={{ __html: formatHtmlContent(translatedAILetter) }} 
                                />
                              </div>
                              <div style={{ display: showAITranslation ? 'none' : 'block' }}>
                                <ReactQuill 
                                  theme="snow" 
                                  value={generatedAILetter} 
                                  onChange={setGeneratedAILetter}
                                  className="h-[300px] mb-12"
                                  modules={{
                                    toolbar: [
                                      [{ 'header': [1, 2, false] }],
                                      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                                      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
                                      ['link', 'image'],
                                      ['clean']
                                    ],
                                  }}
                                />
                              </div>
                            </div>
                            
                            <div className="mt-4 flex justify-end gap-3">
                              <button 
                                onClick={() => { setGeneratedAILetter(''); setTranslatedAILetter(''); setShowAITranslation(false); }}
                                className="px-4 py-2 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors"
                              >
                                Yeniden Oluştur
                              </button>
                              <button 
                                onClick={() => handlePrintLetter(showAITranslation ? translatedAILetter : generatedAILetter)}
                                className="px-4 py-2 bg-white text-blue-600 border border-blue-200 text-sm font-bold rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-sm"
                              >
                                <Printer size={16} />
                                Yazdır
                              </button>
                              <button 
                                onClick={handleSaveLetter}
                                disabled={isSavingLetter}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                              >
                                {isSavingLetter ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <Save size={16} />}
                                Kaydet
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Timeline Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              <div className="max-w-3xl mx-auto">
                <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pb-8">
                  {/* Initial Case Creation Node */}
                  <div className="relative pl-8">
                    <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-slate-200 border-4 border-slate-50 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm group transition-all hover:shadow-md">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vaka Açıldı</span>
                          <span className="text-xs text-slate-400 font-medium">{new Date(selectedCase.createdAt).toLocaleString('tr-TR')}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={openEditInitialCaseModal}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Düzenle"
                          >
                            <Edit3 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedCase.description}</p>
                      <div className="mt-3 text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <User size={12} /> {selectedCase.createdBy}
                      </div>
                    </div>
                  </div>

                  {/* Actions Nodes */}
                  {selectedCase.actions?.map((action, index) => (
                    <div key={action.id} className="relative pl-8">
                      <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-slate-50 flex items-center justify-center ${action.type === 'letter' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                        <div className={`w-2 h-2 rounded-full ${action.type === 'letter' ? 'bg-blue-500' : 'bg-emerald-500'}`}></div>
                      </div>
                      <div className={`bg-white p-4 rounded-xl border shadow-sm transition-all group ${action.type === 'letter' ? 'border-blue-200 hover:shadow-md' : 'border-slate-200 hover:border-emerald-200 hover:shadow-md'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs font-bold uppercase tracking-wider ${action.type === 'letter' ? 'text-blue-600' : 'text-emerald-600'}`}>
                              {action.type === 'letter' ? 'Mektup' : 'Aksiyon / Not'}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{new Date(action.date).toLocaleString('tr-TR')}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleMoveAction(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-slate-400 hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                              title="Yukarı Taşı"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => handleMoveAction(index, 'down')}
                              disabled={index === (selectedCase.actions?.length || 0) - 1}
                              className="p-1 text-slate-400 hover:text-emerald-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                              title="Aşağı Taşı"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={() => openEditActionModal(action)}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Düzenle"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteAction(action.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                              title="Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{action.actionText}</p>
                        
                        {action.type === 'letter' && action.content && (
                          <div className="mt-3">
                            <button
                              onClick={() => setSelectedPreviewAction(action)}
                              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              <FileText size={14} />
                              İçeriği Görüntüle
                            </button>
                          </div>
                        )}

                        <div className="mt-3 text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <User size={12} /> {action.performedBy}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Input Area */}
            <div className="bg-white p-6 border-t border-slate-200 shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.02)] z-10">
              <div className="max-w-3xl mx-auto flex gap-4">
                <textarea 
                  className="flex-1 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none bg-slate-50"
                  placeholder="Vaka ile ilgili yeni bir gelişme veya not ekleyin..."
                  rows={2}
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddAction();
                    }
                  }}
                />
                <button 
                  onClick={handleAddAction}
                  disabled={!newActionText.trim() || isAddingAction}
                  className="px-6 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
                >
                  {isAddingAction ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <><Send size={18} /> Ekle</>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 border border-slate-200">
              <Briefcase size={40} className="text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-600 mb-2">Vaka Seçilmedi</h3>
            <p className="text-sm text-slate-500 max-w-md text-center">
              Detayları ve zaman çizelgesini görmek için sol taraftaki listeden bir vaka seçin veya yeni bir vaka oluşturun.
            </p>
          </div>
        )}
      </div>

      {/* New Case Modal */}
      <AnimatePresence>
        {isNewCaseModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Briefcase className="text-emerald-600" size={20} />
                  Yeni Vaka Oluştur
                </h3>
                <button onClick={() => setIsNewCaseModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Konaklayan Misafir Seçin
                  </label>
                  
                  {isFetchingGuests ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                      <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
                      Konaklayanlar yükleniyor...
                    </div>
                  ) : (
                    <>
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="İsim veya Oda No ile ara..." 
                          className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          value={guestSearchTerm}
                          onChange={(e) => {
                            setGuestSearchTerm(e.target.value);
                            setShowGuestDropdown(true);
                          }}
                          onFocus={() => setShowGuestDropdown(true)}
                        />
                      </div>
                      
                      {showGuestDropdown && inHouseGuests.length > 0 && (
                        <select 
                          className="w-full border border-slate-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-sm mt-2"
                          size={Math.min(5, Math.max(2, filteredGuests.length))}
                          onChange={(e) => {
                            const guest = inHouseGuests.find(g => g.RESID.toString() === e.target.value);
                            if (guest) {
                              setNewCaseRoom(guest.ROOMNO || '');
                              setNewCaseGuest(guest.GUESTNAMES || '');
                              setShowGuestDropdown(false);
                              setGuestSearchTerm(`${guest.ROOMNO} - ${guest.GUESTNAMES}`);
                            }
                          }}
                        >
                          {filteredGuests.map(g => (
                            <option key={g.RESID} value={g.RESID} className="p-2 hover:bg-emerald-50 cursor-pointer rounded-md">
                              {g.ROOMNO} - {g.GUESTNAMES}
                            </option>
                          ))}
                          {filteredGuests.length === 0 && (
                            <option disabled className="p-2 text-slate-400">Sonuç bulunamadı.</option>
                          )}
                        </select>
                      )}
                      
                      {inHouseGuests.length === 0 && (
                        <p className="text-xs text-amber-600 mt-2">
                          Konaklayan misafir bulunamadı. Lütfen manuel giriş yapın.
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Oda No</label>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50"
                      value={newCaseRoom}
                      onChange={(e) => setNewCaseRoom(e.target.value)}
                      placeholder="Örn: 101"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Misafir Adı</label>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50"
                      value={newCaseGuest}
                      onChange={(e) => setNewCaseGuest(e.target.value)}
                      placeholder="Örn: John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Vaka Tanımı</label>
                  <textarea 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none bg-slate-50"
                    rows={4}
                    value={newCaseDesc}
                    onChange={(e) => setNewCaseDesc(e.target.value)}
                    placeholder="Vakanın detaylarını yazın (Örn: Klima su akıtıyor, teknik servis yönlendirildi...)"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsNewCaseModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button 
                  onClick={handleCreateCase}
                  disabled={isCreatingCase || !newCaseRoom.trim() || !newCaseGuest.trim() || !newCaseDesc.trim()}
                  className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreatingCase ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <CheckCircle2 size={16} />}
                  Vaka Oluştur
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {selectedPreviewAction && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FileText size={18} className="text-blue-500" />
                  İçerik Önizleme
                </h3>
                <button 
                  onClick={() => setSelectedPreviewAction(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 ql-snow">
                  <div 
                    className="ql-editor text-slate-700 text-sm"
                    style={{ padding: 0 }}
                    dangerouslySetInnerHTML={{ __html: formatHtmlContent(selectedPreviewAction.content || '') }} 
                  />
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  onClick={() => setSelectedPreviewAction(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Kapat
                </button>
                <button
                  onClick={() => {
                    if (selectedPreviewAction.content) {
                      handlePrintLetter(selectedPreviewAction.content);
                    }
                  }}
                  className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                >
                  <Printer size={16} />
                  Yazdır
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Edit Initial Case Modal */}
      <AnimatePresence>
        {isEditingInitialCase && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Vaka Tanımını Düzenle</h3>
                    <p className="text-sm text-slate-500">İlk vaka açıklamasını güncelleyin</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditingInitialCase(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">İçerik</label>
                  <textarea 
                    value={editInitialCaseDesc}
                    onChange={(e) => setEditInitialCaseDesc(e.target.value)}
                    rows={5}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none bg-slate-50"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditingInitialCase(false)}
                  className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button 
                  onClick={handleSaveInitialCase}
                  disabled={!editInitialCaseDesc.trim()}
                  className="px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save size={16} />
                  Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Action Modal */}
      <AnimatePresence>
        {editingAction && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Aksiyonu Düzenle</h3>
                    <p className="text-sm text-slate-500">Tarih, saat veya içeriği güncelleyin</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingAction(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tarih</label>
                    <input 
                      type="date"
                      value={editActionDate}
                      onChange={(e) => setEditActionDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Saat</label>
                    <input 
                      type="time"
                      value={editActionTime}
                      onChange={(e) => setEditActionTime(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    {editingAction.type === 'letter' ? 'Mektup Başlığı / Not' : 'İçerik'}
                  </label>
                  <textarea 
                    value={editActionText}
                    onChange={(e) => setEditActionText(e.target.value)}
                    rows={editingAction.type === 'letter' ? 2 : 5}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none bg-slate-50"
                  />
                </div>
                
                {editingAction.type === 'letter' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mektup İçeriği</label>
                    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                      <ReactQuill 
                        theme="snow" 
                        value={editActionContent} 
                        onChange={setEditActionContent}
                        className="h-[200px] mb-12"
                        modules={{
                          toolbar: [
                            [{ 'header': [1, 2, false] }],
                            ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                            [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
                            ['link', 'image'],
                            ['clean']
                          ],
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button 
                  onClick={() => setEditingAction(null)}
                  className="px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button 
                  onClick={handleSaveEditAction}
                  disabled={!editActionText.trim() || !editActionDate || !editActionTime}
                  className="px-6 py-2.5 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save size={16} />
                  Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
