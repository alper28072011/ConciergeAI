import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Search, MessageSquare, ArrowUpDown, ChevronDown, ChevronUp, Filter, Users, CalendarDays, LogOut, Star, FileText } from 'lucide-react';
import { GuestData, CommentData, ApiSettings, GuestListTab } from '../types';
import { executeElektraQuery } from '../services/api';
import { buildDynamicPayload, formatTRDate, findGuestComments } from '../utils';

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
  const [searchHasComment, setSearchHasComment] = useState<'all' | 'yes' | 'no'>('all');

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

  // Clear results when tab changes, but DO NOT auto-fetch
  useEffect(() => {
    setGuests([]);
    setExpandedRowId(null);
    setSelectedGuestIds([]);
  }, [activeTab]);

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

    if (!guestTemplate || !settings.commentPayloadTemplate) {
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

      // 2. Prepare Comment Payload
      // We only pass safe columns to comment filters to avoid 500 errors (e.g., TOTALPRICE doesn't exist in comments)
      const commentFilters: Record<string, string> = {};
      if (columnFilters['ROOMNO']) commentFilters['ROOMNO'] = columnFilters['ROOMNO'];
      if (columnFilters['GUESTNAMES']) commentFilters['GUESTNAMES'] = columnFilters['GUESTNAMES'];
      if (columnFilters['CHECKIN']) commentFilters['CHECKIN'] = columnFilters['CHECKIN'];
      if (columnFilters['CHECKOUT']) commentFilters['CHECKOUT'] = columnFilters['CHECKOUT'];
      
      // Provide a wide date range to prevent API 500 errors (full table scans) if the template requires dates
      const wideStartDate = "2020-01-01";
      const wideEndDate = "2030-12-31";
      
      const commentPayload = buildDynamicPayload(settings.commentPayloadTemplate, settings, commentFilters, wideStartDate, wideEndDate);
      if (!commentPayload) throw new Error("Comment payload failed.");

      // Inject Required Fields for Comment
      if (commentPayload.Select && Array.isArray(commentPayload.Select)) {
        const requiredCommentFields = [
          'ROOMNO', 'CHECKIN', 'CHECKOUT', 'GUESTNAMES', 'RESID', 
          'HOTELID', 'COMMENTDATE', 'COMMENT', 'ANSWER', 'SCORE', 'COMMENTSOURCEID_NAME'
        ];
        requiredCommentFields.forEach(field => {
          if (!commentPayload.Select.includes(field)) commentPayload.Select.push(field);
        });
      }

      // 3. Fetch Data Concurrently
      const fetchAllComments = async () => {
        let allComments: CommentData[] = [];
        let commentPage = 1;
        let hasMore = true;
        while (hasMore && commentPage <= 10) { // Max 20k comments
          commentPayload.Paging = { ItemsPerPage: 2000, Current: commentPage };
          const res = await executeElektraQuery(commentPayload);
          if (Array.isArray(res) && res.length > 0) {
            allComments = [...allComments, ...res];
            if (res.length < 2000) hasMore = false;
            else commentPage++;
          } else {
            hasMore = false;
          }
        }
        return allComments;
      };

      let commentsList = cachedComments;
      let guestRes: any;

      if (isLoadMore !== true) {
        // Fetch both concurrently on first load
        const [gRes, cList] = await Promise.all([
          executeElektraQuery(guestPayload),
          fetchAllComments()
        ]);
        guestRes = gRes;
        commentsList = cList;
        setCachedComments(cList);
      } else {
        // Only fetch guests on load more
        guestRes = await executeElektraQuery(guestPayload);
      }

      const guestsList: GuestData[] = Array.isArray(guestRes) ? guestRes : [];

      if (guestsList.length < fetchLimit) {
        setHasMoreData(false);
      }

      // 4. Fetch Survey Logs
      let surveyLogs: any[] = [];
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const querySnapshot = await getDocs(collection(db, 'survey_logs'));
        querySnapshot.forEach(doc => {
          surveyLogs.push(doc.data());
        });
      } catch (e) {
        console.error("Error fetching survey logs:", e);
      }

      // 5. Cross-Match Logic
      let processedGuests = guestsList.map(guest => {
        const matchedComments = findGuestComments(guest, commentsList);
        const hasSurveySent = surveyLogs.some(log => log.guestId === guest.RESID);
        return {
          ...guest,
          hasComment: matchedComments.length > 0,
          comments: matchedComments,
          surveySent: hasSurveySent
        };
      });

      // 6. Local Filter for "Has Comment"
      if (searchHasComment === 'yes') {
        processedGuests = processedGuests.filter(g => g.hasComment);
      } else if (searchHasComment === 'no') {
        processedGuests = processedGuests.filter(g => !g.hasComment);
      }

      // 7. Deduplicate
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

  // Sort Data
  const processedData = useMemo(() => {
    if (!sortConfig) return guests;
    
    return [...guests].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [guests, sortConfig]);

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const openMailMergeModal = async (guest: GuestData) => {
    setSelectedGuestForMail(guest);
    setIsGeneratingLetter(true);
    setIsMailMergeModalOpen(true);
    setGeneratedLetterContent('');

    try {
      // 1. Fetch templates from Firebase
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
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
    } catch (error) {
      console.error("Error generating letter:", error);
      setGeneratedLetterContent('Şablon oluşturulurken bir hata oluştu.');
    } finally {
      setIsGeneratingLetter(false);
    }
  };

  const handleSavePdf = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('mail-merge-content');
    if (!element) return;

    const opt: any = {
      margin:       1,
      filename:     `${selectedGuestForMail?.GUESTNAMES || 'Misafir'}_Mektup.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2,
        onclone: (clonedDoc: Document) => {
          // Remove all stylesheets to prevent html2canvas from parsing oklch colors (Tailwind v4)
          const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach(s => s.remove());
          
          // Apply inline styles to the target element since we removed the stylesheets
          const el = clonedDoc.getElementById('mail-merge-content');
          if (el) {
            el.style.backgroundColor = '#ffffff';
            el.style.color = '#1e293b';
            el.style.padding = '48px';
            el.style.fontFamily = 'serif';
            el.style.whiteSpace = 'pre-wrap';
            el.style.lineHeight = '1.625';
            el.style.fontSize = '14px';
          }
        }
      },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
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

      // Update local state to reflect the change
      setGuests(prev => prev.map(g => g.RESID === selectedGuestForMail.RESID ? { ...g, surveySent: true } : g));
      
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
    }

    setBulkGeneratedLetters(generated);
    setIsGeneratingBulk(false);
  };

  const handleSaveBulkPdf = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('bulk-mail-merge-content');
    if (!element) return;

    const opt: any = {
      margin:       1,
      filename:     `Toplu_Mektuplar_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2,
        onclone: (clonedDoc: Document) => {
          const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach(s => s.remove());
          
          const el = clonedDoc.getElementById('bulk-mail-merge-content');
          if (el) {
            el.style.backgroundColor = '#ffffff';
            el.style.color = '#1e293b';
            el.style.fontFamily = 'serif';
            el.style.whiteSpace = 'pre-wrap';
            el.style.lineHeight = '1.625';
            el.style.fontSize = '14px';
          }
        }
      },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
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
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Sadece Sessiz Misafirler:</label>
            <button
              onClick={() => setSearchHasComment(searchHasComment === 'no' ? 'all' : 'no')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                searchHasComment === 'no' ? 'bg-emerald-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  searchHasComment === 'no' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
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
            {searchHasComment !== 'all' && (
              <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-medium">
                Filtre: {searchHasComment === 'yes' ? 'Sadece Yorum Yapanlar' : 'Yorum Yapmayanlar'}
              </span>
            )}
          </div>
          {selectedGuestIds.length > 0 && (
            <button
              onClick={openBulkMailMergeModal}
              className="px-4 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 animate-in fade-in slide-in-from-right-4"
            >
              <FileText size={14} />
              Toplu Şablon Üret ({selectedGuestIds.length} Misafir)
            </button>
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
                  <td colSpan={9} className="p-16 text-center text-slate-400">
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
                      <td className="p-4 text-sm font-medium text-slate-900 relative">
                        {guest.ROOMNO}
                        {guest.hasComment && (
                          <div className="absolute -top-1 -right-1 group/tooltip z-20">
                             <div className="bg-emerald-100 p-1 rounded-full shadow-sm animate-pulse">
                               <MessageSquare size={14} className="text-emerald-600 fill-emerald-200" />
                             </div>
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                               Misafir yorum yaptı ({guest.comments?.length})
                             </div>
                          </div>
                        )}
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
                    {expandedRowId === guest.RESID && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={9} className="p-0">
                          <div className="p-6 border-t border-b border-slate-200 shadow-inner bg-slate-50">
                            <div className="max-w-4xl mx-auto">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                  <Search size={16} className="text-emerald-600" />
                                  Rezervasyon Detayları
                                </h4>
                                <button
                                  onClick={() => openMailMergeModal(guest)}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                >
                                  {guest.surveySent ? (
                                    <>
                                      <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                                      Anket Gönderildi
                                    </>
                                  ) : (
                                    <>
                                      <FileText size={16} />
                                      Anket/Mektup Hazırla
                                    </>
                                  )}
                                </button>
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

                              {guest.hasComment && guest.comments && guest.comments.length > 0 ? (
                                <div className="mt-8 pt-6 border-t border-slate-200">
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
                                      <div key={comment.ID || idx} className="relative pl-10">
                                        {/* Timeline Dot */}
                                        <div className="absolute left-2 top-4 w-4 h-4 rounded-full bg-white border-2 border-emerald-500 z-10"></div>
                                        
                                        <div className="bg-white rounded-2xl rounded-tl-none border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                                          {/* Header */}
                                          <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                              <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-md shadow-sm">
                                                {comment.COMMENTSOURCEID_NAME || 'Yorum'}
                                              </span>
                                              {comment.SCORE && (
                                                <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-md border border-amber-100">
                                                  <Star size={12} fill="currentColor" />
                                                  <span className="text-xs font-bold">{comment.SCORE} / 10</span>
                                                </div>
                                              )}
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

                                            {comment.ANSWER && (
                                              <div className="mt-4 pl-11">
                                                <div className="bg-emerald-50/50 rounded-xl rounded-tr-none p-4 border border-emerald-100/50 relative">
                                                  <div className="flex gap-3">
                                                    <div className="shrink-0 mt-1">
                                                       <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                         <MessageSquare size={12} />
                                                       </div>
                                                    </div>
                                                    <div>
                                                      <span className="block text-xs font-bold text-emerald-700 mb-1">Otel Yanıtı</span>
                                                      <p className="text-sm text-slate-600 leading-relaxed">
                                                        {comment.ANSWER}
                                                      </p>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-8 text-slate-400 text-sm italic border-t border-slate-200 mt-6 bg-slate-50/50 rounded-lg">
                                  Bu misafir için herhangi bir yorum kaydı bulunmamaktadır.
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
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
      {isMailMergeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                <div 
                  id="mail-merge-content"
                  className="bg-[#ffffff] p-12 shadow-sm border border-[#e2e8f0] min-h-[800px] font-serif text-[#1e293b] whitespace-pre-wrap leading-relaxed"
                >
                  {generatedLetterContent}
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
          </div>
        </div>
      )}

      {/* Bulk Mail Merge Modal */}
      {isBulkMailMergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                    <div key={index} className="bg-[#ffffff] p-12 shadow-sm border border-[#e2e8f0] min-h-[800px] font-serif text-[#1e293b] whitespace-pre-wrap leading-relaxed relative">
                      <div className="absolute top-4 right-4 text-xs font-sans font-bold text-slate-400 border border-slate-200 px-2 py-1 rounded bg-slate-50">
                        {item.guest.GUESTNAMES} ({item.guest.NATIONALITY || 'Bilinmiyor'})
                      </div>
                      {item.content}
                    </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
