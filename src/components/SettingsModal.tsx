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

const DEFAULT_COMMENT_TEMPLATE = JSON.stringify({
  "Action": "Select",
  "Object": "QA_HOTEL_GUEST_COMMENT",
  "Select": [
    "COMMENTTYPEID", "STATEID", "ID", "HOTELID", "COMMENT", "COMMENTSOURCEID", 
    "RESNAMEID", "COMMENTDATE", "COMMENTSOURCEID_NAME", "RESNAMEID_LOOKUP", 
    "ANSWER", "LAST_STATEID", "CREATORID", "CREATORID_USERCODE", "INFO", 
    "SCORE", "GRADE", "PHONE", "EMAIL", "NATIONALITY", "GDPRCONFIRMED", 
    "EMAILCONFIRMED", "PHONECONFIRMED", "SMSCONFIRMED", "WHATSAPPCONFIRMED", 
    "POSITIVE", "NEGATIVE", "SUGGESTION", "INFORMATION", "TYPESTOTAL", 
    "GUESTID", "AGENCYCODE", "ROOMNO", "SOURCEREFID", "SURVEYNAME", 
    "CHECKIN", "CHECKOUT", "EFFECTIVECHECKOUT"
  ],
  "Where": [
    { "Column": "STATEID", "Operator": "=", "Value": 3 },
    { "Column": "COMMENTDATE", "Operator": ">=", "Value": "2024-01-01" },
    { "Column": "COMMENTDATE", "Operator": "<=", "Value": "2024-12-31" },
    { "Column": "HOTELID", "Operator": "=", "Value": 0 }
  ],
  "OrderBy": [{ "Column": "COMMENTDATE", "Direction": "DESC" }],
  "Paging": { "ItemsPerPage": 100, "Current": 1 }
}, null, 2);

const DEFAULT_GUEST_TEMPLATE = JSON.stringify({
  "Action": "Select",
  "Object": "QA_HOTEL_RESERVATION_CHECKOUT",
  "Select": [
    "RESID", "ROOMNO", "GUESTNAMES", "CHECKIN", "CHECKOUT", "AGENCY", "ROOMTYPE", "TOTALPRICE"
  ],
  "Where": [
    { "Column": "CHECKOUT", "Operator": ">=", "Value": "2024-01-01" },
    { "Column": "CHECKOUT", "Operator": "<=", "Value": "2024-12-31" },
    { "Column": "HOTELID", "Operator": "=", "Value": 0 }
  ],
  "OrderBy": [{ "Column": "CHECKOUT", "Direction": "DESC" }],
  "Paging": { "ItemsPerPage": 100, "Current": 1 }
}, null, 2);

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<ApiSettings>({
    baseUrl: '',
    loginToken: '',
    hotelId: '',
    commentPayloadTemplate: DEFAULT_COMMENT_TEMPLATE,
    guestPayloadTemplate: DEFAULT_GUEST_TEMPLATE
  });
  
  const [jsonError, setJsonError] = useState<string | null>(null);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hotelApiSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
          baseUrl: parsed.baseUrl || '',
          loginToken: parsed.loginToken || parsed.token || '',
          hotelId: parsed.hotelId || '',
          commentPayloadTemplate: parsed.commentPayloadTemplate || DEFAULT_COMMENT_TEMPLATE,
          guestPayloadTemplate: parsed.guestPayloadTemplate || DEFAULT_GUEST_TEMPLATE
        });
      } catch (e) {}
    }
  }, [isOpen]);

  useEffect(() => {
    if (bookmarkletRef.current) {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear error when user types
    if (e.target.name.includes('Template')) {
        setJsonError(null);
    }
  };

  const validateJson = (jsonString: string, fieldName: string) => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch (e) {
      setJsonError(`${fieldName} geçerli bir JSON formatında değil.`);
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateJson(settings.commentPayloadTemplate || '{}', 'Yorum Listesi Şablonu')) return;
    if (!validateJson(settings.guestPayloadTemplate || '{}', 'Misafir Listesi Şablonu')) return;

    localStorage.setItem('hotelApiSettings', JSON.stringify(settings));
    
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
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">API Bağlantı ve Sorgu Ayarları</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base URL</label>
                <input type="text" name="baseUrl" value={settings.baseUrl} onChange={handleChange} placeholder="https://4001.hoteladvisor.net" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hotel ID</label>
                <input type="text" name="hotelId" value={settings.hotelId} onChange={handleChange} placeholder="21390" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Elektraweb Login Token</label>
                <input type="password" name="loginToken" value={settings.loginToken} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm" />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 h-fit">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">Otomatik Bağlantı (Bookmarklet)</h3>
              <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                Tarayıcı güvenlik kuralları gereği, token'ı otomatik almak için bu butonu kullanın:
              </p>
              <div className="flex justify-center mb-2">
                <a 
                  ref={bookmarkletRef}
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md text-xs font-bold hover:bg-emerald-700 transition-colors cursor-grab active:cursor-grabbing shadow-sm select-none"
                  onClick={(e) => e.preventDefault()}
                >
                  🔄 Elektraweb Sync
                </a>
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                Butonu yer imleri çubuğuna sürükleyin, sonra Elektraweb sekmesinde tıklayın.
              </p>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* JSON Templates */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">Dinamik Sorgu Şablonları (JSON)</h3>
            <p className="text-xs text-slate-500">
              Aşağıdaki alanlara geçerli JSON sorgu şablonlarını yapıştırın. Sistem, tarihleri ve otel ID'sini otomatik olarak güncelleyecektir.
            </p>
            
            {jsonError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                {jsonError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wider">Yorum Listesi Şablonu</label>
                <textarea 
                  name="commentPayloadTemplate" 
                  value={settings.commentPayloadTemplate} 
                  onChange={handleChange} 
                  className="w-full h-64 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-xs font-mono bg-slate-50"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wider">Misafir Listesi Şablonu</label>
                <textarea 
                  name="guestPayloadTemplate" 
                  value={settings.guestPayloadTemplate} 
                  onChange={handleChange} 
                  className="w-full h-64 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-xs font-mono bg-slate-50"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button onClick={handleSave} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
            Ayarları Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
