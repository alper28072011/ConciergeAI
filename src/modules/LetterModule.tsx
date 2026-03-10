import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { DetailPanel } from '../components/DetailPanel';
import { CommentData, ApiSettings } from '../types';
import { executeElektraQuery } from '../services/api';
import { buildDynamicPayload } from '../utils';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function LetterModule() {
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  // Pagination & Lazy Loading State
  const [fetchLimit, setFetchLimit] = useState<number>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMoreData, setHasMoreData] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Default dates: today and 1 month ago
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);
  
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [startDate, setStartDate] = useState(formatDate(oneMonthAgo));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [agendaNotes, setAgendaNotes] = useState<Record<string, any>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'agenda_notes'), (snapshot) => {
      const notes: Record<string, any> = {};
      snapshot.forEach((doc) => {
        notes[doc.id] = doc.data();
      });
      setAgendaNotes(notes);
    });

    return () => unsubscribe();
  }, []);

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

    if (!settings.commentPayloadTemplate) {
      alert('Yorum listesi şablonu bulunamadı. Lütfen ayarlardan kontrol edin.');
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
      // Create dynamic payload with date filters
      const dateFilters: Record<string, string> = {};
      
      const payload = buildDynamicPayload(
        settings.commentPayloadTemplate,
        settings,
        dateFilters,
        startDate,
        endDate
      );

      if (!payload) throw new Error("Payload oluşturulamadı.");

      // Add dynamic date filters if they don't exist in the template
      if (!payload.Where) payload.Where = [];
      
      // Remove any existing COMMENTDATE filters to avoid duplicates
      payload.Where = payload.Where.filter((w: any) => w.Column !== 'COMMENTDATE');
      
      // Add the new date filters
      if (startDate) {
        payload.Where.push({
          Column: "COMMENTDATE",
          Operator: ">=",
          Value: startDate
        });
      }
      
      if (endDate) {
        payload.Where.push({
          Column: "COMMENTDATE",
          Operator: "<=",
          Value: endDate
        });
      }

      // Add Paging
      payload.Paging = { ItemsPerPage: fetchLimit, Current: targetPage };

      const data = await executeElektraQuery(payload);
      
      const fetchedComments: CommentData[] = Array.isArray(data) ? data : [];

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
          alert('Belirtilen tarih aralığında yorum bulunamadı veya veri formatı hatalı.');
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

  return (
    <div className="flex-1 flex overflow-hidden h-full w-full">
      <Sidebar 
        comments={comments} 
        selectedId={selectedCommentId} 
        onSelect={setSelectedCommentId}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onFetch={fetchComments}
        isFetching={isFetching}
        fetchLimit={fetchLimit}
        setFetchLimit={setFetchLimit}
        hasMoreData={hasMoreData}
        isLoadingMore={isLoadingMore}
        agendaNotes={agendaNotes}
      />
      <DetailPanel comment={selectedComment} />
    </div>
  );
}
