import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ApiSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: ApiSettings) => void;
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<ApiSettings>({
    baseUrl: '',
    loginToken: '',
    hotelId: '',
    action: 'Select',
    objectName: 'QA_HOTEL_GUEST_COMMENT'
  });

  useEffect(() => {
    const saved = localStorage.getItem('hotelApiSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
          baseUrl: parsed.baseUrl || '',
          loginToken: parsed.loginToken || parsed.token || '', // Fallback for migration
          hotelId: parsed.hotelId || '',
          action: parsed.action || 'Select',
          objectName: parsed.objectName || 'QA_HOTEL_GUEST_COMMENT'
        });
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = () => {
    localStorage.setItem('hotelApiSettings', JSON.stringify(settings));
    onSave(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">API Bağlantı Ayarları</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Base URL</label>
            <input type="text" name="baseUrl" value={settings.baseUrl} onChange={handleChange} placeholder="https://4001.hoteladvisor.net" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Elektraweb Login Token</label>
            <input type="password" name="loginToken" value={settings.loginToken} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Uygulama Elektraweb ile aynı ağ/domain üzerinde çalışıyorsa bu alan otomatik dolar. Harici kullanım için tarayıcınızın Geliştirici Araçları -&gt; Application -&gt; Local Storage altından 'loginToken' değerini kopyalayıp buraya yapıştırın.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hotel ID</label>
            <input type="text" name="hotelId" value={settings.hotelId} onChange={handleChange} placeholder="21390" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
              <input type="text" name="action" value={settings.action} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Object Name</label>
              <input type="text" name="objectName" value={settings.objectName} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button onClick={handleSave} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
            Ayarları Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
