import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ApiSettings } from '../types';
import { doc, setDoc } from "firebase/firestore";
import { db } from '../firebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: ApiSettings) => void;
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<ApiSettings>({
    baseUrl: '',
    loginToken: '',
    hotelId: ''
  });
  
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hotelApiSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
          baseUrl: parsed.baseUrl || '',
          loginToken: parsed.loginToken || parsed.token || '', // Fallback for migration
          hotelId: parsed.hotelId || ''
        });
      } catch (e) {}
    }
  }, [isOpen]);

  useEffect(() => {
    if (bookmarkletRef.current) {
      // We set the href directly to bypass React's security check for javascript: URLs
      const appUrl = window.location.origin;
      const code = `javascript:(function(){
        try {
          var t = localStorage.getItem('loginToken') || localStorage.getItem('token') || sessionStorage.getItem('loginToken');
          if(!t) {
            alert('Elektraweb token bulunamadı! Lütfen giriş yapınız.');
            return;
          }
          var newUrl = '${appUrl}?token=' + t;
          window.open(newUrl, '_self');
        } catch(e) {
          alert('Hata: ' + e.message);
        }
      })();`.replace(/\s+/g, ' ');
      
      bookmarkletRef.current.href = code;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    localStorage.setItem('hotelApiSettings', JSON.stringify(settings));
    
    // Sync token to Firestore for other instances
    if (settings.loginToken) {
      try {
        await setDoc(doc(db, "config", "api_settings"), {
          loginToken: settings.loginToken,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (error) {
        console.error("Error syncing token to Firestore:", error);
      }
    }

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
          
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Otomatik Bağlantı (Bookmarklet)</h3>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Tarayıcı güvenlik kuralları gereği, bir web sitesi (bizim uygulamamız) başka bir sitenin (Elektraweb) verilerini doğrudan okuyamaz. Bu nedenle aşağıdaki butonu kullanarak güvenli bir köprü oluşturuyoruz:
            </p>
            <ol className="list-decimal list-inside text-xs text-slate-600 mb-3 space-y-1">
              <li>Aşağıdaki <strong>Elektraweb Sync</strong> butonunu tarayıcınızın yer imleri çubuğuna sürükleyip bırakın.</li>
              <li><strong>app.elektraweb.com</strong> sekmesine gidin (oturumunuz açık olsun).</li>
              <li>Yer imlerine eklediğiniz butona tıklayın.</li>
            </ol>
            <div className="flex justify-center">
              <a 
                ref={bookmarkletRef}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md text-xs font-bold hover:bg-emerald-700 transition-colors cursor-grab active:cursor-grabbing shadow-sm select-none"
                title="Bunu yer imleri çubuğuna sürükleyin"
                onClick={(e) => e.preventDefault()}
              >
                🔄 Elektraweb Sync
              </a>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Elektraweb Login Token</label>
            <input type="password" name="loginToken" value={settings.loginToken} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Manuel giriş için: Tarayıcınızın Geliştirici Araçları -&gt; Application -&gt; Local Storage altından 'loginToken' değerini kopyalayıp buraya yapıştırın.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hotel ID</label>
            <input type="text" name="hotelId" value={settings.hotelId} onChange={handleChange} placeholder="21390" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
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
