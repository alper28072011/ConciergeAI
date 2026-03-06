import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { DetailPanel } from '../components/DetailPanel';
import { CommentData } from '../types';
import { executeElektraQuery } from '../services/api';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from '../firebase';

export function LetterModule() {
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isFetching, setIsFetching] = useState(false);

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

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "config", "api_settings"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.loginToken) {
          const savedSettings = localStorage.getItem('hotelApiSettings');
          if (savedSettings) {
            try {
              const settings = JSON.parse(savedSettings);
              if (settings.loginToken !== data.loginToken) {
                console.log("Syncing new token from Firestore...");
                settings.loginToken = data.loginToken;
                localStorage.setItem('hotelApiSettings', JSON.stringify(settings));
              }
            } catch (e) {
              console.error('Error parsing settings', e);
            }
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchComments = async () => {
    const savedSettings = localStorage.getItem('hotelApiSettings');
    if (!savedSettings) {
      alert('Lütfen önce API ayarlarını yapın.');
      return;
    }

    setIsFetching(true);
    try {
      const payload = {
        Action: 'Select',
        Object: 'QA_HOTEL_GUEST_COMMENT',
        Select: [
          "COMMENTTYPEID", "STATEID", "ID", "HOTELID", "COMMENT", "COMMENTSOURCEID",
          "RESNAMEID", "COMMENTDATE", "COMMENTSOURCEID_NAME", "RESNAMEID_LOOKUP",
          "ANSWER", "LAST_STATEID", "CREATORID", "CREATORID_USERCODE", "INFO",
          "SCORE", "GRADE", "PHONE", "EMAIL", "NATIONALITY", "GDPRCONFIRMED",
          "EMAILCONFIRMED", "PHONECONFIRMED", "SMSCONFIRMED", "WHATSAPPCONFIRMED",
          "POSITIVE", "NEGATIVE", "SUGGESTION", "INFORMATION", "TYPESTOTAL",
          "GUESTID", "AGENCYCODE", "ROOMNO", "SOURCEREFID", "SURVEYNAME",
          "CHECKIN", "CHECKOUT", "EFFECTIVECHECKOUT"
        ],
        Where: [
          { Column: "STATEID", Operator: "=", Value: 3 },
          { Column: "COMMENTDATE", Operator: ">=", Value: startDate },
          { Column: "COMMENTDATE", Operator: "<=", Value: endDate }
        ],
        OrderBy: [{ Column: "COMMENTDATE", Direction: "DESC" as const }],
        Paging: { ItemsPerPage: 100, Current: 1 },
        TotalCount: false,
        Joins: []
      };

      const data = await executeElektraQuery(payload);

      if (Array.isArray(data)) {
        setComments(data);
      } else {
        setComments([]);
        alert('Belirtilen tarih aralığında yorum bulunamadı veya veri formatı hatalı.');
      }
    } catch (error: any) {
      console.error('Fetch error:', error);

      if (error.message === 'TOKEN_EXPIRED') {
        alert("Oturum süreniz dolmuş (Token Expired). Lütfen yeni bir Login Token girin veya uygulamayı Elektraweb üzerinden yeniden başlatın.");
      } else {
        alert(`Veri çekilirken bir hata oluştu: ${error.message}`);
      }
    } finally {
      setIsFetching(false);
    }
  };

  const selectedComment = comments.find(c => c.ID === selectedCommentId) || null;

  return (
    <div className="flex-1 flex overflow-hidden">
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
