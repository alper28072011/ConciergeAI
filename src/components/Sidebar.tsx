import React from 'react';
import { CommentData } from '../types';
import { MessageSquare, Calendar, Globe } from 'lucide-react';

interface SidebarProps {
  comments: CommentData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Sidebar({ comments, selectedId, onSelect }: SidebarProps) {
  const getBadgeColor = (groupName: string) => {
    const lower = groupName.toLowerCase();
    if (lower.includes('temizlik') || lower.includes('housekeeping')) return 'bg-red-100 text-red-700 border-red-200';
    if (lower.includes('restoran') || lower.includes('yemek')) return 'bg-green-100 text-green-700 border-green-200';
    if (lower.includes('öneri')) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="w-1/3 min-w-[320px] max-w-[400px] bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <MessageSquare size={20} className="text-slate-500" />
          Gelen Yorumlar
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {comments.map((comment) => (
          <div
            key={comment.COMMENTID}
            onClick={() => onSelect(comment.COMMENTID)}
            className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
              selectedId === comment.COMMENTID
                ? 'bg-slate-50 border-slate-900 shadow-sm'
                : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium text-slate-900 truncate pr-2">{comment.GUESTNAME}</h3>
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${getBadgeColor(comment.GROUPNAME)}`}>
                {comment.GROUPNAME}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
              <span className="flex items-center gap-1"><Globe size={12} /> {comment.NATIONALITY}</span>
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
