/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { DetailPanel } from './components/DetailPanel';
import { CommentData } from './types';
import { Settings, Hotel } from 'lucide-react';

const MOCK_DATA: CommentData[] = [
  { 
    COMMENTID: "101", 
    HOTELID: "21390", 
    COMMENTDATE: "2025-06-15", 
    COMMENT: "Merhaba, her şey güzeldi fakat odamın temizliğini beğenmedim. Yatak altları tozluydu ve banyoda eksik havlular vardı.", 
    ANSWER: "Misafirin odasına detaylı temizlik yaptırıldı. Kat şefimiz bizzat kontrol etti ve özür dilendi.", 
    SOURCENAME: "Guest Survey", 
    NATIONALITY: "Almanya", 
    GUESTNAME: "Christian Müller", 
    GROUPNAME: "Housekeeping - Olumsuz" 
  },
  { 
    COMMENTID: "102", 
    HOTELID: "21390", 
    COMMENTDATE: "2025-06-16", 
    COMMENT: "Yemekler harikaydı, özellikle sabah kahvaltısındaki omlet şefi çok ilgiliydi. Akşam yemeğindeki tatlı büfesi de çok zengindi.", 
    ANSWER: "Şefe ve mutfak ekibine teşekkür iletildi.", 
    SOURCENAME: "Tripadvisor", 
    NATIONALITY: "Türkiye", 
    GUESTNAME: "Ayşe Yılmaz", 
    GROUPNAME: "Restoran - Olumlu" 
  },
  { 
    COMMENTID: "103", 
    HOTELID: "21390", 
    COMMENTDATE: "2025-06-17", 
    COMMENT: "Havuz kenarında daha fazla şezlong olmalı, sabah 9'da inmemize rağmen yer bulmakta zorlandık. Animasyon ekibi çok eğlenceliydi.", 
    ANSWER: "Ek şezlong siparişi verildi, geçici olarak plajdan takviye yapıldı. Animasyon ekibine teşekkür edildi.", 
    SOURCENAME: "Booking.com", 
    NATIONALITY: "İngiltere", 
    GUESTNAME: "John Smith", 
    GROUPNAME: "Öneri" 
  }
];

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [comments] = useState<CommentData[]>(MOCK_DATA);

  const selectedComment = comments.find(c => c.COMMENTID === selectedCommentId) || null;

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
        />
        <DetailPanel comment={selectedComment} />
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={(settings) => console.log('Settings saved:', settings)} 
      />
    </div>
  );
}
