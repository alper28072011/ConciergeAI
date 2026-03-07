import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { DetailPanel } from '../components/DetailPanel';
import { CommentData, ApiSettings } from '../types';
import { executeElektraQuery } from '../services/api';
import { buildDynamicPayload } from '../utils';

export function LetterModule() {
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isFetching, setIsFetching] = useState(false);

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

  const fetchComments = async () => {
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

    setIsFetching(true);
    try {
      const payload = buildDynamicPayload(
        settings.commentPayloadTemplate,
        settings,
        startDate,
        endDate
      );

      const data = await executeElektraQuery(payload);
      
      if (Array.isArray(data)) {
        setComments(data);
      } else {
        setComments([]);
        alert('Belirtilen tarih aralığında yorum bulunamadı veya veri formatı hatalı.');
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      alert(`Veri çekilirken bir hata oluştu: ${error.message}`);
    } finally {
      setIsFetching(false);
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
      />
      <DetailPanel comment={selectedComment} />
    </div>
  );
}
