import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Calendar, Search, MessageSquare, ArrowUpDown, ChevronDown, ChevronUp, Filter, Users, CalendarDays, LogOut, Star, FileText, Brain, CheckCircle2, AlertCircle, RefreshCw, Phone, PhoneOff, PhoneForwarded, Plus, X, Sparkles, Edit3, Database, Trash2, BarChart3, Download, Save, Clock } from 'lucide-react';
import { GuestData, CommentData, ApiSettings, GuestListTab, UnifiedTimelineAction } from '../types';
import { executeElektraQuery } from '../services/api';
import { generateAIContent } from '../services/aiService';
import { buildDynamicPayload, formatTRDate, groupCommentDetails, buildUnifiedTimeline, formatHtmlContent } from '../utils';
import { TimelineView } from '../components/TimelineView';
import { BulkAnalysisModal } from '../components/BulkAnalysisModal';
import { ActionEntryModal } from '../components/ActionEntryModal';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, serverTimestamp, writeBatch, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteCommentData } from '../services/firebaseService';
import { motion, AnimatePresence } from 'motion/react';

export function GuestListModule() {
  const [guests, setGuests] = useState<GuestData[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [activeTab, setActiveTab] = useState<GuestListTab>('inhouse');
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: keyof GuestData; direction: 'asc' | 'desc' } | null>(null);
  
  // Expanded row for details
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Pagination & Lazy Loading State
  const [fetchLimit, setFetchLimit] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMoreData, setHasMoreData] = useState<boolean>(true);
  const [cachedComments, setCachedComments] = useState<CommentData[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Dynamic Column Filters State
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [activeQuickFilter, setActiveQuickFilter] = useState<string>('all');

  // Firebase Real-time Cache
  const [firebaseCache, setFirebaseCache] = useState<{
    surveys: any[];
    interactions: Record<string, any>;
    agenda: Record<string, any>;
    commentAnalytics: Record<string, any>;
    commentActions: any[];
  }>({
    surveys: [],
    interactions: {},
    agenda: {},
    commentAnalytics: {},
    commentActions: []
  });

  // Welcome Call Modal State
  const [isWelcomeCallModalOpen, setIsWelcomeCallModalOpen] = useState(false);
  const [selectedGuestForCall, setSelectedGuestForCall] = useState<GuestData | null>(null);
  const [callStatus, setCallStatus] = useState<'not_called' | 'answered_all_good' | 'answered_has_request' | 'no_answer'>('not_called');
  const [callNotes, setCallNotes] = useState('');
  const [isSavingCall, setIsSavingCall] = useState(false);

  // Mail Merge Modal State
  const [isMailMergeModalOpen, setIsMailMergeModalOpen] = useState(false);
  const [selectedGuestForMail, setSelectedGuestForMail] = useState<GuestData | null>(null);
  const [generatedLetterContent, setGeneratedLetterContent] = useState('');
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);

  // Bulk Selection & Bulk Mail Merge State
  const [selectedGuestIds, setSelectedGuestIds] = useState<string[]>([]);
  const [isBulkMailMergeOpen, setIsBulkMailMergeOpen] = useState(false);
  const [bulkTemplates, setBulkTemplates] = useState<any[]>([]);
  const [selectedBulkTemplateId, setSelectedBulkTemplateId] = useState<string>('');
  const [bulkGeneratedLetters, setBulkGeneratedLetters] = useState<{guest: GuestData, content: string}[]>([]);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);

  const [isBulkAnalysisModalOpen, setIsBulkAnalysisModalOpen] = useState(false);
  const [bulkAnalysisType, setBulkAnalysisType] = useState<'deep' | 'sentiment'>('deep');
  const [commentsForBulkAnalysis, setCommentsForBulkAnalysis] = useState<CommentData[]>([]);
  const [isBulkResetting, setIsBulkResetting] = useState(false);

  // Timeline Preview State
  const [selectedPreviewAction, setSelectedPreviewAction] = useState<UnifiedTimelineAction | null>(null);

  // Action Modals State
  const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
  const [isAILetterModalOpen, setIsAILetterModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isManualNoteModalOpen, setIsManualNoteModalOpen] = useState(false);
  const [selectedGuestForAction, setSelectedGuestForAction] = useState<GuestData | null>(null);

  const [extraNotes, setExtraNotes] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [isGeneratingAILetter, setIsGeneratingAILetter] = useState(false);
  const [generatedAILetter, setGeneratedAILetter] = useState('');
  const [translatedAILetter, setTranslatedAILetter] = useState('');
  const [showAITranslation, setShowAITranslation] = useState(false);
  const [isTranslatingAILetter, setIsTranslatingAILetter] = useState(false);

  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templatePreview, setTemplatePreview] = useState('');

  const [manualNote, setManualNote] = useState('');
  const [isSavingAction, setIsSavingAction] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.action-dropdown-container')) {
        setIsActionDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const openActionDropdown = (guest: GuestData) => {
    if (selectedGuestForAction?.RESID === guest.RESID) {
      setIsActionDropdownOpen(!isActionDropdownOpen);
    } else {
      setSelectedGuestForAction(guest);
      setIsActionDropdownOpen(true);
    }
  };

  // Fetch templates when template modal opens
  useEffect(() => {
    if (isTemplateModalOpen && templates.length === 0) {
      const fetchTemplates = async () => {
        try {
          const snapshot = await getDocs(collection(db, 'message_templates'));
          const fetchedTemplates: any[] = [];
          snapshot.forEach(doc => {
            fetchedTemplates.push({ id: doc.id, ...doc.data() });
          });
          setTemplates(fetchedTemplates);
        } catch (error) {
          console.error("Error fetching templates:", error);
        }
      };
      fetchTemplates();
    }
  }, [isTemplateModalOpen, templates.length]);

  // Update template preview
  useEffect(() => {
    if (selectedTemplateId && selectedGuestForAction) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        const nationality = selectedGuestForAction.NATIONALITY;
        const content = template.contents[nationality] || template.contents['ENG'] || Object.values(template.contents)[0] || '';
        
        let merged = content;
        merged = merged.replace(/{{GUESTNAMES}}/g, `${selectedGuestForAction.GUESTNAME} ${selectedGuestForAction.GUESTSURNAME}`);
        merged = merged.replace(/{{ROOMNO}}/g, selectedGuestForAction.ROOMNO || '');
        merged = merged.replace(/{{CHECKIN}}/g, formatTRDate(selectedGuestForAction.CHECKIN || ''));
        merged = merged.replace(/{{CHECKOUT}}/g, formatTRDate(selectedGuestForAction.CHECKOUT || ''));
        merged = merged.replace(/{{HOTELNAME}}/g, 'Otelimiz');
        
        setTemplatePreview(merged);
      }
    } else {
      setTemplatePreview('');
    }
  }, [selectedTemplateId, selectedGuestForAction, templates]);

  const handleGenerateAILetter = async () => {
    if (!selectedGuestForAction) return;
    setIsGeneratingAILetter(true);
    setGeneratedAILetter('');
    setTranslatedAILetter('');
    setShowAITranslation(false);

    try {
      const prompt = `You are a professional 5-star hotel Guest Relations Manager / Concierge. Write a polite and professional letter to a guest.
Guest Name: ${selectedGuestForAction.GUESTNAME} ${selectedGuestForAction.GUESTSURNAME}
Nationality: ${selectedGuestForAction.NATIONALITY}
Room Number: ${selectedGuestForAction.ROOMNO}
Check-In: ${formatTRDate(selectedGuestForAction.CHECKIN || '')}
Check-Out: ${formatTRDate(selectedGuestForAction.CHECKOUT || '')}
Extra Notes from Staff: ${extraNotes}
Target Language: ${targetLanguage}

The letter should be empathetic, professional, and address the guest. Do not include placeholders, write the final letter. Format with appropriate paragraphs.`;

      const text = await generateAIContent(prompt, 'Mektup Üretimi', 'letterGeneration');
      const formattedText = text ? text.replace(/\n/g, '<br>') : 'Mektup oluşturulamadı (Boş yanıt).';
      setGeneratedAILetter(formattedText);
    } catch (error: any) {
      console.error('Error generating letter:', error);
      let errorMessage = 'Mektup oluşturulurken bir hata oluştu.';
      if (error.message) errorMessage += `<br><br>Hata Detayı: ${error.message}`;
      setGeneratedAILetter(errorMessage);
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
    } catch (error: any) {
      console.error('Error translating letter:', error);
      alert('Çeviri sırasında bir hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
    } finally {
      setIsTranslatingAILetter(false);
    }
  };

  const addActionToTimeline = async (description: string, type: 'ai_letter' | 'template' | 'manual', content?: string) => {
    if (!selectedGuestForAction) return;
    setIsSavingAction(true);
    try {
      const actionsRef = collection(db, "comment_actions");
      const commentId = selectedGuestForAction.comments?.[0]?.COMMENTID || '';
      await addDoc(actionsRef, {
        commentId: String(commentId),
        resId: selectedGuestForAction.RESNAMEID || '',
        type,
        description,
        date: new Date().toISOString(),
        createdAt: serverTimestamp(),
        ...(content ? { content } : {})
      });
      
      // Close all modals
      setIsAILetterModalOpen(false);
      setIsTemplateModalOpen(false);
      setIsManualNoteModalOpen(false);
      
      // Reset states
      setExtraNotes('');
      setGeneratedAILetter('');
      setTranslatedAILetter('');
      setTemplatePreview('');
      setSelectedTemplateId('');
      setManualNote('');
      
    } catch (error) {
      console.error("Error adding action:", error);
      alert("Aksiyon kaydedilirken bir hata oluştu.");
    } finally {
      setIsSavingAction(false);
    }
  };

  // Clear results when tab changes, but DO NOT auto-fetch
  useEffect(() => {
    setGuests([]);
    setExpandedRowId(null);
    setSelectedGuestIds([]);
  }, [activeTab]);

  // Firebase Real-time Listener
  useEffect(() => {
    const unsubSurveys = onSnapshot(collection(db, 'survey_logs'), (snapshot) => {
      const surveys: any[] = [];
      snapshot.forEach(doc => surveys.push(doc.data()));
      setFirebaseCache(prev => ({ ...prev, surveys }));
    });

    const unsubInteractions = onSnapshot(collection(db, 'guest_interactions'), (snapshot) => {
      const interactions: Record<string, any> = {};
      snapshot.forEach(doc => {
        interactions[doc.id] = doc.data();
      });
      setFirebaseCache(prev => ({ ...prev, interactions }));
    });

    const unsubAgenda = onSnapshot(collection(db, 'agenda_notes'), (snapshot) => {
      const agenda: Record<string, any> = {};
      snapshot.forEach(doc => {
        agenda[doc.id] = doc.data();
      });
      setFirebaseCache(prev => ({ ...prev, agenda }));
    });

    const unsubCommentAnalytics = onSnapshot(collection(db, 'comment_analytics'), (snapshot) => {
      const analytics: Record<string, any> = {};
      snapshot.forEach(doc => {
        analytics[doc.id] = doc.data();
      });
      setFirebaseCache(prev => ({ ...prev, commentAnalytics: analytics }));
    });

    const unsubCommentActions = onSnapshot(collection(db, 'comment_actions'), (snapshot) => {
      const commentActions: any[] = [];
      snapshot.forEach(doc => {
        commentActions.push({ id: doc.id, ...doc.data() });
      });
      setFirebaseCache(prev => ({ ...prev, commentActions }));
    });

    return () => {
      unsubSurveys();
      unsubInteractions();
      unsubAgenda();
      unsubCommentAnalytics();
      unsubCommentActions();
    };
  }, []);

  const handleFilterChange = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const handleSearch = async (isLoadMore = false) => {
    const savedSettings = localStorage.getItem('hotelApiSettings');
    if (!savedSettings) {
      alert('API ayarları bulunamadı. Lütfen önce ayarları yapın.');
      return;
    }

    let settings: ApiSettings;
    try {
      settings = JSON.parse(savedSettings);
    } catch (e) {
      alert('API ayarları okunamadı.');
      return;
    }

    let guestTemplate = '';
    switch (activeTab) {
      case 'inhouse': guestTemplate = settings.inhousePayloadTemplate || ''; break;
      case 'reservation': guestTemplate = settings.reservationPayloadTemplate || ''; break;
      case 'checkout': guestTemplate = settings.checkoutPayloadTemplate || ''; break;
    }

    if (!guestTemplate || !settings.commentDetailPayloadTemplate) {
      alert('Gerekli payload şablonları eksik.');
      return;
    }

    const targetPage = isLoadMore === true ? currentPage + 1 : 1;

    if (isLoadMore !== true) {
      setIsFetching(true);
      setGuests([]);
      setExpandedRowId(null);
      setHasMoreData(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // 1. Prepare Guest Payload using the new dynamic engine
      const guestPayload = buildDynamicPayload(guestTemplate, settings, columnFilters);
      if (!guestPayload) throw new Error("Guest payload failed.");

      // Inject Required Fields for Guest
      if (guestPayload.Select && Array.isArray(guestPayload.Select)) {
        const requiredFields = ['RESGUESTID', 'CONTACTGUESTID', 'CONTACTPHONE', 'CONTACTEMAIL', 'ROOMNO', 'CHECKIN', 'CHECKOUT', 'GUESTNAMES', 'RESID', 'NATIONALITY'];
        requiredFields.forEach(field => {
          if (!guestPayload.Select.includes(field)) guestPayload.Select.push(field);
        });
      }

      // We fetch a chunk based on fetchLimit and targetPage
      guestPayload.Paging = { ItemsPerPage: fetchLimit, Current: targetPage };

      // 2. Fetch Guests First
      const guestRes = await executeElektraQuery(guestPayload);
      const guestsList: GuestData[] = Array.isArray(guestRes) ? guestRes : [];

      if (guestsList.length < fetchLimit) {
        setHasMoreData(false);
      }

      // 3. Extract RESIDs for Laser Targeting
      const fetchedResIds = guestsList.map(g => g.RESID).filter(Boolean);
      let commentsList: any[] = [];

      if (fetchedResIds.length > 0) {
        // Prepare Comment Payload with IN Operator
        const commentFilters: Record<string, string> = {};
        if (columnFilters['RESID']) commentFilters['RESID'] = columnFilters['RESID'];
        
        // No wide date ranges needed, we use IN operator
        const commentPayload = buildDynamicPayload(settings.commentDetailPayloadTemplate, settings, commentFilters);
        if (!commentPayload) throw new Error("Comment Detail payload failed.");

        // Inject Required Fields for Comment Detail
        if (commentPayload.Select && Array.isArray(commentPayload.Select)) {
          const requiredCommentFields = [
            'ID', 'HOTELID', 'DETAILTYPE', 'DEPNAME', 'GROUPNAME', 'DETAIL', 
            'COMMENTID', 'COMMENTDATE', 'COMMENT', 'ANSWER', 'SOURCENAME', 
            'FULLNAME', 'RESID'
          ];
          requiredCommentFields.forEach(field => {
            if (!commentPayload.Select.includes(field)) commentPayload.Select.push(field);
          });
        }

        // Add IN Operator
        if (!commentPayload.Where) commentPayload.Where = [];
        commentPayload.Where.push({
          "Column": "RESID",
          "Operator": "IN",
          "Value": fetchedResIds
        });

        // High Pagination Limit
        commentPayload.Paging = { ItemsPerPage: 5000, Current: 1 };

        // Fetch Comments
        const cList = await executeElektraQuery(commentPayload);
        commentsList = Array.isArray(cList) ? cList : [];
      }

      // 4. Cross-Match Logic using Firebase Cache
      const groupedDetails = groupCommentDetails(commentsList as any);

      let processedGuests = guestsList.map(guest => {
        const matchedComments = groupedDetails.filter(detail => String(detail.RESID) === String(guest.RESID));
        const hasSurveySent = firebaseCache.surveys.some(log => log.guestId === guest.RESID);
        const interaction = firebaseCache.interactions[guest.RESID] || {};
        
        let sentimentScore = interaction.sentimentScore;
        let sentimentAnalysisDate = interaction.sentimentAnalysisDate;

        if (sentimentScore === undefined && matchedComments.length > 0) {
          for (const comment of matchedComments) {
            const note = firebaseCache.agenda[comment.COMMENTID];
            if (note && note.sentimentScore !== undefined) {
              sentimentScore = note.sentimentScore;
              sentimentAnalysisDate = note.sentimentAnalysisDate;
              break;
            }
          }
        }
        
        const elektraAnswers = matchedComments.map(c => c.ANSWER).filter(Boolean).join('\n');
        const guestCommentIds = matchedComments.map(c => String(c.COMMENTID));
        
        const filteredActions = firebaseCache.commentActions.filter(a => 
          (a.resId && String(a.resId) === String(guest.RESID)) || 
          (a.commentId && guestCommentIds.includes(String(a.commentId)))
        );
        
        const filteredInteractions = (Object.values(firebaseCache.interactions) as any[]).filter(i => 
          String(i.resId) === String(guest.RESID)
        );
        
        const filteredSurveys = firebaseCache.surveys.filter(s => 
          String(s.resId) === String(guest.RESID)
        );

        const timelineActions = buildUnifiedTimeline(
          elektraAnswers,
          filteredActions,
          filteredInteractions,
          filteredSurveys
        );

        return {
          ...guest,
          hasComment: matchedComments.length > 0,
          comments: matchedComments,
          surveySent: hasSurveySent,
          sentimentScore: sentimentScore,
          sentimentAnalysisDate: sentimentAnalysisDate,
          generatedLetter: interaction.generatedLetter,
          letterSentDate: interaction.letterSentDate,
          welcomeCallStatus: interaction.welcomeCallStatus || 'not_called',
          welcomeCallNotes: interaction.welcomeCallNotes || '',
          welcomeCallDate: interaction.welcomeCallDate || '',
          timelineActions: timelineActions
        };
      });

      // 5. Deduplicate
      const uniqueGuests = processedGuests.filter((guest, index, self) =>
        index === self.findIndex((t) => t.RESID === guest.RESID)
      );

      if (isLoadMore === true) {
        setGuests(prev => {
          const combined = [...prev, ...uniqueGuests];
          // deduplicate combined just in case
          return combined.filter((guest, index, self) =>
            index === self.findIndex((t) => t.RESID === guest.RESID)
          );
        });
        setCurrentPage(targetPage);
      } else {
        setGuests(uniqueGuests);
        setCurrentPage(1);
      }

    } catch (error: any) {
      console.error('Fetch error:', error);
      alert(`Sorgulama sırasında bir hata oluştu: ${error.message}`);
    } finally {
      setIsFetching(false);
      setIsLoadingMore(false);
    }
  };

  // Handle Sort
  const handleSort = (key: keyof GuestData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDeleteAction = async (actionId: string) => {
    if (!window.confirm('Bu aksiyonu silmek istediğinize emin misiniz?')) return;
    try {
      await deleteDoc(doc(db, "comment_actions", actionId));
    } catch (error) {
      console.error("Error deleting action:", error);
      alert("Aksiyon silinirken bir hata oluştu.");
    }
  };

  // Sort Data
  const processedData = useMemo(() => {
    let filtered = guests;

    // Apply Quick Filters
    switch (activeQuickFilter) {
      case 'has_comment':
        filtered = filtered.filter(g => g.hasComment);
        break;
      case 'no_comment':
        filtered = filtered.filter(g => !g.hasComment);
        break;
      case 'analyzed':
        filtered = filtered.filter(g => g.sentimentScore !== undefined);
        break;
      case 'high_sentiment':
        filtered = filtered.filter(g => g.sentimentScore !== undefined && g.sentimentScore > 0.8);
        break;
      case 'low_sentiment':
        filtered = filtered.filter(g => g.sentimentScore !== undefined && g.sentimentScore < 0.5);
        break;
      case 'survey_sent':
        filtered = filtered.filter(g => g.surveySent);
        break;
      case 'no_welcome_call':
        filtered = filtered.filter(g => !g.welcomeCallStatus || g.welcomeCallStatus === 'not_called');
        break;
      case 'has_request':
        filtered = filtered.filter(g => g.welcomeCallStatus === 'answered_has_request');
        break;
      default:
        break;
    }

    if (!sortConfig) return filtered;
    
    return [...filtered].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [guests, sortConfig, activeQuickFilter]);

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const openWelcomeCallModal = (guest: GuestData) => {
    setSelectedGuestForCall(guest);
    setCallStatus(guest.welcomeCallStatus || 'not_called');
    setCallNotes(guest.welcomeCallNotes || '');
    setIsWelcomeCallModalOpen(true);
  };

  const handleSaveWelcomeCall = async () => {
    if (!selectedGuestForCall) return;
    setIsSavingCall(true);

    try {
      const interactionRef = doc(db, 'guest_interactions', String(selectedGuestForCall.RESID));
      const payload = {
        welcomeCallStatus: callStatus,
        welcomeCallNotes: callStatus === 'answered_has_request' ? callNotes : '',
        welcomeCallDate: new Date().toISOString()
      };

      await setDoc(interactionRef, payload, { merge: true });

      // Update local state
      setGuests(prev => prev.map(g => 
        g.RESID === selectedGuestForCall.RESID 
          ? { ...g, ...payload }
          : g
      ));

      setIsWelcomeCallModalOpen(false);
    } catch (error) {
      console.error("Error saving welcome call:", error);
      alert("Kaydedilirken bir hata oluştu.");
    } finally {
      setIsSavingCall(false);
    }
  };

  const openMailMergeModal = async (guest: GuestData) => {
    if (guest.generatedLetter) {
      const confirmRegenerate = window.confirm("Bu misafir için daha önce mektup üretilmiş. Tekrar üretmek istiyor musunuz?");
      if (!confirmRegenerate) {
        setSelectedGuestForMail(guest);
        setGeneratedLetterContent(guest.generatedLetter);
        setIsMailMergeModalOpen(true);
        return;
      }
    }

    setSelectedGuestForMail(guest);
    setIsGeneratingLetter(true);
    setIsMailMergeModalOpen(true);
    setGeneratedLetterContent('');

    try {
      const querySnapshot = await getDocs(collection(db, 'letter_templates'));
      const templates: any[] = [];
      querySnapshot.forEach((doc) => {
        templates.push({ id: doc.id, ...doc.data() });
      });

      if (templates.length === 0) {
        setGeneratedLetterContent('Sistemde hiç şablon bulunamadı. Lütfen Şablon Yöneticisi ekranından şablon ekleyin.');
        setIsGeneratingLetter(false);
        return;
      }

      // 2. Find matching template based on NATIONALITY
      const guestNationality = (guest.NATIONALITY || 'ENG').toUpperCase();
      
      // We don't know which template the user wants for a single guest yet, 
      // so we'll just pick the first one for now, or ideally we should let them choose.
      // For simplicity, let's pick the first template available.
      let matchedTemplate = templates[0];
      
      if (!matchedTemplate) {
        setGeneratedLetterContent('Sistemde hiç şablon bulunamadı.');
        setIsGeneratingLetter(false);
        return;
      }

      // 3. Replace Placeholders (Mail Merge)
      let content = '';
      if (matchedTemplate.contents && matchedTemplate.contents[guestNationality]) {
        content = matchedTemplate.contents[guestNationality];
      } else if (matchedTemplate.contents && matchedTemplate.contents['ENG']) {
        content = matchedTemplate.contents['ENG'];
      } else if (matchedTemplate.contents) {
        content = Object.values(matchedTemplate.contents)[0] as string || '';
      }

      content = content.replace(/{{GUESTNAMES}}/g, guest.GUESTNAMES || 'Misafir');
      content = content.replace(/{{ROOMNO}}/g, guest.ROOMNO || '-');
      content = content.replace(/{{CHECKIN}}/g, formatTRDate(guest.CHECKIN || ''));
      content = content.replace(/{{CHECKOUT}}/g, formatTRDate(guest.CHECKOUT || ''));
      content = content.replace(/{{AGENCY}}/g, guest.AGENCY || '');

      setGeneratedLetterContent(content);

      // Save generated letter to Firebase
      const interactionRef = doc(db, 'guest_interactions', String(guest.RESID));
      await setDoc(interactionRef, {
        generatedLetter: content
      }, { merge: true });

      // Update local state
      setGuests(prev => prev.map(g => g.RESID === guest.RESID ? { ...g, generatedLetter: content } : g));
    } catch (error) {
      console.error("Error generating letter:", error);
      setGeneratedLetterContent('Şablon oluşturulurken bir hata oluştu.');
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  const handleSavePdf = async () => {
    try {
      const htmlToImage = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      const element = document.getElementById('mail-merge-content');
      if (!element) return;

      // html-to-image works best with elements already in the DOM.
      // We pass the element directly and use the 'style' option to force A4 dimensions during capture.
      const imgData = await htmlToImage.toJpeg(element, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          width: '794px', // A4 width at 96 DPI
          minHeight: '1123px', // A4 height at 96 DPI
          padding: '75px', // ~20mm margin
          margin: '0',
          border: 'none',
          boxShadow: 'none',
          transform: 'none',
          boxSizing: 'border-box',
          overflow: 'visible',
          position: 'static'
        }
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = 210;
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedGuestForMail?.GUESTNAMES || 'Misafir'}_Mektup.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("PDF oluşturulurken bir hata oluştu.");
    }
  };

  const handleMarkAsSent = async () => {
    if (!selectedGuestForMail) return;

    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebase');

      await addDoc(collection(db, 'survey_logs'), {
        guestId: selectedGuestForMail.RESID,
        guestName: selectedGuestForMail.GUESTNAMES,
        roomNo: selectedGuestForMail.ROOMNO,
        action: 'Anket Üretildi',
        createdAt: serverTimestamp()
      });

      // Update interaction log
      const interactionRef = doc(db, 'guest_interactions', String(selectedGuestForMail.RESID));
      await setDoc(interactionRef, {
        letterSentDate: new Date().toISOString()
      }, { merge: true });

      // Update local state to reflect the change
      setGuests(prev => prev.map(g => g.RESID === selectedGuestForMail.RESID ? { 
        ...g, 
        surveySent: true,
        letterSentDate: new Date().toISOString()
      } : g));
      
      alert('Başarıyla gönderildi olarak işaretlendi.');
      setIsMailMergeModalOpen(false);
    } catch (error) {
      console.error("Error saving log:", error);
      alert('İşlem kaydedilirken bir hata oluştu.');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedGuestIds(processedData.map(g => g.RESID));
    } else {
      setSelectedGuestIds([]);
    }
  };

  const handleSelectGuest = (id: string) => {
    setSelectedGuestIds(prev => 
      prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]
    );
  };

  const openBulkMailMergeModal = async () => {
    setIsBulkMailMergeOpen(true);
    setBulkGeneratedLetters([]);
    setSelectedBulkTemplateId('');
    
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const querySnapshot = await getDocs(collection(db, 'letter_templates'));
      const templates: any[] = [];
      querySnapshot.forEach((doc) => {
        templates.push({ id: doc.id, ...doc.data() });
      });
      setBulkTemplates(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      alert("Şablonlar yüklenirken bir hata oluştu.");
    }
  };

  const openBulkAnalysisModal = (type: 'deep' | 'sentiment') => {
    const commentsToAnalyze: CommentData[] = [];
    selectedGuestIds.forEach(guestId => {
      const guest = guests.find(g => g.RESID === guestId);
      if (guest && guest.comments) {
        guest.comments.forEach(c => {
          commentsToAnalyze.push({
            ID: String(c.COMMENTID),
            COMMENT: c.COMMENT,
            COMMENTDATE: c.COMMENTDATE,
            RESNAMEID_LOOKUP: String(c.RESID),
            RESID: String(c.RESID)
          } as unknown as CommentData);
        });
      }
    });

    if (commentsToAnalyze.length === 0) {
      alert("Seçili misafirlerin analize uygun yorumu bulunmuyor.");
      return;
    }

    setCommentsForBulkAnalysis(commentsToAnalyze);
    setBulkAnalysisType(type);
    setIsBulkAnalysisModalOpen(true);
  };

  const [isGeneratingBulkReport, setIsGeneratingBulkReport] = useState(false);
  const [bulkGeneratedReport, setBulkGeneratedReport] = useState('');
  const [isBulkReportModalOpen, setIsBulkReportModalOpen] = useState(false);
  const [isSavingBulkReport, setIsSavingBulkReport] = useState(false);

  const handleGenerateBulkReport = async () => {
    if (selectedGuestIds.length === 0) return;
    setIsGeneratingBulkReport(true);
    setIsBulkReportModalOpen(true);
    
    try {
      const selectedGuests = guests.filter(g => selectedGuestIds.includes(g.RESID));
      
      const prompt = `Sen 5 yıldızlı bir otelin Misafir İlişkileri Müdürüsün. Aşağıdaki zaman damgalı aksiyon geçmişini incele ve üst yönetime sunulacak profesyonel, özet bir 'Toplu Vaka Çözüm ve Aksiyon Raporu' yaz. Hangi tarihte ne yapıldığını ve misafir memnuniyeti için nasıl bir efor sarf edildiğini kurumsal bir dille anlat. İstatistiksel bir özetle başla (kaç misafire dokunuldu, kaç ikram yapıldı vb.).

ÖNEMLİ KURALLAR:
1. Metin içinde KESİNLİKLE ** (çift yıldız) veya markdown formatı KULLANMA.
2. Başlıkları HTML <h3> veya <h4> etiketleri ile belirt.
3. Listeleri HTML <ul> ve <li> etiketleri ile oluştur.
4. Paragrafları HTML <p> etiketleri ile ayır.

Seçili Misafirler ve Aksiyon Geçmişleri:
${JSON.stringify(selectedGuests.map(g => ({
  misafirAdi: g.GUESTNAMES,
  oda: g.ROOMNO,
  aksiyonlar: g.timelineActions?.map(a => ({
    tarih: a.date,
    tip: a.type,
    kategori: a.actionCategory || 'Belirtilmemiş',
    aciklama: a.description
  })) || []
})), null, 2)}`;

      const report = await generateAIContent(prompt, 'Toplu Vaka Raporu Üretimi', 'bulkReport');
      setBulkGeneratedReport(report.replace(/\*\*/g, ''));
      
    } catch (error) {
      console.error("Toplu rapor üretilirken hata:", error);
      alert("Rapor üretilirken bir hata oluştu.");
      setIsBulkReportModalOpen(false);
    } finally {
      setIsGeneratingBulkReport(false);
    }
  };

  const handleSaveBulkReport = async () => {
    if (!bulkGeneratedReport.trim()) return;
    setIsSavingBulkReport(true);
    try {
      await addDoc(collection(db, 'executive_reports'), {
        type: 'bulk_case',
        guestIds: selectedGuestIds,
        reportContent: bulkGeneratedReport,
        createdAt: new Date().toISOString()
      });
      alert("Rapor başarıyla kaydedildi. Dashboard üzerinden geçmiş raporlara ulaşabilirsiniz.");
      setIsBulkReportModalOpen(false);
    } catch (error) {
      console.error("Rapor kaydedilirken hata:", error);
      alert("Rapor kaydedilirken bir hata oluştu.");
    } finally {
      setIsSavingBulkReport(false);
    }
  };

  const handleBulkResetAnalysis = async () => {
    const commentsToReset: string[] = [];
    selectedGuestIds.forEach(guestId => {
      const guest = guests.find(g => g.RESID === guestId);
      if (guest && guest.comments) {
        guest.comments.forEach(c => {
          commentsToReset.push(String(c.COMMENTID));
        });
      }
    });

    if (commentsToReset.length === 0) {
      alert("Seçili misafirlerin sıfırlanacak yorumu bulunmuyor.");
      return;
    }

    if (!window.confirm(`Seçili misafirlerin toplam ${commentsToReset.length} yorumuna ait tüm analiz verilerini (Duygu Analizi, Derin Analiz, Aksiyonlar) veritabanından silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setIsBulkResetting(true);
    try {
      for (const commentId of commentsToReset) {
        await deleteCommentData(commentId);
      }
      alert("Seçili yorumların analiz verileri başarıyla sıfırlandı.");
    } catch (error: any) {
      console.error("Error bulk resetting analysis:", error);
      alert("Toplu sıfırlama sırasında bir hata oluştu: " + (error.message || 'Bilinmeyen hata'));
    } finally {
      setIsBulkResetting(false);
    }
  };

  const handleGenerateBulkLetters = async () => {
    if (!selectedBulkTemplateId) {
      alert("Lütfen bir şablon seçin.");
      return;
    }

    setIsGeneratingBulk(true);
    const template = bulkTemplates.find(t => t.id === selectedBulkTemplateId);
    if (!template || !template.contents) {
      alert("Şablon içeriği bulunamadı.");
      setIsGeneratingBulk(false);
      return;
    }

    const selectedGuests = processedData.filter(g => selectedGuestIds.includes(g.RESID));
    const generated: {guest: GuestData, content: string}[] = [];

    for (const guest of selectedGuests) {
      const nationality = guest.NATIONALITY?.toUpperCase() || 'ENG';
      let content = '';

      if (template.contents[nationality]) {
        content = template.contents[nationality];
      } else if (template.contents['ENG']) {
        content = template.contents['ENG'];
      } else {
        content = Object.values(template.contents)[0] as string || '';
      }

      content = content.replace(/{{GUESTNAMES}}/g, guest.GUESTNAMES || 'Misafir');
      content = content.replace(/{{ROOMNO}}/g, guest.ROOMNO || '-');
      content = content.replace(/{{CHECKIN}}/g, formatTRDate(guest.CHECKIN || ''));
      content = content.replace(/{{CHECKOUT}}/g, formatTRDate(guest.CHECKOUT || ''));
      content = content.replace(/{{AGENCY}}/g, guest.AGENCY || '');

      generated.push({ guest, content });

      // Save to Firebase
      const interactionRef = doc(db, 'guest_interactions', String(guest.RESID));
      await setDoc(interactionRef, {
        generatedLetter: content
      }, { merge: true });
    }

    // Update local state for all generated guests
    const generatedIds = generated.map(g => g.guest.RESID);
    setGuests(prev => prev.map(g => {
      const gen = generated.find(item => item.guest.RESID === g.RESID);
      return gen ? { ...g, generatedLetter: gen.content } : g;
    }));

    setBulkGeneratedLetters(generated);
    setIsGeneratingBulk(false);
  };

  const handleSaveBulkPdf = async () => {
    setIsGeneratingBulk(true);
    try {
      const htmlToImage = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      
      const letters = document.querySelectorAll('.letter-container');
      if (letters.length === 0) return;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i] as HTMLElement;
        
        // Pass the existing DOM element directly to avoid blank rendering issues.
        // Use the 'style' option to force A4 dimensions during the internal cloning process.
        const imgData = await htmlToImage.toJpeg(letter, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
          style: {
            width: '794px', // A4 width at 96 DPI
            minHeight: '1123px', // A4 height at 96 DPI
            padding: '75px', // ~20mm margin
            margin: '0',
            border: 'none',
            boxShadow: 'none',
            transform: 'none',
            boxSizing: 'border-box',
            overflow: 'visible',
            position: 'static'
          }
        });
        
        if (i > 0) {
          pdf.addPage();
        }
        
        const pdfWidth = 210;
        const imgProps = pdf.getImageProperties(imgData);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      }

      pdf.save(`Toplu_Mektuplar_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error generating bulk PDF:", error);
      alert("PDF oluşturulurken bir hata oluştu.");
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  const handleMarkBulkAsSent = async () => {
    if (bulkGeneratedLetters.length === 0) return;

    try {
      const { collection, writeBatch, doc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      const batch = writeBatch(db);
      const template = bulkTemplates.find(t => t.id === selectedBulkTemplateId);
      const templateName = template?.name || 'Toplu Şablon';

      bulkGeneratedLetters.forEach(({ guest }) => {
        const logRef = doc(collection(db, 'survey_logs'));
        batch.set(logRef, {
          guestId: guest.RESID,
          guestName: guest.GUESTNAMES,
          roomNo: guest.ROOMNO,
          action: `Toplu Anket Üretildi (${templateName})`,
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();

      // Update local state
      const sentIds = bulkGeneratedLetters.map(g => g.guest.RESID);
      setGuests(prev => prev.map(g => sentIds.includes(g.RESID) ? { ...g, surveySent: true } : g));
      
      alert(`${bulkGeneratedLetters.length} misafir başarıyla gönderildi olarak işaretlendi.`);
      setIsBulkMailMergeOpen(false);
      setSelectedGuestIds([]);
    } catch (error) {
      console.error("Error saving bulk logs:", error);
      alert('İşlem kaydedilirken bir hata oluştu.');
    }
  };

  const combinedAnalysisData = { ...firebaseCache.agenda };
  Object.keys(firebaseCache.commentAnalytics).forEach(id => {
    combinedAnalysisData[id] = { ...combinedAnalysisData[id], ...firebaseCache.commentAnalytics[id] };
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Tab Navigation & Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 pt-4 shrink-0 flex justify-between items-end">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('inhouse')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'inhouse' 
                ? 'border-emerald-500 text-emerald-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={18} />
            Konaklayanlar
          </button>
          <button
            onClick={() => setActiveTab('reservation')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'reservation' 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays size={18} />
            Rezervasyon
          </button>
          <button
            onClick={() => setActiveTab('checkout')}
            className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'checkout' 
                ? 'border-amber-500 text-amber-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <LogOut size={18} />
            Ayrılanlar
          </button>
        </div>

        <div className="pb-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Kayıt Sayısı:</label>
            <select 
              value={fetchLimit}
              onChange={(e) => setFetchLimit(Number(e.target.value))}
              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
            >
              <option value={100}>100 Kayıt</option>
              <option value={500}>500 Kayıt</option>
              <option value={1000}>1.000 Kayıt</option>
              <option value={2000}>2.000 Kayıt</option>
              <option value={5000}>5.000 Kayıt</option>
              <option value={10000}>10.000 Kayıt</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-500">Hızlı Filtreler:</label>
            <select
              value={activeQuickFilter}
              onChange={(e) => setActiveQuickFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer shadow-sm"
            >
              <option value="all">Tümü</option>
              <option value="has_comment">Yorum Yapanlar</option>
              <option value="no_comment">Sessiz Misafirler (Yorum Yok)</option>
              <option value="analyzed">Duygu Analizi Yapılanlar</option>
              <option value="high_sentiment">Yüksek Memnuniyet (Score &gt; %80)</option>
              <option value="low_sentiment">Riskli Misafirler (Score &lt; %50)</option>
              <option value="survey_sent">Anket/Mektup Gönderilenler</option>
              <option value="no_welcome_call">Welcome Call Yapılmayanlar</option>
              <option value="has_request">Talebi Olan Misafirler</option>
            </select>
          </div>
          <button 
            onClick={() => handleSearch(false)}
            disabled={isFetching}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetching ? (
              <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <Search size={16} />
            )}
            Sorgula
          </button>
        </div>
      </div>

      {guests.length > 0 && (
        <div className="px-6 py-2 bg-white border-b border-slate-200 text-sm text-slate-500 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span>Toplam <strong>{processedData.length}</strong> misafir listeleniyor</span>
            {activeQuickFilter !== 'all' && (
              <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-medium">
                Filtre Aktif
              </span>
            )}
          </div>
          {selectedGuestIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openBulkAnalysisModal('sentiment')}
                disabled={isBulkResetting}
                className="px-4 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 animate-in fade-in slide-in-from-right-4 disabled:opacity-50"
              >
                <Brain size={14} />
                Toplu Duygu Analizi
              </button>
              <button
                onClick={() => openBulkAnalysisModal('deep')}
                disabled={isBulkResetting}
                className="px-4 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 animate-in fade-in slide-in-from-right-4 disabled:opacity-50"
              >
                <Sparkles size={14} />
                Toplu Derin Analiz
              </button>
              <button
                onClick={handleBulkResetAnalysis}
                disabled={isBulkResetting}
                className="px-4 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 animate-in fade-in slide-in-from-right-4 disabled:opacity-50"
              >
                {isBulkResetting ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-red-600 border-t-transparent" />
                ) : (
                  <Trash2 size={14} />
                )}
                Toplu Analiz Sıfırla
              </button>
              <button
                onClick={openBulkMailMergeModal}
                disabled={isBulkResetting}
                className="px-4 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 animate-in fade-in slide-in-from-right-4 disabled:opacity-50"
              >
                <FileText size={14} />
                Toplu Şablon Üret ({selectedGuestIds.length} Misafir)
              </button>
              <button
                onClick={handleGenerateBulkReport}
                disabled={isBulkResetting}
                className="px-4 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 animate-in fade-in slide-in-from-right-4 disabled:opacity-50"
              >
                <BarChart3 size={14} />
                Toplu Aksiyon Raporu (AI)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table Container - Data Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-[1000px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                <th className="p-3 w-10 bg-slate-50 align-top">
                  <div className="flex flex-col gap-2 items-center">
                    <div className="h-4"></div>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      checked={processedData.length > 0 && selectedGuestIds.length === processedData.length}
                      onChange={handleSelectAll}
                    />
                  </div>
                </th>
                <th className="p-3 w-10 bg-slate-50 align-top"></th>
                <th className="p-3 bg-slate-50 align-top min-w-[120px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1">
                      Durum & Analiz
                    </div>
                  </div>
                </th>
                
                <th className="p-3 bg-slate-50 align-top min-w-[100px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('ROOMNO')}>
                      Oda <ArrowUpDown size={12} />
                    </div>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-normal text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-white"
                      value={columnFilters['ROOMNO'] || ''} 
                      onChange={(e) => handleFilterChange('ROOMNO', e.target.value)} 
                    />
                  </div>
                </th>

                <th className="p-3 bg-slate-50 align-top min-w-[200px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('GUESTNAMES')}>
                      Misafir Adı <ArrowUpDown size={12} />
                    </div>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-normal text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-white"
                      value={columnFilters['GUESTNAMES'] || ''} 
                      onChange={(e) => handleFilterChange('GUESTNAMES', e.target.value)} 
                    />
                  </div>
                </th>

                <th className="p-3 bg-slate-50 align-top min-w-[140px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('CHECKIN')}>
                      Giriş Tarihi <ArrowUpDown size={12} />
                    </div>
                    <input 
                      type="date" 
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-normal text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-white"
                      value={columnFilters['CHECKIN'] || ''} 
                      onChange={(e) => handleFilterChange('CHECKIN', e.target.value)} 
                    />
                  </div>
                </th>

                <th className="p-3 bg-slate-50 align-top min-w-[140px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('CHECKOUT')}>
                      Çıkış Tarihi <ArrowUpDown size={12} />
                    </div>
                    <input 
                      type="date" 
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-normal text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-white"
                      value={columnFilters['CHECKOUT'] || ''} 
                      onChange={(e) => handleFilterChange('CHECKOUT', e.target.value)} 
                    />
                  </div>
                </th>

                <th className="p-3 bg-slate-50 align-top min-w-[150px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('AGENCY')}>
                      Acenta <ArrowUpDown size={12} />
                    </div>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-normal text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-white"
                      value={columnFilters['AGENCY'] || ''} 
                      onChange={(e) => handleFilterChange('AGENCY', e.target.value)} 
                    />
                  </div>
                </th>

                <th className="p-3 bg-slate-50 align-top min-w-[120px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('ROOMTYPE')}>
                      Oda Tipi <ArrowUpDown size={12} />
                    </div>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-normal text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-white"
                      value={columnFilters['ROOMTYPE'] || ''} 
                      onChange={(e) => handleFilterChange('ROOMTYPE', e.target.value)} 
                    />
                  </div>
                </th>

                <th className="p-3 bg-slate-50 align-top min-w-[120px]">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('NATIONALITY')}>
                      Uyruk <ArrowUpDown size={12} />
                    </div>
                    <input 
                      type="text" 
                      className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-normal text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-white"
                      value={columnFilters['NATIONALITY'] || ''} 
                      onChange={(e) => handleFilterChange('NATIONALITY', e.target.value)} 
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedData.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={10} className="p-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                        <Search size={24} className="text-slate-300" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-slate-500">Arama kriterlerinize uygun misafir bulunamadı.</p>
                        <p className="text-xs">Lütfen sütun başlıklarındaki filtreleri doldurup "Sorgula" butonuna basın.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                processedData.map((guest) => (
                  <React.Fragment key={guest.RESID}>
                    <tr 
                      className={`hover:bg-slate-50 transition-colors cursor-pointer group ${expandedRowId === guest.RESID ? 'bg-slate-50' : ''}`}
                      onClick={() => toggleRow(guest.RESID)}
                    >
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          checked={selectedGuestIds.includes(guest.RESID)}
                          onChange={() => handleSelectGuest(guest.RESID)}
                        />
                      </td>
                      <td className="p-4 text-center text-slate-400">
                        {expandedRowId === guest.RESID ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="relative group/tooltip flex items-center justify-center">
                              <MessageSquare size={14} className={guest.hasComment ? "text-blue-500" : "text-slate-200"} />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] font-medium rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                {guest.hasComment ? "Yorum Var" : "Yorum Yok"}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                            </div>
                            
                            <div className="relative group/tooltip flex items-center justify-center">
                              <Brain size={14} className={guest.sentimentScore !== undefined ? "text-purple-500" : "text-slate-200"} />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] font-medium rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                {guest.sentimentScore !== undefined ? `Analiz Edildi: %${(guest.sentimentScore * 100).toFixed(0)}` : "Analiz Edilmedi"}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                            </div>

                            <div className="relative group/tooltip flex items-center justify-center">
                              <FileText size={14} className={guest.generatedLetter ? "text-amber-500" : "text-slate-200"} />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] font-medium rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                {guest.generatedLetter ? "Mektup Üretildi" : "Mektup Üretilmedi"}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                            </div>

                            <div className="relative group/tooltip flex items-center justify-center">
                              <CheckCircle2 size={14} className={guest.surveySent ? "text-emerald-500" : "text-slate-200"} />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] font-medium rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                {guest.surveySent ? "Mektup Gönderildi" : "Mektup Gönderilmedi"}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                            </div>

                            <div className="relative group/tooltip flex items-center justify-center">
                              {guest.welcomeCallStatus === 'answered_all_good' ? (
                                <Phone size={14} className="text-emerald-500" />
                              ) : guest.welcomeCallStatus === 'answered_has_request' ? (
                                <PhoneForwarded size={14} className="text-amber-500" />
                              ) : guest.welcomeCallStatus === 'no_answer' ? (
                                <PhoneOff size={14} className="text-red-500" />
                              ) : (
                                <Phone size={14} className="text-slate-200" />
                              )}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] font-medium rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 translate-y-1 group-hover/tooltip:translate-y-0 whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                {guest.welcomeCallStatus === 'answered_all_good' ? "Ulaşıldı - Her Şey Yolunda" :
                                 guest.welcomeCallStatus === 'answered_has_request' ? `Talebi Var: ${guest.welcomeCallNotes || 'Not yok'}` :
                                 guest.welcomeCallStatus === 'no_answer' ? "Ulaşılamadı" : "Arama Yapılmadı"}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                            </div>
                          </div>
                          
                          {guest.sentimentScore !== undefined && (
                            <div className="flex flex-col gap-0.5 mt-1">
                              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                <span>Memnuniyet</span>
                                <span>%{(guest.sentimentScore * 100).toFixed(0)}</span>
                              </div>
                              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${
                                    guest.sentimentScore > 0.7 ? 'bg-emerald-500' : 
                                    guest.sentimentScore > 0.4 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${guest.sentimentScore * 100}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-medium text-slate-900 relative">
                        {guest.ROOMNO}
                      </td>
                      <td className="p-4 text-sm text-slate-700 font-medium">{guest.GUESTNAMES}</td>
                      <td className="p-4 text-sm text-slate-500">{formatTRDate(guest.CHECKIN)}</td>
                      <td className="p-4 text-sm text-slate-500">{formatTRDate(guest.CHECKOUT)}</td>
                      <td className="p-4 text-sm text-slate-600">{guest.AGENCY || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{guest.ROOMTYPE}</td>
                      <td className="p-4 text-sm text-slate-600 font-medium">
                        {guest.NATIONALITY || '-'}
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedRowId === guest.RESID && (
                        <tr className="bg-slate-50/50" key={`expanded-${guest.RESID}`}>
                          <td colSpan={10} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="p-6 border-t border-b border-slate-200 shadow-inner bg-slate-50">
                                <div className="w-[95%] max-w-[1600px] mx-auto">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                  <Search size={16} className="text-emerald-600" />
                                  Rezervasyon Detayları
                                </h4>
                              </div>
                              <div className="grid grid-cols-4 gap-6 mb-6 text-sm">
                                <div>
                                  <span className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Rezervasyon ID</span>
                                  <span className="font-mono text-slate-700">{guest.RESID}</span>
                                </div>
                                <div>
                                  <span className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Oda Tipi</span>
                                  <span className="text-slate-700">{guest.ROOMTYPE}</span>
                                </div>
                                <div>
                                  <span className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Acenta</span>
                                  <span className="text-slate-700">{guest.AGENCY}</span>
                                </div>
                                <div>
                                  <span className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Uyruk</span>
                                  <span className="text-slate-700 font-medium">{guest.NATIONALITY || '-'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8 pt-6 border-t border-slate-200">
                                {/* Left Column: Comments */}
                                <div className="lg:col-span-8">
                                  {guest.hasComment && guest.comments && guest.comments.length > 0 ? (
                                    <>
                                      <h5 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                                        <div className="bg-emerald-100 p-2 rounded-lg">
                                          <MessageSquare size={20} className="text-emerald-600" />
                                        </div>
                                        Misafir Yorumları / Geri Bildirimleri
                                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full ml-auto">
                                          {guest.comments.length} Yorum
                                        </span>
                                      </h5>
                                      
                                      <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                                        {guest.comments.map((comment, idx) => (
                                          <div key={comment.COMMENTID || idx} className="relative pl-10">
                                            {/* Timeline Dot */}
                                            <div className="absolute left-2 top-4 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 z-10"></div>
                                            
                                            <div className="bg-white rounded-2xl rounded-tl-none border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                                              {/* Header */}
                                              <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                  <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm">
                                                    {comment.SOURCENAME || 'Yorum'}
                                                  </span>
                                                </div>
                                                <span className="text-xs text-slate-400 font-medium font-mono">
                                                  {formatTRDate(comment.COMMENTDATE)}
                                                </span>
                                              </div>
                                              
                                              {/* Body */}
                                              <div className="p-5">
                                                <div className="flex gap-3">
                                                  <div className="shrink-0 mt-1">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                      <Users size={14} />
                                                    </div>
                                                  </div>
                                                  <div className="flex-1">
                                                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                                                      {comment.COMMENT}
                                                    </p>
                                                  </div>
                                                </div>

                                                {/* Grouped Details Badges */}
                                                {comment.details && comment.details.length > 0 && (
                                                  <div className="mt-4 pl-11 flex flex-wrap gap-2">
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
                                        ))}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-center py-8 text-slate-400 text-sm italic border border-slate-200 bg-slate-50/50 rounded-lg">
                                      Bu misafir için herhangi bir yorum kaydı bulunmamaktadır.
                                    </div>
                                  )}
                                </div>

                                {/* Right Column: Timeline */}
                                <div className="lg:col-span-4">
                                  <div className="flex justify-between items-center mb-4 relative">
                                    <h5 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                      <div className="bg-blue-100 p-2 rounded-lg">
                                        <Database size={20} className="text-blue-600" />
                                      </div>
                                      Vaka Takibi ve Aksiyon Geçmişi
                                    </h5>
                                    
                                    {/* Action Dropdown Container */}
                                    <div className="relative action-dropdown-container">
                                      <button
                                        onClick={() => openActionDropdown(guest)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium shadow-md"
                                      >
                                        <Plus size={16} />
                                        Aksiyon Ekle
                                      </button>

                                      {/* Dropdown Menu */}
                                      {isActionDropdownOpen && selectedGuestForAction?.RESID === guest.RESID && (
                                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 animate-in fade-in zoom-in duration-200 origin-top-right">
                                          <div className="p-2 space-y-1">
                                            <button 
                                              onClick={() => {
                                                setIsActionDropdownOpen(false);
                                                openWelcomeCallModal(guest);
                                              }}
                                              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 flex items-center gap-3 transition-colors group"
                                            >
                                              <div className="bg-blue-100 p-1.5 rounded-md group-hover:bg-blue-200 transition-colors">
                                                <Phone size={16} className="text-blue-600" />
                                              </div>
                                              <div>
                                                <div className="font-medium text-slate-800 text-sm">Hoş Geldiniz Araması</div>
                                                <div className="text-[10px] text-slate-500">Arama sonucunu kaydedin</div>
                                              </div>
                                            </button>

                                            <button 
                                              onClick={() => {
                                                setIsActionDropdownOpen(false);
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
                                                setIsActionDropdownOpen(false);
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
                                                setIsActionDropdownOpen(false);
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
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-[500px] overflow-y-auto">
                                    <TimelineView 
                                      actions={guest.timelineActions || []} 
                                      onDeleteAction={handleDeleteAction} 
                                      onPreviewAction={setSelectedPreviewAction} 
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
          
          {guests.length > 0 && hasMoreData && (
            <div className="p-4 flex justify-center border-t border-slate-200 bg-white">
              <button
                onClick={() => handleSearch(true)}
                disabled={isLoadingMore}
                className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm font-medium shadow-sm disabled:opacity-50"
              >
                {isLoadingMore ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ChevronDown size={16} />
                )}
                Daha Fazla Yükle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mail Merge Modal */}
      <AnimatePresence>
        {isMailMergeModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-emerald-600" />
                Anket/Mektup Önizleme
              </h3>
              <button 
                onClick={() => setIsMailMergeModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50">
              {isGeneratingLetter ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium">Şablon hazırlanıyor...</p>
                </div>
              ) : (
                <div id="mail-merge-content" className="bg-white p-12 shadow-sm border border-slate-200 min-h-[297mm] ql-snow relative">
                  <div 
                    className="ql-editor font-serif text-slate-800 text-base" 
                    style={{ minHeight: '100%', padding: 0 }}
                    dangerouslySetInnerHTML={{ __html: formatHtmlContent(generatedLetterContent) }}
                  />
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button
                onClick={() => setIsMailMergeModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSavePdf}
                disabled={isGeneratingLetter || !generatedLetterContent}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <LogOut size={16} className="rotate-90" />
                PDF Kaydet
              </button>
              <button
                onClick={handleMarkAsSent}
                disabled={isGeneratingLetter || !generatedLetterContent}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Star size={16} />
                Gönderildi Olarak İşaretle
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Bulk Analysis Modal */}
      {isBulkAnalysisModalOpen && (
        <BulkAnalysisModal
          isOpen={isBulkAnalysisModalOpen}
          onClose={() => setIsBulkAnalysisModalOpen(false)}
          comments={commentsForBulkAnalysis}
          agendaNotes={combinedAnalysisData}
          type={bulkAnalysisType}
          onComplete={() => {
            // Optional: refresh data
            // fetchGuests(currentPage);
          }}
        />
      )}

      {/* Bulk Mail Merge Modal */}
      <AnimatePresence>
      {isBulkMailMergeOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-emerald-600" />
                Toplu Şablon Üretimi ({selectedGuestIds.length} Misafir)
              </h3>
              <button 
                onClick={() => setIsBulkMailMergeOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
            
            <div className="p-6 border-b border-slate-200 bg-white flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">Kullanılacak Şablonu Seçin</label>
                <select 
                  value={selectedBulkTemplateId}
                  onChange={(e) => setSelectedBulkTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
                >
                  <option value="">-- Şablon Seçin --</option>
                  {bulkTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleGenerateBulkLetters}
                disabled={!selectedBulkTemplateId || isGeneratingBulk}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingBulk ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                Üret
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-100/50">
              {bulkGeneratedLetters.length > 0 ? (
                <div id="bulk-mail-merge-content" className="space-y-8">
                  {bulkGeneratedLetters.map((item, index) => (
                    <React.Fragment key={index}>
                      <div className="letter-container bg-white p-12 shadow-sm border border-slate-200 min-h-[297mm] relative ql-snow">
                        <div className="absolute top-4 right-4 text-xs font-sans font-bold text-slate-400 border border-slate-200 px-2 py-1 rounded bg-slate-50 z-10">
                          {item.guest.GUESTNAMES} ({item.guest.NATIONALITY || 'Bilinmiyor'})
                        </div>
                        <div 
                          className="ql-editor font-serif text-slate-800 text-base"
                          style={{ minHeight: '100%', padding: 0 }}
                          dangerouslySetInnerHTML={{ __html: formatHtmlContent(item.content) }} 
                        />
                      </div>
                      {index < bulkGeneratedLetters.length - 1 && (
                        <div className="page-break"></div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <FileText size={48} className="mb-4 opacity-20" />
                  <p>Şablon seçip "Üret" butonuna basarak mektupları oluşturun.</p>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button
                onClick={() => setIsBulkMailMergeOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveBulkPdf}
                disabled={bulkGeneratedLetters.length === 0}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <LogOut size={16} className="rotate-90" />
                Tümünü PDF Olarak Kaydet
              </button>
              <button
                onClick={handleMarkBulkAsSent}
                disabled={bulkGeneratedLetters.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Star size={16} />
                Tümünü Gönderildi İşaretle
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      {/* Welcome Call Modal */}
      <AnimatePresence>
      {isWelcomeCallModalOpen && selectedGuestForCall && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Phone size={20} className="text-blue-600" />
                Hoş Geldiniz Araması
              </h3>
              <button 
                onClick={() => setIsWelcomeCallModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="mb-6 flex items-center justify-between bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div>
                  <span className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Misafir</span>
                  <span className="text-lg font-semibold text-slate-800">{selectedGuestForCall.GUESTNAMES}</span>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Oda</span>
                  <span className="text-lg font-semibold text-slate-800">{selectedGuestForCall.ROOMNO}</span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <label className="block text-sm font-semibold text-slate-700">Arama Durumu</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div 
                    onClick={() => setCallStatus('answered_all_good')}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center text-center gap-2 ${
                      callStatus === 'answered_all_good' 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50 text-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-full ${callStatus === 'answered_all_good' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      <Phone size={24} className={callStatus === 'answered_all_good' ? 'text-emerald-600' : 'text-slate-400'} />
                    </div>
                    <span className="text-sm font-medium">Ulaşıldı<br/>Her Şey Yolunda</span>
                  </div>

                  <div 
                    onClick={() => setCallStatus('answered_has_request')}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center text-center gap-2 ${
                      callStatus === 'answered_has_request' 
                        ? 'border-amber-500 bg-amber-50 text-amber-700' 
                        : 'border-slate-200 hover:border-amber-200 hover:bg-amber-50/50 text-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-full ${callStatus === 'answered_has_request' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                      <PhoneForwarded size={24} className={callStatus === 'answered_has_request' ? 'text-amber-600' : 'text-slate-400'} />
                    </div>
                    <span className="text-sm font-medium">Ulaşıldı<br/>Özel Talebi Var</span>
                  </div>

                  <div 
                    onClick={() => setCallStatus('no_answer')}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex flex-col items-center text-center gap-2 ${
                      callStatus === 'no_answer' 
                        ? 'border-red-500 bg-red-50 text-red-700' 
                        : 'border-slate-200 hover:border-red-200 hover:bg-red-50/50 text-slate-600'
                    }`}
                  >
                    <div className={`p-2 rounded-full ${callStatus === 'no_answer' ? 'bg-red-100' : 'bg-slate-100'}`}>
                      <PhoneOff size={24} className={callStatus === 'no_answer' ? 'text-red-600' : 'text-slate-400'} />
                    </div>
                    <span className="text-sm font-medium">Ulaşılamadı<br/>Odada Yok</span>
                  </div>
                </div>
              </div>

              {callStatus === 'answered_has_request' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-semibold text-slate-700">Talepler / Notlar</label>
                  <textarea
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Misafirin ekstra havlu, geç çıkış vb. taleplerini buraya yazın..."
                    className="w-full h-32 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                  />
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsWelcomeCallModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveWelcomeCall}
                disabled={isSavingCall || (callStatus === 'answered_has_request' && !callNotes.trim())}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingCall ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Kaydet
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

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
                
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Hedef Dil</label>
                    <select
                      value={targetLanguage}
                      onChange={(e) => setTargetLanguage(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                    >
                      <option value="English">İngilizce (English)</option>
                      <option value="Turkish">Türkçe (Turkish)</option>
                      <option value="German">Almanca (Deutsch)</option>
                      <option value="Russian">Rusça (Русский)</option>
                      <option value="French">Fransızca (Français)</option>
                    </select>
                  </div>
                  <div className="flex-1 flex items-end">
                    <button
                      onClick={handleGenerateAILetter}
                      disabled={isGeneratingAILetter}
                      className="w-full bg-slate-900 text-white px-6 py-2 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 h-[42px]"
                    >
                      {isGeneratingAILetter ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Brain size={18} />
                          Yapay Zeka ile Üret
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {generatedAILetter && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-slate-800">Üretilen Mektup</h4>
                    <button
                      onClick={handleTranslateAILetter}
                      disabled={isTranslatingAILetter}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      {isTranslatingAILetter ? (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      {showAITranslation ? 'Orijinali Göster' : 'Türkçe Çeviriyi Gör'}
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 ql-snow min-h-[200px]">
                    <div 
                      className="ql-editor text-slate-700 text-sm"
                      style={{ padding: 0 }}
                      dangerouslySetInnerHTML={{ __html: formatHtmlContent(showAITranslation ? translatedAILetter : generatedAILetter) }} 
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsAILetterModalOpen(false)}
                className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => addActionToTimeline('AI ile mektup oluşturuldu.', 'ai_letter', generatedAILetter)}
                disabled={!generatedAILetter || isSavingAction}
                className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingAction ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Aksiyon Olarak Kaydet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-green-500" />
                Şablon Kullan
              </h3>
              <button onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 flex gap-6">
              <div className="w-1/3 space-y-4 border-r border-slate-100 pr-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Şablon Seçin</label>
                  <div className="space-y-2">
                    {templates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                          selectedTemplateId === template.id 
                            ? 'border-green-500 bg-green-50 text-green-700 font-medium' 
                            : 'border-slate-200 hover:border-green-300 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {template.name}
                      </button>
                    ))}
                    {templates.length === 0 && (
                      <div className="text-sm text-slate-500 italic text-center py-4">
                        Kayıtlı şablon bulunamadı.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Dil</label>
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 text-sm"
                  >
                    <option value="English">İngilizce (English)</option>
                    <option value="Turkish">Türkçe (Turkish)</option>
                    <option value="German">Almanca (Deutsch)</option>
                    <option value="Russian">Rusça (Русский)</option>
                  </select>
                </div>
              </div>

              <div className="w-2/3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Şablon Önizleme</label>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 min-h-[300px] ql-snow">
                  {templatePreview ? (
                    <div 
                      className="ql-editor text-slate-700 text-sm"
                      style={{ padding: 0 }}
                      dangerouslySetInnerHTML={{ __html: formatHtmlContent(templatePreview) }} 
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 italic">
                      Lütfen sol taraftan bir şablon seçin.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => addActionToTimeline('Şablon mesaj gönderildi.', 'template', templatePreview)}
                disabled={!templatePreview || isSavingAction}
                className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingAction ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Aksiyon Olarak Kaydet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Action Modal */}
      <ActionEntryModal
        isOpen={isManualNoteModalOpen}
        onClose={() => setIsManualNoteModalOpen(false)}
        guestId={selectedGuestForAction?.RESID || ''}
        commentId={selectedGuestForAction?.comments?.[0]?.COMMENTID}
        onActionAdded={() => {
          // The onSnapshot listener will automatically update the timeline
          setManualNote('');
        }}
      />

      {/* Preview Modal */}
      {selectedPreviewAction && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={18} className="text-blue-500" />
                İçerik Önizleme
              </h3>
              <button onClick={() => setSelectedPreviewAction(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 ql-snow">
                <div 
                  className="ql-editor text-slate-700 text-sm"
                  style={{ padding: 0 }}
                  dangerouslySetInnerHTML={{ __html: formatHtmlContent(selectedPreviewAction.content) }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Report Modal */}
      {isBulkReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-600" />
                Toplu Vaka Çözüm ve Aksiyon Raporu
              </h3>
              <button 
                onClick={() => setIsBulkReportModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                disabled={isGeneratingBulkReport}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              {isGeneratingBulkReport ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-slate-600 font-medium animate-pulse">Yapay Zeka Raporu Hazırlıyor...</p>
                  <p className="text-slate-400 text-sm">Seçili misafirlerin tüm aksiyon geçmişi analiz ediliyor.</p>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-3xl mx-auto">
                  {/* Antetli Kağıt Görünümü */}
                  <div className="border-b-2 border-slate-800 pb-6 mb-8 text-center">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">Yönetim Raporu</h1>
                    <p className="text-slate-500 mt-2 font-medium">Toplu Vaka Çözüm ve Aksiyon Özeti</p>
                    <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  
                  <div className="mt-6">
                    <ReactQuill 
                      theme="snow" 
                      value={bulkGeneratedReport} 
                      onChange={setBulkGeneratedReport}
                      className="bg-white"
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, 4, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                          ['clean']
                        ]
                      }}
                    />
                  </div>
                  
                  <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-sm text-slate-500">
                    <div>
                      <span className="font-medium text-slate-700">Raporlayan:</span> Yapay Zeka Asistanı
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Kapsam:</span> {selectedGuestIds.length} Misafir
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsBulkReportModalOpen(false)}
                className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
                disabled={isGeneratingBulkReport}
              >
                Kapat
              </button>
              {!isGeneratingBulkReport && bulkGeneratedReport && (
                <>
                  <button
                    onClick={handleSaveBulkReport}
                    disabled={isSavingBulkReport}
                    className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <Save size={18} />
                    {isSavingBulkReport ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(bulkGeneratedReport.replace(/<[^>]*>?/gm, ''));
                      alert("Rapor metni panoya kopyalandı.");
                    }}
                    className="px-6 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <FileText size={18} />
                    Kopyala
                  </button>
                  <button
                    onClick={() => {
                      // PDF indirme mantığı buraya eklenebilir
                      alert("PDF indirme özelliği yakında eklenecektir.");
                    }}
                    className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Download size={18} />
                    PDF İndir
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
