import React, { useState } from 'react';
import { CommentData } from '../types';
import { MessageSquare, Calendar, Globe, RefreshCw, DoorOpen, ChevronDown, Filter } from 'lucide-react';
import { formatTRDate } from '../utils';

interface SidebarProps {
  comments: CommentData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onFetch: (isLoadMore?: boolean) => void;
  isFetching: boolean;
  fetchLimit: number;
  setFetchLimit: (limit: number) => void;
  hasMoreData: boolean;
  isLoadingMore: boolean;
}

export function Sidebar({ 
  comments, 
  selectedId, 
  onSelect,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onFetch,
  isFetching,
  fetchLimit,
  setFetchLimit,
  hasMoreData,
  isLoadingMore
}: SidebarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showDateInputs, setShowDateInputs] = useState(false);
  const [filterLabel, setFilterLabel] = useState('Son 30 Gün');

  const handleQuickFilter = (type: 'today' | 'yesterday' | 'last7' | 'last14' | 'last30' | 'last90' | 'custom') => {
    const today = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let start = new Date();
    let end = new Date();
    let label = '';
    let showInputs = false;

    switch (type) {
      case 'today':
        label = 'Bugün';
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        label = 'Dün';
        break;
      case 'last7':
        start.setDate(today.getDate() - 7);
        label = 'Son 7 Gün';
        break;
      case 'last14':
        start.setDate(today.getDate() - 14);
        label = 'Son 14 Gün';
        break;
      case 'last30':
        start.setDate(today.getDate() - 30);
        label = 'Son 30 Gün';
        break;
      case 'last90':
        start.setDate(today.getDate() - 90);
        label = 'Son 90 Gün';
        break;
      case 'custom':
        label = 'Özel Tarih Aralığı';
        showInputs = true;
        break;
    }

    setFilterLabel(label);
    setShowDateInputs(showInputs);
    setIsFilterOpen(false);

    if (type !== 'custom') {
      onStartDateChange(formatDate(start));
      onEndDateChange(formatDate(end));
    }
  };

  return (
    <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-slate-200 flex flex-col h-full print:hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare size={20} className="text-slate-500" />
            Gelen Yorumlar
          </h2>
          <span className="text-xs font-medium text-slate-400 bg-slate-200/50 px-2 py-1 rounded-full">{comments.length} Mesaj</span>
        </div>
        
        <div className="flex flex-col gap-3 relative">
          <div className="flex gap-2">
            {/* Filter Dropdown Button */}
            <div className="relative flex-1">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="w-full flex items-center justify-between bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-slate-400" />
                  <span>{filterLabel}</span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isFilterOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsFilterOpen(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1">
                      <button onClick={() => handleQuickFilter('today')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2">Bugün</button>
                      <button onClick={() => handleQuickFilter('yesterday')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2">Dün</button>
                      <button onClick={() => handleQuickFilter('last7')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2">Son 7 Gün</button>
                      <button onClick={() => handleQuickFilter('last14')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2">Son 14 Gün</button>
                      <button onClick={() => handleQuickFilter('last30')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2">Son 30 Gün</button>
                      <button onClick={() => handleQuickFilter('last90')} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-2">Son 90 Gün</button>
                      <div className="h-px bg-slate-100 my-1" />
                      <button onClick={() => handleQuickFilter('custom')} className="w-full text-left px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-2">Özel Tarih Aralığı</button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Fetch Limit Dropdown */}
            <select 
              value={fetchLimit}
              onChange={(e) => setFetchLimit(Number(e.target.value))}
              className="bg-white border border-slate-200 text-slate-700 px-2 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm focus:outline-none"
            >
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1K</option>
              <option value={5000}>5K</option>
              <option value={10000}>10K</option>
            </select>

            {/* Refresh Button */}
            <button 
              onClick={() => onFetch(false)}
              disabled={isFetching}
              className="flex items-center justify-center bg-slate-900 text-white w-10 h-10 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-70 shadow-sm shrink-0"
              title="Yorumları Getir"
            >
              {isFetching ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <RefreshCw size={18} />
              )}
            </button>
          </div>

          {/* Custom Date Inputs (Conditional) */}
          {showDateInputs && (
            <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
              <div className="flex-1">
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all bg-white"
                />
              </div>
              <div className="flex-1">
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all bg-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {comments.length === 0 && !isFetching && (
          <div className="text-center text-slate-400 text-sm py-8">
            Gösterilecek yorum bulunamadı.
          </div>
        )}
        {comments.map((comment) => (
          <div
            key={comment.ID || Math.random().toString()}
            onClick={() => onSelect(comment.ID)}
            className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
              selectedId === comment.ID
                ? 'bg-slate-50 border-slate-900 shadow-sm'
                : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-2 gap-2">
              <h3 className="font-medium text-slate-900 truncate pr-2">{comment.RESNAMEID_LOOKUP || 'Misafir'}</h3>
              {comment.ROOMNO && (
                <div className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                  <DoorOpen size={14} />
                  <span className="text-xs font-bold whitespace-nowrap">Oda: {comment.ROOMNO}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
              <span className="flex items-center gap-1"><Globe size={12} /> {comment.NATIONALITY || 'Bilinmiyor'}</span>
              <span className="flex items-center gap-1"><Calendar size={12} /> {formatTRDate(comment.COMMENTDATE)}</span>
            </div>
            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
              {comment.COMMENT}
            </p>
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs font-medium text-slate-400">{comment.COMMENTSOURCEID_NAME}</span>
            </div>
          </div>
        ))}
        
        {comments.length > 0 && hasMoreData && (
          <div className="pt-2 pb-4 flex justify-center">
            <button
              onClick={() => onFetch(true)}
              disabled={isLoadingMore}
              className="w-full py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm disabled:opacity-50"
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
  );
}
