import React from 'react';
import { CommentData } from '../types';
import { MessageSquare, Calendar, Globe, RefreshCw } from 'lucide-react';

interface SidebarProps {
  comments: CommentData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onFetch: () => void;
  isFetching: boolean;
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
  isFetching
}: SidebarProps) {
  const getBadgeColor = (groupName: string | undefined) => {
    if (!groupName) return 'bg-slate-100 text-slate-700 border-slate-200';
    const lower = groupName.toLowerCase();
    if (lower.includes('temizlik') || lower.includes('housekeeping')) return 'bg-red-100 text-red-700 border-red-200';
    if (lower.includes('restoran') || lower.includes('yemek')) return 'bg-green-100 text-green-700 border-green-200';
    if (lower.includes('öneri')) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <MessageSquare size={20} className="text-slate-500" />
          Gelen Yorumlar
        </h2>
        
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Başlangıç</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => onStartDateChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Bitiş</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => onEndDateChange(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all"
              />
            </div>
          </div>
          <button 
            onClick={onFetch}
            disabled={isFetching}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-70"
          >
            {isFetching ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <RefreshCw size={16} />
            )}
            {isFetching ? 'Yükleniyor...' : 'Yorumları Getir'}
          </button>
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
            key={comment.COMMENTID || Math.random().toString()}
            onClick={() => onSelect(comment.COMMENTID)}
            className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
              selectedId === comment.COMMENTID
                ? 'bg-slate-50 border-slate-900 shadow-sm'
                : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-2 gap-2">
              <h3 className="font-medium text-slate-900 truncate pr-2">{comment.GUESTNAME || 'Misafir'}</h3>
              {comment.GROUPNAME && (
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${getBadgeColor(comment.GROUPNAME)}`}>
                  {comment.GROUPNAME}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
              <span className="flex items-center gap-1"><Globe size={12} /> {comment.NATIONALITY || 'Bilinmiyor'}</span>
              <span className="flex items-center gap-1"><Calendar size={12} /> {comment.COMMENTDATE}</span>
            </div>
            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
              {comment.COMMENT}
            </p>
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs font-medium text-slate-400">{comment.SOURCENAME}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
