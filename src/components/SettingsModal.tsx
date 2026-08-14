import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ChevronDown, ChevronUp, Eye, EyeOff, Brain, DollarSign, Activity, 
  Settings2, Database, Plus, Trash2, DoorOpen, Globe, Server, CheckCircle2, 
  AlertCircle, RefreshCw, Sliders, ExternalLink, Check, ArrowRight, Radio
} from 'lucide-react';
import { ApiSettings, AILog, SubRoomMapping } from '../types';
import { DEFAULT_API_BASE_URL } from '../utils/constants';
import { testApiConnection, normalizeBaseUrl } from '../services/api';
import { doc, setDoc, collection, getDocs, getDoc } from "firebase/firestore";
import { db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: ApiSettings) => void;
}

const DEFAULT_COMMENT_TEMPLATE = JSON.stringify({
  "Action": "Select",
  "Object": "QA_HOTEL_GUEST_COMMENT",
  "LoginToken": "{{LOGIN_TOKEN}}",
  "Select": [
    "COMMENTTYPEID", "STATEID", "ID", "HOTELID", "COMMENT", "COMMENTSOURCEID", 
    "RESNAMEID", "COMMENTDATE", "COMMENTSOURCEID_NAME", 
    "ANSWER", "LAST_STATEID", "CREATORID", "CREATORID_USERCODE", "INFO", 
    "SCORE", "GRADE", "PHONE", "EMAIL", "NATIONALITY", "GDPRCONFIRMED", 
    "EMAILCONFIRMED", "PHONECONFIRMED", "SMSCONFIRMED", "WHATSAPPCONFIRMED", 
    "POSITIVE", "NEGATIVE", "SUGGESTION", "INFORMATION", "TYPESTOTAL", 
    "GUESTID", "AGENCYCODE", "ROOMNO", "SOURCEREFID", "SURVEYNAME", 
    "CHECKIN", "CHECKOUT", "EFFECTIVECHECKOUT"
  ],
  "Where": [
    { "Column": "STATEID", "Operator": "=", "Value": 3 },
    { "Column": "HOTELID", "Operator": "=", "Value": "{{HOTELID}}" }
  ],
  "OrderBy": [{ "Column": "COMMENTDATE", "Direction": "DESC" }],
  "Paging": { "ItemsPerPage": 100, "Current": 1 }
}, null, 2);

const DEFAULT_COMMENT_DETAIL_TEMPLATE = JSON.stringify({
  "Action": "Select",
  "Object": "QA_HOTEL_GUEST_COMMENT_DETAIL",
  "LoginToken": "{{LOGIN_TOKEN}}",
  "Select": [
    "ID", "HOTELID", "DETAILTYPE", "DEPNAME", "GROUPNAME", "DETAIL", 
    "COMMENTID", "COMMENTDATE", "COMMENT", "ANSWER", "SOURCENAME", 
    "FULLNAME", "RESID"
  ],
  "Where": [
    { "Column": "COMMENTDATE", "Operator": ">=", "Value": "{{START_DATE}}" },
    { "Column": "COMMENTDATE", "Operator": "<=", "Value": "{{END_DATE}}" },
    { "Column": "HOTELID", "Operator": "=", "Value": "{{HOTELID}}" }
  ],
  "OrderBy": [{ "Column": "COMMENTDATE", "Direction": "DESC" }],
  "Paging": { "ItemsPerPage": 1000, "Current": 1 }
}, null, 2);

const DEFAULT_INHOUSE_TEMPLATE = JSON.stringify({
  "Action": "Select",
  "Object": "QA_HOTEL_RESERVATION_CHECKOUT",
  "LoginToken": "{{LOGIN_TOKEN}}",
  "Select": [
    "RESID", "ROOMNO", "GUESTNAMES", "CHECKIN", "CHECKOUT", "AGENCY", "ROOMTYPE", "TOTALPRICE"
  ],
  "Where": [
    { "Column": "CHECKOUT", "Operator": ">=", "Value": "{{START_DATE}}" },
    { "Column": "CHECKIN", "Operator": "<=", "Value": "{{END_DATE}}" },
    { "Column": "HOTELID", "Operator": "=", "Value": "{{HOTELID}}" }
  ],
  "OrderBy": [{ "Column": "ROOMNO", "Direction": "ASC" }],
  "Paging": { "ItemsPerPage": 100, "Current": 1 }
}, null, 2);

const DEFAULT_RESERVATION_TEMPLATE = JSON.stringify({
  "Action": "Select",
  "Object": "QA_HOTEL_RESERVATION_CHECKOUT",
  "LoginToken": "{{LOGIN_TOKEN}}",
  "Select": [
    "RESID", "ROOMNO", "GUESTNAMES", "CHECKIN", "CHECKOUT", "AGENCY", "ROOMTYPE", "TOTALPRICE"
  ],
  "Where": [
    { "Column": "CHECKIN", "Operator": ">=", "Value": "{{START_DATE}}" },
    { "Column": "CHECKIN", "Operator": "<=", "Value": "{{END_DATE}}" },
    { "Column": "HOTELID", "Operator": "=", "Value": "{{HOTELID}}" }
  ],
  "OrderBy": [{ "Column": "CHECKIN", "Direction": "ASC" }],
  "Paging": { "ItemsPerPage": 100, "Current": 1 }
}, null, 2);

const DEFAULT_CHECKOUT_TEMPLATE = JSON.stringify({
  "Action": "Select",
  "Object": "QA_HOTEL_RESERVATION_CHECKOUT",
  "LoginToken": "{{LOGIN_TOKEN}}",
  "Select": [
    "RESID", "ROOMNO", "GUESTNAMES", "CHECKIN", "CHECKOUT", "AGENCY", "ROOMTYPE", "TOTALPRICE"
  ],
  "Where": [
    { "Column": "CHECKOUT", "Operator": ">=", "Value": "{{START_DATE}}" },
    { "Column": "CHECKOUT", "Operator": "<=", "Value": "{{END_DATE}}" },
    { "Column": "HOTELID", "Operator": "=", "Value": "{{HOTELID}}" }
  ],
  "OrderBy": [{ "Column": "CHECKOUT", "Direction": "DESC" }],
  "Paging": { "ItemsPerPage": 100, "Current": 1 }
}, null, 2);

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [settings, setSettings] = useState<ApiSettings>({
    baseUrl: DEFAULT_API_BASE_URL,
    loginToken: '',
    hotelId: '',
    commentPayloadTemplate: DEFAULT_COMMENT_TEMPLATE,
    commentDetailPayloadTemplate: DEFAULT_COMMENT_DETAIL_TEMPLATE,
    inhousePayloadTemplate: DEFAULT_INHOUSE_TEMPLATE,
    reservationPayloadTemplate: DEFAULT_RESERVATION_TEMPLATE,
    checkoutPayloadTemplate: DEFAULT_CHECKOUT_TEMPLATE,
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    featureModels: {}
  });
  
  const [subRoomMappings, setSubRoomMappings] = useState<SubRoomMapping[]>([]);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'ai' | 'rooms'>('api');
  const [aiLogs, setAiLogs] = useState<AILog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  // Connection testing state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{ success: boolean; message: string; status?: number } | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      // First load from localStorage for immediate UI update
      const saved = window.safeStorage.getItem('hotelApiSettings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          
          // Auto-fix for hardcoded dates in comment template
          let commentTemplate = parsed.commentPayloadTemplate || DEFAULT_COMMENT_TEMPLATE;
          if (commentTemplate.includes('"Value": "2024-01-01"')) {
            commentTemplate = commentTemplate.replace(/"Value": "2024-01-01"/g, '"Value": "{{START_DATE}}"');
          }
          if (commentTemplate.includes('"Value": "2024-12-31"')) {
            commentTemplate = commentTemplate.replace(/"Value": "2024-12-31"/g, '"Value": "{{END_DATE}}"');
          }

          setSettings({
            baseUrl: parsed.baseUrl || DEFAULT_API_BASE_URL,
            loginToken: parsed.loginToken || parsed.token || '',
            hotelId: parsed.hotelId || '',
            commentPayloadTemplate: commentTemplate,
            commentDetailPayloadTemplate: parsed.commentDetailPayloadTemplate || DEFAULT_COMMENT_DETAIL_TEMPLATE,
            inhousePayloadTemplate: parsed.inhousePayloadTemplate || DEFAULT_INHOUSE_TEMPLATE,
            reservationPayloadTemplate: parsed.reservationPayloadTemplate || DEFAULT_RESERVATION_TEMPLATE,
            checkoutPayloadTemplate: parsed.checkoutPayloadTemplate || DEFAULT_CHECKOUT_TEMPLATE,
            geminiApiKey: parsed.geminiApiKey || '',
            geminiModel: parsed.geminiModel || 'gemini-2.5-flash',
            featureModels: parsed.featureModels || {}
          });
        } catch (e) {}
      }

      const savedMappings = window.safeStorage.getItem('subRoomMappings');
      if (savedMappings) {
        try {
          const parsed = JSON.parse(savedMappings);
          setSubRoomMappings(parsed.map((m: any) => ({ ...m, subRoomsInput: m.subRooms.join(', ') })));
        } catch (e) {}
      }

      // Then fetch from Firestore to ensure cross-device sync
      try {
        const apiSettingsDoc = await getDoc(doc(db, "config", "api_settings"));
        if (apiSettingsDoc.exists()) {
          const data = apiSettingsDoc.data();
          let commentTemplate = data.commentPayloadTemplate || DEFAULT_COMMENT_TEMPLATE;
          if (commentTemplate.includes('"Value": "2024-01-01"')) {
            commentTemplate = commentTemplate.replace(/"Value": "2024-01-01"/g, '"Value": "{{START_DATE}}"');
          }
          if (commentTemplate.includes('"Value": "2024-12-31"')) {
            commentTemplate = commentTemplate.replace(/"Value": "2024-12-31"/g, '"Value": "{{END_DATE}}"');
          }

          const newSettings = {
            baseUrl: data.baseUrl || DEFAULT_API_BASE_URL,
            loginToken: data.loginToken || data.token || '',
            hotelId: data.hotelId || '',
            commentPayloadTemplate: commentTemplate,
            commentDetailPayloadTemplate: data.commentDetailPayloadTemplate || DEFAULT_COMMENT_DETAIL_TEMPLATE,
            inhousePayloadTemplate: data.inhousePayloadTemplate || DEFAULT_INHOUSE_TEMPLATE,
            reservationPayloadTemplate: data.reservationPayloadTemplate || DEFAULT_RESERVATION_TEMPLATE,
            checkoutPayloadTemplate: data.checkoutPayloadTemplate || DEFAULT_CHECKOUT_TEMPLATE,
            geminiApiKey: data.geminiApiKey || '',
            geminiModel: data.geminiModel || 'gemini-2.5-flash',
            featureModels: data.featureModels || {}
          };
          setSettings(newSettings);
          window.safeStorage.setItem('hotelApiSettings', JSON.stringify(newSettings));
        }

        const subRoomMappingsDoc = await getDoc(doc(db, "config", "sub_room_mappings"));
        if (subRoomMappingsDoc.exists()) {
          const data = subRoomMappingsDoc.data();
          if (data.mappings && Array.isArray(data.mappings)) {
            setSubRoomMappings(data.mappings.map((m: any) => ({ ...m, subRoomsInput: m.subRooms.join(', ') })));
            window.safeStorage.setItem('subRoomMappings', JSON.stringify(data.mappings));
          }
        }
      } catch (error) {
        console.error("Error fetching settings from Firestore:", error);
      }
    };

    if (isOpen) {
      loadSettings();
      setTestConnectionResult(null);
    }

    window.addEventListener('hotelApiSettingsUpdated', loadSettings);
    return () => {
      window.removeEventListener('hotelApiSettingsUpdated', loadSettings);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'ai') {
      const fetchLogs = async () => {
        setIsLoadingLogs(true);
        try {
          const snapshot = await getDocs(collection(db, 'ai_usage_logs'));
          const logs: AILog[] = [];
          snapshot.forEach(doc => {
            logs.push({ id: doc.id, ...doc.data() } as AILog);
          });
          setAiLogs(logs);
        } catch (error) {
          console.error("Error fetching AI logs:", error);
        } finally {
          setIsLoadingLogs(false);
        }
      };
      fetchLogs();
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (bookmarkletRef.current) {
      const appUrl = window.location.origin;
      const code = `javascript:(function(){
        try {
          var t = window.safeStorage.getItem('loginToken') || window.safeStorage.getItem('token') || sessionStorage.getItem('loginToken');
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear error when user types
    if (e.target.name.includes('Template')) {
        setJsonError(null);
    }
  };

  const handleFeatureModelChange = (feature: string, model: string) => {
    setSettings(prev => ({
      ...prev,
      featureModels: {
        ...prev.featureModels,
        [feature]: model
      }
    }));
  };

  const handleTestConnection = async () => {
    const targetUrl = settings.baseUrl || DEFAULT_API_BASE_URL;
    setIsTestingConnection(true);
    setTestConnectionResult(null);
    try {
      const result = await testApiConnection(targetUrl);
      setTestConnectionResult(result);
    } catch (err: any) {
      setTestConnectionResult({
        success: false,
        message: err.message || 'Bağlantı testi başarısız oldu.'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const setBaseUrlPreset = (presetUrl: string) => {
    setSettings(prev => ({ ...prev, baseUrl: presetUrl }));
    setTestConnectionResult(null);
  };

  const resetToDefault = (name: keyof ApiSettings) => {
    if (confirm('Bu şablonu varsayılan ayarlara döndürmek istediğinize emin misiniz?')) {
      let defaultValue = '';
      switch (name) {
        case 'baseUrl': defaultValue = DEFAULT_API_BASE_URL; break;
        case 'commentPayloadTemplate': defaultValue = DEFAULT_COMMENT_TEMPLATE; break;
        case 'commentDetailPayloadTemplate': defaultValue = DEFAULT_COMMENT_DETAIL_TEMPLATE; break;
        case 'inhousePayloadTemplate': defaultValue = DEFAULT_INHOUSE_TEMPLATE; break;
        case 'reservationPayloadTemplate': defaultValue = DEFAULT_RESERVATION_TEMPLATE; break;
        case 'checkoutPayloadTemplate': defaultValue = DEFAULT_CHECKOUT_TEMPLATE; break;
      }
      setSettings(prev => ({ ...prev, [name]: defaultValue }));
    }
  };

  const validateJson = (jsonString: string, fieldName: string) => {
    try {
      let testString = jsonString
        .replace(/{{LOGIN_TOKEN}}/g, "DUMMY_TOKEN")
        .replace(/{{HOTELID}}/g, "12345")
        .replace(/{{START_DATE}}/g, "2024-01-01")
        .replace(/{{END_DATE}}/g, "2024-01-01");
        
      JSON.parse(testString);
      return true;
    } catch (e) {
      setJsonError(`${fieldName} geçerli bir JSON formatında değil (Placeholderlar dahil kontrol edildi).`);
      return false;
    }
  };

  const handleSave = async () => {
    if (!validateJson(settings.commentPayloadTemplate || '{}', 'Yorum Listesi Şablonu')) return;
    if (!validateJson(settings.commentDetailPayloadTemplate || '{}', 'Yorum Detayları (Köprü) Şablonu')) return;
    if (!validateJson(settings.inhousePayloadTemplate || '{}', 'Konaklayanlar Şablonu')) return;
    if (!validateJson(settings.reservationPayloadTemplate || '{}', 'Rezervasyon Şablonu')) return;
    if (!validateJson(settings.checkoutPayloadTemplate || '{}', 'Ayrılanlar Şablonu')) return;

    const processedMappings = subRoomMappings.map(mapping => {
      const newMapping = { ...mapping };
      if (newMapping.subRoomsInput !== undefined) {
        newMapping.subRooms = newMapping.subRoomsInput.split(',').map(s => s.trim()).filter(s => s !== '');
        delete newMapping.subRoomsInput;
      }
      return newMapping;
    });

    window.safeStorage.setItem('hotelApiSettings', JSON.stringify(settings));
    window.safeStorage.setItem('subRoomMappings', JSON.stringify(processedMappings));
    
    try {
      // Sync all settings to Firestore for centralized management
      await setDoc(doc(db, "config", "api_settings"), {
        ...settings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      await setDoc(doc(db, "config", "sub_room_mappings"), {
        mappings: processedMappings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Error syncing settings to Firestore:", error);
    }

    onSave(settings);
    onClose();
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderAccordionItem = (title: string, name: keyof ApiSettings) => (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => toggleSection(name)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left group"
      >
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider group-hover:text-slate-900">{title}</span>
        {expandedSection === name ? 
          <ChevronUp size={18} className="text-slate-400 group-hover:text-slate-600" /> : 
          <ChevronDown size={18} className="text-slate-400 group-hover:text-slate-600" />
        }
      </button>
      <AnimatePresence>
        {expandedSection === name && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-white border-t border-slate-200 relative">
              <textarea
                name={name}
                value={settings[name] as string}
                onChange={handleChange}
                className="w-full h-64 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-xs font-mono bg-slate-50"
                spellCheck={false}
              />
              <button 
                onClick={() => resetToDefault(name)}
                className="absolute top-6 right-6 text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded transition-colors"
              >
                Varsayılanı Yükle
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0 bg-slate-50">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-semibold text-slate-800">Sistem Ayarları</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('api')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'api' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Database size={16} />
                API Bağlantı
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'ai' 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Brain size={16} />
                Yapay Zeka & FinOps
              </button>
              <button
                onClick={() => setActiveTab('rooms')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === 'rooms' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                <DoorOpen size={16} />
                Alt Oda Yapılandırması
              </button>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {activeTab === 'api' && (
            <div className="space-y-6">
              {/* API Base URL Configuration Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                      <Globe size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-800">API Sunucu Adresi (Base URL)</h3>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                          Parametrik Değişken
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tüm Elektraweb API isteklerinin yönlendirileceği hedef sunucu kök adresi.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBaseUrlPreset(DEFAULT_API_BASE_URL)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                    title="Varsayılan adresi yükle (http://4001.hoteladvisor.net)"
                  >
                    <RefreshCw size={12} />
                    Varsayılan Adres
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Server size={16} />
                      </div>
                      <input
                        type="text"
                        name="baseUrl"
                        value={settings.baseUrl}
                        onChange={handleChange}
                        placeholder={DEFAULT_API_BASE_URL}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm font-mono transition-all text-slate-800"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 shrink-0 disabled:opacity-50"
                    >
                      {isTestingConnection ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Test Ediliyor...</span>
                        </>
                      ) : (
                        <>
                          <Radio size={14} className="text-emerald-400" />
                          <span>Bağlantıyı Test Et</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Preset Shortcuts */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-medium text-slate-500">Hızlı Seçim:</span>
                    {[
                      { label: '4001 (Varsayılan)', url: 'http://4001.hoteladvisor.net' },
                      { label: '4002 (Alternatif)', url: 'http://4002.hoteladvisor.net' },
                      { label: '4001 (HTTPS)', url: 'https://4001.hoteladvisor.net' },
                      { label: 'Elektra Cloud', url: 'https://app.elektraweb.com' }
                    ].map((preset) => {
                      const isSelected = (settings.baseUrl || DEFAULT_API_BASE_URL).trim() === preset.url;
                      return (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => setBaseUrlPreset(preset.url)}
                          className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1 font-mono ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Dynamic Endpoint Structure Preview */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500 font-medium">
                      <span>Dinamik İstek URL Şablonu:</span>
                      <span className="font-mono text-[11px] text-slate-600">{"[Base URL]/[Action]/[Object]"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 bg-white px-2.5 py-1.5 rounded border border-slate-200 font-mono text-[11px] overflow-x-auto">
                      <span className="text-emerald-600 font-semibold shrink-0">POST</span>
                      <span className="text-slate-800 break-all">
                        {normalizeBaseUrl(settings.baseUrl)}/Select/QA_HOTEL_GUEST_COMMENT
                      </span>
                    </div>
                  </div>

                  {/* Test Connection Result Alert */}
                  {testConnectionResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-lg text-xs flex items-start gap-2.5 border ${
                        testConnectionResult.success
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                      }`}
                    >
                      {testConnectionResult.success ? (
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold">{testConnectionResult.message}</p>
                        <p className="text-[11px] opacity-80 mt-0.5">
                          {testConnectionResult.success 
                            ? 'Hedef sunucu ve port istek almaya hazır.' 
                            : 'Girdiğiniz adresi, ağ bağlantınızı veya güvenlik duvarı ayarlarını kontrol ediniz.'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Basic Settings: Hotel ID & Token */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
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

              {/* JSON Templates Accordion */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Dinamik Sorgu Şablonları (JSON)</h3>
                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs border border-blue-100">
                  <strong>Bilgi:</strong> Tarih alanlarına <code>{"{{START_DATE}}"}</code> ve <code>{"{{END_DATE}}"}</code>, 
                  Login Token alanına <code>{"{{LOGIN_TOKEN}}"}</code>, Hotel ID için <code>{"{{HOTELID}}"}</code> yazabilirsiniz. 
                  Sistem bu değerleri otomatik dolduracaktır.
                </div>
                
                {jsonError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                    {jsonError}
                  </div>
                )}

                <div className="space-y-3">
                  {renderAccordionItem('Yorum Listesi Şablonu', 'commentPayloadTemplate')}
                  <div className="relative">
                    {renderAccordionItem('Yorum Detayları (Köprü) İstek Şablonu', 'commentDetailPayloadTemplate')}
                    <p className="text-[10px] text-slate-500 mt-1 ml-1">Bu şablon, Misafirler ve Yorumlar arasında %100 kesin eşleşme (RESID üzerinden) sağlamak için kullanılır.</p>
                  </div>
                  {renderAccordionItem('Konaklayanlar (Inhouse) Şablonu', 'inhousePayloadTemplate')}
                  {renderAccordionItem('Rezervasyon Şablonu', 'reservationPayloadTemplate')}
                  {renderAccordionItem('Ayrılanlar (Checkout) Şablonu', 'checkoutPayloadTemplate')}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'ai' && (
            <div className="space-y-8">
              {/* AI Config */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Settings2 size={20} className="text-purple-600" />
                  Model ve Bağlantı Ayarları
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API Anahtarı</label>
                    <div className="relative">
                      <input 
                        type={showGeminiKey ? "text" : "password"} 
                        name="geminiApiKey" 
                        value={settings.geminiApiKey || ''} 
                        onChange={handleChange} 
                        placeholder="AI özellikleri için gerekli" 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm pr-10" 
                      />
                      <button
                        type="button"
                        onClick={() => setShowGeminiKey(!showGeminiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Varsayılan Yapay Zeka Modeli</label>
                    <select
                      name="geminiModel"
                      value={settings.geminiModel || 'gemini-2.5-flash'}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                    >
                      <option value="gemini-2.5-flash-lite">Ultra Ekonomik & Hızlı (Gemini 2.5 Flash-Lite)</option>
                      <option value="gemini-2.5-flash">Fiyat/Performans Dengesi (Gemini 2.5 Flash) - Önerilen</option>
                      <option value="gemini-2.5-pro">Gelişmiş Mantık ve Strateji (Gemini 2.5 Pro)</option>
                      <option value="gemini-3.1-pro-preview">Yeni Nesil Amiral Gemisi (Gemini 3.1 Pro Preview)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">Modül bazlı seçim yapılmadığında kullanılacak varsayılan model.</p>
                  </div>
                </div>

                {/* Module-Specific AI Models */}
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <h4 className="text-sm font-semibold text-slate-800 mb-4">Modül Bazlı Model Tercihleri</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Mektup Üretimi</label>
                      <select
                        value={settings.featureModels?.letterGeneration || ''}
                        onChange={(e) => handleFeatureModelChange('letterGeneration', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Mektup Çevirisi</label>
                      <select
                        value={settings.featureModels?.translation || ''}
                        onChange={(e) => handleFeatureModelChange('translation', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Derin Yorum Analizi (İş Zekası)</label>
                      <select
                        value={settings.featureModels?.deepAnalysis || ''}
                        onChange={(e) => handleFeatureModelChange('deepAnalysis', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Vaka Özeti</label>
                      <select
                        value={settings.featureModels?.caseSummary || ''}
                        onChange={(e) => handleFeatureModelChange('caseSummary', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Vaka Mektubu</label>
                      <select
                        value={settings.featureModels?.caseLetter || ''}
                        onChange={(e) => handleFeatureModelChange('caseLetter', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Şablon Çevirisi</label>
                      <select
                        value={settings.featureModels?.templateTranslation || ''}
                        onChange={(e) => handleFeatureModelChange('templateTranslation', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Yönetim Raporu Üretimi</label>
                      <select
                        value={settings.featureModels?.dashboardReport || ''}
                        onChange={(e) => handleFeatureModelChange('dashboardReport', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Dashboard Bölüm Özetleri (AI)</label>
                      <select
                        value={settings.featureModels?.dashboardSectionSummary || ''}
                        onChange={(e) => handleFeatureModelChange('dashboardSectionSummary', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Toplu Aksiyon Raporu</label>
                      <select
                        value={settings.featureModels?.bulkReport || ''}
                        onChange={(e) => handleFeatureModelChange('bulkReport', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Dashboard Derin Analizler (Deep Diagnostics)</label>
                      <select
                        value={settings.featureModels?.dashboardDeepAnalytics || ''}
                        onChange={(e) => handleFeatureModelChange('dashboardDeepAnalytics', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm bg-white"
                      >
                        <option value="">Varsayılan Modeli Kullan</option>
                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* FinOps Dashboard */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Activity size={20} className="text-blue-600" />
                  Tüketim ve Maliyet Dashboard'u (FinOps)
                </h3>
                
                {isLoadingLogs ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                          <Brain size={20} />
                        </div>
                        <h4 className="font-medium text-slate-600 text-sm">Toplam İşlem Sayısı</h4>
                      </div>
                      <p className="text-3xl font-bold text-slate-800">{aiLogs.length}</p>
                      <p className="text-xs text-slate-500 mt-2">Mektup, Analiz, Çeviri vb.</p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                          <Activity size={20} />
                        </div>
                        <h4 className="font-medium text-slate-600 text-sm">Toplam Harcanan Token</h4>
                      </div>
                      <p className="text-3xl font-bold text-slate-800">
                        {(aiLogs.reduce((acc, log) => acc + log.inputTokens + log.outputTokens, 0)).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 mt-2">Input + Output Tokenları</p>
                    </div>

                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                          <DollarSign size={20} />
                        </div>
                        <h4 className="font-medium text-slate-600 text-sm">Toplam Tahmini Maliyet</h4>
                      </div>
                      <p className="text-3xl font-bold text-emerald-600">
                        ${(aiLogs.reduce((acc, log) => acc + log.costUSD, 0)).toFixed(4)}
                      </p>
                      <p className="text-xs text-slate-500 mt-2">Güncel model tarifelerine göre</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'rooms' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold mb-1">Alt Oda / Bağlantılı Oda Yapılandırması</p>
                <p>Elektraweb'den gelen ana oda numaralarını, misafir notlarındaki (ALLNOTES) bilgilere göre alt odalara ayırmak için bu alanı kullanın. Örneğin ana oda "4401" ise ve notlarda "4500" geçiyorsa, sistem odayı otomatik olarak 4500 olarak çözümleyecektir.</p>
              </div>

              <div className="space-y-4">
                {subRoomMappings.map((mapping, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Ana Oda (Elektraweb)</label>
                      <input 
                        type="text" 
                        value={mapping.mainRoom}
                        onChange={(e) => {
                          const newMappings = [...subRoomMappings];
                          newMappings[index].mainRoom = e.target.value;
                          setSubRoomMappings(newMappings);
                        }}
                        placeholder="Örn: 4401"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div className="flex-[2]">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Alt Odalar (Virgülle ayırın)</label>
                      <input 
                        type="text" 
                        value={mapping.subRoomsInput !== undefined ? mapping.subRoomsInput : mapping.subRooms.join(', ')}
                        onChange={(e) => {
                          const newMappings = [...subRoomMappings];
                          newMappings[index].subRoomsInput = e.target.value;
                          setSubRoomMappings(newMappings);
                        }}
                        placeholder="Örn: 4401, 4500, 4501"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        const newMappings = subRoomMappings.filter((_, i) => i !== index);
                        setSubRoomMappings(newMappings);
                      }}
                      className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setSubRoomMappings([...subRoomMappings, { mainRoom: '', subRooms: [], subRoomsInput: '' }])}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 font-medium text-sm"
                >
                  <Plus size={18} />
                  Yeni Eşleştirme Ekle
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button onClick={handleSave} className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
            Ayarları Kaydet
          </button>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
