import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import { executeElektraQuery } from '../services/api';
import { CommentAnalytics, HotelTaxonomy } from '../types';
import { HOTEL_MAIN_CATEGORIES } from '../utils/constants';
import { 
  BarChart3, TrendingUp, AlertCircle, MessageSquare, Calendar as CalendarIcon, 
  Award, AlertTriangle, FileText, Download, X, Save, Edit3, Trash2, Clock, 
  Filter, Brain, Globe, Database, CheckCircle2, PieChart as PieChartIcon,
  ChevronRight, ArrowUpRight, ArrowDownRight, Printer, Sparkles, Layout,
  Settings, Eye, EyeOff, LayoutGrid, List, ChevronDown, ChevronUp, Layers, History,
  MousePointerClick
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAIContent } from '../services/aiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { getDashboardData } from '../utils/biEngine';
import { buildUnifiedTimeline } from '../utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#71717a'];
const RADAR_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

// Country code mapping for flags
const getCountryCode = (countryName: string): string => {
  if (!countryName) return '';
  
  const name = countryName.trim().toLowerCase();
  
  const mapping: { [key: string]: string } = {
    // Common mappings (Turkish & English) - Lowercase keys for robust matching
    'türkiye': 'tr', 'turkey': 'tr', 'tr': 'tr',
    'almanya': 'de', 'germany': 'de', 'de': 'de',
    'ingiltere': 'gb', 'united kingdom': 'gb', 'uk': 'gb', 'birleşik krallık': 'gb', 'great britain': 'gb', 'gb': 'gb',
    'rusya': 'ru', 'russia': 'ru', 'rusya federasyonu': 'ru', 'russian federation': 'ru', 'ru': 'ru',
    'hollanda': 'nl', 'netherlands': 'nl', 'nl': 'nl',
    'belçika': 'be', 'belgium': 'be', 'be': 'be',
    'fransa': 'fr', 'france': 'fr', 'fr': 'fr',
    'italya': 'it', 'italy': 'it', 'it': 'it',
    'ispanya': 'es', 'spain': 'es', 'es': 'es',
    'abd': 'us', 'usa': 'us', 'united states': 'us', 'amerika': 'us', 'amerika birleşik devletleri': 'us', 'us': 'us',
    'ukrayna': 'ua', 'ukraine': 'ua', 'ua': 'ua',
    'polonya': 'pl', 'poland': 'pl', 'pl': 'pl',
    'isviçre': 'ch', 'switzerland': 'ch', 'ch': 'ch',
    'avusturya': 'at', 'austria': 'at', 'at': 'at',
    'isveç': 'se', 'sweden': 'se', 'se': 'se',
    'norveç': 'no', 'norway': 'no', 'no': 'no',
    'danimarka': 'dk', 'denmark': 'dk', 'dk': 'dk',
    'finlandiya': 'fi', 'finland': 'fi', 'fi': 'fi',
    'yunanistan': 'gr', 'greece': 'gr', 'gr': 'gr',
    'bulgaristan': 'bg', 'bulgaria': 'bg', 'bg': 'bg',
    'romanya': 'ro', 'romania': 'ro', 'ro': 'ro',
    'azerbaycan': 'az', 'azerbaijan': 'az', 'az': 'az',
    'kazakistan': 'kz', 'kazakhstan': 'kz', 'kz': 'kz',
    'özbekistan': 'uz', 'uzbekistan': 'uz', 'uz': 'uz',
    'türkmenistan': 'tm', 'turkmenistan': 'tm', 'tm': 'tm',
    'kırgızistan': 'kg', 'kyrgyzstan': 'kg', 'kg': 'kg',
    'iran': 'ir', 'ir': 'ir',
    'irak': 'iq', 'iraq': 'iq', 'iq': 'iq',
    'suriye': 'sy', 'syria': 'sy', 'sy': 'sy',
    'lübnan': 'lb', 'lebanon': 'lb', 'lb': 'lb',
    'ürdün': 'jo', 'jordan': 'jo', 'jo': 'jo',
    'mısır': 'eg', 'egypt': 'eg', 'eg': 'eg',
    'suudi arabistan': 'sa', 'saudi arabia': 'sa', 'sa': 'sa',
    'bae': 'ae', 'uae': 'ae', 'birleşik arap emirlikleri': 'ae', 'united arab emirates': 'ae', 'ae': 'ae',
    'katar': 'qa', 'qatar': 'qa', 'qa': 'qa',
    'kuveyt': 'kw', 'kuwait': 'kw', 'kw': 'kw',
    'bahreyn': 'bh', 'bahrain': 'bh', 'bh': 'bh',
    'umman': 'om', 'oman': 'om', 'om': 'om',
    'israil': 'il', 'israel': 'il', 'il': 'il',
    'çin': 'cn', 'china': 'cn', 'cn': 'cn',
    'japonya': 'jp', 'japan': 'jp', 'jp': 'jp',
    'güney kore': 'kr', 'south korea': 'kr', 'kr': 'kr',
    'hindistan': 'in', 'india': 'in', 'in': 'in',
    'pakistan': 'pk', 'pk': 'pk',
    'kanada': 'ca', 'canada': 'ca', 'ca': 'ca',
    'meksika': 'mx', 'mexico': 'mx', 'mx': 'mx',
    'brezilya': 'br', 'brazil': 'br', 'br': 'br',
    'arjantin': 'ar', 'argentina': 'ar', 'ar': 'ar',
    'avustralya': 'au', 'australia': 'au', 'au': 'au',
    'yeni zelanda': 'nz', 'new zealand': 'nz', 'nz': 'nz',
    'güney afrika': 'za', 'south africa': 'za', 'za': 'za',
    'fas': 'ma', 'morocco': 'ma', 'ma': 'ma',
    'tunus': 'tn', 'tunisia': 'tn', 'tn': 'tn',
    'cezayir': 'dz', 'algeria': 'dz', 'dz': 'dz',
    'libya': 'ly', 'ly': 'ly',
    'nijerya': 'ng', 'nigeria': 'ng', 'ng': 'ng',
    'gürcistan': 'ge', 'georgia': 'ge', 'ge': 'ge',
    'ermenistan': 'am', 'armenia': 'am', 'am': 'am',
    'kıbrıs': 'cy', 'cyprus': 'cy', 'cy': 'cy',
    'malta': 'mt', 'mt': 'mt',
    'macaristan': 'hu', 'hungary': 'hu', 'hu': 'hu',
    'çekya': 'cz', 'czechia': 'cz', 'czech republic': 'cz', 'cz': 'cz',
    'slovakya': 'sk', 'slovakia': 'sk', 'sk': 'sk',
    'irlanda': 'ie', 'ireland': 'ie', 'ie': 'ie',
    'lüksemburg': 'lu', 'luxembourg': 'lu', 'lu': 'lu',
    'sırbistan': 'rs', 'serbia': 'rs', 'rs': 'rs',
    'hırvatistan': 'hr', 'croatia': 'hr', 'hr': 'hr',
    'slovenya': 'si', 'slovenia': 'si', 'si': 'si',
    'bosna hersek': 'ba', 'bosnia and herzegovina': 'ba', 'ba': 'ba',
    'karadağ': 'me', 'montenegro': 'me', 'me': 'me',
    'arnavutluk': 'al', 'albania': 'al', 'al': 'al',
    'kuzey makedonya': 'mk', 'north macedonia': 'mk', 'makedonya': 'mk', 'macedonia': 'mk', 'mk': 'mk',
    'estonya': 'ee', 'estonia': 'ee', 'ee': 'ee',
    'letonya': 'lv', 'latvia': 'lv', 'lv': 'lv',
    'litvanya': 'lt', 'lithuania': 'lt', 'lt': 'lt',
    'beyaz rusya': 'by', 'belarus': 'by', 'by': 'by',
    'moldova': 'md', 'md': 'md',
    'kosova': 'xk', 'kosovo': 'xk', 'xk': 'xk',
    'izlanda': 'is', 'iceland': 'is', 'is': 'is',
    'portekiz': 'pt', 'portugal': 'pt', 'pt': 'pt',
  };
  
  return mapping[name] || '';
};

const AVAILABLE_MODULES = [
  { id: 'kpi_cards', label: 'KPI Özet Kartları', icon: LayoutGrid },
  { id: 'satisfaction_timeline', label: 'Zamana Göre Memnuniyet Skoru', icon: Clock },
  { id: 'category_satisfaction', label: 'Kategori Bazlı Memnuniyet', icon: BarChart3 },
  { id: 'source_analysis', label: 'Kanal Dağılımı (OTA)', icon: PieChartIcon },
  { id: 'nationality_analysis', label: 'Uyruk Memnuniyet Endeksi', icon: Globe },
  { id: 'hotel_agenda', label: 'Otel Gündemi & Alt Konular', icon: List },
];

const getGuaranteedUserId = () => {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  let localUid = localStorage.getItem('crm_device_uid');
  if (!localUid) {
    localUid = 'device_' + Math.random().toString(36).substr(2, 11);
    localStorage.setItem('crm_device_uid', localUid);
  }
  return localUid;
};

export function DashboardModule() {
  const [analytics, setAnalytics] = useState<CommentAnalytics[]>([]);
  const [commentActions, setCommentActions] = useState<Record<string, any[]>>({});
  const [taxonomy, setTaxonomy] = useState<HotelTaxonomy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisYear' | 'custom'>('30days');
  const [isCompareActive, setIsCompareActive] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [selectedNationalities, setSelectedNationalities] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [isSourceExpanded, setIsSourceExpanded] = useState(false);
  const [isNationalityExpanded, setIsNationalityExpanded] = useState(false);
  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false);
  const [isDateExpanded, setIsDateExpanded] = useState(false);
  const [globalViewMode, setGlobalViewMode] = useState<'chart' | 'table'>('chart');
  const [showSubCategories, setShowSubCategories] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [activeModules, setActiveModules] = useState<string[]>(['kpi_cards', 'satisfaction_timeline', 'category_satisfaction', 'source_analysis', 'nationality_analysis', 'hotel_agenda']);
  const [modulesOrder, setModulesOrder] = useState(AVAILABLE_MODULES);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [drillDownFilter, setDrillDownFilter] = useState<{ type: 'category' | 'source' | 'nationality' | 'all', value: string, sentiment?: 'negative' | 'positive' | 'all' }>({ type: 'all', value: 'all' });
  const [timelineGranularity, setTimelineGranularity] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  
  // Show All Toggles
  const [showAllMostMentioned, setShowAllMostMentioned] = useState(false);
  const [showAllTopPositive, setShowAllTopPositive] = useState(false);
  const [showAllTopNegative, setShowAllTopNegative] = useState(false);

  useEffect(() => {
    setPortalTarget(document.getElementById('header-actions-portal'));
  }, []);
  
  // Report State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [isSavedReportsModalOpen, setIsSavedReportsModalOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingReportType, setEditingReportType] = useState<string>('dashboard_summary');
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isExportOptionsModalOpen, setIsExportOptionsModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeComments: true,
    includeFilters: true,
    interactive: true,
    title: `Otel CRM Kokpit Raporu - ${new Date().toLocaleDateString('tr-TR')}`
  });

  useEffect(() => {
    const initPreferences = async () => {
      const uid = getGuaranteedUserId();
      setUserId(uid);
      
      try {
        const docRef = doc(db, 'user_preferences', uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          let resolvedModulesOrder = AVAILABLE_MODULES;
          if (data.modulesOrder && Array.isArray(data.modulesOrder)) {
            const ordered = data.modulesOrder.map((id: string) => AVAILABLE_MODULES.find(m => m.id === id)).filter(Boolean) as typeof AVAILABLE_MODULES;
            const missing = AVAILABLE_MODULES.filter(m => !data.modulesOrder.includes(m.id));
            resolvedModulesOrder = [...ordered, ...missing];
          }

          setModulesOrder(resolvedModulesOrder);
          if (data.activeModules) setActiveModules(data.activeModules);
          if (data.globalViewMode) setGlobalViewMode(data.globalViewMode as any);
          if (data.dateFilter) setDateFilter(data.dateFilter as any);
          if (data.customStartDate) setCustomStartDate(data.customStartDate);
          if (data.customEndDate) setCustomEndDate(data.customEndDate);
          if (data.selectedMainCategory) setSelectedMainCategory(data.selectedMainCategory);
          if (data.selectedSubCategory) setSelectedSubCategory(data.selectedSubCategory);
          if (data.selectedNationalities) setSelectedNationalities(data.selectedNationalities);
          if (data.selectedSources) setSelectedSources(data.selectedSources);
          if (data.isSourceExpanded !== undefined) setIsSourceExpanded(data.isSourceExpanded);
          if (data.isNationalityExpanded !== undefined) setIsNationalityExpanded(data.isNationalityExpanded);
          if (data.isDateExpanded !== undefined) setIsDateExpanded(data.isDateExpanded);
        }
      } catch (error) {
        console.error("Tercihler yüklenirken hata:", error);
      } finally {
        setIsInitialLoad(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, () => {
      initPreferences();
    });
    
    const timeoutId = setTimeout(initPreferences, 1000);

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const handleSavePreferences = async () => {
    const uid = getGuaranteedUserId();
    
    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const dataToSave = {
        modulesOrder: modulesOrder.map(m => m.id),
        activeModules,
        globalViewMode,
        dateFilter,
        customStartDate,
        customEndDate,
        selectedMainCategory,
        selectedSubCategory,
        selectedNationalities,
        selectedSources,
        isSourceExpanded,
        isNationalityExpanded,
        isDateExpanded,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'user_preferences', uid), dataToSave, { merge: true });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Tercihler kaydedilirken hata:", error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
      alert("Kaydetme işlemi başarısız oldu.");
    } finally {
      setIsSaving(false);
    }
  };

  const moveModule = (id: string, direction: 'up' | 'down') => {
    const index = modulesOrder.findIndex(m => m.id === id);
    if (index === -1) return;
    const newOrder = [...modulesOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setModulesOrder(newOrder);
  };

  useEffect(() => {
    const syncMissingComments = async () => {
      try {
        const missingComments = analytics.filter(c => !c.comment || c.comment.trim() === '' || c.comment === 'Yorum metni sistemde bulunamadı.' || c.answer == null);
        if (missingComments.length === 0) return;

        const missingIds = missingComments.map(c => Number(c.commentId)).filter(id => !isNaN(id));
        if (missingIds.length === 0) return;

        const savedSettings = localStorage.getItem('hotelApiSettings');
        if (!savedSettings) return;
        const settings = JSON.parse(savedSettings);
        if (!settings.commentPayloadTemplate) return;

        const basePayload = JSON.parse(settings.commentPayloadTemplate);
        
        // Chunk IDs to prevent API 500 errors (too many parameters in IN clause)
        const chunkSize = 100;
        for (let i = 0; i < missingIds.length; i += chunkSize) {
          const chunk = missingIds.slice(i, i + chunkSize);
          
          const payload = {
            ...basePayload,
            // 1. DÜZELTME: ANSWER kolonunu da API'den istiyoruz!
            Select: ["ID", "COMMENT", "ANSWER"],
            Where: [
              ...((basePayload.Where && Array.isArray(basePayload.Where)) ? basePayload.Where : []),
              { Column: "ID", Operator: "IN", Value: chunk }
            ],
            Paging: { Current: 1, ItemsPerPage: 5000 }
          };

          try {
            const response = await executeElektraQuery(payload);
            
            if (response && Array.isArray(response)) {
              // Process chunk
              for (const item of response) {
                if (item.ID) {
                  const docRef = doc(db, 'comment_analytics', String(item.ID));
                  const updateData: any = {};
                  
                  if (item.COMMENT) updateData.comment = item.COMMENT;
                  // 2. DÜZELTME: Gelen ANSWER verisini Firestore'a (answer adıyla) kaydediyoruz!
                  if (item.ANSWER !== undefined) updateData.answer = item.ANSWER || '';

                  if (Object.keys(updateData).length > 0) {
                    await updateDoc(docRef, updateData).catch(e => console.warn("Sessiz güncelleme atlandı:", e));
                  }
                }
              }
            }
          } catch (chunkError) {
            console.error(`Chunk senkronizasyon hatası (${i}-${i+chunkSize}):`, chunkError);
          }
          
          // Small delay between chunks to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error("Arka plan yorum senkronizasyonu hatası:", error);
      }
    };

    const timeoutId = setTimeout(() => {
      syncMissingComments();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [analytics]);

  useEffect(() => {
    setIsLoading(true);
    
    const fetchTaxonomy = async () => {
      try {
        const docRef = doc(db, 'system_memory', 'taxonomy');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTaxonomy(docSnap.data() as HotelTaxonomy);
        }
      } catch (error) {
        console.error("Error fetching taxonomy:", error);
      }
    };
    fetchTaxonomy();

    const unsubscribe = onSnapshot(collection(db, 'comment_analytics'), (querySnapshot) => {
      const data: CommentAnalytics[] = [];
      querySnapshot.forEach((doc) => {
        data.push(doc.data() as CommentAnalytics);
      });
      setAnalytics(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching analytics:", error);
      setIsLoading(false);
      handleFirestoreError(error, OperationType.GET, 'comment_analytics');
    });

    const unsubscribeActions = onSnapshot(collection(db, 'comment_actions'), (querySnapshot) => {
      const actionsMap: Record<string, any[]> = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const commentId = data.commentId;
        if (!actionsMap[commentId]) {
          actionsMap[commentId] = [];
        }
        actionsMap[commentId].push({ id: doc.id, ...data });
      });
      Object.keys(actionsMap).forEach(key => {
        actionsMap[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      });
      setCommentActions(actionsMap);
    }, (error) => {
      console.error("Error fetching comment_actions:", error);
      handleFirestoreError(error, OperationType.GET, 'comment_actions');
    });

    return () => {
      unsubscribe();
      unsubscribeActions();
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'executive_reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const reports: any[] = [];
      querySnapshot.forEach((doc) => {
        reports.push({ id: doc.id, ...doc.data() });
      });
      setSavedReports(reports);
    }, (error) => {
      console.error("Error fetching saved reports:", error);
      handleFirestoreError(error, OperationType.GET, 'executive_reports');
    });

    return () => unsubscribe();
  }, []);

  const { filteredAnalytics, previousFilteredAnalytics } = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const currentYear = now.getFullYear();
    
    const parseDate = (dateStr: string) => {
      if (!dateStr) return new Date();
      if (typeof dateStr === 'string' && dateStr.includes('.') && dateStr.split('.').length === 3) {
        const [d, m, y] = dateStr.split('.');
        return new Date(`${y}-${m}-${d}`);
      }
      return new Date(dateStr);
    };

    let currentStart = new Date(now);
    let currentEnd = new Date(now);
    let previousStart = new Date(now);
    let previousEnd = new Date(now);

    if (dateFilter === 'today') {
      currentStart.setHours(0, 0, 0, 0);
      previousEnd = new Date(currentStart);
      previousEnd.setMilliseconds(-1);
      previousStart = new Date(previousEnd);
      previousStart.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'yesterday') {
      currentStart.setDate(currentStart.getDate() - 1);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd.setDate(currentEnd.getDate() - 1);
      previousEnd = new Date(currentStart);
      previousEnd.setMilliseconds(-1);
      previousStart = new Date(previousEnd);
      previousStart.setHours(0, 0, 0, 0);
    } else if (dateFilter === '7days') {
      currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentStart);
      previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === '30days') {
      currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentStart);
      previousStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'thisYear') {
      currentStart = new Date(currentYear, 0, 1);
      previousEnd = new Date(currentStart);
      previousEnd.setMilliseconds(-1);
      previousStart = new Date(currentYear - 1, 0, 1);
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      currentStart = new Date(customStartDate);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date(customEndDate);
      currentEnd.setHours(23, 59, 59, 999);
      const diffTime = currentEnd.getTime() - currentStart.getTime();
      previousEnd = new Date(currentStart.getTime() - 1);
      previousStart = new Date(previousEnd.getTime() - diffTime);
    }

    const current: CommentAnalytics[] = [];
    const previous: CommentAnalytics[] = [];

    analytics.forEach(item => {
      let itemDate = parseDate(item.date);
      if (isNaN(itemDate.getTime())) {
        itemDate = parseDate(item.createdAt);
      }
      
      if (selectedMainCategory !== 'all') {
        const hasCategory = item.topics?.some(t => t.mainCategory === selectedMainCategory);
        if (!hasCategory) return;
        
        if (selectedSubCategory !== 'all') {
          const hasSub = item.topics?.some(t => t.mainCategory === selectedMainCategory && t.subCategory === selectedSubCategory);
          if (!hasSub) return;
        }
      }

      if (selectedNationalities.length > 0) {
        if (!selectedNationalities.includes(item.nationality || 'Bilinmiyor')) return;
      }

      if (selectedSources.length > 0) {
        if (!selectedSources.includes(item.source || 'Bilinmiyor')) return;
      }

      if (itemDate >= currentStart && itemDate <= currentEnd) {
        current.push(item);
      } else if (isCompareActive && itemDate >= previousStart && itemDate <= previousEnd) {
        previous.push(item);
      }
    });

    // Sort by date descending (newest first)
    current.sort((a, b) => parseDate(b.date || (b as any).createdAt).getTime() - parseDate(a.date || (a as any).createdAt).getTime());
    previous.sort((a, b) => parseDate(b.date || (b as any).createdAt).getTime() - parseDate(a.date || (a as any).createdAt).getTime());

    return { filteredAnalytics: current, previousFilteredAnalytics: previous };
  }, [analytics, dateFilter, customStartDate, customEndDate, selectedMainCategory, selectedSubCategory, selectedNationalities, selectedSources, isCompareActive]);

  const drillDownComments = useMemo(() => {
    if (drillDownFilter.type === 'all') return filteredAnalytics;
    
    return filteredAnalytics.filter(item => {
      if (drillDownFilter.type === 'category') {
        if (drillDownFilter.value.includes('|')) {
          const [main, sub] = drillDownFilter.value.split('|');
          return item.topics?.some(t => 
            t.mainCategory === main && 
            t.subCategory === sub &&
            (drillDownFilter.sentiment === 'negative' ? (t.score !== undefined && t.score < 50) : true) &&
            (drillDownFilter.sentiment === 'positive' ? (t.score !== undefined && t.score >= 80) : true)
          );
        } else {
          return item.topics?.some(t => 
            (t.subCategory === drillDownFilter.value || t.mainCategory === drillDownFilter.value) &&
            (drillDownFilter.sentiment === 'negative' ? (t.score !== undefined && t.score < 50) : true) &&
            (drillDownFilter.sentiment === 'positive' ? (t.score !== undefined && t.score >= 80) : true)
          );
        }
      }
      if (drillDownFilter.type === 'source') return item.source === drillDownFilter.value;
      if (drillDownFilter.type === 'nationality') return item.nationality === drillDownFilter.value;
      return true;
    });
  }, [filteredAnalytics, drillDownFilter]);

  const dashboardData = useMemo(() => getDashboardData(filteredAnalytics, isCompareActive ? previousFilteredAnalytics : undefined), [filteredAnalytics, previousFilteredAnalytics, isCompareActive]);
  const previousDashboardData = useMemo(() => getDashboardData(previousFilteredAnalytics), [previousFilteredAnalytics]);

  const hierarchicalCategoryData = useMemo(() => {
    const groups: { [key: string]: { name: string, count: number, totalScore: number, subCategories: any[] } } = {};
    
    dashboardData.mostMentioned.forEach(item => {
      if (!groups[item.mainCategory]) {
        groups[item.mainCategory] = { name: item.mainCategory, count: 0, totalScore: 0, subCategories: [] };
      }
      groups[item.mainCategory].count += item.count;
      groups[item.mainCategory].totalScore += (item.avgScore * item.count);
      groups[item.mainCategory].subCategories.push(item);
    });

    return Object.values(groups).map(group => ({
      ...group,
      avgScore: Math.round(group.totalScore / group.count)
    })).sort((a, b) => b.count - a.count);
  }, [dashboardData.mostMentioned]);

  const categoryChartData = useMemo(() => {
    const flatData: any[] = [];
    hierarchicalCategoryData.forEach(group => {
      flatData.push({
        name: group.name,
        score: group.avgScore,
        count: group.count,
        isSub: false
      });
      
      if (showSubCategories || expandedCategories[group.name]) {
        group.subCategories.forEach(sub => {
          flatData.push({
            name: sub.subCategory,
            score: sub.avgScore,
            count: sub.count,
            isSub: true,
            parent: group.name
          });
        });
      }
    });
    return flatData;
  }, [hierarchicalCategoryData, showSubCategories, expandedCategories]);

  const allNationalities = useMemo(() => {
    const nats = new Set<string>();
    analytics.forEach(item => nats.add(item.nationality || 'Bilinmiyor'));
    return Array.from(nats).sort();
  }, [analytics]);

  const allSources = useMemo(() => {
    const sources = new Set<string>();
    analytics.forEach(item => sources.add(item.source || 'Bilinmiyor'));
    return Array.from(sources).sort();
  }, [analytics]);

  const handleExportHtml = async () => {
    if (!dashboardRef.current) return;

    // Temporarily expand all categories for export so they are in the DOM
    const previousShowSubCategories = showSubCategories;
    setShowSubCategories(true);
    
    // Wait for React to render the expanded rows
    await new Promise(resolve => setTimeout(resolve, 300));

    const clone = dashboardRef.current.cloneNode(true) as HTMLElement;
    
    // Restore previous state
    setShowSubCategories(previousShowSubCategories);
    
    // If they were originally collapsed, hide them in the clone
    if (!previousShowSubCategories) {
      const mainCategoryRows = clone.querySelectorAll('.main-category-row');
      mainCategoryRows.forEach(row => {
        const categoryName = row.getAttribute('data-category-name');
        if (categoryName && !expandedCategories[categoryName]) {
          row.setAttribute('data-expanded', 'false');
          const icon = row.querySelector('.category-expand-icon');
          if (icon) {
            icon.classList.remove('rotate-180', 'text-indigo-500');
          }
          const subRows = clone.querySelectorAll(`.subtopic-row[data-parent-category="${categoryName}"]`);
          subRows.forEach(subRow => {
            subRow.classList.add('hidden');
          });
        }
      });
      
      const toggleBtn = clone.querySelector('#toggle-subtopics-btn');
      if (toggleBtn) {
        toggleBtn.setAttribute('data-showing', 'false');
        toggleBtn.setAttribute('title', 'Alt Konuları Göster');
        toggleBtn.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-100');
        toggleBtn.classList.add('bg-slate-100', 'text-slate-600');
      }
    }
    
    // Gereksiz scrollbar ve boşlukları temizle
    clone.classList.remove('overflow-y-auto', 'pr-4', 'custom-scrollbar', 'pb-20');
    
    const noExportElements = clone.querySelectorAll('.no-export');
    noExportElements.forEach(el => el.remove());

    if (exportOptions.interactive) {
      const interactiveOnlyElements = clone.querySelectorAll('.interactive-only');
      interactiveOnlyElements.forEach(el => {
        el.classList.remove('interactive-only', 'hidden');
      });
    } else {
      const interactiveOnlyElements = clone.querySelectorAll('.interactive-only');
      interactiveOnlyElements.forEach(el => el.remove());
    }

    // SVG düzeltmeleri
    const svgs = clone.querySelectorAll('svg');
    svgs.forEach(svg => {
      if (svg.classList.contains('recharts-surface')) {
        const viewBox = svg.getAttribute('viewBox');
        if (!viewBox || viewBox === '0 0 0 0') {
          const width = svg.getAttribute('width') || svg.getBoundingClientRect().width || '1000';
          const height = svg.getAttribute('height') || svg.getBoundingClientRect().height || '400';
          svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        svg.setAttribute('width', '100%');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.display = 'block';
      }
    });

    const responsiveContainers = clone.querySelectorAll('.recharts-responsive-container');
    responsiveContainers.forEach(container => {
      const parent = container.parentElement;
      if (parent) {
        parent.style.height = 'auto';
        parent.style.minHeight = 'unset';
        parent.style.overflow = 'visible';
      }
    });

    const content = clone.innerHTML;
    
    // --- EUREKA: YORUMLARI DOĞRUDAN HTML OLARAK ÜRETİP DIŞARIYA ENJEKTE EDİYORUZ ---
    let commentsSidebarHtml = '';
    if (exportOptions.includeComments) {
      // Aktif Filtre Çubuğu
      let allCommentsHtml = `
        <div id="active-filter-bar" class="bg-indigo-50 border border-indigo-200 p-4 rounded-xl mb-4 flex justify-between items-center text-sm font-bold text-indigo-800 shadow-sm" style="display: none;"> 
          <span id="active-filter-text">Filtre: </span> 
          <button id="clear-filter-btn" class="text-xs bg-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-100 cursor-pointer border border-indigo-200 transition-colors">
            Tümünü Göster
          </button> 
        </div>`;
      
      if (filteredAnalytics.length === 0) {
        allCommentsHtml += '<div class="flex flex-col items-center justify-center py-20 text-slate-400 opacity-50"><p class="text-sm font-bold">Bu döneme ait yorum bulunamadı</p></div>';
      } else {
        filteredAnalytics.forEach((commentData) => {
          const localText = commentData.comment || (commentData as any).rawText || (commentData as any).COMMENT || '';
          const dateStr = new Date(commentData.date || commentData.createdAt).toLocaleDateString('tr-TR');
          
          // Akıllı Filtre Etiketleri (Data Attributes)
          const categories = commentData.topics?.map(t => t.mainCategory).join(',') || '';
          const subCategories = commentData.topics?.map(t => t.subCategory).join(',') || '';
          const compositeTopics = commentData.topics?.map(t => `${t.mainCategory}|${t.subCategory}`).join(',') || '';
          const nationality = commentData.nationality || 'Bilinmiyor';
          const source = commentData.source || 'Bilinmiyor';

          let topicsHtml = '';
          if (commentData.topics && commentData.topics.length > 0) {
              topicsHtml = '<div class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">';
              commentData.topics.forEach(topic => {
                  const tScore = topic.score || 0;
                  let tColorClass = 'bg-slate-100 text-slate-500 border-slate-200';
                  if (tScore >= 80) tColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  else if (tScore >= 50) tColorClass = 'bg-amber-50 text-amber-700 border-amber-100';
                  else tColorClass = 'bg-red-50 text-red-700 border-red-100';
                  
                  topicsHtml += `<span class="text-[9px] font-black ${tColorClass} border px-2 py-1 rounded shadow-sm uppercase">${topic.subCategory}</span>`;
              });
              topicsHtml += '</div>';
          }

          let textHtml = '';
          if (localText) {
              textHtml = `<p class="text-sm text-slate-700 leading-relaxed">"${localText}"</p>`;
          } else {
              textHtml = '<p class="text-sm text-slate-400 italic">Metin bulunamadı.</p>';
          }

          const localAnswer = commentData.answer || (commentData as any).ANSWER || '';
          const firebaseActions = commentActions[String(commentData.commentId)] || [];
          const unifiedActions = buildUnifiedTimeline(localAnswer, firebaseActions);
          
          let actionsHtml = '';
          if (unifiedActions.length > 0) {
            actionsHtml = `
              <div class="mt-4 pt-4 border-t border-slate-100">
                <button class="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-800 transition-colors uppercase" onclick="const content = this.nextElementSibling; const icon = this.querySelector('svg'); content.classList.toggle('expanded'); icon.classList.toggle('rotated');">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="accordion-icon"><path d="m6 9 6 6 6-6"/></svg>
                  Alınan Aksiyonlar (${unifiedActions.length})
                </button>
                <div class="accordion-content pl-2 border-l-2 border-indigo-100">
                  ${unifiedActions.map(action => `
                    <div class="relative pl-4 mb-3 last:mb-0">
                      <div class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-400 border-2 border-white"></div>
                      <div class="text-[9px] font-bold text-slate-400 mb-0.5">${action.date ? new Date(action.date).toLocaleString('tr-TR') : 'Tarih Belirtilmemiş'}</div>
                      <div class="text-xs text-slate-700">${action.description}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }

          const oScore = commentData.overallScore || 0;
          let oColorClass = 'bg-slate-50 text-slate-700 border-slate-200';
          if (oScore >= 80) oColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
          else if (oScore >= 50) oColorClass = 'bg-amber-50 text-amber-700 border-amber-100';
          else oColorClass = 'bg-red-50 text-red-700 border-red-100';

          allCommentsHtml += `<div class="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-indigo-400 transition-all mb-4 comment-card visible-card" 
              data-source="${source}" 
              data-nationality="${nationality}" 
              data-topics="${compositeTopics},${subCategories},${categories}"
              data-overall-score="${oScore}"
              style="animation-delay: ${Math.min(filteredAnalytics.indexOf(commentData) * 0.05, 0.5)}s;">
              <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                      <span class="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 uppercase">${source}</span>
                      <span class="text-xs font-bold text-slate-400">${dateStr}</span>
                  </div>
                  <div class="text-sm font-black ${oColorClass} border px-2 py-1 rounded-lg">${oScore}/100</div>
              </div>
              <div class="relative">${textHtml}</div>
              ${topicsHtml}
              ${actionsHtml}
          </div>`;
        });
      }

      // Yorumları kendi tasarım sütununa oturtuyoruz
      commentsSidebarHtml = `
        <aside class="w-full xl:w-[450px] shrink-0 mt-8 xl:mt-0 relative">
          <div class="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar flex flex-col">
            <h3 class="text-base font-black text-slate-900 uppercase tracking-widest mb-6 border-b border-slate-200 pb-4 flex items-center gap-2 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Yorum Detayları
            </h3>
            <div id="comments-wrapper" class="flex flex-col flex-1">
              ${allCommentsHtml}
            </div>
          </div>
        </aside>
      `;
    }

    const dateRangeLabel = dateFilter === 'today' ? 'Bugün' :
                           dateFilter === 'yesterday' ? 'Dün' :
                           dateFilter === '7days' ? 'Son 7 Gün' :
                           dateFilter === '30days' ? 'Son 30 Gün' :
                           dateFilter === 'thisYear' ? 'Bu Yıl' :
                           dateFilter === 'custom' ? `${customStartDate} - ${customEndDate}` : 'Tümü';

    const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${exportOptions.title || 'Yönetim Raporu'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; padding: 40px 0; display: flex; justify-content: center; }
        /* Geniş ekran monitörler için konteyneri büyüttük */
        .report-container { width: 95%; max-width: 1600px; background: white; min-height: 297mm; padding: 40px; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1); border-radius: 16px; border: 1px solid #e2e8f0; }
        .recharts-responsive-container { width: 100% !important; height: auto !important; min-height: unset !important; }
        .recharts-responsive-container > div { width: 100% !important; height: auto !important; position: relative !important; }
        .recharts-wrapper { width: 100% !important; height: auto !important; padding-bottom: 20px !important; }
        .recharts-surface { width: 100% !important; height: auto !important; overflow: visible !important; display: block !important; }
        .recharts-layer { visibility: visible !important; opacity: 1 !important; clip-path: none !important; }
        .recharts-cartesian-axis-tick-value, .recharts-cartesian-axis-tick text { font-size: 12px !important; font-weight: 700 !important; fill: #334155 !important; }
        .recharts-label, .recharts-label-list text { font-size: 12px !important; font-weight: 900 !important; }
        .recharts-text { font-family: 'Inter', sans-serif !important; font-size: 12px !important; }
        .recharts-legend-wrapper { position: relative !important; bottom: auto !important; left: auto !important; right: auto !important; top: auto !important; width: 100% !important; height: auto !important; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }

        .subtopic-row { transition: all 0.3s ease; }
        .active-filter-highlight { outline: 2px solid #6366f1; outline-offset: 2px; border-radius: 4px; background-color: #f8fafc; }
        
        /* --- ANIMASYONLAR --- */
        @keyframes fadeInSlideUp {
            from { opacity: 0; transform: translateY(15px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .comment-card {
            transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                        transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                        max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                        margin 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                        padding 0.4s cubic-bezier(0.4, 0, 0.2, 1),
                        border-width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            transform-origin: top center;
            overflow: hidden;
            animation: fadeInSlideUp 0.6s ease-out forwards;
            animation-fill-mode: both;
        }
        
        .comment-card.hidden-card {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
            max-height: 0;
            margin-bottom: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            border-width: 0 !important;
            pointer-events: none;
        }
        
        .comment-card.visible-card {
            opacity: 1;
            transform: scale(1) translateY(0);
            max-height: 2000px; /* Yeterince büyük bir değer */
            pointer-events: auto;
        }

        /* Accordion animasyonu */
        .accordion-content {
            transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease, margin 0.4s ease;
            max-height: 0;
            opacity: 0;
            overflow: hidden;
            margin-top: 0;
        }
        
        .accordion-content.expanded {
            max-height: 1000px;
            opacity: 1;
            margin-top: 0.75rem; /* mt-3 */
        }
        
        .accordion-icon {
            transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .accordion-icon.rotated {
            transform: rotate(180deg);
        }

        #active-filter-bar {
            transition: opacity 0.3s ease, transform 0.3s ease;
            opacity: 0;
            transform: translateY(-10px);
            display: none;
        }
        
        #active-filter-bar.visible {
            display: flex;
            opacity: 1;
            transform: translateY(0);
        }
        
        @media print {
            .no-print { display: none; }
            body { background-color: white; padding: 0; }
            .report-container { width: 100%; max-width: 100%; box-shadow: none; border: none; padding: 0; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <header class="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div>
                <h1 class="text-4xl font-black text-slate-900 tracking-tight">${exportOptions.title || 'Yönetim Raporu'}</h1>
                <p class="text-slate-500 font-medium mt-2">Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}</p>
                <div class="flex items-center gap-3 mt-4">
                    <span class="px-4 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-100">
                        Dönem: ${dateRangeLabel}
                    </span>
                    <span class="px-4 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100">
                        Kaynak: ${selectedSources.length === 0 ? 'Tümü' : selectedSources.join(', ')}
                    </span>
                </div>
            </div>
            <div class="no-print flex gap-3">
                <button onclick="window.print()" class="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Yazdır / PDF
                </button>
            </div>
        </header>

        <div class="flex flex-col xl:flex-row gap-10">
            <main id="report-body" class="flex-1 flex flex-col gap-8 min-w-0">
                ${content}
            </main>
            
            ${commentsSidebarHtml}
        </div>

        <footer class="mt-16 py-8 border-t border-slate-200 text-center">
            <p class="text-slate-400 text-xs font-bold tracking-widest uppercase">Concierge AI Dashboard &copy; 2026</p>
        </footer>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            ${exportOptions.interactive ? `
            // --- A. Accordion (Göster/Gizle) Motoru ---
            const toggleSubtopicsBtn = document.getElementById('toggle-subtopics-btn');
            if (toggleSubtopicsBtn) {
                toggleSubtopicsBtn.addEventListener('click', function() {
                    const isShowing = this.getAttribute('data-showing') === 'true';
                    const subtopicRows = document.querySelectorAll('.subtopic-row');
                    const mainCategoryRows = document.querySelectorAll('.main-category-row');
                    
                    subtopicRows.forEach(row => {
                        if (isShowing) {
                            row.classList.add('hidden');
                            row.style.animation = '';
                        } else {
                            row.classList.remove('hidden');
                            row.style.animation = 'fadeInDown 0.3s ease forwards';
                        }
                    });

                    mainCategoryRows.forEach(row => {
                        row.setAttribute('data-expanded', !isShowing);
                        const icon = row.querySelector('.category-expand-icon');
                        if (icon) {
                            if (isShowing) {
                                icon.classList.remove('rotate-180', 'text-indigo-500');
                            } else {
                                icon.classList.add('rotate-180', 'text-indigo-500');
                            }
                        }
                    });
                    
                    this.setAttribute('data-showing', !isShowing);
                    this.title = isShowing ? 'Alt Konuları Göster' : 'Alt Konuları Gizle';
                    
                    if (isShowing) {
                        this.classList.remove('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-100');
                        this.classList.add('bg-slate-100', 'text-slate-600');
                    } else {
                        this.classList.remove('bg-slate-100', 'text-slate-600');
                        this.classList.add('bg-indigo-600', 'text-white', 'shadow-lg', 'shadow-indigo-100');
                    }
                });
            }

            const mainCategoryRows = document.querySelectorAll('.main-category-row');
            mainCategoryRows.forEach(row => {
                row.addEventListener('click', function(e) {
                    const categoryName = this.getAttribute('data-category-name');
                    const subRows = document.querySelectorAll('.subtopic-row[data-parent-category="' + categoryName + '"]');
                    
                    let isExpanded = this.getAttribute('data-expanded') === 'true';
                    isExpanded = !isExpanded;
                    this.setAttribute('data-expanded', isExpanded);
                    
                    const icon = this.querySelector('.category-expand-icon');
                    if (icon) {
                        if (isExpanded) {
                            icon.classList.add('rotate-180', 'text-indigo-500');
                        } else {
                            icon.classList.remove('rotate-180', 'text-indigo-500');
                        }
                    }
                    
                    subRows.forEach(subRow => {
                        if (isExpanded) {
                            subRow.classList.remove('hidden');
                            subRow.style.animation = 'fadeInDown 0.3s ease forwards';
                        } else {
                            subRow.classList.add('hidden');
                            subRow.style.animation = '';
                        }
                    });
                });
            });

            const toggleButtons = document.querySelectorAll('[data-toggle-btn]');
            toggleButtons.forEach(btn => {
                const sectionId = btn.getAttribute('data-toggle-btn');
                const rows = document.querySelectorAll(\`[data-section="\${sectionId}"] .toggleable-row\`);
                let isExpanded = btn.getAttribute('data-expanded') === 'true';
                
                btn.addEventListener('click', () => {
                    isExpanded = !isExpanded;
                    rows.forEach(row => {
                        if (isExpanded) row.classList.remove('hidden');
                        else row.classList.add('hidden');
                    });
                    btn.setAttribute('data-expanded', isExpanded);
                    const count = btn.getAttribute('data-count');
                    btn.innerHTML = isExpanded ? 'Daha Az Göster' : 'Tümünü Gör (' + count + ')';
                });
            });
            ` : ''}

            ${exportOptions.includeComments ? `
            // --- B. OMNI-FİLTRE (Tüm Yorumları Filtreleme) MOTORU ---
            const triggers = document.querySelectorAll('.interactive-filter-trigger');
            const commentCards = document.querySelectorAll('.comment-card');
            const filterBar = document.getElementById('active-filter-bar');
            const filterText = document.getElementById('active-filter-text');
            const clearBtn = document.getElementById('clear-filter-btn');

            // Görsel Hover Efektleri İçin CSS Enjeksiyonu
            const style = document.createElement('style');
            style.textContent = '.interactive-filter-trigger { cursor: pointer; transition: all 0.2s; } .interactive-filter-trigger:hover { background-color: #f1f5f9 !important; outline: 2px solid #cbd5e1; outline-offset: -2px; }';
            document.head.appendChild(style);

            const resetFilters = () => {
              commentCards.forEach(card => {
                card.classList.remove('hidden-card');
                card.classList.add('visible-card');
              });
              if (filterBar) {
                filterBar.classList.remove('visible');
                setTimeout(() => { if (!filterBar.classList.contains('visible')) filterBar.style.display = 'none'; }, 300);
              }
              triggers.forEach(t => t.classList.remove('active-filter-highlight'));
            };

            if (clearBtn) clearBtn.addEventListener('click', resetFilters);

            triggers.forEach(trigger => {
              trigger.addEventListener('click', (e) => {
                const type = trigger.getAttribute('data-filter-type');
                const value = trigger.getAttribute('data-filter-value');
                const sentiment = trigger.getAttribute('data-filter-sentiment');
                if (!type || !value || value === 'all') {
                  resetFilters();
                  return;
                }

                // Önceden seçili olanı temizle
                triggers.forEach(t => t.classList.remove('active-filter-highlight'));
                trigger.classList.add('active-filter-highlight');

                if (filterText) filterText.textContent = \`Filtreleniyor: \${value}\`;
                if (filterBar) {
                  filterBar.style.display = 'flex';
                  // Force reflow
                  void filterBar.offsetWidth;
                  filterBar.classList.add('visible');
                }

                let visibleCount = 0;

                commentCards.forEach(card => {
                  let isMatch = false;
                  if (type === 'topic') {
                    const topics = card.getAttribute('data-topics') || '';
                    // Alt konu veya ana konu kelimesini arar
                    isMatch = topics.split(',').includes(value); 
                    
                    if (isMatch && sentiment) {
                      const cardScore = parseInt(card.getAttribute('data-overall-score') || '0', 10);
                      if (sentiment === 'negative' && cardScore >= 50) {
                        isMatch = false;
                      } else if (sentiment === 'positive' && cardScore < 80) {
                        isMatch = false;
                      }
                    }
                  } else {
                    const cardValue = card.getAttribute(\`data-\${type}\`);
                    isMatch = (cardValue === value);
                  }
                  
                  if (isMatch) {
                      card.classList.remove('hidden-card');
                      card.classList.add('visible-card');
                      visibleCount++;
                  } else {
                      card.classList.remove('visible-card');
                      card.classList.add('hidden-card');
                  }
                });
              });
            });
            ` : ''}

            // --- C. ZAMANA GÖRE MEMNUNİYET SKORU SEKMELERİ ---
            const timelineTabs = document.querySelectorAll('.timeline-tab-btn');
            const timelineContents = document.querySelectorAll('[data-timeline-content]');

            timelineTabs.forEach(tab => {
              tab.addEventListener('click', () => {
                const target = tab.getAttribute('data-tab-target');
                
                // Aktif sekme stilini güncelle
                timelineTabs.forEach(t => {
                  t.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm', 'active-tab');
                  t.classList.add('text-slate-500');
                });
                tab.classList.remove('text-slate-500');
                tab.classList.add('bg-white', 'text-indigo-600', 'shadow-sm', 'active-tab');

                // İçerikleri göster/gizle
                timelineContents.forEach(content => {
                  if (content.getAttribute('data-timeline-content') === target) {
                    if (content.classList.contains('absolute')) {
                      content.classList.remove('opacity-0', 'z-0', 'pointer-events-none');
                      content.classList.add('opacity-100', 'z-10');
                    } else {
                      content.classList.remove('hidden', 'opacity-0');
                      content.classList.add('block', 'opacity-100');
                    }
                  } else {
                    if (content.classList.contains('absolute')) {
                      content.classList.remove('opacity-100', 'z-10');
                      content.classList.add('opacity-0', 'z-0', 'pointer-events-none');
                    } else {
                      content.classList.remove('block', 'opacity-100');
                      content.classList.add('hidden', 'opacity-0');
                    }
                  }
                });
              });
            });
        });
    </script>
</body>
</html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportOptions.title || 'concierge-ai-rapor'}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setIsExportOptionsModalOpen(false);
  };

  const handleGenerateDashboardReport = async () => {
    if (filteredAnalytics.length === 0) {
      alert("Raporlanacak veri bulunamadı.");
      return;
    }
    
    setIsGeneratingReport(true);
    setIsReportModalOpen(true);
    setEditingReportId(null);
    setEditingReportType('dashboard_summary');
    
    try {
      const prompt = `Sen 5 yıldızlı bir otelin Kalite ve Misafir İlişkileri Direktörüsün. Aşağıdaki analiz verilerini incele ve üst yönetime sunulacak profesyonel, özet bir 'Yönetim Faaliyet Raporu' yaz.
      
      ÖNEMLİ KURALLAR:
      1. Metin içinde KESİNLİKLE ** (çift yıldız) veya markdown formatı KULLANMA.
      2. Başlıkları HTML <h3> veya <h4> etiketleri ile belirt.
      3. Listeleri HTML <ul> ve <li> etiketleri ile oluştur.
      4. Paragrafları HTML <p> etiketleri ile ayır.
      
      Raporun içermesi gerekenler:
      1. Genel Değerlendirme (Ortalama memnuniyet ve genel durum)
      2. Kategori Performansları (En iyi ve en çok geliştirilmesi gereken ana kategoriler)
      3. Öne Çıkan Gündem Konuları (Trending Sub-Categories)
      4. Aksiyon Önerileri (Kaliteyi artırmak için 3 somut öneri)
      
      Veriler (${dateFilter === 'today' ? 'Bugün' : dateFilter === 'yesterday' ? 'Dün' : dateFilter === '7days' ? 'Son 7 Gün' : dateFilter === '30days' ? 'Son 30 Gün' : dateFilter === 'thisYear' ? 'Bu Yıl' : 'Özel Tarih Aralığı'}):
      - Toplam Yorum Sayısı: ${dashboardData.kpis.totalComments}
      - Ortalama Memnuniyet: %${dashboardData.kpis.avgScore}
      - En Başarılı Kategori: ${dashboardData.kpis.bestCategory}
      - En Çok Şikayet Alan Kategori: ${dashboardData.kpis.worstCategory}
      
      Kategori Performansları:
      ${JSON.stringify(dashboardData.categoryPerformance, null, 2)}
      
      Kaynak Analizi:
      ${JSON.stringify(dashboardData.sourceAnalysis, null, 2)}
      
      Uyruk Analizi:
      ${JSON.stringify(dashboardData.nationalityAnalysis, null, 2)}
      
      En Çok Konuşulan Konular:
      ${JSON.stringify(dashboardData.mostMentioned.slice(0, 10), null, 2)}
      `;

      const report = await generateAIContent(prompt, 'Yönetim Faaliyet Raporu Üretimi', 'dashboardReport');
      setGeneratedReport(report.replace(/\*\*/g, ''));
      
    } catch (error) {
      console.error("Faaliyet raporu üretilirken hata:", error);
      alert("Rapor üretilirken bir hata oluştu.");
      setIsReportModalOpen(false);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleSaveReport = async () => {
    if (!generatedReport.trim()) return;
    setIsSavingReport(true);
    try {
      if (editingReportId) {
        await updateDoc(doc(db, 'executive_reports', editingReportId), {
          reportContent: generatedReport,
          updatedAt: new Date().toISOString()
        });
        alert("Rapor başarıyla güncellendi.");
      } else {
        await addDoc(collection(db, 'executive_reports'), {
          type: 'dashboard_summary',
          period: dateFilter,
          reportContent: generatedReport,
          createdAt: new Date().toISOString()
        });
        alert("Rapor başarıyla kaydedildi.");
      }
      setIsReportModalOpen(false);
    } catch (error) {
      console.error("Rapor kaydedilirken hata:", error);
      handleFirestoreError(error, OperationType.WRITE, `executive_reports/${editingReportId || 'new'}`);
      alert("Rapor kaydedilirken bir hata oluştu.");
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (window.confirm("Bu raporu silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, 'executive_reports', id));
      } catch (error) {
        console.error("Rapor silinirken hata:", error);
        handleFirestoreError(error, OperationType.DELETE, `executive_reports/${id}`);
        alert("Rapor silinirken bir hata oluştu.");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#f8fafc] overflow-hidden flex flex-col">
      {/* Portal for Header Actions */}
      {portalTarget && createPortal(
        <div className="flex items-center gap-4 h-10">
          <button 
            onClick={handleSavePreferences}
            disabled={isSaving}
            className={`px-5 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all disabled:opacity-70 ${
              saveStatus === 'success' 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200' 
                : saveStatus === 'error'
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saveStatus === 'success' ? (
              <CheckCircle2 size={16} />
            ) : saveStatus === 'error' ? (
              <AlertCircle size={16} />
            ) : (
              <Save size={16} />
            )}
            {isSaving ? 'Kaydediliyor...' : saveStatus === 'success' ? 'Kaydedildi' : 'Görünümü Kaydet'}
          </button>
        </div>,
        portalTarget
      )}

      {/* Main Cockpit Layout */}
      <div className="w-full max-w-[1850px] mx-auto h-full flex justify-between gap-8 py-6 overflow-hidden px-6">
        
        {/* Left Column: Control Panel (Sticky) */}
        <aside className="w-64 shrink-0 flex flex-col gap-3 sticky top-0 h-[calc(100vh-3rem)] overflow-y-auto pr-2 custom-scrollbar pb-6">
          {/* View Mode Toggle (Modernized) */}
          <div className="bg-white rounded-lg p-2.5 border border-slate-200 shadow-sm">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <Layout size={10} className="text-indigo-500" />
              Görünüm
            </h3>
            <div className="flex p-0.5 bg-slate-100 rounded-md">
              <button
                onClick={() => setGlobalViewMode('chart')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold transition-all ${
                  globalViewMode === 'chart' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart3 size={12} />
                Grafik
              </button>
              <button
                onClick={() => setGlobalViewMode('table')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-bold transition-all ${
                  globalViewMode === 'table' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Database size={12} />
                Tablo
              </button>
            </div>
          </div>

          {/* Report Structure (Modular Configuration) */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Settings size={10} className="text-indigo-500" />
                Yapılandırma
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  {activeModules.length}/{AVAILABLE_MODULES.length}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              {modulesOrder.map((module, index) => {
                const isActive = activeModules.includes(module.id);
                return (
                  <div key={module.id} className="group relative flex items-center gap-1">
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        disabled={index === 0}
                        onClick={() => moveModule(module.id, 'up')}
                        className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-20 text-slate-400"
                      >
                        <ChevronUp size={10} />
                      </button>
                      <button 
                        disabled={index === modulesOrder.length - 1}
                        onClick={() => moveModule(module.id, 'down')}
                        className="p-0.5 hover:bg-slate-100 rounded disabled:opacity-20 text-slate-400"
                      >
                        <ChevronDown size={10} />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        if (isActive) {
                          setActiveModules(prev => prev.filter(id => id !== module.id));
                        } else {
                          setActiveModules(prev => [...prev, module.id]);
                        }
                      }}
                      className={`flex-1 flex items-center justify-between p-1.5 rounded-md transition-all border ${
                        isActive 
                          ? 'bg-indigo-50/50 border-indigo-100 text-indigo-700' 
                          : 'bg-white border-slate-50 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded-md ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                          <module.icon size={12} />
                        </div>
                        <span className="text-[10px] font-bold">{module.label}</span>
                      </div>
                      {isActive ? <Eye size={10} /> : <EyeOff size={10} className="opacity-30" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filters Section */}
          <div className="bg-white rounded-lg p-3 border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Filter size={10} className="text-indigo-500" />
                Filtreler
              </h3>
              <button 
                onClick={() => {
                  setDateFilter('30days');
                  setSelectedMainCategory('all');
                  setSelectedSubCategory('all');
                  setSelectedNationalities([]);
                  setSelectedSources([]);
                }}
                className="text-[8px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
              >
                Sıfırla
              </button>
            </div>

            {/* Date Presets */}
            <div className="space-y-1">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setIsDateExpanded(!isDateExpanded)}
              >
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer group-hover:text-slate-600 transition-colors">
                  Dönem {dateFilter !== 'custom' ? (
                    <span className="text-indigo-500">
                      ({[
                        { id: 'today', label: 'Bugün' },
                        { id: 'yesterday', label: 'Dün' },
                        { id: '7days', label: '7 Gün' },
                        { id: '30days', label: '30 Gün' },
                        { id: 'thisYear', label: 'Bu Yıl' },
                        { id: 'custom', label: 'Özel' }
                      ].find(p => p.id === dateFilter)?.label})
                    </span>
                  ) : <span className="text-indigo-500">(Özel)</span>}
                </label>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isDateExpanded ? 'rotate-180' : ''}`} />
              </div>

              {/* Custom Date Inputs - Always visible if 'custom' is selected, matching user request */}
              {dateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-1.5 animate-in fade-in slide-in-from-top-1 py-1">
                  <div className="space-y-0.5">
                    <span className="text-[7px] font-bold text-slate-400 uppercase ml-0.5">Başlangıç</span>
                    <input 
                      type="date" 
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-md px-1.5 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[7px] font-bold text-slate-400 uppercase ml-0.5">Bitiş</span>
                    <input 
                      type="date" 
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-md px-1.5 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div 
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isDateExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <div className="space-y-3 py-1">
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: 'today', label: 'Bugün' },
                      { id: 'yesterday', label: 'Dün' },
                      { id: '7days', label: '7 Gün' },
                      { id: '30days', label: '30 Gün' },
                      { id: 'thisYear', label: 'Bu Yıl' },
                      { id: 'custom', label: 'Özel' }
                    ].map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => setDateFilter(preset.id as any)}
                        className={`px-1.5 py-1.5 text-[9px] font-bold rounded-md border transition-all ${
                          dateFilter === preset.id 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Compare Toggle */}
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-md ${isCompareActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                  <History size={12} />
                </div>
                <span className="text-[10px] font-bold text-slate-700">Önceki Dönemle Karşılaştır</span>
              </div>
              <button
                onClick={() => setIsCompareActive(!isCompareActive)}
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${isCompareActive ? 'bg-indigo-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isCompareActive ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Multi-selects for Source, Nationality & Category */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
                >
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer group-hover:text-slate-600 transition-colors">
                    Kategori {selectedMainCategory !== 'all' && <span className="text-indigo-500">({selectedMainCategory})</span>}
                  </label>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isCategoryExpanded ? 'rotate-180' : ''}`} />
                </div>
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${isCategoryExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="flex flex-col gap-3 py-2">
                    <div className="space-y-1">
                      <span className="text-[7px] font-bold text-slate-400 uppercase ml-0.5">Ana Kategori</span>
                      <select 
                        value={selectedMainCategory}
                        onChange={(e) => {
                          setSelectedMainCategory(e.target.value);
                          setSelectedSubCategory('all');
                        }}
                        className="w-full border border-slate-200 rounded-md px-1.5 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="all">Tümü</option>
                        {taxonomy && Object.keys(taxonomy.categories).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {selectedMainCategory !== 'all' && taxonomy && taxonomy.categories[selectedMainCategory] && (
                      <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                        <span className="text-[7px] font-bold text-slate-400 uppercase ml-0.5">Alt Kategori</span>
                        <select 
                          value={selectedSubCategory}
                          onChange={(e) => setSelectedSubCategory(e.target.value)}
                          className="w-full border border-slate-200 rounded-md px-1.5 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500"
                        >
                          <option value="all">Tümü</option>
                          {taxonomy.categories[selectedMainCategory].map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setIsSourceExpanded(!isSourceExpanded)}
                >
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer group-hover:text-slate-600 transition-colors">
                    Kaynak {selectedSources.length > 0 && <span className="text-indigo-500">({selectedSources.length})</span>}
                  </label>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isSourceExpanded ? 'rotate-180' : ''}`} />
                </div>
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${isSourceExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar pr-1 py-1">
                    {allSources.map(source => (
                      <label key={source} className="flex items-center gap-2 text-[10px] text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedSources.includes(source)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedSources([...selectedSources, source]);
                            else setSelectedSources(selectedSources.filter(s => s !== source));
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                        />
                        <span className="truncate">{source}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div 
                  className="flex items-center justify-between cursor-pointer group"
                  onClick={() => setIsNationalityExpanded(!isNationalityExpanded)}
                >
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer group-hover:text-slate-600 transition-colors">
                    Uyruk {selectedNationalities.length > 0 && <span className="text-indigo-500">({selectedNationalities.length})</span>}
                  </label>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isNationalityExpanded ? 'rotate-180' : ''}`} />
                </div>
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${isNationalityExpanded ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar pr-1 py-1">
                    {allNationalities.map(nat => (
                      <label key={nat} className="flex items-center gap-2 text-[10px] text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedNationalities.includes(nat)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedNationalities([...selectedNationalities, nat]);
                            else setSelectedNationalities(selectedNationalities.filter(n => n !== nat));
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                        />
                        <span className="truncate">{nat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={handleGenerateDashboardReport}
              className="w-full bg-indigo-600 text-white p-2.5 rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 group"
            >
              <Sparkles size={14} className="text-amber-300 group-hover:scale-110 transition-transform" />
              AI Özeti Üret
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setIsExportOptionsModalOpen(true)}
                className="bg-white text-slate-700 border border-slate-200 p-2 rounded-lg font-bold text-[9px] flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all shadow-sm"
              >
                <FileText size={14} className="text-slate-400" />
                HTML Rapor
              </button>
              <button
                onClick={() => setIsSavedReportsModalOpen(true)}
                className="bg-white text-slate-700 border border-slate-200 p-2 rounded-lg font-bold text-[9px] flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Database size={14} className="text-slate-400" />
                Kayıtlı ({savedReports.length})
              </button>
            </div>
          </div>
        </aside>
        {/* Middle Column: Graphics Area (Scrollable) */}
        <main className="flex-1 min-w-0 flex flex-col gap-6 overflow-y-auto pr-4 custom-scrollbar pb-20" ref={dashboardRef}>
          
          {activeModules.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
              <LayoutGrid size={48} className="mb-4 opacity-20" />
              <p className="font-bold text-lg">Rapor İçeriği Boş</p>
              <p className="text-sm">Sol panelden görüntülemek istediğiniz rapor parçalarını seçebilirsiniz.</p>
            </div>
          )}

          {modulesOrder.map((module) => {
            if (!activeModules.includes(module.id)) return null;

            if (module.id === 'kpi_cards') {
              return (
                <div key="kpi_cards" className="grid grid-cols-4 gap-4">
                  {[
                    { 
                      label: 'Ort. Memnuniyet', 
                      value: `%${dashboardData.kpis.avgScore}`, 
                      change: dashboardData.kpis.scoreChange, 
                      icon: Award, 
                      color: 'indigo' 
                    },
                    { 
                      label: 'Toplam Yorum Sayısı', 
                      value: dashboardData.kpis.totalComments, 
                      change: dashboardData.kpis.commentChange, 
                      icon: MessageSquare, 
                      color: 'blue' 
                    },
                    { 
                      label: 'En Başarılı Kategori', 
                      value: dashboardData.kpis.bestCategory, 
                      icon: CheckCircle2, 
                      color: 'emerald' 
                    },
                    { 
                      label: 'Gelişim Alanı', 
                      value: dashboardData.kpis.worstCategory, 
                      icon: AlertTriangle, 
                      color: 'red' 
                    }
                  ].map((kpi, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-indigo-300 transition-all interactive-filter-trigger"
                      onClick={() => {
                        if (kpi.label === 'En Başarılı Kategori' || kpi.label === 'Gelişim Alanı') {
                          setDrillDownFilter({ type: 'category', value: kpi.value });
                        } else {
                          setDrillDownFilter({ type: 'all', value: 'all' });
                        }
                      }}
                      data-filter-type={kpi.label === 'En Başarılı Kategori' || kpi.label === 'Gelişim Alanı' ? 'category' : 'all'}
                      data-filter-value={kpi.label === 'En Başarılı Kategori' || kpi.label === 'Gelişim Alanı' ? kpi.value : 'all'}
                    >
                      <div className={`absolute top-0 right-0 w-24 h-24 bg-${kpi.color}-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110`} />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-3">
                          <div className={`p-2 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600`}>
                            <kpi.icon size={20} />
                          </div>
                          {kpi.change !== undefined && (
                            <div className={`flex items-center gap-0.5 text-[10px] font-bold ${kpi.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {kpi.change >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              {Math.abs(kpi.change)}%
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                        <h4 className="text-xl font-black text-slate-900 truncate">{kpi.value}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            if (module.id === 'satisfaction_timeline') {
              const timelineData = dashboardData.satisfactionOverTime[timelineGranularity];
              return (
                <section key="satisfaction_timeline" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                          <Clock size={18} className="text-indigo-600" />
                        </div>
                        Zamana Göre Memnuniyet Skoru
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Seçilen periyoda göre ortalama memnuniyet değişimi</p>
                    </div>
                    <div className="flex p-1 bg-slate-100 rounded-lg interactive-timeline-tabs">
                      {[
                        { id: 'daily', label: 'Günlük' },
                        { id: 'weekly', label: 'Haftalık' },
                        { id: 'monthly', label: 'Aylık' },
                        { id: 'yearly', label: 'Yıllık' }
                      ].map((g) => (
                        <button
                          key={g.id}
                          onClick={() => setTimelineGranularity(g.id as any)}
                          data-tab-target={g.id}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all timeline-tab-btn ${
                            timelineGranularity === g.id 
                              ? 'bg-white text-indigo-600 shadow-sm active-tab' 
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {globalViewMode === 'chart' ? (
                    <div className="h-[300px] w-full relative min-w-0 min-h-0">
                      {['daily', 'weekly', 'monthly', 'yearly'].map(granularity => {
                        const data = dashboardData.satisfactionOverTime[granularity as keyof typeof dashboardData.satisfactionOverTime];
                        const isActive = timelineGranularity === granularity;
                        return (
                          <div 
                            key={granularity}
                            data-timeline-content={granularity}
                            className={`absolute inset-0 transition-opacity duration-300 ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
                          >
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="date" 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tick={{ fontSize: 10, fill: '#64748b' }}
                                  dy={10}
                                />
                                <YAxis 
                                  domain={[0, 100]} 
                                  axisLine={false} 
                                  tickLine={false} 
                                  tick={{ fontSize: 10, fill: '#64748b' }}
                                  tickFormatter={(v) => `%${v}`}
                                />
                                <Tooltip 
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                  formatter={(value: any) => [`%${value}`, 'Ort. Skor']}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="avgScore" 
                                  stroke="#6366f1" 
                                  strokeWidth={3} 
                                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                                  activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="overflow-x-auto relative">
                      {['daily', 'weekly', 'monthly', 'yearly'].map(granularity => {
                        const data = dashboardData.satisfactionOverTime[granularity as keyof typeof dashboardData.satisfactionOverTime];
                        const isActive = timelineGranularity === granularity;
                        return (
                          <div 
                            key={granularity}
                            data-timeline-content={granularity}
                            className={`transition-opacity duration-300 ${isActive ? 'block opacity-100' : 'hidden opacity-0'}`}
                          >
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Tarih / Periyot</th>
                                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Yorum Sayısı</th>
                                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Ort. Memnuniyet</th>
                                </tr>
                              </thead>
                              <tbody>
                                {data.map((item, idx) => (
                                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3 px-4 text-sm font-bold text-slate-700">{item.date}</td>
                                    <td className="py-3 px-4 text-sm text-slate-500 text-center font-mono">{item.count}</td>
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-3">
                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[100px]">
                                          <div 
                                            className={`h-full rounded-full ${
                                              item.avgScore >= 80 ? 'bg-emerald-500' :
                                              item.avgScore >= 60 ? 'bg-blue-500' :
                                              item.avgScore >= 40 ? 'bg-amber-500' :
                                              'bg-red-500'
                                            }`}
                                            style={{ width: `${item.avgScore}%` }}
                                          />
                                        </div>
                                        <span className={`text-xs font-black w-10 ${
                                          item.avgScore >= 80 ? 'text-emerald-600' :
                                          item.avgScore >= 60 ? 'text-blue-600' :
                                          item.avgScore >= 40 ? 'text-amber-600' :
                                          'text-red-600'
                                        }`}>
                                          %{item.avgScore}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            }

            if (module.id === 'category_satisfaction') {
              return (
                <section key="category_satisfaction" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Kategori Bazlı Memnuniyet</h3>
                      <p className="text-xs text-slate-500">Ana ve alt kategorilerdeki misafir deneyim puanları</p>
                    </div>
                    <button
                      id="toggle-subtopics-btn"
                      data-showing={showSubCategories}
                      onClick={() => setShowSubCategories(!showSubCategories)}
                      title={showSubCategories ? 'Alt Konuları Gizle' : 'Alt Konuları Göster'}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                        showSubCategories 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Layers size={14} />
                    </button>
                  </div>

                  {globalViewMode === 'chart' ? (
                    <div className="w-full overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: '700px' }}>
                      <div 
                        className="w-full relative min-w-0 min-h-0 transition-all duration-500" 
                        style={{ height: `${Math.max(400, categoryChartData.length * 45)}px` }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          layout="vertical" 
                          data={categoryChartData} 
                          margin={{ left: 10, right: 60, top: 10, bottom: 10 }}
                          onClick={(data: any) => {
                            if (data && data.activePayload && data.activePayload[0]) {
                              const payload = data.activePayload[0].payload;
                              if (payload.isSub && payload.parent) {
                                setDrillDownFilter({ type: 'category', value: `${payload.parent}|${payload.name}` });
                              } else {
                                setDrillDownFilter({ type: 'category', value: payload.name });
                                setExpandedCategories(prev => ({
                                  ...prev,
                                  [payload.name]: !prev[payload.name]
                                }));
                              }
                            } else if (data && data.activeLabel) {
                              setDrillDownFilter({ type: 'category', value: data.activeLabel });
                              setExpandedCategories(prev => ({
                                ...prev,
                                [data.activeLabel]: !prev[data.activeLabel]
                              }));
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            interval={0}
                            tick={(props) => {
                              const { x, y, payload } = props;
                              const item = categoryChartData.find(d => d.name === payload.value);
                              return (
                                <g transform={`translate(${x},${y})`}>
                                  <text 
                                    x={-15} 
                                    y={0} 
                                    dy={4} 
                                    textAnchor="end" 
                                    fill={item?.isSub ? '#94a3b8' : '#1e293b'}
                                    fontSize={item?.isSub ? 10 : 11}
                                    fontWeight={item?.isSub ? 500 : 800}
                                    className="uppercase tracking-tighter"
                                  >
                                    {item?.isSub ? `↳ ${payload.value}` : payload.value}
                                  </text>
                                </g>
                              );
                            }}
                            width={200}
                          />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          {isCompareActive && <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />}
                          {isCompareActive && (
                            <Bar 
                              dataKey="prevScore" 
                              name="Önceki Dönem"
                              radius={[0, 4, 4, 0]} 
                              barSize={showSubCategories ? 10 : 14}
                              fill="#cbd5e1"
                            />
                          )}
                          <Bar 
                            dataKey="score" 
                            name="Bu Dönem"
                            radius={[0, 4, 4, 0]} 
                            barSize={showSubCategories ? 14 : 24}
                            label={{ position: 'right', fontSize: 12, fontWeight: 700, fill: '#4f46e5', formatter: (val: any) => `%${val}` }}
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.isSub ? '#818cf8' : '#4f46e5'} 
                                className="interactive-filter-trigger cursor-pointer"
                                data-filter-type="topic"
                                data-filter-value={entry.name}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategori</th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Bahsedilme Sayısı</th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memnuniyet Skoru</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {hierarchicalCategoryData.map((group, gIdx) => {
                            const isExpanded = showSubCategories || expandedCategories[group.name];
                            return (
                            <React.Fragment key={gIdx}>
                              <tr 
                                className="hover:bg-slate-50 transition-colors group cursor-pointer interactive-filter-trigger main-category-row"
                                data-filter-type="topic"
                                data-filter-value={group.name}
                                data-category-name={group.name}
                                data-expanded={isExpanded}
                                onClick={() => {
                                  setDrillDownFilter({ type: 'category', value: group.name });
                                  setExpandedCategories(prev => ({
                                    ...prev,
                                    [group.name]: !prev[group.name]
                                  }));
                                }}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <ChevronDown 
                                      size={14} 
                                      className={`text-slate-400 transition-transform duration-300 category-expand-icon ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`} 
                                    />
                                    <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                                      {group.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-sm text-slate-500 text-center font-mono font-bold">
                                  {group.count}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[100px]">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          group.avgScore >= 80 ? 'bg-emerald-500' :
                                          group.avgScore >= 60 ? 'bg-blue-500' :
                                          group.avgScore >= 40 ? 'bg-amber-500' :
                                          'bg-red-500'
                                        }`}
                                        style={{ width: `${group.avgScore}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-black w-10 ${
                                      group.avgScore >= 80 ? 'text-emerald-600' :
                                      group.avgScore >= 60 ? 'text-blue-600' :
                                      group.avgScore >= 40 ? 'text-amber-600' :
                                      'text-red-600'
                                    }`}>
                                      %{group.avgScore}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              <AnimatePresence>
                                {isExpanded && group.subCategories.map((sub, sIdx) => (
                                  <motion.tr
                                    initial={{ opacity: 0, height: 0, scaleY: 0.8 }}
                                    animate={{ opacity: 1, height: 'auto', scaleY: 1 }}
                                    exit={{ opacity: 0, height: 0, scaleY: 0.8 }}
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    key={`${gIdx}-${sIdx}`}
                                    className={`bg-slate-50/50 hover:bg-indigo-50 transition-colors cursor-pointer border-l-2 border-indigo-200 interactive-filter-trigger subtopic-row`}
                                    data-parent-category={group.name}
                                    data-filter-type="topic"
                                    data-filter-value={`${group.name}|${sub.subCategory}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDrillDownFilter({ type: 'category', value: `${group.name}|${sub.subCategory}` });
                                    }}
                                  >
                                    <td className="py-2 px-4 pl-8">
                                      <span className="text-xs font-medium text-slate-600 flex items-center gap-2">
                                        <div className="w-1 h-1 rounded-full bg-indigo-400" />
                                        {sub.subCategory}
                                      </span>
                                    </td>
                                    <td className="py-2 px-4 text-xs text-slate-400 text-center font-mono">
                                      {sub.count}
                                    </td>
                                    <td className="py-2 px-4">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden min-w-[100px]">
                                          <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                              sub.avgScore >= 80 ? 'bg-emerald-400' :
                                              sub.avgScore >= 60 ? 'bg-blue-400' :
                                              sub.avgScore >= 40 ? 'bg-amber-400' :
                                              'bg-red-400'
                                            }`}
                                            style={{ width: `${sub.avgScore}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 w-8">
                                          %{sub.avgScore}
                                        </span>
                                      </div>
                                    </td>
                                  </motion.tr>
                                ))}
                              </AnimatePresence>
                            </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            }

            if (module.id === 'source_analysis') {
              return (
                <section key="source_analysis" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Kanal Dağılımı</h3>
                      <p className="text-xs text-slate-500">Yorumların geldiği platformlar ve kanal bazlı performans</p>
                    </div>
                  </div>

                  {globalViewMode === 'chart' ? (
                    <div className="h-[300px] w-full relative min-w-0 min-h-0">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart
                          onClick={(data: any) => {
                            if (data && data.activePayload && data.activePayload[0]) {
                              setDrillDownFilter({ type: 'source', value: data.activePayload[0].name });
                            }
                          }}
                        >
                          <Pie
                            data={dashboardData.sourceAnalysis}
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={8}
                            dataKey="count"
                            nameKey="name"
                          >
                            {dashboardData.sourceAnalysis.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={COLORS[index % COLORS.length]} 
                                className="interactive-filter-trigger cursor-pointer"
                                data-filter-type="source"
                                data-filter-value={entry.name}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: any, name: string, props: any) => {
                              if (isCompareActive && props.payload.prevCount !== undefined) {
                                return [
                                  <div key="tooltip-content" className="flex flex-col gap-1">
                                    <span>Bu Dönem: {value}</span>
                                    <span className="text-slate-400">Önceki Dönem: {props.payload.prevCount}</span>
                                  </div>,
                                  name
                                ];
                              }
                              return [value, name];
                            }}
                          />
                          <Legend verticalAlign="bottom" iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '15px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kanal Kaynağı</th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Yorum Sayısı</th>
                            {isCompareActive && <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Önceki Yorum Sayısı</th>}
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memnuniyet Skoru</th>
                            {isCompareActive && <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Önceki Memnuniyet</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {dashboardData.sourceAnalysis.map((item, idx) => (
                            <tr 
                              key={idx} 
                              className="hover:bg-slate-50 transition-colors cursor-pointer interactive-filter-trigger"
                              data-filter-type="source"
                              data-filter-value={item.name}
                              onClick={() => setDrillDownFilter({ type: 'source', value: item.name })}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                  <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-500 text-center font-mono">
                                {item.count}
                              </td>
                              {isCompareActive && (
                                <td className="py-3 px-4 text-sm text-slate-400 text-center font-mono">
                                  {item.prevCount || 0}
                                </td>
                              )}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[100px]">
                                    <div 
                                      className={`h-full rounded-full ${
                                        item.avgScore >= 80 ? 'bg-emerald-500' :
                                        item.avgScore >= 60 ? 'bg-blue-500' :
                                        item.avgScore >= 40 ? 'bg-amber-500' :
                                        'bg-red-500'
                                      }`}
                                      style={{ width: `${item.avgScore}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-bold w-10 ${
                                    item.avgScore >= 80 ? 'text-emerald-600' :
                                    item.avgScore >= 60 ? 'text-blue-600' :
                                    item.avgScore >= 40 ? 'text-amber-600' :
                                    'text-red-600'
                                  }`}>
                                    %{item.avgScore}
                                  </span>
                                </div>
                              </td>
                              {isCompareActive && (
                                <td className="py-3 px-4">
                                  <span className="text-xs font-bold text-slate-400">
                                    %{item.prevScore || 0}
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            }

            if (module.id === 'nationality_analysis') {
              return (
                <section key="nationality_analysis" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Uyruk Memnuniyet Endeksi</h3>
                      <p className="text-xs text-slate-500">Pazar bazlı ortalama skorlar ve misafir dağılımı</p>
                    </div>
                  </div>

                  {globalViewMode === 'chart' ? (
                    <div className="w-full overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: '500px' }}>
                      <div 
                        className="w-full relative min-w-0 min-h-0 overflow-hidden" 
                        style={{ height: `${Math.max(400, dashboardData.nationalityAnalysis.length * 45)}px` }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          layout="vertical" 
                          data={dashboardData.nationalityAnalysis} 
                          margin={{ left: 20, right: 80, top: 10, bottom: 10 }}
                          onClick={(data: any) => {
                            if (data && data.activeLabel) {
                              setDrillDownFilter({ type: 'nationality', value: data.activeLabel });
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            interval={0}
                            tick={(props) => {
                              const { x, y, payload } = props;
                              const countryCode = getCountryCode(payload.value);
                              return (
                                <g transform={`translate(${x},${y})`}>
                                  {countryCode ? (
                                    <image
                                      x="-135"
                                      y="-10"
                                      width="20"
                                      height="14"
                                      href={`https://flagcdn.com/w40/${countryCode}.png`}
                                      preserveAspectRatio="xMidYMid slice"
                                      style={{ borderRadius: '2px' }}
                                    />
                                  ) : (
                                    <g transform="translate(-135, -10)">
                                      <circle cx="10" cy="7" r="7" fill="#f1f5f9" />
                                      <path 
                                        d="M10 0a7 7 0 0 0-7 7 7 7 0 0 0 7 7 7 7 0 0 0 7-7 7 7 0 0 0-7-7zm0 1.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5 5.5 5.5 0 0 1-5.5-5.5 5.5 5.5 0 0 1 5.5-5.5zM6.5 7h7M10 1.5v11" 
                                        stroke="#94a3b8" 
                                        strokeWidth="0.5" 
                                        fill="none" 
                                      />
                                    </g>
                                  )}
                                  <text
                                    x={-105}
                                    y={2}
                                    fill="#64748b"
                                    fontSize={12}
                                    fontWeight={600}
                                    textAnchor="start"
                                  >
                                    {payload.value}
                                  </text>
                                </g>
                              );
                            }}
                            width={140}
                          />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: any, name: string) => {
                              if (name === 'avgScore') return [`%${value}`, 'Bu Dönem Memnuniyet'];
                              if (name === 'prevScore') return [`%${value}`, 'Önceki Dönem Memnuniyet'];
                              if (name === 'count') return [value, 'Bahsedilme Sayısı'];
                              return [value, name];
                            }}
                          />
                          {isCompareActive && <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />}
                          {isCompareActive && (
                            <Bar 
                              dataKey="prevScore" 
                              name="Önceki Dönem"
                              fill="#cbd5e1" 
                              radius={[0, 4, 4, 0]} 
                              barSize={12}
                            />
                          )}
                          <Bar 
                            dataKey="avgScore" 
                            name="Bu Dönem"
                            radius={[0, 4, 4, 0]} 
                            barSize={isCompareActive ? 12 : 24}
                            label={{ position: 'right', fontSize: 12, fontWeight: 700, fill: '#4f46e5', formatter: (val: any) => `%${val}` }}
                          >
                            {dashboardData.nationalityAnalysis.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.avgScore >= 80 ? '#10b981' : entry.avgScore >= 60 ? '#4f46e5' : entry.avgScore >= 40 ? '#f59e0b' : '#ef4444'} 
                                className="interactive-filter-trigger cursor-pointer"
                                data-filter-type="nationality"
                                data-filter-value={entry.name}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uyruk / Pazar</th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Yorum Sayısı</th>
                            {isCompareActive && <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Önceki Yorum Sayısı</th>}
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memnuniyet Skoru</th>
                            {isCompareActive && <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Önceki Memnuniyet</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {dashboardData.nationalityAnalysis.map((item, idx) => {
                            const countryCode = getCountryCode(item.name);
                            return (
                              <tr 
                                key={idx} 
                                className="hover:bg-slate-50 transition-colors cursor-pointer group interactive-filter-trigger"
                                data-filter-type="nationality"
                                data-filter-value={item.name}
                                onClick={() => setDrillDownFilter({ type: 'nationality', value: item.name })}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    {countryCode ? (
                                      <img 
                                        src={`https://flagcdn.com/w40/${countryCode}.png`}
                                        srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
                                        width="24"
                                        height="18"
                                        alt={`${item.name} bayrağı`}
                                        className="rounded-sm shadow-sm object-cover border border-slate-100 shrink-0"
                                        referrerPolicy="no-referrer"
                                        style={{ width: '24px', height: '18px', minWidth: '24px' }}
                                      />
                                    ) : (
                                      <div className="w-6 h-[18px] bg-slate-100 rounded-sm flex items-center justify-center border border-slate-200 shrink-0">
                                        <Globe className="w-3 h-3 text-slate-400" />
                                      </div>
                                    )}
                                    <span className="text-sm font-bold text-slate-800 tracking-tight truncate">{item.name}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-sm text-slate-500 text-center font-mono font-bold">
                                  {item.count}
                                </td>
                                {isCompareActive && (
                                  <td className="py-3 px-4 text-sm text-slate-400 text-center font-mono font-bold">
                                    {item.prevCount || 0}
                                  </td>
                                )}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[100px]">
                                      <div 
                                        className={`h-full rounded-full ${
                                          item.avgScore >= 80 ? 'bg-emerald-500' :
                                          item.avgScore >= 60 ? 'bg-blue-500' :
                                          item.avgScore >= 40 ? 'bg-amber-500' :
                                          'bg-red-500'
                                        }`}
                                        style={{ width: `${item.avgScore}%` }}
                                      />
                                    </div>
                                    <span className={`text-xs font-black w-10 ${
                                      item.avgScore >= 80 ? 'text-emerald-600' :
                                      item.avgScore >= 60 ? 'text-blue-600' :
                                      item.avgScore >= 40 ? 'text-amber-600' :
                                      'text-red-600'
                                    }`}>
                                      %{item.avgScore}
                                    </span>
                                  </div>
                                </td>
                                {isCompareActive && (
                                  <td className="py-3 px-4">
                                    <span className="text-xs font-bold text-slate-400">
                                      %{item.prevScore || 0}
                                    </span>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            }

            if (module.id === 'hotel_agenda') {
              return (
                <div key="hotel_agenda" className="flex flex-col gap-8">
                  {/* En Çok Konuşulanlar */}
                  <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <div className="p-1.5 bg-indigo-50 rounded-lg">
                            <TrendingUp size={18} className="text-indigo-600" />
                          </div>
                          En Çok Konuşulan Konular
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">En yüksek yorum hacmine sahip, gündemi belirleyen alt kategoriler</p>
                      </div>
                    </div>

                    {globalViewMode === 'chart' ? (
                      <div className={`w-full relative min-w-0 min-h-0 transition-all duration-300`} style={{ height: showAllMostMentioned ? `${Math.max(400, dashboardData.mostMentioned.length * 40)}px` : '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            layout="vertical" 
                            data={showAllMostMentioned ? dashboardData.mostMentioned : dashboardData.mostMentioned.slice(0, 10)} 
                            margin={{ left: 20, right: 80, top: 10, bottom: 10 }}
                            onClick={(data: any) => {
                              if (data && data.activePayload && data.activePayload[0]) {
                                const payload = data.activePayload[0].payload;
                                setDrillDownFilter({ type: 'category', value: `${payload.mainCategory}|${payload.subCategory}` });
                              } else if (data && data.activeLabel) {
                                setDrillDownFilter({ type: 'category', value: data.activeLabel });
                              }
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" domain={[0, 'dataMax + 5']} hide />
                            <YAxis 
                              dataKey="subCategory" 
                              type="category" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                              width={160}
                            />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                              formatter={(value: any, name: string) => {
                                if (name === 'count') return [value, 'Bu Dönem Bahsedilme'];
                                if (name === 'prevCount') return [value, 'Önceki Dönem Bahsedilme'];
                                if (name === 'avgScore') return [`%${value}`, 'Memnuniyet Skoru'];
                                return [value, name];
                              }}
                            />
                            {isCompareActive && <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />}
                            {isCompareActive && (
                              <Bar 
                                dataKey="prevCount" 
                                name="Önceki Dönem"
                                fill="#cbd5e1" 
                                radius={[0, 6, 6, 0]} 
                                barSize={12}
                              />
                            )}
                            <Bar 
                              dataKey="count" 
                              name="Bu Dönem"
                              fill="#6366f1" 
                              radius={[0, 6, 6, 0]} 
                              barSize={isCompareActive ? 12 : 24}
                              label={{ position: 'right', fontSize: 12, fontWeight: 900, fill: '#4f46e5', offset: 10 }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Alt Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ana Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Bahsedilme Sayısı</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Skor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50" data-section="most-mentioned">
                            {dashboardData.mostMentioned.map((item, idx) => (
                              <tr 
                                key={idx} 
                                className={`hover:bg-slate-50/80 transition-all group cursor-pointer interactive-filter-trigger ${idx >= 10 ? 'toggleable-row' : ''} ${(!showAllMostMentioned && idx >= 10) ? 'hidden' : ''}`}
                                onClick={() => setDrillDownFilter({ type: 'category', value: `${item.mainCategory}|${item.subCategory}` })}
                                data-filter-type="topic"
                                data-filter-value={`${item.mainCategory}|${item.subCategory}`}
                              >
                                <td className="py-4 px-4">
                                  <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.subCategory}</span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{item.mainCategory}</span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <span className="text-sm font-black text-indigo-600">{item.count}</span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <span className={`text-xs font-bold ${
                                    item.avgScore >= 80 ? 'text-emerald-600' :
                                    item.avgScore >= 60 ? 'text-blue-600' :
                                    item.avgScore >= 40 ? 'text-amber-600' :
                                    'text-red-600'
                                  }`}>%{item.avgScore}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {dashboardData.mostMentioned.length > 10 && (
                      <div className="mt-6 pt-4 border-t border-slate-50 flex justify-center">
                        <button 
                          onClick={() => setShowAllMostMentioned(!showAllMostMentioned)}
                          data-toggle-btn="most-mentioned"
                          data-expanded={showAllMostMentioned}
                          data-count={dashboardData.mostMentioned.length}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all interactive-only"
                        >
                          {showAllMostMentioned ? (
                            <>Daha Az Göster <ChevronUp size={14} /></>
                          ) : (
                            <>Tümünü Gör ({dashboardData.mostMentioned.length}) <ChevronDown size={14} /></>
                          )}
                        </button>
                      </div>
                    )}
                  </section>

                  {/* En Çok Övülenler */}
                  <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <div className="p-1.5 bg-emerald-50 rounded-lg">
                            <Award size={18} className="text-emerald-600" />
                          </div>
                          En Çok Övülen Konular
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Misafirlerin en yüksek puan verdiği ve memnuniyetin zirve yaptığı alanlar</p>
                      </div>
                    </div>

                    {globalViewMode === 'chart' ? (
                      <div className={`w-full relative min-w-0 min-h-0 transition-all duration-300`} style={{ height: showAllTopPositive ? `${Math.max(400, dashboardData.topPositive.length * 40)}px` : '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            layout="vertical" 
                            data={showAllTopPositive ? dashboardData.topPositive : dashboardData.topPositive.slice(0, 10)} 
                            margin={{ left: 20, right: 100, top: 10, bottom: 10 }}
                            onClick={(data: any) => {
                              if (data && data.activePayload && data.activePayload[0]) {
                                const payload = data.activePayload[0].payload;
                                setDrillDownFilter({ type: 'category', value: `${payload.mainCategory}|${payload.subCategory}`, sentiment: 'positive' });
                              } else if (data && data.activeLabel) {
                                setDrillDownFilter({ type: 'category', value: data.activeLabel, sentiment: 'positive' });
                              }
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis 
                              dataKey="subCategory" 
                              type="category" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                              width={160}
                            />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                              formatter={(value: any, name: string) => {
                                if (name === 'avgScore') return [`%${value}`, 'Bu Dönem Memnuniyet'];
                                if (name === 'prevScore') return [`%${value}`, 'Önceki Dönem Memnuniyet'];
                                if (name === 'count') return [value, 'Bahsedilme Sayısı'];
                                return [value, name];
                              }}
                            />
                            {isCompareActive && <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />}
                            {isCompareActive && (
                              <Bar 
                                dataKey="prevScore" 
                                name="Önceki Dönem"
                                fill="#cbd5e1" 
                                radius={[0, 6, 6, 0]} 
                                barSize={12}
                              />
                            )}
                            <Bar 
                              dataKey="avgScore" 
                              name="Bu Dönem"
                              fill="#10b981" 
                              radius={[0, 6, 6, 0]} 
                              barSize={isCompareActive ? 12 : 24}
                              label={{ position: 'right', fontSize: 12, fontWeight: 900, fill: '#059669', offset: 10, formatter: (val: any) => `%${val}` }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Alt Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ana Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Bahsedilme Sayısı</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Memnuniyet Skoru</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50" data-section="top-positive">
                            {dashboardData.topPositive.map((item, idx) => (
                              <tr 
                                key={idx} 
                                className={`hover:bg-slate-50/80 transition-all group cursor-pointer interactive-filter-trigger ${idx >= 10 ? 'toggleable-row' : ''} ${(!showAllTopPositive && idx >= 10) ? 'hidden' : ''}`}
                                onClick={() => setDrillDownFilter({ type: 'category', value: `${item.mainCategory}|${item.subCategory}`, sentiment: 'positive' })}
                                data-filter-type="topic"
                                data-filter-value={`${item.mainCategory}|${item.subCategory}`}
                                data-filter-sentiment="positive"
                              >
                                <td className="py-4 px-4">
                                  <span className="text-sm font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{item.subCategory}</span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{item.mainCategory}</span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <span className="text-xs font-bold text-slate-500">{item.count}</span>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[120px]">
                                      <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${item.avgScore}%` }} />
                                    </div>
                                    <span className="text-xs font-black text-emerald-600 w-10">%{item.avgScore}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {dashboardData.topPositive.length > 10 && (
                      <div className="mt-6 pt-4 border-t border-slate-50 flex justify-center">
                        <button 
                          onClick={() => setShowAllTopPositive(!showAllTopPositive)}
                          data-toggle-btn="top-positive"
                          data-expanded={showAllTopPositive}
                          data-count={dashboardData.topPositive.length}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all interactive-only"
                        >
                          {showAllTopPositive ? (
                            <>Daha Az Göster <ChevronUp size={14} /></>
                          ) : (
                            <>Tümünü Gör ({dashboardData.topPositive.length}) <ChevronDown size={14} /></>
                          )}
                        </button>
                      </div>
                    )}
                  </section>

                  {/* Acil Müdahale Gerekenler */}
                  <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <div className="p-1.5 bg-rose-50 rounded-lg">
                            <AlertTriangle size={18} className="text-rose-600" />
                          </div>
                          Acil Müdahale Gerekenler
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">En düşük performans gösteren ve operasyonel müdahale bekleyen kritik konular</p>
                      </div>
                    </div>

                    {globalViewMode === 'chart' ? (
                      <div className={`w-full relative min-w-0 min-h-0 transition-all duration-300`} style={{ height: showAllTopNegative ? `${Math.max(400, dashboardData.topNegative.length * 40)}px` : '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            layout="vertical" 
                            data={showAllTopNegative ? dashboardData.topNegative : dashboardData.topNegative.slice(0, 10)} 
                            margin={{ left: 20, right: 100, top: 10, bottom: 10 }}
                            onClick={(data: any) => {
                              if (data && data.activePayload && data.activePayload[0]) {
                                const payload = data.activePayload[0].payload;
                                setDrillDownFilter({ type: 'category', value: `${payload.mainCategory}|${payload.subCategory}`, sentiment: 'negative' });
                              } else if (data && data.activeLabel) {
                                setDrillDownFilter({ type: 'category', value: data.activeLabel, sentiment: 'negative' });
                              }
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis 
                              dataKey="subCategory" 
                              type="category" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                              width={160}
                            />
                            <Tooltip 
                              cursor={{ fill: '#fff1f2' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                              formatter={(value: any, name: string) => {
                                if (name === 'avgScore') return [`%${value}`, 'Bu Dönem Memnuniyet'];
                                if (name === 'prevScore') return [`%${value}`, 'Önceki Dönem Memnuniyet'];
                                if (name === 'count') return [value, 'Bahsedilme Sayısı'];
                                return [value, name];
                              }}
                            />
                            {isCompareActive && <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />}
                            {isCompareActive && (
                              <Bar 
                                dataKey="prevScore" 
                                name="Önceki Dönem"
                                fill="#cbd5e1" 
                                radius={[0, 6, 6, 0]} 
                                barSize={12}
                              />
                            )}
                            <Bar 
                              dataKey="avgScore" 
                              name="Bu Dönem"
                              fill="#ef4444" 
                              radius={[0, 6, 6, 0]} 
                              barSize={isCompareActive ? 12 : 24}
                              label={{ position: 'right', fontSize: 12, fontWeight: 900, fill: '#dc2626', offset: 10, formatter: (val: any) => `%${val}` }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Alt Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ana Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Bahsedilme Sayısı</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Memnuniyet Skoru</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50" data-section="top-negative">
                            {dashboardData.topNegative.map((item, idx) => (
                              <tr 
                                key={idx} 
                                className={`hover:bg-rose-50/30 transition-all group cursor-pointer interactive-filter-trigger ${idx >= 10 ? 'toggleable-row' : ''} ${(!showAllTopNegative && idx >= 10) ? 'hidden' : ''}`}
                                onClick={() => setDrillDownFilter({ type: 'category', value: `${item.mainCategory}|${item.subCategory}`, sentiment: 'negative' })}
                                data-filter-type="topic"
                                data-filter-value={`${item.mainCategory}|${item.subCategory}`}
                                data-filter-sentiment="negative"
                              >
                                <td className="py-4 px-4">
                                  <span className="text-sm font-bold text-slate-800 group-hover:text-rose-600 transition-colors">{item.subCategory}</span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{item.mainCategory}</span>
                                </td>
                                <td className="py-4 px-4 text-center">
                                  <span className="text-xs font-bold text-slate-500">{item.count}</span>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[120px]">
                                      <div className="h-full bg-rose-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.3)]" style={{ width: `${item.avgScore}%` }} />
                                    </div>
                                    <span className="text-xs font-black text-rose-600 w-10">%{item.avgScore}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {dashboardData.topNegative.length > 10 && (
                      <div className="mt-6 pt-4 border-t border-slate-50 flex justify-center">
                        <button 
                          onClick={() => setShowAllTopNegative(!showAllTopNegative)}
                          data-toggle-btn="top-negative"
                          data-expanded={showAllTopNegative}
                          data-count={dashboardData.topNegative.length}
                          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all interactive-only"
                        >
                          {showAllTopNegative ? (
                            <>Daha Az Göster <ChevronUp size={14} /></>
                          ) : (
                            <>Tümünü Gör ({dashboardData.topNegative.length}) <ChevronDown size={14} /></>
                          )}
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              );
            }

            return null;
          })}

          {/* Bottom Spacing */}
          <div className="h-12 shrink-0" />
        </main>

        {/* Right Column: Live Comments (Drill-down) */}
        <section className="w-[420px] shrink-0 flex flex-col gap-4 sticky top-0 h-[calc(100vh-3rem)] overflow-hidden">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <MessageSquare size={16} className="text-indigo-500" />
                  Yorum Detayları
                </h3>
                <p id="html-export-drilldown-title" className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                  {drillDownFilter.type === 'all' ? 'Tüm Filtrelenmiş Yorumlar' : `${drillDownFilter.value} Analizi`}
                </p>
              </div>
              <button 
                id="html-export-drilldown-clear"
                onClick={() => setDrillDownFilter({ type: 'all', value: 'all' })}
                className={`p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors ${drillDownFilter.type === 'all' ? 'hidden' : ''}`}
                title="Filtreyi Temizle"
              >
                <X size={16} />
              </button>
            </div>

            <div id="html-export-comments-container" className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-3">
              {drillDownComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-50">
                  <MessageSquare size={40} className="mb-2" />
                  <p className="text-xs font-bold">Yorum Bulunamadı</p>
                </div>
              ) : (
                drillDownComments.map((commentData, idx) => {
                  const localText = commentData.comment || (commentData as any).rawText || (commentData as any).COMMENT || '';
                  const isExpanded = !!expandedComments[commentData.commentId];
                  const isLong = localText.length > 150;
                  const displayedText = isExpanded ? localText : localText.slice(0, 150);

                  const oScore = commentData.overallScore || 0;
                  let oColorClass = 'bg-slate-50 text-slate-700 border-slate-200';
                  if (oScore >= 80) oColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  else if (oScore >= 50) oColorClass = 'bg-amber-50 text-amber-700 border-amber-100';
                  else oColorClass = 'bg-red-50 text-red-700 border-red-100';

                  return (
                    <div key={commentData.commentId || idx} className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{commentData.source}</span>
                          <span className="text-[10px] font-bold text-slate-400">{new Date(commentData.date).toLocaleDateString('tr-TR')}</span>
                        </div>
                        <div className={`text-xs font-black ${oColorClass} border px-2 py-1 rounded-lg`}>{oScore}/100</div>
                      </div>
                      <div className="relative">
                        {localText ? (
                          <>
                            <p className="text-xs text-slate-700 leading-relaxed italic">"{displayedText}{!isExpanded && isLong ? '...' : ''}"</p>
                            {isLong && (
                              <button 
                                onClick={() => setExpandedComments(prev => ({ ...prev, [commentData.commentId]: !prev[commentData.commentId] }))} 
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 mt-1 uppercase"
                              >
                                {isExpanded ? 'Daha Az Göster' : 'Devamını Oku'}
                              </button>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-slate-400 italic animate-pulse">Metin senkronize ediliyor...</p>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-50 flex flex-wrap gap-1">
                        {commentData.topics?.map((topic, tidx) => {
                          const tScore = topic.score || 0;
                          let tColorClass = 'bg-slate-100 text-slate-500 border-slate-200';
                          if (tScore >= 80) tColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                          else if (tScore >= 50) tColorClass = 'bg-amber-50 text-amber-700 border-amber-100';
                          else tColorClass = 'bg-red-50 text-red-700 border-red-100';

                          return (
                            <span key={tidx} className={`text-[8px] font-bold ${tColorClass} border px-1.5 py-0.5 rounded uppercase`}>
                              {topic.subCategory}
                            </span>
                          );
                        })}
                      </div>
                      
                      {(() => {
                        const localAnswer = commentData.answer || (commentData as any).ANSWER || '';
                        const firebaseActions = commentActions[String(commentData.commentId)] || [];
                        const unifiedActions = buildUnifiedTimeline(localAnswer, firebaseActions);
                        
                        if (unifiedActions.length === 0) return null;
                        
                        return (
                          <div className="mt-3 pt-3 border-t border-slate-50">
                            <button 
                              onClick={() => setExpandedActions(prev => ({ ...prev, [commentData.commentId]: !prev[commentData.commentId] }))}
                              className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-800 transition-colors uppercase"
                            >
                              <ChevronDown className={`w-3 h-3 transition-transform ${expandedActions[commentData.commentId] ? 'rotate-180' : ''}`} />
                              Alınan Aksiyonlar ({unifiedActions.length})
                            </button>
                            
                            {expandedActions[commentData.commentId] && (
                              <div className="mt-3 space-y-3 pl-2 border-l-2 border-indigo-100">
                                {unifiedActions.map((action, aidx) => (
                                  <div key={aidx} className="relative pl-4">
                                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-400 border-2 border-white"></div>
                                    <div className="text-[9px] font-bold text-slate-400 mb-0.5">{action.date ? new Date(action.date).toLocaleString('tr-TR') : 'Tarih Belirtilmemiş'}</div>
                                    <div className="text-xs text-slate-700">{action.description}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/30">
              <p id="html-export-comments-count" className="text-[10px] font-bold text-slate-400 text-center uppercase">
                Toplam {drillDownComments.length} Yorum Listeleniyor
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Report Generation Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="text-indigo-600" />
                Yönetim Faaliyet Raporu
              </h3>
              <button 
                onClick={() => setIsReportModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center py-20 text-indigo-600">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-current border-t-transparent mb-4"></div>
                  <p className="font-medium">Yapay Zeka Raporu Hazırlıyor...</p>
                  <p className="text-sm text-slate-500 mt-2 text-center max-w-md">
                    Bu işlem analiz edilen veri miktarına göre 10-30 saniye sürebilir. Lütfen bekleyin.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800">
                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                    <div className="text-sm">
                      <p className="font-semibold mb-1">Yapay Zeka Tarafından Üretildi</p>
                      <p>Bu rapor, seçili dönemdeki misafir yorumlarının yapay zeka tarafından analiz edilmesiyle oluşturulmuştur. Kaydetmeden önce içeriği inceleyebilir ve düzenleyebilirsiniz.</p>
                    </div>
                  </div>
                  
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <ReactQuill 
                      theme="snow" 
                      value={generatedReport} 
                      onChange={setGeneratedReport}
                      className="bg-white h-[400px] mb-12"
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                          ['clean']
                        ]
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSaveReport}
                disabled={isGeneratingReport || isSavingReport || !generatedReport.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingReport ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <Save size={16} />
                )}
                Sisteme Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Reports Modal */}
      {isSavedReportsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Database className="text-indigo-600" />
                Kayıtlı Yönetim Raporları
              </h3>
              <button 
                onClick={() => setIsSavedReportsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
              {savedReports.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText size={48} className="mx-auto mb-4 text-slate-300" />
                  <p>Henüz kaydedilmiş bir rapor bulunmuyor.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                      <div>
                        <h4 className="font-medium text-slate-800">
                          {report.type === 'dashboard_summary' ? 'Yönetim Faaliyet Raporu' : 'Toplu Vaka Çözüm Raporu'}
                          {report.period && ` (${report.period === '7days' ? 'Haftalık' : report.period === '30days' ? 'Aylık' : 'Dönemsel'})`}
                        </h4>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(report.createdAt).toLocaleString('tr-TR')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setGeneratedReport(report.reportContent);
                            setEditingReportId(report.id);
                            setEditingReportType(report.type);
                            setIsSavedReportsModalOpen(false);
                            setIsReportModalOpen(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                          title="Görüntüle / Düzenle"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {isExportOptionsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                  <Download size={20} />
                </div>
                <button 
                  onClick={() => setIsExportOptionsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Dışa Aktarma Seçenekleri</h3>
              <p className="text-sm text-slate-500 font-medium">Raporunuzu özelleştirin ve HTML olarak indirin.</p>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Rapor Başlığı</label>
                <input 
                  type="text" 
                  value={exportOptions.title}
                  onChange={(e) => setExportOptions({ ...exportOptions, title: e.target.value })}
                  placeholder="Örn: Mart 2026 Yönetim Sunumu"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <MessageSquare size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Yorumları Dahil Et</p>
                      <p className="text-[10px] text-slate-500 font-medium">Tüm müşteri geri bildirimlerini rapora ekler.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setExportOptions({ ...exportOptions, includeComments: !exportOptions.includeComments })}
                    className={`w-12 h-6 rounded-full transition-all relative ${exportOptions.includeComments ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${exportOptions.includeComments ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <MousePointerClick size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Etkileşimli Rapor</p>
                      <p className="text-[10px] text-slate-500 font-medium">Tıklanabilir grafikler ve genişletilebilir listeler.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setExportOptions({ ...exportOptions, interactive: !exportOptions.interactive })}
                    className={`w-12 h-6 rounded-full transition-all relative ${exportOptions.interactive ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${exportOptions.interactive ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                onClick={() => setIsExportOptionsModalOpen(false)}
                className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
              >
                İptal
              </button>
              <button 
                onClick={() => {
                  handleExportHtml();
                  setIsExportOptionsModalOpen(false);
                }}
                className="flex-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Raporu İndir
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}