/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { DetailPanel } from './components/DetailPanel';
import { CommentData, ApiSettings } from './types';
import { Settings, Hotel } from 'lucide-react';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      const savedSettings = localStorage.getItem('hotelApiSettings');
      let settings: ApiSettings = {
        baseUrl: '',
        loginToken: '',
        hotelId: '',
        action: 'Select',
        objectName: 'QA_HOTEL_GUEST_COMMENT'
      };

      if (savedSettings) {
        try {
          settings = JSON.parse(savedSettings);
        } catch (e) {
          console.error('Error parsing settings', e);
        }
      }

      settings.loginToken = token;
      localStorage.setItem('hotelApiSettings', JSON.stringify(settings));

      // Clean URL
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
  }, []);

  const fetchComments = async () => {
    const savedSettings = localStorage.getItem('hotelApiSettings');
    if (!savedSettings) {
      alert('Lütfen önce API ayarlarını yapın.');
      setIsSettingsOpen(true);
      return;
    }

    let settings: ApiSettings;
    try {
      settings = JSON.parse(savedSettings);
    } catch (e) {
      alert('API ayarları okunamadı. Lütfen tekrar kaydedin.');
      return;
    }

    if (!settings.baseUrl || !settings.hotelId || !settings.action || !settings.objectName) {
      alert('Lütfen API ayarlarındaki tüm alanları doldurun.');
      setIsSettingsOpen(true);
      return;
    }

    const activeToken = localStorage.getItem('loginToken') || settings.loginToken;

    if (!activeToken) {
      alert("Lütfen geçerli bir Elektraweb oturum token'ı (loginToken) girin");
      setIsSettingsOpen(true);
      return;
    }

    setIsFetching(true);
    try {
      const payload = {
        Parameters: { HOTELID: Number(settings.hotelId) },
        Action: settings.action,
        Object: settings.objectName,
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
          { Column: "COMMENTDATE", Operator: "<=", Value: endDate },
          { Column: "HOTELID", Operator: "=", Value: Number(settings.hotelId) }
        ],
        OrderBy: [{ Column: "COMMENTDATE", Direction: "DESC" }],
        Paging: { ItemsPerPage: 100, Current: 1 },
        TotalCount: false,
        Joins: [],
        LoginToken: activeToken
      };

      const response = await fetch(settings.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setIsSettingsOpen(true);
          alert("Oturum süreniz dolmuş (Token Expired). Lütfen yeni bir Login Token girin veya uygulamayı Elektraweb üzerinden yeniden başlatın.");
          throw new Error(`Oturum Hatası: ${response.status}`);
        }
        throw new Error(`API Hatası: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.ResultSets && data.ResultSets.length > 0) {
        setComments(data.ResultSets[0]);
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
    <div className="h-screen w-full bg-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-slate-900 text-white h-14 flex items-center justify-between px-6 shrink-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-1.5 rounded-lg">
            <Hotel size={20} className="text-slate-100" />
          </div>
          <h1 className="font-semibold tracking-wide text-sm">AI Destekli Misafir Mektubu Asistanı</h1>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg"
        >
          <Settings size={16} />
          API Ayarları
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
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
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={(settings) => {
          console.log('Settings saved:', settings);
        }} 
      />
    </div>
  );
}
