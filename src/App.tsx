/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
        Action: settings.action,
        Object: settings.objectName,
        Select: [
          "ID", "HOTELID", "COMMENT", "COMMENTDATE", "RESNAMEID_LOOKUP", 
          "ANSWER", "PHONE", "EMAIL", "NATIONALITY", "GDPRCONFIRMED", 
          "EMAILCONFIRMED", "PHONECONFIRMED", "SMSCONFIRMED", 
          "WHATSAPPCONFIRMED", "GUESTID", "ROOMNO", "COMMENTSOURCEID_NAME", 
          "CHECKIN", "CHECKOUT", "SCORE"
        ],
        Where: [
          { Column: "STATEID", Operator: "=", Value: 3 },
          { Column: "COMMENTDATE", Operator: ">=", Value: startDate },
          { Column: "COMMENTDATE", Operator: "<=", Value: endDate },
          { Column: "HOTELID", Operator: "=", Value: settings.hotelId }
        ],
        OrderBy: [{ Column: "COMMENTDATE", Direction: "DESC" }],
        Paging: { ItemsPerPage: 100, Current: 1 },
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
