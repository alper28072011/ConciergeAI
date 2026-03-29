import React from 'react';
import { UnifiedTimelineAction } from '../types';
import { Database, Sparkles, FileText, Edit3, PhoneCall, Send, Trash2, MessageCircle, BarChart3 } from 'lucide-react';

interface TimelineViewProps {
  actions: UnifiedTimelineAction[];
  onDeleteAction?: (id: string) => void;
  onPreviewAction?: (action: UnifiedTimelineAction) => void;
  onGenerateReport?: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ actions, onDeleteAction, onPreviewAction, onGenerateReport }) => {
  if (actions.length === 0) {
    return (
      <div className="text-center text-slate-400 mt-10">
        <Database size={32} className="mx-auto mb-3 opacity-20" />
        <p className="text-sm">Henüz bir aksiyon bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {onGenerateReport && (
        <div className="flex justify-end mb-4">
          <button
            onClick={onGenerateReport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-medium text-sm transition-colors border border-indigo-200 shadow-sm"
          >
            <BarChart3 size={16} />
            Yönetim Raporu Oluştur (AI)
          </button>
        </div>
      )}
      <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
      {actions.map((action) => {
        let icon = <Database size={14} className="text-blue-500" />;
        let iconBg = "bg-blue-100";
        let borderColor = "border-blue-200";
        
        if (action.type === 'ai_letter') {
          icon = <Sparkles size={14} className="text-purple-500" />;
          iconBg = "bg-purple-100";
          borderColor = "border-purple-200";
        } else if (action.type === 'template') {
          icon = <FileText size={14} className="text-green-500" />;
          iconBg = "bg-green-100";
          borderColor = "border-green-200";
        } else if (action.type === 'manual') {
          icon = <Edit3 size={14} className="text-orange-500" />;
          iconBg = "bg-orange-100";
          borderColor = "border-orange-200";
        } else if (action.type === 'welcome_call') {
          icon = <PhoneCall size={14} className="text-indigo-500" />;
          iconBg = "bg-indigo-100";
          borderColor = "border-indigo-200";
        } else if (action.type === 'survey_sent') {
          icon = <Send size={14} className="text-teal-500" />;
          iconBg = "bg-teal-100";
          borderColor = "border-teal-200";
        } else if (action.type === 'whatsapp_sent') {
          icon = <MessageCircle size={14} className="text-emerald-500" />;
          iconBg = "bg-emerald-100";
          borderColor = "border-emerald-200";
        } else if (action.type === 'report') {
          icon = <BarChart3 size={14} className="text-rose-500" />;
          iconBg = "bg-rose-100";
          borderColor = "border-rose-200";
        }

        return (
          <div key={action.id} className="relative pl-6 group">
            <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full ${iconBg} border-2 border-white flex items-center justify-center shadow-sm`}>
              {icon}
            </div>
            <div className={`bg-white p-4 rounded-xl border ${borderColor} shadow-sm relative`}>
              {action.type !== 'elektra' && action.type !== 'survey_sent' && onDeleteAction && (
                <button
                  onClick={() => onDeleteAction(action.id)}
                  className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                  title="Sil"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <div className="flex justify-between items-start mb-2 pr-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {action.source || 'Sistem'}
                </span>
                <span className="text-xs text-slate-400">
                  {action.date ? new Date(action.date).toLocaleString('tr-TR', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', 
                    hour: '2-digit', minute: '2-digit' 
                  }) : 'Tarih Yok'}
                </span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{action.description}</p>
              {action.content && onPreviewAction && (
                <div className="mt-3">
                  <button
                    onClick={() => onPreviewAction(action)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <FileText size={14} />
                    İçeriği Görüntüle
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
};
