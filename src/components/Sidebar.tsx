import React, { useState, useMemo } from 'react';
import { CommentData } from '../types';
import { MessageSquare, Calendar, Globe, RefreshCw, DoorOpen, ChevronDown, Filter, LayoutTemplate } from 'lucide-react';
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
  commentActions?: Record<string, any[]>;
  viewMode: 'spacious' | 'compact';
  onViewModeChange: (mode: 'spacious' | 'compact') => void;
}

const getOutlookDateGroup = (dateString: string | undefined): string => {
  if (!dateString) return 'Bilinmeyen Tarih';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Bilinmeyen Tarih';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const commentDate = new Date(date);
  commentDate.setHours(0, 0, 0, 0);

  if (commentDate.getTime() === today.getTime()) {
    return 'Bugün';
  } else if (commentDate.getTime() === yesterday.getTime()) {
    return 'Dün';
  } else if (commentDate.getTime() > lastWeek.getTime()) {
    return 'Geçen Hafta';
  } else if (commentDate.getTime() > lastMonth.getTime()) {
    return 'Geçen Ay';
  } else {
    return 'Daha Eski';
  }
};

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
  agendaNotes = {},
  commentActions = {},
  viewMode,
  onViewModeChange
}: SidebarProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'waiting_letter' | 'low_score' | 'high_score' | 'face_to_face'>('all');

  const filteredComments = useMemo(() => {
    return comments.filter(comment => {
      const note = agendaNotes[String(comment.ID)];
      const sentimentScore = note?.sentimentScore;
      const deepAnalytics = note; // Since combinedAnalysisData is passed
      
      const isDissatisfied = (sentimentScore !== null && sentimentScore !== undefined && sentimentScore < 0.5) || 
                             (deepAnalytics?.overallScore !== undefined && (deepAnalytics.overallScore < 50 || deepAnalytics.topics?.some((t: any) => t.score < 50)));
      
      const isHighScore = (sentimentScore !== null && sentimentScore !== undefined && sentimentScore >= 0.8) || 
                          (deepAnalytics?.overallScore !== undefined && deepAnalytics.overallScore >= 80);
      
      const actions = commentActions[String(comment.ID)] || [];
      const hasLetterGenerated = actions.some(action => 
        action.type === 'ai_letter' || action.type === 'template_letter' || action.type === 'email' || action.type === 'manual_close'
      );

      if (filterMode === 'waiting_letter') {
        return isDissatisfied && !hasLetterGenerated;
      }
      if (filterMode === 'low_score') {
        return isDissatisfied;
      }
      if (filterMode === 'high_score') {
        return isHighScore;
      }
      if (filterMode === 'face_to_face') {
        if (!comment.COMMENTSOURCEID_NAME) return false;
        const s = comment.COMMENTSOURCEID_NAME.toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
        return s.includes('yüzyüze') || s.includes('yuzyuze') || s.includes('facetoface');
      }
      return true;
    });
  }, [comments, agendaNotes, commentActions, filterMode]);

  const groupedComments = useMemo(() => {
    const groups: Record<string, CommentData[]> = {
      'Bugün': [],
      'Dün': [],
      'Geçen Hafta': [],
      'Geçen Ay': [],
      'Daha Eski': [],
      'Bilinmeyen Tarih': []
    };

    filteredComments.forEach(comment => {
      const group = getOutlookDateGroup(comment.COMMENTDATE);
      if (groups[group]) {
        groups[group].push(comment);
      } else {
        groups[group] = [comment];
      }
    });

    // Remove empty groups
    return Object.entries(groups).filter(([_, groupComments]) => groupComments.length > 0);
  }, [filteredComments]);

  return (
    <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-slate-200 flex flex-col h-full print:hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare size={20} className="text-slate-500" />
            Gelen Yorumlar
          </h2>
          <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-lg">
            <button 
              onClick={() => onViewModeChange('spacious')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'spacious' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Ferah Görünüm"
            >
              <Filter size={14} />
            </button>
            <button 
              onClick={() => onViewModeChange('compact')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'compact' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Sıkıştırılmış Görünüm"
            >
              <LayoutTemplate size={14} />
            </button>
          </div>
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

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button 
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterMode === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Tümü
            </button>
            <button 
              onClick={() => setFilterMode('waiting_letter')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterMode === 'waiting_letter' ? 'bg-amber-500 text-white shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
            >
              Mektup Bekleyen
            </button>
            <button 
              onClick={() => setFilterMode('low_score')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterMode === 'low_score' ? 'bg-red-500 text-white shadow-sm' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
            >
              Düşük Puanlı
            </button>
            <button 
              onClick={() => setFilterMode('high_score')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterMode === 'high_score' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
            >
              Yüksek Puanlı
            </button>
            <button 
              onClick={() => setFilterMode('face_to_face')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${filterMode === 'face_to_face' ? 'bg-indigo-500 text-white shadow-sm' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
            >
              Yüz Yüze
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
        {groupedComments.map(([groupName, groupComments]) => (
          <div key={groupName} className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1 sticky top-0 bg-white/90 backdrop-blur-sm py-1 z-10">
              {groupName}
            </h3>
            <div className="space-y-2">
              {groupComments.map((comment) => {
                const note = agendaNotes[String(comment.ID)];
                const score = note?.sentimentScore;
                const deepAnalytics = note;
                const isSelected = selectedId === comment.ID;
                
                const isDissatisfied = (score !== null && score !== undefined && score < 0.5) || 
                                      (deepAnalytics?.overallScore !== undefined && (deepAnalytics.overallScore < 50 || deepAnalytics.topics?.some((t: any) => t.score < 50)));
                
                const actions = commentActions[String(comment.ID)] || [];
                const hasLetterGenerated = actions.some(action => 
                  action.type === 'ai_letter' || action.type === 'template_letter' || action.type === 'email' || action.type === 'manual_close'
                );
          
          if (viewMode === 'compact') {
            return (
              <div
                key={comment.ID || Math.random().toString()}
                className={`px-3 py-2 rounded-lg border transition-all duration-200 cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-50 border-slate-900 shadow-sm'
                    : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
                }`}
                onClick={() => onSelect(comment.ID)}
              >
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />}
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    checked={selectedIds.includes(comment.ID)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelect(comment.ID);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <h3 className={`font-semibold text-slate-900 truncate text-xs ${isSelected ? 'text-indigo-600' : ''}`}>
                        {comment.RESNAMEID_LOOKUP ? comment.RESNAMEID_LOOKUP.split('-')[1] : 'Misafir Yorumu'}
                      </h3>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap font-medium">
                        {formatTRDate(comment.COMMENTDATE)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-[11px] text-slate-500 truncate flex-1">
                        {comment.COMMENT}
                      </p>
                      {isDissatisfied && !hasLetterGenerated && (
                        <span className="shrink-0 bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                          Mektup Bekliyor
                        </span>
                      )}
                      {score !== undefined && score !== null && (
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          score >= 0.8 ? 'bg-emerald-500' :
                          score >= 0.6 ? 'bg-blue-500' :
                          score >= 0.4 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={comment.ID || Math.random().toString()}
              className={`p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                isSelected
                  ? 'bg-slate-50 border-slate-900 shadow-sm'
                  : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />}
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
                    <h3 className="font-medium text-slate-900 truncate pr-2">
                      {comment.RESNAMEID_LOOKUP ? comment.RESNAMEID_LOOKUP.split('-')[1] : 'Misafir Yorumu'}
                    </h3>
                    {(comment.resolvedRoomNo || comment.ROOMNO) && (
                      <div className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                        <DoorOpen size={14} />
                        <span className="text-xs font-bold whitespace-nowrap">Oda: {comment.resolvedRoomNo || comment.ROOMNO}</span>
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-400">{comment.COMMENTSOURCEID_NAME}</span>
                      {isDissatisfied && !hasLetterGenerated && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-1 rounded-md">
                          Mektup Bekliyor
                        </span>
                      )}
                    </div>
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
