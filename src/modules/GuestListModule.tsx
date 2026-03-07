import React, { useState, useMemo } from 'react';
import { Calendar, Search, MessageSquare, ArrowUpDown, ChevronDown, ChevronUp, Filter, Download } from 'lucide-react';
import { GuestData, CommentData, ApiSettings } from '../types';
import { executeElektraQuery } from '../services/api';
import { buildDynamicPayload, formatTRDate } from '../utils';

export function GuestListModule() {
  const [guests, setGuests] = useState<GuestData[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  
  // Filter state: key is the column name (e.g., 'GUESTNAMES'), value is the search string
  const [filters, setFilters] = useState<Record<string, string>>({});
  
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
  
  const [startDate, setStartDate] = useState(formatDate(oneMonthAgo));
  const [endDate, setEndDate] = useState(formatDate(today));

  const fetchGuestsAndComments = async () => {
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

    if (!settings.guestPayloadTemplate || !settings.commentPayloadTemplate) {
      alert('Misafir veya Yorum listesi şablonu bulunamadı. Lütfen ayarlardan kontrol edin.');
      return;
    }

    setIsFetching(true);
    try {
      // 1. Prepare Payloads
      const guestPayload = buildDynamicPayload(settings.guestPayloadTemplate, settings, startDate, endDate);
      const commentPayload = buildDynamicPayload(settings.commentPayloadTemplate, settings, startDate, endDate);

      // 2. Execute Requests in Parallel
      const [guestData, commentData] = await Promise.all([
        executeElektraQuery(guestPayload),
        executeElektraQuery(commentPayload)
      ]);

      const guestsList: GuestData[] = Array.isArray(guestData) ? guestData : [];
      const commentsList: CommentData[] = Array.isArray(commentData) ? commentData : [];

      // 3. Cross-Match Logic
      const processedGuests = guestsList.map(guest => {
        const matchingComment = commentsList.find(c => c.ROOMNO === guest.ROOMNO);
        return {
          ...guest,
          hasComment: !!matchingComment,
          commentData: matchingComment
        };
      });

      setGuests(processedGuests);
      setExpandedRowId(null); // Reset expansion

      if (processedGuests.length === 0) {
        alert('Belirtilen tarih aralığında misafir bulunamadı.');
      }

    } catch (error: any) {
      console.error('Fetch error:', error);
      alert(`Veri çekilirken bir hata oluştu: ${error.message}`);
    } finally {
      setIsFetching(false);
    }
  };

  // Handle Filter Change
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Handle Sort
  const handleSort = (key: keyof GuestData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter and Sort Data
  const processedData = useMemo(() => {
    // 1. Filter
    let data = guests.filter(guest => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const guestValue = String(guest[key as keyof GuestData] || '').toLowerCase();
        return guestValue.includes(String(value).toLowerCase());
      });
    });

    // 2. Sort
    if (sortConfig) {
      data.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [guests, filters, sortConfig]);

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Top Bar: Filters & Actions */}
      <div className="bg-white border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <span className="text-slate-300">-</span>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-2.5 text-slate-400" size={16} />
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <button 
            onClick={fetchGuestsAndComments}
            disabled={isFetching}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-70"
          >
            {isFetching ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Search size={16} />}
            Sorgula
          </button>
        </div>
        
        <div className="text-sm text-slate-500">
          Toplam <strong>{processedData.length}</strong> misafir listeleniyor
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-[1000px]">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* Header Row 1: Titles */}
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4 w-10"></th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('ROOMNO')}>
                  <div className="flex items-center gap-1">Oda <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('GUESTNAMES')}>
                  <div className="flex items-center gap-1">Misafir Adı <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('CHECKIN')}>
                  <div className="flex items-center gap-1">Giriş <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('CHECKOUT')}>
                  <div className="flex items-center gap-1">Çıkış <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('AGENCY')}>
                  <div className="flex items-center gap-1">Acenta <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('ROOMTYPE')}>
                  <div className="flex items-center gap-1">Oda Tipi <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('TOTALPRICE')}>
                  <div className="flex items-center gap-1">Tutar <ArrowUpDown size={12} /></div>
                </th>
                <th className="p-4 text-center">Durum</th>
              </tr>
              
              {/* Header Row 2: Filters */}
              <tr className="bg-white border-b border-slate-200">
                <th className="p-2 bg-slate-50/50">
                  <Filter size={14} className="mx-auto text-slate-300" />
                </th>
                <th className="p-2">
                  <input 
                    type="text" 
                    placeholder="Ara..." 
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-500"
                    onChange={(e) => handleFilterChange('ROOMNO', e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input 
                    type="text" 
                    placeholder="Ara..." 
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-500"
                    onChange={(e) => handleFilterChange('GUESTNAMES', e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input 
                    type="text" 
                    placeholder="Yıl-Ay-Gün" 
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-500"
                    onChange={(e) => handleFilterChange('CHECKIN', e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input 
                    type="text" 
                    placeholder="Yıl-Ay-Gün" 
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-500"
                    onChange={(e) => handleFilterChange('CHECKOUT', e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input 
                    type="text" 
                    placeholder="Ara..." 
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-500"
                    onChange={(e) => handleFilterChange('AGENCY', e.target.value)}
                  />
                </th>
                <th className="p-2">
                  <input 
                    type="text" 
                    placeholder="Ara..." 
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-500"
                    onChange={(e) => handleFilterChange('ROOMTYPE', e.target.value)}
                  />
                </th>
                <th className="p-2">
                  {/* Price filter could be range, but text for now */}
                  <input 
                    type="text" 
                    placeholder="Ara..." 
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-500"
                    onChange={(e) => handleFilterChange('TOTALPRICE', e.target.value)}
                  />
                </th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Veri bulunamadı.
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
                      <td className="p-4 text-sm font-medium text-slate-900">{guest.ROOMNO}</td>
                      <td className="p-4 text-sm text-slate-700 font-medium">{guest.GUESTNAMES}</td>
                      <td className="p-4 text-sm text-slate-500">{formatTRDate(guest.CHECKIN)}</td>
                      <td className="p-4 text-sm text-slate-500">{formatTRDate(guest.CHECKOUT)}</td>
                      <td className="p-4 text-sm text-slate-600">{guest.AGENCY || '-'}</td>
                      <td className="p-4 text-sm text-slate-600">{guest.ROOMTYPE}</td>
                      <td className="p-4 text-sm text-slate-600 font-mono">
                        {guest.TOTALPRICE?.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                      </td>
                      <td className="p-4 text-center">
                        {guest.hasComment && (
                          <div className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-[10px] font-bold border border-amber-200 shadow-sm">
                            <MessageSquare size={12} />
                            Yorum
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedRowId === guest.RESID && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={9} className="p-0">
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

                              {guest.hasComment && guest.commentData ? (
                                <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-sm">
                                  <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex justify-between items-center">
                                    <h5 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                                      <MessageSquare size={16} />
                                      Misafir Yorumu
                                    </h5>
                                    <span className="text-xs text-amber-700 font-medium">
                                      {formatTRDate(guest.commentData.COMMENTDATE)}
                                    </span>
                                  </div>
                                  <div className="p-4">
                                    <p className="text-slate-700 text-sm leading-relaxed italic mb-4">
                                      "{guest.commentData.COMMENT}"
                                    </p>
                                    {guest.commentData.ANSWER && (
                                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <span className="block text-xs font-bold text-slate-500 mb-1">Otel Yanıtı:</span>
                                        <p className="text-sm text-slate-600">{guest.commentData.ANSWER}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center py-4 text-slate-400 text-sm italic border-t border-slate-200 pt-6">
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
