import React, { useState } from 'react';
import { CommentData } from '../types';
import { MessageSquare, Calendar, Globe, RefreshCw, DoorOpen, ChevronDown, Filter } from 'lucide-react';
import { formatTRDate } from '../utils';

interface SidebarProps {
  comments: CommentData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onFetch: (isLoadMore?: boolean) => void;
  isFetching: boolean;
  fetchLimit: number;
  setFetchLimit: (limit: number) => void;
  hasMoreData: boolean;
  isLoadingMore: boolean;
  agendaNotes?: Record<string, any>;
}

export function Sidebar({ 
  comments, 
  selectedId, 
  onSelect,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onFetch,
  isFetching,
  fetchLimit,
  setFetchLimit,
  hasMoreData,
  isLoadingMore,
  agendaNotes = {}
}: SidebarProps) {
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
          <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={comments.length > 0 && selectedIds.length === comments.length}
                onChange={onToggleSelectAll}
              />
              Tümünü Seç
            </label>
            {selectedIds.length > 0 && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                {selectedIds.length} Seçili
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {/* Fetch Limit Dropdown */}
            <select 
              value={fetchLimit}
              onChange={(e) => setFetchLimit(Number(e.target.value))}
              className="flex-1 bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm focus:outline-none"
            >
              <option value={100}>100 Yorum</option>
              <option value={500}>500 Yorum</option>
              <option value={1000}>1000 Yorum</option>
            </select>

            {/* Refresh Button */}
            <button 
              onClick={() => onFetch(false)}
              disabled={isFetching}
              className="flex items-center justify-center bg-slate-900 text-white w-10 h-10 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-70 shadow-sm shrink-0"
              title="Yenile"
            >
              <RefreshCw size={18} className={isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
        {isFetching && comments.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-slate-500">Yorumlar yükleniyor...</p>
          </div>
        )}
        {comments.length === 0 && !isFetching && (
          <div className="text-center text-slate-400 text-sm py-8">
            Gösterilecek yorum bulunamadı.
          </div>
        )}
        {comments.map((comment) => {
          const note = agendaNotes[String(comment.ID)];
          const score = note?.sentimentScore;
          
          return (
            <div
              key={comment.ID || Math.random().toString()}
              className={`p-4 rounded-xl border transition-all duration-200 ${
                selectedId === comment.ID
                  ? 'bg-slate-50 border-slate-900 shadow-sm'
                  : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3 mb-2">
                <input 
                  type="checkbox" 
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  checked={selectedIds.includes(comment.ID)}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelect(comment.ID);
                  }}
                />
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => onSelect(comment.ID)}
                >
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <h3 className="font-medium text-slate-900 truncate pr-2">Misafir Yorumu</h3>
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
                    {score !== undefined && score !== null && (
                      <div className={`text-xs font-bold px-2 py-1 rounded-md ${
                        score >= 0.8 ? 'bg-emerald-100 text-emerald-700' :
                        score >= 0.6 ? 'bg-blue-100 text-blue-700' :
                        score >= 0.4 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        Memnuniyet: %{(score * 100).toFixed(0)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
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
