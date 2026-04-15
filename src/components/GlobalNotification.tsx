import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listenToCases } from '../services/firebaseService';
import { CaseTracker, CaseAction } from '../types';

export function GlobalNotification() {
  const [cases, setCases] = useState<CaseTracker[]>([]);
  const [activeNotification, setActiveNotification] = useState<{ caseId: string; action: CaseAction; caseTitle: string; roomNumber: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = listenToCases((fetchedCases) => {
      setCases(fetchedCases);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (cases.length === 0) return;

    let lastDismissedStr = localStorage.getItem('last_dismissed_action_date');
    if (!lastDismissedStr) {
      // If first time, don't show old notifications. Only show new ones from now on.
      const now = Date.now().toString();
      localStorage.setItem('last_dismissed_action_date', now);
      lastDismissedStr = now;
    }
    const lastDismissedDate = parseInt(lastDismissedStr, 10);

    let latestAction: { caseId: string; action: CaseAction; caseTitle: string; roomNumber: string } | null = null;
    let latestDate = 0;

    cases.forEach(c => {
      if (c.actions && c.actions.length > 0) {
        c.actions.forEach(action => {
          const actionDate = new Date(action.date).getTime();
          if (actionDate > lastDismissedDate && actionDate > latestDate) {
            latestDate = actionDate;
            latestAction = {
              caseId: c.id,
              action: action,
              caseTitle: c.title,
              roomNumber: c.roomNumber
            };
          }
        });
      }
    });

    setActiveNotification(latestAction);
  }, [cases]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeNotification) {
      const actionDate = new Date(activeNotification.action.date).getTime();
      localStorage.setItem('last_dismissed_action_date', actionDate.toString());
      setActiveNotification(null);
    }
  };

  const handleClick = () => {
    if (activeNotification) {
      handleDismiss({ stopPropagation: () => {} } as React.MouseEvent);
      navigate(`/cases?caseId=${activeNotification.caseId}`);
    }
  };

  return (
    <AnimatePresence>
      {activeNotification && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: 50 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 50, x: 50 }}
          className="fixed bottom-6 right-6 z-[9999] w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-indigo-500/10 transition-shadow"
          onClick={handleClick}
        >
          <div className="p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-indigo-600">
              <Bell size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                Yeni Vaka Gelişmesi
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              </h4>
              <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">
                Oda: {activeNotification.roomNumber} - {activeNotification.caseTitle}
              </p>
              <p className="text-sm text-slate-700 mt-2 line-clamp-2 leading-snug">
                <span className="font-semibold">{activeNotification.action.performedBy}:</span> {activeNotification.action.actionText}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-bold text-indigo-600">
                Vakaya Git <ExternalLink size={12} />
              </div>
            </div>
            <button 
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              title="Kapat"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
