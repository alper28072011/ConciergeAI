import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Search, MessageSquare, ArrowUpDown, ChevronDown, ChevronUp, Filter, Users, CalendarDays, LogOut, Star } from 'lucide-react';
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
  
  // Search Form State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchRoom, setSearchRoom] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchHasComment, setSearchHasComment] = useState<'all' | 'yes' | 'no'>('all');

  // Clear results when tab changes, but DO NOT auto-fetch
  useEffect(() => {
    setGuests([]);
    setExpandedRowId(null);
  }, [activeTab]);

  const handleSearch = async () => {
    if (!startDate && !endDate && !searchRoom && !searchName && searchHasComment === 'all') {
      alert('Lütfen arama yapmak için en az bir kriter (Tarih, Oda No veya Misafir Adı) belirleyin.');
      return;
    }

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

    setIsFetching(true);
    setGuests([]);
    setExpandedRowId(null);

    try {
      // 1. Prepare Guest Payload
      const guestPayload = buildDynamicPayload(guestTemplate, settings, startDate, endDate);
      if (!guestPayload) throw new Error("Guest payload failed.");

      // Clean up empty filters (if user left dates blank, the replaced value is "")
      if (guestPayload.Filters && Array.isArray(guestPayload.Filters)) {
        guestPayload.Filters = guestPayload.Filters.filter((f: any) => f.Value !== "" && f.Value !== null && f.Value !== undefined);
      } else {
        guestPayload.Filters = [];
      }

      // Inject Advanced Filters into Guest Payload
      if (searchRoom) {
        guestPayload.Filters.push({ Column: "ROOMNO", Operator: "like", Value: searchRoom });
      }
      if (searchName) {
        guestPayload.Filters.push({ Column: "GUESTNAMES", Operator: "like", Value: searchName });
      }

      // Inject Required Fields for Guest
      if (guestPayload.Select && Array.isArray(guestPayload.Select)) {
        const requiredFields = ['RESGUESTID', 'CONTACTGUESTID', 'CONTACTPHONE', 'CONTACTEMAIL', 'ROOMNO', 'CHECKIN', 'CHECKOUT', 'GUESTNAMES', 'RESID'];
        requiredFields.forEach(field => {
          if (!guestPayload.Select.includes(field)) guestPayload.Select.push(field);
        });
      }

      // We fetch a large chunk for the search result
      guestPayload.Paging = { ItemsPerPage: 2000, Current: 1 };

      // 2. Prepare Comment Payload (Wide Date Range or Fallback if empty)
      let wideStartDate = "2000-01-01";
      if (startDate) {
        const fromDateObj = new Date(startDate);
        fromDateObj.setMonth(fromDateObj.getMonth() - 3);
        wideStartDate = fromDateObj.toISOString().split('T')[0];
      }
      
      let wideEndDate = "2099-12-31";
      if (endDate) {
        const toDateObj = new Date(endDate);
        toDateObj.setMonth(toDateObj.getMonth() + 1);
        wideEndDate = toDateObj.toISOString().split('T')[0];
      }

      const commentPayload = buildDynamicPayload(settings.commentPayloadTemplate, settings, wideStartDate, wideEndDate);
      if (!commentPayload) throw new Error("Comment payload failed.");

      // Clean up empty filters for comments too
      if (commentPayload.Filters && Array.isArray(commentPayload.Filters)) {
        commentPayload.Filters = commentPayload.Filters.filter((f: any) => f.Value !== "" && f.Value !== null && f.Value !== undefined);
      } else {
        commentPayload.Filters = [];
      }

      // Inject Advanced Filters into Comment Payload to optimize fetching
      if (searchRoom) {
        commentPayload.Filters.push({ Column: "ROOMNO", Operator: "like", Value: searchRoom });
      }
      if (searchName) {
        commentPayload.Filters.push({ Column: "GUESTNAMES", Operator: "like", Value: searchName });
      }

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
        while (hasMore && commentPage <= 10) { // Max 50k comments
          commentPayload.Paging = { ItemsPerPage: 5000, Current: commentPage };
          const res = await executeElektraQuery(commentPayload);
          if (Array.isArray(res) && res.length > 0) {
            allComments = [...allComments, ...res];
            if (res.length < 5000) hasMore = false;
            else commentPage++;
          } else {
            hasMore = false;
          }
        }
        return allComments;
      };

      const [guestRes, commentsList] = await Promise.all([
        executeElektraQuery(guestPayload),
        fetchAllComments()
      ]);

      const guestsList: GuestData[] = Array.isArray(guestRes) ? guestRes : [];

      // 4. Cross-Match Logic
      let processedGuests = guestsList.map(guest => {
        const matchedComments = findGuestComments(guest, commentsList);
        return {
          ...guest,
          hasComment: matchedComments.length > 0,
          comments: matchedComments
        };
      });

      // 5. Local Filter for "Has Comment"
      if (searchHasComment === 'yes') {
        processedGuests = processedGuests.filter(g => g.hasComment);
      } else if (searchHasComment === 'no') {
        processedGuests = processedGuests.filter(g => !g.hasComment);
      }

      // 6. Deduplicate
      const uniqueGuests = processedGuests.filter((guest, index, self) =>
        index === self.findIndex((t) => t.RESID === guest.RESID)
      );

      setGuests(uniqueGuests);

    } catch (error: any) {
      console.error('Fetch error:', error);
      alert(`Sorgulama sırasında bir hata oluştu: ${error.message}`);
    } finally {
      setIsFetching(false);
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

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 pt-4 shrink-0">
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
      </div>

      {/* Advanced Search Bar */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[100px] max-w-[120px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Oda No</label>
            <input 
              type="text" 
              placeholder="Örn: 101"
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Giriş Tarihi</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Çıkış Tarihi</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Misafir Adı</label>
            <input 
              type="text" 
              placeholder="Örn: John Doe"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Yorum Durumu</label>
            <select 
              value={searchHasComment}
              onChange={(e) => setSearchHasComment(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            >
              <option value="all">Tümü</option>
              <option value="yes">Yorum Yapanlar</option>
              <option value="no">Yorum Yapmayanlar</option>
            </select>
          </div>
          <button 
            onClick={handleSearch}
            disabled={isFetching}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed h-[38px]"
          >
            {isFetching ? (
              <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <Search size={16} />
            )}
            Sorgula
          </button>
        </div>
        
        {guests.length > 0 && (
          <div className="mt-4 text-sm text-slate-500 flex items-center justify-between">
            <span>Toplam <strong>{processedData.length}</strong> misafir listeleniyor</span>
            {searchHasComment !== 'all' && (
              <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-medium">
                Filtre: {searchHasComment === 'yes' ? 'Sadece Yorum Yapanlar' : 'Yorum Yapmayanlar'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-[1000px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                <th className="p-4 w-10 bg-slate-50"></th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50" onClick={() => handleSort('ROOMNO')}>
                  <div className="flex items-center gap-1">Oda <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50" onClick={() => handleSort('GUESTNAMES')}>
                  <div className="flex items-center gap-1">Misafir Adı <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50" onClick={() => handleSort('CHECKIN')}>
                  <div className="flex items-center gap-1">Giriş <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50" onClick={() => handleSort('CHECKOUT')}>
                  <div className="flex items-center gap-1">Çıkış <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50" onClick={() => handleSort('AGENCY')}>
                  <div className="flex items-center gap-1">Acenta <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50" onClick={() => handleSort('ROOMTYPE')}>
                  <div className="flex items-center gap-1">Oda Tipi <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors bg-slate-50" onClick={() => handleSort('TOTALPRICE')}>
                  <div className="flex items-center gap-1">Tutar <ArrowUpDown size={12} /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedData.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Search size={32} className="text-slate-300" />
                      <p>Arama kriterlerinize uygun misafir bulunamadı.</p>
                      <p className="text-xs">Lütfen yukarıdaki panelden kriterleri belirleyip "Sorgula" butonuna basın.</p>
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
                      <td className="p-4 text-sm text-slate-600 font-mono">
                        {guest.TOTALPRICE?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                      </td>
                    </tr>
                    {expandedRowId === guest.RESID && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={8} className="p-0">
                          <div className="p-6 border-t border-b border-slate-200 shadow-inner bg-slate-50">
                            <div className="max-w-4xl mx-auto">
                              <h4 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <Search size={16} className="text-emerald-600" />
                                Rezervasyon Detayları
                              </h4>
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
                                  <span className="block text-xs text-slate-400 uppercase tracking-wider mb-1">Toplam Tutar</span>
                                  <span className="text-slate-700">{guest.TOTALPRICE?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
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
        </div>
      </div>
    </div>
  );
}
