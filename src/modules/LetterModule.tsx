import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { DetailPanel } from '../components/DetailPanel';
import { BulkAnalysisModal } from '../components/BulkAnalysisModal';
import { CommentData, ApiSettings } from '../types';
import { executeElektraQuery } from '../services/api';
import { buildDynamicPayload, groupCommentDetails } from '../utils';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { deleteCommentData } from '../services/firebaseService';
import { Sparkles, Brain, Trash2 } from 'lucide-react';

export function LetterModule() {
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [viewMode, setViewMode] = useState<'spacious' | 'compact'>('spacious');

  // Pagination & Lazy Loading State
  const [fetchLimit, setFetchLimit] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMoreData, setHasMoreData] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const [agendaNotes, setAgendaNotes] = useState<Record<string, any>>({});

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkType, setBulkType] = useState<'deep' | 'sentiment'>('deep');
  const [isBulkResetting, setIsBulkResetting] = useState(false);

  useEffect(() => {
    // Load UI preferences
    const loadPrefs = async () => {
      try {
        const prefDoc = await getDoc(doc(db, 'config', 'ui_preferences'));
        if (prefDoc.exists()) {
          const data = prefDoc.data();
          if (data.letterModuleViewMode) {
            setViewMode(data.letterModuleViewMode);
          }
        }
      } catch (error) {
        console.error("Error loading UI preferences:", error);
      }
    };
    loadPrefs();

    const unsubscribe = onSnapshot(collection(db, 'agenda_notes'), (snapshot) => {
      const notes: Record<string, any> = {};
      snapshot.forEach((doc) => {
        notes[doc.id] = doc.data();
      });
      setAgendaNotes(notes);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchComments(false);
  }, []); // Auto-load on mount

  const fetchComments = async (isLoadMore = false) => {
    const savedSettings = localStorage.getItem('hotelApiSettings');
    if (!savedSettings) {
      alert('Lütfen önce API ayarlarını yapın.');
      return;
    }

    let settings: ApiSettings;
    try {
      settings = JSON.parse(savedSettings);
    } catch (e) {
      alert('API ayarları okunamadı.');
      return;
    }

    if (!settings.commentPayloadTemplate || !settings.commentDetailPayloadTemplate) {
      alert('Yorum listesi veya detay şablonu bulunamadı. Lütfen ayarlardan kontrol edin.');
      return;
    }

    const targetPage = isLoadMore === true ? currentPage + 1 : 1;

    if (isLoadMore !== true) {
      setIsFetching(true);
      setComments([]);
      setSelectedCommentId(null);
      setHasMoreData(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // Create dynamic payload without date filters
      const dateFilters: Record<string, string> = {};
      
      const payload = buildDynamicPayload(
        settings.commentPayloadTemplate,
        settings,
        dateFilters,
        "",
        ""
      );

      if (!payload) throw new Error("Payload oluşturulamadı.");

      // Add dynamic date filters if they don't exist in the template
      if (!payload.Where) payload.Where = [];
      
      // Remove any existing COMMENTDATE filters to avoid duplicates
      payload.Where = payload.Where.filter((w: any) => w.Column !== 'COMMENTDATE');

      // Ensure RESNAMEID_LOOKUP is in Select
      if (!payload.Select) {
        payload.Select = [];
      }
      if (Array.isArray(payload.Select) && !payload.Select.includes('RESNAMEID_LOOKUP')) {
        payload.Select.push('RESNAMEID_LOOKUP');
      }

      // Add Paging
      payload.Paging = { ItemsPerPage: fetchLimit, Current: targetPage };

      // Prepare Comment Detail Payload
      const detailPayload = buildDynamicPayload(
        settings.commentDetailPayloadTemplate,
        settings,
        dateFilters,
        "",
        ""
      );

      if (!detailPayload) throw new Error("Detail Payload oluşturulamadı.");

      if (!detailPayload.Where) detailPayload.Where = [];
      detailPayload.Where = detailPayload.Where.filter((w: any) => w.Column !== 'COMMENTDATE');

      // Fetch details up to 2000 items to ensure we get most details for the current page
      detailPayload.Paging = { ItemsPerPage: 2000, Current: 1 };

      const [data, detailData] = await Promise.all([
        executeElektraQuery(payload),
        executeElektraQuery(detailPayload)
      ]);
      
      let fetchedComments: CommentData[] = Array.isArray(data) ? data : [];
      const rawDetails = Array.isArray(detailData) ? detailData : [];
      
      const groupedDetails = groupCommentDetails(rawDetails);

      fetchedComments = fetchedComments.map(comment => {
        const matchedDetail = groupedDetails.find(d => String(d.COMMENTID) === String(comment.ID));
        if (matchedDetail && matchedDetail.details) {
          return { ...comment, details: matchedDetail.details };
        }
        return comment;
      });

      if (fetchedComments.length < fetchLimit) {
        setHasMoreData(false);
      }

      if (isLoadMore === true) {
        setComments(prev => {
          const combined = [...prev, ...fetchedComments];
          // Deduplicate
          return combined.filter((comment, index, self) =>
            index === self.findIndex((t) => t.ID === comment.ID)
          );
        });
        setCurrentPage(targetPage);
      } else {
        setComments(fetchedComments);
        setCurrentPage(1);
        if (fetchedComments.length === 0) {
          // alert('Belirtilen aralıkta yorum bulunamadı veya veri formatı hatalı.');
        }
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      alert(`Veri çekilirken bir hata oluştu: ${error.message}`);
    } finally {
      setIsFetching(false);
      setIsLoadingMore(false);
    }
  };

  const selectedComment = comments.find(c => c.ID === selectedCommentId) || null;

  const handleToggleSelect = (id: string) => {
    setSelectedCommentIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (comments.length > 0 && selectedCommentIds.length === comments.length) {
      setSelectedCommentIds([]);
    } else {
      setSelectedCommentIds(comments.map(c => c.ID));
    }
  };

  const openBulkModal = (type: 'deep' | 'sentiment') => {
    setBulkType(type);
    setIsBulkModalOpen(true);
  };

  const handleBulkResetAnalysis = async () => {
    if (selectedCommentIds.length === 0) return;

    if (!window.confirm(`Seçili ${selectedCommentIds.length} yorumun tüm analiz verilerini (Duygu Analizi, Derin Analiz, Aksiyonlar) veritabanından silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setIsBulkResetting(true);
    try {
      for (const commentId of selectedCommentIds) {
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

  const handleViewModeChange = async (mode: 'spacious' | 'compact') => {
    setViewMode(mode);
    try {
      await setDoc(doc(db, 'config', 'ui_preferences'), {
        letterModuleViewMode: mode
      }, { merge: true });
    } catch (error) {
      console.error("Error saving UI preference:", error);
    }
  };

  const selectedCommentsForBulk = comments.filter(c => selectedCommentIds.includes(c.ID));

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full w-full relative">
      {selectedCommentIds.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
              {selectedCommentIds.length} Yorum Seçili
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openBulkModal('sentiment')}
              disabled={isBulkResetting}
              className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Brain size={16} />
              Toplu Duygu Analizi
            </button>
            <button
              onClick={() => openBulkModal('deep')}
              disabled={isBulkResetting}
              className="px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles size={16} />
              Toplu Derin Analiz
            </button>
            <button
              onClick={handleBulkResetAnalysis}
              disabled={isBulkResetting}
              className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isBulkResetting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent" />
              ) : (
                <Trash2 size={16} />
              )}
              Toplu Analiz Sıfırla
            </button>
          </div>
        </div>
      )}
      <div className="flex-1 flex overflow-hidden h-full w-full relative">
        <Sidebar 
          comments={comments} 
          selectedId={selectedCommentId} 
          onSelect={setSelectedCommentId}
          selectedIds={selectedCommentIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onFetch={fetchComments}
          isFetching={isFetching}
          fetchLimit={fetchLimit}
          setFetchLimit={setFetchLimit}
          hasMoreData={hasMoreData}
          isLoadingMore={isLoadingMore}
          agendaNotes={agendaNotes}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
        <DetailPanel comment={selectedComment} />
      </div>
      
      {isBulkModalOpen && (
        <BulkAnalysisModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          comments={selectedCommentsForBulk}
          type={bulkType}
          onComplete={() => {
            // Optional: clear selection or refresh data
            // setSelectedCommentIds([]);
          }}
        />
      )}
    </div>
  );
}
