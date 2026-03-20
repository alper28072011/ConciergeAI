import React, { useState, useEffect } from 'react';
import { X, Sparkles, Brain, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { CommentData, CommentAnalytics } from '../types';
import { analyzeCommentComprehensive } from '../services/aiService';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

interface BulkAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  comments: CommentData[];
  agendaNotes: Record<string, any>;
  type?: 'deep' | 'sentiment'; // Kept for compatibility but ignored
  onComplete: () => void;
}

export function BulkAnalysisModal({ isOpen, onClose, comments, agendaNotes, type, onComplete }: BulkAnalysisModalProps) {
  const [progress, setProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<{ id: string; status: 'success' | 'error' | 'skipped'; message?: string }[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProgress(0);
      setResults([]);
      setIsFinished(false);
    }
  }, [isOpen]);

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setProgress(0);
    setResults([]);

    const alreadyAnalyzedCount = comments.filter(c => {
      const id = String(c.ID);
      const note = agendaNotes[id];
      return note && (note.sentimentScore !== undefined || note.overallScore !== undefined);
    }).length;
    
    let skipAllAnalyzed = false;

    if (alreadyAnalyzedCount > 0) {
      if (window.confirm(`${alreadyAnalyzedCount} yorum zaten analiz edilmiş. Bunları atlamak ister misiniz? (Tamam: Atla, İptal: Hepsini Tekrar Analiz Et)`)) {
        skipAllAnalyzed = true;
      }
    }

    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      try {
        if (!comment.COMMENT) {
          throw new Error("Yorum metni boş.");
        }

        // Check if already analyzed
        const id = String(comment.ID);
        const isAlreadyAnalyzed = agendaNotes[id] && (agendaNotes[id].sentimentScore !== undefined || agendaNotes[id].overallScore !== undefined);
        
        if (isAlreadyAnalyzed && skipAllAnalyzed) {
          setResults(prev => [...prev, { id, status: 'skipped', message: 'Atlandı' }]);
          setProgress(((i + 1) / comments.length) * 100);
          continue;
        }

        const analyticsData = await analyzeCommentComprehensive(comment);

        // Update legacy sentiment score for compatibility
        const sentimentScore = (analyticsData.overallScore || 0) / 100;
        await setDoc(doc(db, "agenda_notes", String(comment.ID)), {
          sentimentScore,
          sentimentAnalysisDate: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        setResults(prev => [...prev, { id: String(comment.ID), status: 'success' }]);
      } catch (error: any) {
        console.error(`Error analyzing comment ${comment.ID}:`, error);
        setResults(prev => [...prev, { id: String(comment.ID), status: 'error', message: error.message }]);
      }

      setProgress(((i + 1) / comments.length) * 100);
    }

    setIsAnalyzing(false);
    setIsFinished(true);
    onComplete();
  };

  if (!isOpen) return null;

  const successCount = results.filter(r => r.status === 'success').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
        >
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {type === 'deep' ? <Sparkles size={20} className="text-purple-600" /> : <Brain size={20} className="text-blue-600" />}
              Toplu {type === 'deep' ? 'Derin Analiz' : 'Duygu Analizi'} ({comments.length} Yorum)
            </h3>
            {!isAnalyzing && (
              <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-lg transition-colors">
                <X size={20} />
              </button>
            )}
          </div>

          <div className="p-6">
            {!isAnalyzing && !isFinished ? (
              <div className="text-center space-y-4">
                <p className="text-slate-600">
                  Seçili <strong>{comments.length}</strong> yorum için {type === 'deep' ? 'Derin Yapay Zeka Analizi' : 'Duygu Skoru Analizi'} başlatılacak. Bu işlem yorum sayısına bağlı olarak biraz zaman alabilir.
                </p>
                <button
                  onClick={startAnalysis}
                  className={`w-full py-3 rounded-xl font-bold text-white shadow-sm transition-all flex items-center justify-center gap-2 ${
                    type === 'deep' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {type === 'deep' ? <Sparkles size={18} /> : <Brain size={18} />}
                  Analizi Başlat
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium text-slate-700">
                    <span>İlerleme</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                    <motion.div 
                      className={`h-full rounded-full ${type === 'deep' ? 'bg-purple-500' : 'bg-blue-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center justify-center">
                    <CheckCircle2 size={24} className="text-emerald-500 mb-1" />
                    <span className="text-2xl font-bold text-emerald-700">{successCount}</span>
                    <span className="text-xs font-medium text-emerald-600">Başarılı</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col items-center justify-center">
                    <Brain size={24} className="text-blue-500 mb-1" />
                    <span className="text-2xl font-bold text-blue-700">{skippedCount}</span>
                    <span className="text-xs font-medium text-blue-600">Atlanan</span>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col items-center justify-center">
                    <AlertCircle size={24} className="text-red-500 mb-1" />
                    <span className="text-2xl font-bold text-red-700">{errorCount}</span>
                    <span className="text-xs font-medium text-red-600">Hatalı</span>
                  </div>
                </div>

                {isFinished && (
                  <button
                    onClick={onClose}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-sm transition-all"
                  >
                    Kapat
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
