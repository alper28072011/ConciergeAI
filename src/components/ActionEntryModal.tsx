import React, { useState } from 'react';
import { X, Save, Clock, Tag } from 'lucide-react';
import { PREDEFINED_ACTIONS } from '../types';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

interface ActionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  guestId: string | number;
  commentId?: string | number;
  onActionAdded: () => void;
}

export function ActionEntryModal({ isOpen, onClose, guestId, commentId, onActionAdded }: ActionEntryModalProps) {
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleChipClick = (action: typeof PREDEFINED_ACTIONS[number]) => {
    setDescription(prev => prev ? `${prev}\n${action.description}` : action.description);
    setSelectedCategory(action.category);
  };

  const handleSave = async () => {
    if (!description.trim()) return;
    
    setIsSaving(true);
    try {
      const actionsRef = collection(db, "comment_actions");
      await addDoc(actionsRef, {
        commentId: commentId ? String(commentId) : '',
        resId: String(guestId),
        type: 'manual',
        description: description.trim(),
        actionCategory: selectedCategory || 'diger',
        date: new Date().toISOString(),
      });
      
      setDescription('');
      setSelectedCategory(undefined);
      onActionAdded();
      onClose();
    } catch (error) {
      console.error("Error saving action:", error);
      alert("Aksiyon kaydedilirken bir hata oluştu.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Manuel Not / Aksiyon Ekle</h3>
              <p className="text-sm text-slate-500">Misafir için alınan aksiyonu zaman damgalı olarak kaydedin</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Tag size={16} className="text-slate-400" />
              Hızlı Seçim (Aksiyon Tipleri)
            </label>
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChipClick(action)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    selectedCategory === action.category && description.includes(action.description)
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Aksiyon Detayı / Not</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Misafir için yapılan işlemi veya alınan notu buraya yazın..."
              className="w-full h-32 px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none text-slate-700"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={!description.trim() || isSaving}
            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-indigo-200"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
