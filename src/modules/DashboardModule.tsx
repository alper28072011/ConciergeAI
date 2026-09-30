import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { createPortal } from 'react-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, getDoc, setDoc, limit, where, getDocs } from 'firebase/firestore';
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
  MousePointerClick, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAIContent } from '../services/aiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { getDashboardData } from '../utils/biEngine';
import { buildUnifiedTimeline } from '../utils';
import { normalizeNationality, getStandardCountryCode } from '../utils/nationality';
import PerformanceTrendBadge from '../components/PerformanceTrendBadge';
import KpiCard from '../components/KpiCard';

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
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`Firestore Error [${operationType}] on [${path}]:`, msg);
  
  if (msg.includes('Quota exceeded') || msg.includes('resource-exhausted') || (error as any)?.code === 'resource-exhausted') {
    window.dispatchEvent(new Event('firestore-quota-exceeded'));
  }
  
  throw new Error(`Veritabanı Hatası: ${msg}`);
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#71717a'];
const RADAR_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

// Country code mapping for flags
const getCountryCode = (countryName: string): string => {
  return getStandardCountryCode(countryName);
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
  let localUid = window.safeStorage.getItem('crm_device_uid');
  if (!localUid) {
    localUid = 'device_' + Math.random().toString(36).substr(2, 11);
    window.safeStorage.setItem('crm_device_uid', localUid);
  }
  return localUid;
};

export function DashboardModule() {
  const [analytics, setAnalytics] = useState<CommentAnalytics[]>([]);
  const [commentActions, setCommentActions] = useState<Record<string, any[]>>({});
  const [taxonomy, setTaxonomy] = useState<HotelTaxonomy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const attemptedSyncIdsRef = useRef<Set<string>>(new Set());
  
  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'thisYear' | 'custom'>('30days');
  const [isCompareActive, setIsCompareActive] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [customCompareStartDate, setCustomCompareStartDate] = useState<string>('');
  const [customCompareEndDate, setCustomCompareEndDate] = useState<string>('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [selectedNationalities, setSelectedNationalities] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  // The actual applied filters used for DB fetching and Dashboard rendering
  const [appliedFilters, setAppliedFilters] = useState({
    dateFilter: '30days' as 'today' | 'yesterday' | '7days' | '30days' | 'thisYear' | 'custom',
    customStartDate: '',
    customEndDate: '',
    customCompareStartDate: '',
    customCompareEndDate: '',
    selectedMainCategory: 'all',
    selectedSubCategory: 'all',
    selectedNationalities: [] as string[],
    selectedSources: [] as string[],
    isCompareActive: false
  });
  const [isRaporlaLoading, setIsRaporlaLoading] = useState(false);
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
  const [showAllNationality, setShowAllNationality] = useState(false);

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
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const [sectionSummaries, setSectionSummaries] = useState<Record<string, string>>({});
  const [isGeneratingSectionSummaries, setIsGeneratingSectionSummaries] = useState(false);
  const [deepAnalytics, setDeepAnalytics] = useState<Record<string, string>>({});
  const [isGeneratingDeepAnalytics, setIsGeneratingDeepAnalytics] = useState(false);
  const [deepAnalyticsProgress, setDeepAnalyticsProgress] = useState('');

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const [exportOptions, setExportOptions] = useState({
    includeComments: true,
    includeFilters: true,
    interactive: true,
    includeAiSummaries: false,
    title: `Otel CRM Kokpit Raporu - ${new Date().toLocaleDateString('tr-TR')}`
  });
  const [isGeneratingExport, setIsGeneratingExport] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

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
        // Filter elements that actually need to be synchronized
        // We track processed IDs in attemptedSyncIdsRef to strictly prevent any infinite loop.
        const missingComments = analytics.filter(c => {
          const cId = String(c.commentId);
          if (!cId || cId === 'undefined' || attemptedSyncIdsRef.current.has(cId)) return false;

          const hasNoText = !c.comment || c.comment.trim() === '' || c.comment === 'Yorum metni sistemde bulunamadı.';
          
          // Only check/sync missing answers for recent comments (last 30 days) to optimize reads/writes
          const isRecent = c.date ? (new Date().getTime() - new Date(c.date).getTime() < 30 * 24 * 60 * 60 * 1000) : true;
          const hasNoAnswer = c.answer == null && isRecent;

          return hasNoText || hasNoAnswer;
        });

        if (missingComments.length === 0) return;

        // Immediately add all target IDs to the attempted list before starting async calls
        // This ensures subsequent onSnapshot triggers do NOT pick them up again.
        missingComments.forEach(c => attemptedSyncIdsRef.current.add(String(c.commentId)));

        const missingIds = missingComments.map(c => Number(c.commentId)).filter(id => !isNaN(id));
        if (missingIds.length === 0) return;

        console.log(`[Firestore Cache Optimizer] Syncing ${missingIds.length} missing comments/answers...`);

        const savedSettings = window.safeStorage.getItem('hotelApiSettings');
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

  const handleRaporlaClick = async () => {
    setIsRaporlaLoading(true);
    setIsLoading(true);
    
    const currentApplied = {
      dateFilter,
      customStartDate,
      customEndDate,
      customCompareStartDate,
      customCompareEndDate,
      selectedMainCategory,
      selectedSubCategory,
      selectedNationalities,
      selectedSources,
      isCompareActive
    };
    
    setAppliedFilters(currentApplied);
    
    try {
      // Fetch data without the 2500 limit completely! Because the dashboard itself works locally by filtering.
      // Getting ALL documents initially isn't scalable for millions, but since this is CRM, we fetch all comment analytics and actions for the user.
      const qAnalytics = query(collection(db, 'comment_analytics'), orderBy('date', 'desc'));
      const analyticsSnap = await getDocs(qAnalytics);
      const data: CommentAnalytics[] = [];
      analyticsSnap.forEach((doc) => {
        data.push(doc.data() as CommentAnalytics);
      });
      setAnalytics(data);

      const qActions = query(collection(db, 'comment_actions'), orderBy('date', 'desc'));
      const actionsSnap = await getDocs(qActions);
      const actionsMap: Record<string, any[]> = {};
      actionsSnap.forEach((doc) => {
        const actionData = doc.data();
        const commentId = actionData.commentId;
        if (!actionsMap[commentId]) {
          actionsMap[commentId] = [];
        }
        actionsMap[commentId].push({ id: doc.id, ...actionData });
      });
      Object.keys(actionsMap).forEach(key => {
        actionsMap[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      });
      setCommentActions(actionsMap);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsRaporlaLoading(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    
    const initData = async () => {
      try {
        const docRef = doc(db, 'system_memory', 'taxonomy');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setTaxonomy(docSnap.data() as HotelTaxonomy);
        }
        // Initially fetch data once exactly like 'Raporla' without limit
        await handleRaporlaClick();
      } catch (error) {
        console.error("Error fetching dashboard init data:", error);
      }
    };

    initData();

    return () => {
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

  const { filteredAnalytics, previousFilteredAnalytics, daysInPeriod, currentPeriodStr, previousPeriodStr } = useMemo(() => {
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

    const {
      dateFilter: apDate,
      customStartDate: apCStart,
      customEndDate: apCEnd,
      customCompareStartDate: apCCmpStart,
      customCompareEndDate: apCCmpEnd,
      selectedMainCategory: apMainCat,
      selectedSubCategory: apSubCat,
      selectedNationalities: apNats,
      selectedSources: apSources,
      isCompareActive: apCompare
    } = appliedFilters;

    let currentStart = new Date(now);
    let currentEnd = new Date(now);
    let previousStart = new Date(now);
    let previousEnd = new Date(now);

    if (apDate === 'today') {
      currentStart.setHours(0, 0, 0, 0);
      previousEnd = new Date(currentStart);
      previousEnd.setMilliseconds(-1);
      previousStart = new Date(previousEnd);
      previousStart.setHours(0, 0, 0, 0);
    } else if (apDate === 'yesterday') {
      currentStart.setDate(currentStart.getDate() - 1);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd.setDate(currentEnd.getDate() - 1);
      previousEnd = new Date(currentStart);
      previousEnd.setMilliseconds(-1);
      previousStart = new Date(previousEnd);
      previousStart.setHours(0, 0, 0, 0);
    } else if (apDate === '7days') {
      currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentStart);
      previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (apDate === '30days') {
      currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousEnd = new Date(currentStart);
      previousStart = new Date(currentStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (apDate === 'thisYear') {
      currentStart = new Date(currentYear, 0, 1);
      previousEnd = new Date(currentStart);
      previousEnd.setMilliseconds(-1);
      previousStart = new Date(currentYear - 1, 0, 1);
    } else if (apDate === 'custom' && apCStart && apCEnd) {
      currentStart = new Date(apCStart);
      currentStart.setHours(0, 0, 0, 0);
      currentEnd = new Date(apCEnd);
      currentEnd.setHours(23, 59, 59, 999);
      if (apCCmpStart && apCCmpEnd) {
        previousStart = new Date(apCCmpStart);
        previousStart.setHours(0, 0, 0, 0);
        previousEnd = new Date(apCCmpEnd);
        previousEnd.setHours(23, 59, 59, 999);
      } else {
        const diffTime = currentEnd.getTime() - currentStart.getTime();
        previousEnd = new Date(currentStart.getTime() - 1);
        previousStart = new Date(previousEnd.getTime() - diffTime);
      }
    }

    const current: CommentAnalytics[] = [];
    const previous: CommentAnalytics[] = [];

    analytics.forEach(item => {
      let itemDate = parseDate(item.date);
      if (isNaN(itemDate.getTime())) {
        itemDate = parseDate(item.createdAt);
      }
      
      if (apMainCat !== 'all') {
        const hasCategory = item.topics?.some(t => t.mainCategory === apMainCat);
        if (!hasCategory) return;
        
        if (apSubCat !== 'all') {
          const hasSub = item.topics?.some(t => t.mainCategory === apMainCat && t.subCategory === apSubCat);
          if (!hasSub) return;
        }
      }

      if (apNats.length > 0) {
        const itemNat = normalizeNationality(item.nationality);
        if (!apNats.includes(itemNat) && !apNats.includes(item.nationality || 'Bilinmiyor')) return;
      }

      if (apSources.length > 0) {
        if (!apSources.includes(item.source || 'Bilinmiyor')) return;
      }

      if (itemDate >= currentStart && itemDate <= currentEnd) {
        current.push(item);
      } else if (apCompare && itemDate >= previousStart && itemDate <= previousEnd) {
        previous.push(item);
      }
    });

    // Sort by date descending (newest first)
    current.sort((a, b) => parseDate(b.date || (b as any).createdAt).getTime() - parseDate(a.date || (a as any).createdAt).getTime());
    previous.sort((a, b) => parseDate(b.date || (b as any).createdAt).getTime() - parseDate(a.date || (a as any).createdAt).getTime());

    const diffTime = Math.abs(currentEnd.getTime() - currentStart.getTime());
    const daysInPeriod = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const formatDateForDisplay = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}.${mm}.${yyyy}`;
    };

    const currentPeriodStr = `${formatDateForDisplay(currentStart)} - ${formatDateForDisplay(currentEnd)}`;
    const previousPeriodStr = `${formatDateForDisplay(previousStart)} - ${formatDateForDisplay(previousEnd)}`;

    return { filteredAnalytics: current, previousFilteredAnalytics: previous, daysInPeriod, currentPeriodStr, previousPeriodStr };
  }, [analytics, appliedFilters]);

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
      if (drillDownFilter.type === 'nationality') {
        return normalizeNationality(item.nationality) === normalizeNationality(drillDownFilter.value) || item.nationality === drillDownFilter.value;
      }
      return true;
    });
  }, [filteredAnalytics, drillDownFilter]);

  const dashboardData = useMemo(() => getDashboardData(filteredAnalytics, appliedFilters.isCompareActive ? previousFilteredAnalytics : undefined), [filteredAnalytics, previousFilteredAnalytics, appliedFilters.isCompareActive]);
  const previousDashboardData = useMemo(() => getDashboardData(previousFilteredAnalytics), [previousFilteredAnalytics]);

  const hierarchicalCategoryData = useMemo(() => {
    const groups: { [key: string]: { 
      name: string; 
      count: number; 
      totalScore: number; 
      prevCount: number; 
      prevTotalScore: number; 
      subCategories: any[];
    } } = {};
    
    dashboardData.mostMentioned.forEach(item => {
      if (!groups[item.mainCategory]) {
        groups[item.mainCategory] = { 
          name: item.mainCategory, 
          count: 0, 
          totalScore: 0, 
          prevCount: 0, 
          prevTotalScore: 0, 
          subCategories: [] 
        };
      }
      groups[item.mainCategory].count += item.count;
      groups[item.mainCategory].totalScore += (item.avgScore * item.count);
      groups[item.mainCategory].prevCount += (item.prevCount || 0);
      groups[item.mainCategory].prevTotalScore += ((item.prevScore || 0) * (item.prevCount || 0));
      groups[item.mainCategory].subCategories.push(item);
    });

    return Object.values(groups).map(group => {
      const avgScore = group.count > 0 ? Math.round(group.totalScore / group.count) : 0;
      const prevAvgScore = group.prevCount > 0 ? Math.round(group.prevTotalScore / group.prevCount) : (appliedFilters.isCompareActive ? 0 : undefined);
      const scoreDelta = prevAvgScore !== undefined ? (avgScore - prevAvgScore) : undefined;
      const countDelta = appliedFilters.isCompareActive ? (group.count - group.prevCount) : undefined;
      const growthRate = (appliedFilters.isCompareActive && group.prevCount > 0)
        ? Math.round(((group.count - group.prevCount) / group.prevCount) * 100)
        : (group.count > 0 ? 100 : 0);

      return {
        ...group,
        avgScore,
        prevScore: prevAvgScore,
        scoreDelta,
        countDelta,
        growthRate
      };
    }).sort((a, b) => b.count - a.count);
  }, [dashboardData.mostMentioned, appliedFilters.isCompareActive]);

  const categoryChartData = useMemo(() => {
    const flatData: any[] = [];
    hierarchicalCategoryData.forEach(group => {
      flatData.push({
        name: group.name,
        score: group.avgScore,
        count: group.count,
        prevScore: group.prevScore,
        prevCount: group.prevCount,
        scoreDelta: group.scoreDelta,
        countDelta: group.countDelta,
        isSub: false
      });
      
      if (showSubCategories || expandedCategories[group.name]) {
        group.subCategories.forEach(sub => {
          flatData.push({
            name: sub.subCategory,
            score: sub.avgScore,
            count: sub.count,
            prevScore: sub.prevScore,
            prevCount: sub.prevCount,
            scoreDelta: sub.scoreDelta,
            countDelta: sub.countDelta,
            growthRate: sub.growthRate,
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
    analytics.forEach(item => {
      nats.add(normalizeNationality(item.nationality));
    });
    return Array.from(nats).filter(Boolean).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [analytics]);

  const allSources = useMemo(() => {
    const sources = new Set<string>();
    analytics.forEach(item => sources.add(item.source || 'Bilinmiyor'));
    return Array.from(sources).sort();
  }, [analytics]);

  /**
   * HTML Dışarı Aktarımını Optimize Eden ve Dosya Boyutunu Minimuma İndiren Motor.
   * 1. SVG koordinat hassasiyetini (virgülden sonraki 10-15 basamağı) 1-2 basamağa yuvarlayarak SVG boyutunu %50 düşürür.
   * 2. HTML yorumlarını ve etiketler arası gereksiz boşlukları (script/style hariç) temizler.
   * 3. CSS stillerindeki gereksiz boşlukları ve yorumları sıkıştırır.
   * 4. Tüm görsel tasarım, yazı tipleri, gölgeler ve animasyonları BİREBİR KORUR.
   */
  const optimizeExportedHtml = (rawHtml: string): string => {
    // 1. SVG koordinat hassasiyeti sıkıştırması (d ve points niteliklerindeki aşırı ondalıkları 2 basamağa yuvarlar)
    let optimized = rawHtml.replace(/([0-9]+\.[0-9]{2})[0-9]+/g, '$1');

    // 2. Script ve Style bloklarını koruyarak güvenli minifikasyon
    const parts = optimized.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/gi);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.toLowerCase().startsWith('<style')) {
        parts[i] = part
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\s+/g, ' ')
          .replace(/\s*([{}:;,])\s*/g, '$1')
          .replace(/;}/g, '}');
      } else if (!part.toLowerCase().startsWith('<script')) {
        parts[i] = part
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/>\s+</g, '><')
          .replace(/[ \t\r\n]+/g, ' ');
      }
    }

    return parts.join('').trim();
  };

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
    
    // Recharts kütüphanesinin React DOM içine yerleştirdiği ama statik HTML'de çalışmayan ağır tooltip yapılarını temizle
    clone.querySelectorAll('.recharts-tooltip-wrapper').forEach(el => el.remove());
    // Boş SVG katmanlarını ve gizli imleçleri temizle
    clone.querySelectorAll('g:empty, defs:empty, .recharts-tooltip-cursor').forEach(el => el.remove());

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

    if (!exportOptions.includeAiSummaries) {
      const aiSummaries = clone.querySelectorAll('.ai-summary-block');
      aiSummaries.forEach(el => el.remove());
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
    
    // --- ULTRA-KOMPAKT YORUM SERİLEŞTİRME VE İSTEMCİ TARAFI ÇALIŞTIRMA SİSTEMİ ---
    // Binlerce satırlık tekrarlayan HTML üretmek yerine veriyi sözlük tabanlı ultra-küçük JSON'a dönüştürür.
    // Bu sayede HTML dosya boyutu %80-%90 oranında küçülür, tarayıcıda ise aynı görsel ve animasyonlarla anında render edilir.
    let commentsSidebarHtml = '';
    let commentsDataScript = '';

    if (exportOptions.includeComments) {
      if (filteredAnalytics.length === 0) {
        commentsSidebarHtml = `
          <aside class="w-full xl:w-[450px] shrink-0 mt-8 xl:mt-0 relative">
            <div class="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar flex flex-col">
              <h3 class="text-base font-black text-slate-900 uppercase tracking-widest mb-6 border-b border-slate-200 pb-4 flex items-center justify-between gap-2 shrink-0">
                <span class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  Yorum Detayları
                </span>
                <span class="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">0 Yorum</span>
              </h3>
              <div class="flex flex-col items-center justify-center py-20 text-slate-400 opacity-50"><p class="text-sm font-bold">Bu döneme ait yorum bulunamadı</p></div>
            </div>
          </aside>
        `;
      } else {
        // Sözlük tabanlı sıkıştırma: Kaynak, uyruk ve kategori metinlerini tekilleştir
        const sourceDict: string[] = [];
        const natDict: string[] = [];
        const catDict: string[] = [];
        const subDict: string[] = [];

        const getIdx = (arr: string[], val: string) => {
          let idx = arr.indexOf(val);
          if (idx === -1) {
            idx = arr.length;
            arr.push(val);
          }
          return idx;
        };

        const compactItems = filteredAnalytics.map((commentData) => {
          const localText = commentData.comment || (commentData as any).rawText || (commentData as any).COMMENT || '';
          const dateStr = new Date(commentData.date || commentData.createdAt).toLocaleDateString('tr-TR');
          const nationality = commentData.nationality || 'Bilinmiyor';
          const source = commentData.source || 'Bilinmiyor';
          const oScore = commentData.overallScore || 0;

          const sIdx = getIdx(sourceDict, source);
          const nIdx = getIdx(natDict, nationality);

          const topicsArr = (commentData.topics || []).map(t => [
            getIdx(catDict, t.mainCategory || ''),
            getIdx(subDict, t.subCategory || ''),
            t.score || 0
          ]);

          const localAnswer = commentData.answer || (commentData as any).ANSWER || '';
          const firebaseActions = commentActions[String(commentData.commentId)] || [];
          const unifiedActions = buildUnifiedTimeline(localAnswer, firebaseActions);
          const actionsArr = unifiedActions.map(a => [
            a.date ? new Date(a.date).toLocaleString('tr-TR') : 'Tarih Belirtilmemiş',
            a.description
          ]);

          return [sIdx, nIdx, dateStr, oScore, localText, topicsArr, actionsArr];
        });

        const rawJson = JSON.stringify({
          s: sourceDict,
          n: natDict,
          c: catDict,
          sub: subDict,
          items: compactItems
        }).replace(/<\/script>/gi, '<\\/script>');

        commentsDataScript = `<script id="comments-data" type="application/json">${rawJson}</script>`;

        commentsSidebarHtml = `
          <aside class="w-full xl:w-[450px] shrink-0 mt-8 xl:mt-0 relative">
            <div class="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar flex flex-col">
              <h3 class="text-base font-black text-slate-900 uppercase tracking-widest mb-6 border-b border-slate-200 pb-4 flex items-center justify-between gap-2 shrink-0">
                <span class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  Yorum Detayları
                </span>
                <span id="comments-count-badge" class="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  ${filteredAnalytics.length} Yorum
                </span>
              </h3>
              
              <div id="active-filter-bar" class="bg-indigo-50 border border-indigo-200 p-4 rounded-xl mb-4 flex justify-between items-center text-sm font-bold text-indigo-800 shadow-sm" style="display: none;"> 
                <span id="active-filter-text">Filtre: </span> 
                <button id="clear-filter-btn" class="text-xs bg-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-100 cursor-pointer border border-indigo-200 transition-colors">
                  Tümünü Göster
                </button> 
              </div>

              <div id="comments-wrapper" class="flex flex-col flex-1">
                <!-- Yüksek Performanslı İstemci Motoru Tarafından İşlenir -->
              </div>

              <div id="comments-load-more" class="pt-3 text-center" style="display: none;">
                <button id="load-all-comments-btn" class="w-full py-2.5 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 shadow-sm transition-all cursor-pointer">
                  Tüm Yorumları Göster
                </button>
              </div>
            </div>
          </aside>
        `;
      }
    }

    const dateRangeLabel = currentPeriodStr;
    const compareRangeLabel = isCompareActive ? previousPeriodStr : null;

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
        
        /* --- DERİN ANALİZ STİLLERİ --- */
        .deep-analytics-block { background-color: #fffbeb !important; border: 1px solid #fde68a !important; border-left: 5px solid #f59e0b !important; padding: 20px !important; border-radius: 12px !important; margin-top: 20px !important; display: flex !important; gap: 16px !important; }
        .deep-analytics-content h3 { font-size: 15px !important; font-weight: 800 !important; color: #78350f !important; margin-top: 12px !important; margin-bottom: 8px !important; border-bottom: 1px solid #fef3c7 !important; padding-bottom: 4px !important; }
        .deep-analytics-content h3:first-of-type { margin-top: 0 !important; }
        .deep-analytics-content ul { list-style-type: disc !important; padding-left: 20px !important; margin-bottom: 12px !important; }
        .deep-analytics-content li { font-size: 13px !important; line-height: 1.6 !important; color: #451a03 !important; margin-bottom: 6px !important; }

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

        /* --- AKILLI METRİK AÇIKLAMA TOOLTIP STİLLERİ --- */
        #metric-template-tooltip {
            position: fixed;
            z-index: 99999;
            width: 360px;
            max-width: 90vw;
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(71, 85, 105, 0.8);
            box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.1);
            border-radius: 14px;
            padding: 14px 16px;
            color: #f8fafc;
            pointer-events: none;
            font-family: 'Inter', sans-serif;
            opacity: 0;
            transform: translateY(6px);
            transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            display: none;
        }
        #metric-template-tooltip.visible {
            opacity: 1;
            transform: translateY(0);
            display: block;
        }
        [data-metric-tooltip="performance"] {
            cursor: help !important;
        }

        /* --- KPI KARŞILAŞTIRMA VE BİLGİ ARAÇ İPUCU (HOVER TOOLTIP) STİLLERİ --- */
        #kpi-comparison-tooltip {
            position: fixed;
            z-index: 999999;
            width: 350px;
            max-width: 90vw;
            background: rgba(15, 23, 42, 0.96);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(71, 85, 105, 0.8);
            box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 16px;
            color: #f8fafc;
            pointer-events: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            opacity: 0;
            transform: translateY(6px);
            transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            display: none;
        }
        #kpi-comparison-tooltip.visible {
            opacity: 1;
            transform: translateY(0);
            display: block;
        }
        [data-kpi-card="true"] {
            cursor: pointer !important;
            transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        [data-kpi-card="true"]:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
            border-color: #a5b4fc !important;
        }
        
        @media print {
            .no-print { display: none; }
            #metric-template-tooltip { display: none !important; }
            #kpi-comparison-tooltip { display: none !important; }
            body { background-color: white; padding: 0; }
            .report-container { width: 100%; max-width: 100%; box-shadow: none; border: none; padding: 0; }
        }
    </style>
    ${commentsDataScript}
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
                    ${compareRangeLabel ? `
                    <span class="px-4 py-1.5 bg-slate-50 text-slate-700 text-xs font-bold rounded-full border border-slate-200">
                        Karşılaştırma: ${compareRangeLabel}
                    </span>
                    ` : ''}
                    <span class="px-4 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-100">
                        Kaynak: ${selectedSources.length === 0 ? 'Tümü' : selectedSources.join(', ')}
                    </span>
                </div>
            </div>
            <div class="no-print flex gap-3">
                <button onclick="window.print()" class="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg shadow-slate-200 cursor-pointer">
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
            // --- B. ULTRA-PERFORMANSLI YORUM VE OMNI-FİLTRE MOTORU ---
            const commentsDataEl = document.getElementById('comments-data');
            const commentsWrapper = document.getElementById('comments-wrapper');
            const filterBar = document.getElementById('active-filter-bar');
            const filterText = document.getElementById('active-filter-text');
            const clearBtn = document.getElementById('clear-filter-btn');
            const countBadge = document.getElementById('comments-count-badge');
            const loadMoreContainer = document.getElementById('comments-load-more');
            const loadAllBtn = document.getElementById('load-all-comments-btn');

            let allComments = [];
            let activeFilteredComments = [];
            let displayedCount = 0;
            const BATCH_SIZE = 40;

            function escapeHtml(str) {
              if (!str) return '';
              return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            }

            window.toggleCommentAccordion = function(btn) {
              const content = btn.nextElementSibling;
              const icon = btn.querySelector('.accordion-icon');
              if (content) content.classList.toggle('expanded');
              if (icon) icon.classList.toggle('rotated');
            };

            // Görsel Hover Efektleri İçin CSS Enjeksiyonu
            const style = document.createElement('style');
            style.textContent = '.interactive-filter-trigger { cursor: pointer; transition: all 0.2s; } .interactive-filter-trigger:hover { background-color: #f1f5f9 !important; outline: 2px solid #cbd5e1; outline-offset: -2px; }';
            document.head.appendChild(style);

            if (commentsDataEl && commentsWrapper) {
              try {
                const raw = JSON.parse(commentsDataEl.textContent);
                allComments = (raw.items || []).map((item, idx) => {
                  const [sIdx, nIdx, dateStr, oScore, text, topicsArr, actionsArr] = item;
                  const source = raw.s[sIdx] || 'Bilinmiyor';
                  const nationality = raw.n[nIdx] || 'Bilinmiyor';
                  const topics = (topicsArr || []).map(([cIdx, subIdx, sc]) => ({
                    main: raw.c[cIdx] || '',
                    sub: raw.sub[subIdx] || '',
                    score: sc
                  }));
                  const actions = (actionsArr || []).map(([d, desc]) => ({
                    date: d,
                    description: desc
                  }));

                  const compositeTopics = topics.map(t => t.main + '|' + t.sub).join(',');
                  const subCategories = topics.map(t => t.sub).join(',');
                  const categories = topics.map(t => t.main).join(',');
                  const filterTopics = [compositeTopics, subCategories, categories].filter(Boolean).join(',');
                  const topicDetails = topics.map(t => t.main + '|' + t.sub + '|' + (t.score || 0)).join(';');

                  return {
                    id: idx,
                    source,
                    nationality,
                    dateStr,
                    score: oScore,
                    text,
                    topics,
                    actions,
                    filterTopics,
                    topicDetails
                  };
                });
              } catch (e) {
                console.error("Yorum verisi ayrıştırılamadı:", e);
              }

              activeFilteredComments = allComments;

              function renderCommentCard(c, animIdx) {
                const delay = Math.min((animIdx || 0) * 0.04, 0.4);
                let oColorClass = 'bg-slate-50 text-slate-700 border-slate-200';
                if (c.score >= 80) oColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                else if (c.score >= 50) oColorClass = 'bg-amber-50 text-amber-700 border-amber-100';
                else oColorClass = 'bg-red-50 text-red-700 border-red-100';

                let topicsHtml = '';
                if (c.topics && c.topics.length > 0) {
                  topicsHtml = '<div class="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">';
                  c.topics.forEach(t => {
                    const tScore = t.score || 0;
                    let tColorClass = 'bg-slate-100 text-slate-500 border-slate-200';
                    if (tScore >= 80) tColorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                    else if (tScore >= 50) tColorClass = 'bg-amber-50 text-amber-700 border-amber-100';
                    else tColorClass = 'bg-red-50 text-red-700 border-red-100';
                    topicsHtml += '<span class="text-[9px] font-black ' + tColorClass + ' border px-2 py-1 rounded shadow-sm uppercase">' + escapeHtml(t.sub) + '</span>';
                  });
                  topicsHtml += '</div>';
                }

                let textHtml = c.text 
                  ? '<p class="text-sm text-slate-700 leading-relaxed">"' + escapeHtml(c.text) + '"</p>' 
                  : '<p class="text-sm text-slate-400 italic">Metin bulunamadı.</p>';

                let actionsHtml = '';
                if (c.actions && c.actions.length > 0) {
                  actionsHtml = '<div class="mt-4 pt-4 border-t border-slate-100">' +
                    '<button class="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-800 transition-colors uppercase cursor-pointer" onclick="toggleCommentAccordion(this)">' +
                      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="accordion-icon"><path d="m6 9 6 6 6-6"/></svg>' +
                      'Alınan Aksiyonlar (' + c.actions.length + ')' +
                    '</button>' +
                    '<div class="accordion-content pl-2 border-l-2 border-indigo-100">';
                  c.actions.forEach(a => {
                    actionsHtml += '<div class="relative pl-4 mb-3 last:mb-0">' +
                      '<div class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-400 border-2 border-white"></div>' +
                      '<div class="text-[9px] font-bold text-slate-400 mb-0.5">' + escapeHtml(a.date) + '</div>' +
                      '<div class="text-xs text-slate-700">' + escapeHtml(a.description) + '</div>' +
                    '</div>';
                  });
                  actionsHtml += '</div></div>';
                }

                return '<div class="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm hover:border-indigo-400 transition-all mb-4 comment-card visible-card" ' +
                  'data-id="' + c.id + '" ' +
                  'data-source="' + escapeHtml(c.source) + '" ' +
                  'data-nationality="' + escapeHtml(c.nationality) + '" ' +
                  'data-topics="' + escapeHtml(c.filterTopics) + '" ' +
                  'data-topic-details="' + escapeHtml(c.topicDetails) + '" ' +
                  'data-overall-score="' + c.score + '" ' +
                  'style="animation-delay: ' + delay + 's;">' +
                  '<div class="flex items-center justify-between mb-3">' +
                    '<div class="flex items-center gap-3">' +
                      '<span class="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 uppercase">' + escapeHtml(c.source) + '</span>' +
                      '<span class="text-xs font-bold text-slate-400">' + escapeHtml(c.dateStr) + '</span>' +
                    '</div>' +
                    '<div class="text-sm font-black ' + oColorClass + ' border px-2 py-1 rounded-lg">' + c.score + '/100</div>' +
                  '</div>' +
                  '<div class="relative">' + textHtml + '</div>' +
                  topicsHtml +
                  actionsHtml +
                '</div>';
              }

              function renderBatch(reset) {
                if (reset) {
                  commentsWrapper.innerHTML = '';
                  displayedCount = 0;
                }

                if (activeFilteredComments.length === 0) {
                  commentsWrapper.innerHTML = '<div class="flex flex-col items-center justify-center py-16 text-slate-400 opacity-60 text-center"><p class="text-sm font-bold">Kriterlere uygun yorum bulunamadı</p></div>';
                  if (loadMoreContainer) loadMoreContainer.style.display = 'none';
                  return;
                }

                const toAdd = activeFilteredComments.slice(displayedCount, displayedCount + BATCH_SIZE);
                let htmlStr = '';
                for (let i = 0; i < toAdd.length; i++) {
                  htmlStr += renderCommentCard(toAdd[i], displayedCount + i);
                }
                commentsWrapper.insertAdjacentHTML('beforeend', htmlStr);
                displayedCount += toAdd.length;

                if (loadMoreContainer) {
                  if (displayedCount < activeFilteredComments.length) {
                    loadMoreContainer.style.display = 'block';
                    if (loadAllBtn) {
                      loadAllBtn.textContent = 'Kalan Yorumları Göster (' + (activeFilteredComments.length - displayedCount) + ' yorum)';
                    }
                  } else {
                    loadMoreContainer.style.display = 'none';
                  }
                }
              }

              // İlk render
              renderBatch(true);

              if (loadAllBtn) {
                loadAllBtn.addEventListener('click', () => {
                  while (displayedCount < activeFilteredComments.length) {
                    renderBatch(false);
                  }
                });
              }

              // Otomatik scroll yükleme (kullanıcı alta kaydırdıkça akıcı yüklenir)
              const sidebarContainer = commentsWrapper.parentElement;
              if (sidebarContainer) {
                sidebarContainer.addEventListener('scroll', () => {
                  if (sidebarContainer.scrollTop + sidebarContainer.clientHeight >= sidebarContainer.scrollHeight - 250) {
                    if (displayedCount < activeFilteredComments.length) {
                      renderBatch(false);
                    }
                  }
                });
              }

              // Yazdırma (PDF) öncesi tüm yorumları eksiksiz yükle
              window.addEventListener('beforeprint', () => {
                while (displayedCount < activeFilteredComments.length) {
                  renderBatch(false);
                }
              });

              // --- Filtreleme Tetikleyicileri ---
              const triggers = document.querySelectorAll('.interactive-filter-trigger');
              
              const resetFilters = () => {
                triggers.forEach(t => t.classList.remove('active-filter-highlight'));
                activeFilteredComments = allComments;
                if (filterBar) {
                  filterBar.classList.remove('visible');
                  setTimeout(() => { if (!filterBar.classList.contains('visible')) filterBar.style.display = 'none'; }, 300);
                }
                if (countBadge) countBadge.textContent = allComments.length + ' Yorum';
                renderBatch(true);
              };

              if (clearBtn) clearBtn.addEventListener('click', resetFilters);

              triggers.forEach(trigger => {
                trigger.addEventListener('click', () => {
                  const type = trigger.getAttribute('data-filter-type');
                  const value = trigger.getAttribute('data-filter-value');
                  const sentiment = trigger.getAttribute('data-filter-sentiment');
                  if (!type || !value || value === 'all') {
                    resetFilters();
                    return;
                  }

                  triggers.forEach(t => t.classList.remove('active-filter-highlight'));
                  trigger.classList.add('active-filter-highlight');

                  if (filterText) filterText.textContent = 'Filtreleniyor: ' + value;
                  if (filterBar) {
                    filterBar.style.display = 'flex';
                    void filterBar.offsetWidth;
                    filterBar.classList.add('visible');
                  }

                  activeFilteredComments = allComments.filter(c => {
                    if (type === 'topic') {
                      for (let i = 0; i < c.topics.length; i++) {
                        const t = c.topics[i];
                        let matchesValue = false;
                        if (value.includes('|')) {
                          matchesValue = (value === t.main + '|' + t.sub);
                        } else {
                          matchesValue = (value === t.main || value === t.sub);
                        }
                        if (matchesValue) {
                          if (sentiment === 'negative' && t.score >= 50) continue;
                          if (sentiment === 'positive' && t.score < 80) continue;
                          return true;
                        }
                      }
                      return false;
                    } else if (type === 'nationality') {
                      return c.nationality === value;
                    } else if (type === 'source') {
                      return c.source === value;
                    }
                    return false;
                  });

                  if (countBadge) countBadge.textContent = activeFilteredComments.length + ' Yorum';
                  renderBatch(true);
                });
              });
            }
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

            // --- D. AKILLI METRİK PERFORMANS AÇIKLAMA ŞABLON MOTORU ---
            const tooltipEl = document.createElement('div');
            tooltipEl.id = 'metric-template-tooltip';
            document.body.appendChild(tooltipEl);

            function formatMetricNarrative(ds) {
              const title = ds.metricName || 'Metrik';
              const type = ds.metricType || 'general';
              const currCount = parseInt(ds.currCount, 10) || 0;
              const prevCount = (ds.prevCount !== undefined && ds.prevCount !== '') ? parseInt(ds.prevCount, 10) : undefined;
              const currScore = parseInt(ds.currScore, 10) || 0;
              const prevScore = (ds.prevScore !== undefined && ds.prevScore !== '') ? parseInt(ds.prevScore, 10) : undefined;
              const scoreDelta = (ds.scoreDelta !== undefined && ds.scoreDelta !== '') ? parseInt(ds.scoreDelta, 10) : undefined;
              const growthRate = (ds.growthRate !== undefined && ds.growthRate !== '') ? parseInt(ds.growthRate, 10) : undefined;
              const extra = ds.extra || '';

              let typeLabel = 'Metrik Analizi';
              if (type === 'source') typeLabel = 'Kanal Kaynağı';
              else if (type === 'category') typeLabel = 'Ana Kategori';
              else if (type === 'subCategory') typeLabel = 'Alt Kategori / Konu';
              else if (type === 'nationality') typeLabel = 'Pazar / Uyruk';
              else if (type === 'timeline') typeLabel = 'Zaman Periyodu';
              else if (type === 'topic') typeLabel = 'Gündem / Konu';
              else if (type === 'praisedTopic') typeLabel = 'Övülen Başarı';
              else if (type === 'urgentTopic') typeLabel = 'Acil Müdahale';

              const hasPrevCount = prevCount !== undefined && prevCount > 0;
              const hasPrevScore = prevScore !== undefined;
              const hasScoreDelta = scoreDelta !== undefined;
              const growthAbs = Math.abs(growthRate || 0);

              let volumeSentence = '';
              if (type === 'praisedTopic') {
                if (hasPrevCount) {
                  volumeSentence = 'Önceki dönemde bu konuda ' + prevCount + ' övgü alınmışken, bu dönemde övgü sayısı ' + currCount + ' adede ulaştı (' + (growthRate !== undefined && growthRate >= 0 ? 'övgü hacmi %' + growthAbs + ' büyüdü' : 'övgü adedi %' + growthAbs + ' azaldı') + ').';
                } else {
                  volumeSentence = 'Bu konuda önceki dönemde kayıtlı övgü bulunmuyor; bu dönemde toplam ' + currCount + ' yeni övgü kaydedildi.';
                }
              } else if (type === 'urgentTopic') {
                if (hasPrevCount) {
                  volumeSentence = 'Önceki dönemde bu konuda ' + prevCount + ' şikayet bildirilmişken, bu dönemde şikayet sayısı ' + currCount + ' adede ulaştı (' + (growthRate !== undefined && growthRate > 0 ? 'şikayet hacmi %' + growthAbs + ' ARTTI ⚠️' : 'şikayet adedi %' + growthAbs + ' azaldı 📉') + ').';
                } else {
                  volumeSentence = 'Bu konu önceki dönemde şikayet konusu olmamışken, bu dönem ilk kez ' + currCount + ' şikayet bildirildi.';
                }
              } else if (type === 'topic') {
                if (hasPrevCount) {
                  volumeSentence = 'Önceki dönemde bu konudan ' + prevCount + ' kez bahsedilmişken, bu dönem ' + currCount + ' yoruma ulaştı (gündeme gelme sıklığı %' + growthAbs + ' ' + (currCount >= (prevCount || 0) ? 'arttı' : 'azaldı') + ').';
                } else {
                  volumeSentence = 'Bu konu önceki dönemde gündemde yokken, bu dönem ' + currCount + ' misafir yorumunda yer aldı.';
                }
              } else if (type === 'source') {
                if (hasPrevCount) {
                  if (currCount > prevCount) {
                    volumeSentence = 'Önceki dönemde ' + title + ' kanalından ' + prevCount + ' yorum gelmişken, bu dönemde ' + currCount + ' yoruma ulaşıldı (yorum hacmi %' + growthAbs + ' büyüdü).';
                  } else if (currCount < prevCount) {
                    volumeSentence = 'Önceki dönemde ' + title + ' kanalından ' + prevCount + ' yorum alınmışken, bu dönemde ' + currCount + ' yoruma geriledi (yorum hacmi %' + growthAbs + ' daraldı).';
                  } else {
                    volumeSentence = 'Önceki dönemle aynı sayıda (' + currCount + ' adet) yorum kaydedildi (hacim korundu).';
                  }
                } else {
                  volumeSentence = 'Bu kanal için önceki dönemde kayıtlı yorum bulunmuyor. Bu dönemde ilk kez ' + currCount + ' yorum kaydedildi.';
                }
              } else if (type === 'category' || type === 'subCategory') {
                if (hasPrevCount) {
                  if (currCount > prevCount) {
                    volumeSentence = 'Önceki dönemde bu konudan ' + prevCount + ' kez bahsedilmişken, bu dönemde ' + currCount + ' yoruma ulaşıldı (gündeme gelme oranı %' + growthAbs + ' arttı).';
                  } else if (currCount < prevCount) {
                    volumeSentence = 'Önceki dönemde bu konudan ' + prevCount + ' kez bahsedilmişken, bu dönemde ' + currCount + ' yoruma indi (gündeme gelme sıklığı %' + growthAbs + ' azaldı).';
                  } else {
                    volumeSentence = 'Önceki dönem ile bu dönemde aynı sıklıkta (' + currCount + ' kez) dile getirildi.';
                  }
                } else {
                  volumeSentence = 'Bu konu önceki dönemde hiç dile getirilmemişken, bu dönem ' + currCount + ' misafir yorumunda yer aldı.';
                }
              } else if (type === 'nationality') {
                if (hasPrevCount) {
                  if (currCount > prevCount) {
                    volumeSentence = 'Önceki dönemde ' + title + ' pazarından ' + prevCount + ' misafir yorumu alınmışken, bu dönemde ' + currCount + ' yoruma ulaşıldı (pazar hacmi %' + growthAbs + ' büyüdü).';
                  } else if (currCount < prevCount) {
                    volumeSentence = 'Önceki dönemde ' + title + ' pazarından ' + prevCount + ' yorum gelmişken, bu dönemde ' + currCount + ' yoruma geriledi (pazar hacmi %' + growthAbs + ' azaldı).';
                  } else {
                    volumeSentence = 'Önceki dönem ile bu dönemde aynı sayıda (' + currCount + ' adet) misafir değerlendirmesi alındı.';
                  }
                } else {
                  volumeSentence = 'Bu uyruk / pazar için önceki dönemde kayıtlı yorum bulunmuyor; bu dönem ilk kez ' + currCount + ' yorum alındı.';
                }
              } else if (type === 'timeline') {
                if (hasPrevCount) {
                  if (currCount > prevCount) {
                    volumeSentence = 'Önceki eşdeğer periyotta ' + prevCount + ' yorum toplanmışken, bu periyotta ' + currCount + ' yoruma ulaşıldı (yorum akışı %' + growthAbs + ' arttı).';
                  } else if (currCount < prevCount) {
                    volumeSentence = 'Önceki periyotta ' + prevCount + ' yorum toplanmışken, bu periyotta ' + currCount + ' yoruma geriledi (yorum sayısı %' + growthAbs + ' azaldı).';
                  } else {
                    volumeSentence = 'Önceki periyotla eşit sayıda (' + currCount + ' adet) yorum kaydedildi.';
                  }
                } else {
                  volumeSentence = 'Önceki eşdeğer periyotta kayıtlı veri bulunmuyor; bu periyotta toplam ' + currCount + ' yorum incelendi.';
                }
              } else {
                volumeSentence = hasPrevCount ? ('Önceki dönem ' + prevCount + ' adetten bu dönem ' + currCount + ' adede ulaştı.') : ('Bu dönem toplam ' + currCount + ' kayıt mevcut.');
              }

              let scoreSentence = '';
              if (hasPrevScore && hasScoreDelta) {
                if (scoreDelta > 0) {
                  scoreSentence = 'Önceki dönem memnuniyet oranı %' + prevScore + ' iken, bu dönem %' + currScore + ' seviyesine çıkarak +' + scoreDelta + ' puanlık net bir artış yakaladı.';
                } else if (scoreDelta < 0) {
                  scoreSentence = 'Önceki dönem memnuniyet skoru %' + prevScore + ' iken, bu dönem %' + currScore + ' seviyesine inerek ' + Math.abs(scoreDelta) + ' puanlık bir gerileme gösterdi.';
                } else {
                  scoreSentence = 'Memnuniyet skoru önceki dönemle birebir aynı kalarak %' + currScore + ' seviyesinde dengesini korudu (0 puan değişim).';
                }
              } else {
                scoreSentence = 'Bu dönem misafir memnuniyet skoru %' + currScore + ' olarak gerçekleşti.';
              }

              let verdict = '⚖️ Stabil Denge: Performans önceki dönemin kalite standartlarını istikrarlı bir şekilde koruyor.';
              if (type === 'praisedTopic') {
                verdict = '👑 Güçlü Misafir Takdiri: Otelin misafir memnuniyetinde öne çıkan en güçlü başarı alanlarındandır.';
              } else if (type === 'urgentTopic') {
                verdict = (growthRate !== undefined && growthRate > 0)
                  ? '🚨 Acil Müdahale: Şikayet hacmi yükselişte; operasyonel aksiyonlar ivedilikle devreye alınmalıdır.'
                  : '⚠️ İnceleme & Takip: Kronikleşen şikayetlerin kök nedenleri incelenmeli ve kalıcı çözümler uygulanmalıdır.';
              } else if (type === 'topic') {
                verdict = (scoreDelta !== undefined && scoreDelta >= 5)
                  ? '🌟 Pozitif Gündem: Konu misafirler nezdinde belirgin şekilde değer kazanıyor.'
                  : ((scoreDelta !== undefined && scoreDelta <= -5)
                    ? '⚠️ Riskli Gündem: Konuda misafir algısı geriliyor, dikkat edilmeli.'
                    : '⚖️ Dengeli Gündem: Konu misafir deneyiminde olağan seyrini koruyor.');
              } else if (!hasPrevScore && !hasPrevCount) {
                verdict = '✨ Yeni Veri: Bu dönem misafir memnuniyeti %' + currScore + ' düzeyinde giriş yaptı.';
              } else if (scoreDelta >= 5) {
                verdict = '🚀 Güçlü İyileşme: Hem misafir algısı hem memnuniyet performansı çok yüksek ve pozitif ivmede seyrediyor.';
              } else if (scoreDelta > 0) {
                verdict = '↗ Olumlu Gidişat: Misafirlerin memnuniyet puanında gözle görülür bir artış ve iyileşme kaydedildi.';
              } else if (scoreDelta <= -5) {
                verdict = '⚠️ Acil İnceleme: Memnuniyet skorunda belirgin bir düşüş var; gelen olumsuz yorumların acilen teşhis edilmesi önerilir.';
              } else if (scoreDelta < 0) {
                verdict = '↘ Dikkat: Memnuniyet seviyesinde hafif bir gerileme söz konusu; trendin izlenmesi tavsiye edilir.';
              }

              const deltaColor = (scoreDelta && scoreDelta > 0) ? 'rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);' : ((scoreDelta && scoreDelta < 0) ? 'rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.4);' : 'rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3);');
              const deltaBadgeText = (scoreDelta && scoreDelta > 0) ? ('+' + scoreDelta + ' Puan') : ((scoreDelta !== undefined) ? (scoreDelta + ' Puan') : '0 Puan');
              const growthColor = (growthRate !== undefined && growthRate >= 0) ? '#34d399' : '#fb7185';
              const growthStr = growthRate !== undefined ? (growthRate >= 0 ? '+' + growthRate + '%' : growthRate + '%') : '-';

              return '<div style="font-family: inherit;">' +
                '<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 6px;">' +
                  '<div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">' +
                    '<span style="font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; background: rgba(99, 102, 241, 0.25); color: #a5b4fc; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(99, 102, 241, 0.4); white-space: nowrap;">' + typeLabel + '</span>' +
                    '<span style="font-size: 13px; font-weight: 800; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + title + '</span>' +
                  '</div>' +
                  '<span style="font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; background: ' + deltaColor + '; white-space: nowrap;">' +
                    deltaBadgeText +
                  '</span>' +
                '</div>' +
                '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: rgba(30, 41, 59, 0.7); border-radius: 8px; padding: 8px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.06); text-align: center;">' +
                  '<div>' +
                    '<div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Bu Dönem</div>' +
                    '<div style="font-size: 13px; font-weight: 900; color: #ffffff;">%' + currScore + '</div>' +
                    '<div style="font-size: 10px; color: #cbd5e1; font-weight: 600;">' + currCount + ' yorum</div>' +
                  '</div>' +
                  '<div>' +
                    '<div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Önceki</div>' +
                    '<div style="font-size: 13px; font-weight: 900; color: #94a3b8;">' + (hasPrevScore ? ('%' + prevScore) : '-') + '</div>' +
                    '<div style="font-size: 10px; color: #94a3b8; font-weight: 600;">' + (hasPrevCount ? (prevCount + ' yorum') : '-') + '</div>' +
                  '</div>' +
                  '<div>' +
                    '<div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Hacim Değişimi</div>' +
                    '<div style="font-size: 13px; font-weight: 900; color: ' + growthColor + ';">' + growthStr + '</div>' +
                    '<div style="font-size: 10px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">' + (extra || 'Trend') + '</div>' +
                  '</div>' +
                '</div>' +
                '<div style="font-size: 11px; line-height: 1.55; color: #e2e8f0; margin-bottom: 6px;">' +
                  '<p style="margin: 0 0 4px 0;"><strong style="color: #818cf8;">•</strong> ' + volumeSentence + '</p>' +
                  '<p style="margin: 0;"><strong style="color: #818cf8;">•</strong> ' + scoreSentence + '</p>' +
                '</div>' +
                '<div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.12); font-size: 11px; font-weight: 700; color: #cbd5e1;">' +
                  verdict +
                '</div>' +
                '<div style="margin-top: 6px; font-size: 9px; color: #64748b; text-align: right; font-style: italic;">' +
                  'İş Zekası & Karşılaştırmalı Metrik Şablonu' +
                '</div>' +
              '</div>';
            }

            function positionMetricTooltip(e) {
              const tooltipWidth = 360;
              const tooltipHeight = 230;
              let x = e.clientX + 16;
              let y = e.clientY + 16;
              if (x + tooltipWidth > window.innerWidth) {
                x = e.clientX - tooltipWidth - 16;
              }
              if (y + tooltipHeight > window.innerHeight) {
                y = Math.max(12, window.innerHeight - tooltipHeight - 12);
              }
              tooltipEl.style.left = x + 'px';
              tooltipEl.style.top = y + 'px';
            }

            const metricTriggers = document.querySelectorAll('[data-metric-tooltip="performance"]');
            metricTriggers.forEach(el => {
              el.addEventListener('mouseenter', (e) => {
                tooltipEl.innerHTML = formatMetricNarrative(el.dataset);
                positionMetricTooltip(e);
                tooltipEl.classList.add('visible');
              });
              el.addEventListener('mousemove', (e) => {
                positionMetricTooltip(e);
              });
              el.addEventListener('mouseleave', () => {
                tooltipEl.classList.remove('visible');
              });
            });

            // --- E. KPI DÖNEM KARŞILAŞTIRMA ARAÇ İPUCU (HOVER TOOLTIP) MOTORU ---
            const kpiTooltipEl = document.createElement('div');
            kpiTooltipEl.id = 'kpi-comparison-tooltip';
            document.body.appendChild(kpiTooltipEl);

            function escapeKpiHtml(str) {
              if (!str) return '';
              return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            }

            function formatKpiComparisonNarrative(ds) {
              const isComparison = ds.kpiComparison === 'true';
              const label = escapeKpiHtml(ds.kpiLabel || 'KPI Metriği');
              const value = escapeKpiHtml(ds.kpiValue || '-');
              const subValue = escapeKpiHtml(ds.kpiSubvalue || '');
              const fromText = escapeKpiHtml(ds.kpiFrom || '-');
              const toText = escapeKpiHtml(ds.kpiTo || value);
              const deltaText = escapeKpiHtml(ds.kpiDelta || '');
              const isGood = ds.kpiIsGood === 'true';
              const tooltip = escapeKpiHtml(ds.kpiTooltip || '');
              const prevPeriod = escapeKpiHtml(ds.kpiPrevPeriod || '');
              const currPeriod = escapeKpiHtml(ds.kpiCurrPeriod || '');

              if (isComparison) {
                const badgeStyle = isGood 
                  ? 'background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.3);'
                  : 'background: rgba(244, 63, 94, 0.2); color: #fda4af; border: 1px solid rgba(244, 63, 94, 0.3);';

                let periodHtml = '';
                if (prevPeriod || currPeriod) {
                  periodHtml = '<div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 10px; color: #94a3b8; background: rgba(30, 41, 59, 0.5); padding: 8px; border-radius: 12px; border: 1px solid rgba(51, 65, 85, 0.5);">';
                  if (prevPeriod) {
                    periodHtml += '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                      '<span style="display: flex; align-items: center; gap: 4px; font-weight: 500;">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>' +
                        'Önceki Dönem:</span>' +
                      '<span style="font-weight: 600; color: #cbd5e1;">' + prevPeriod + '</span>' +
                    '</div>';
                  }
                  if (currPeriod) {
                    periodHtml += '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                      '<span style="display: flex; align-items: center; gap: 4px; font-weight: 500;">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>' +
                        'Bu Dönem:</span>' +
                      '<span style="font-weight: 600; color: #c7d2fe;">' + currPeriod + '</span>' +
                    '</div>';
                  }
                  periodHtml += '</div>';
                }

                return '' +
                  '<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 10px; margin-bottom: 12px;">' +
                    '<div style="display: flex; align-items: center; gap: 6px; min-width: 0;">' +
                      '<span style="padding: 4px; border-radius: 6px; background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); display: inline-flex; align-items: center;">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>' +
                      '</span>' +
                      '<span style="font-size: 12px; font-weight: 900; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.025em;">' +
                        label + ' • Dönem Karşılaştırması' +
                      '</span>' +
                    '</div>' +
                    (deltaText ? '<span style="font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 9999px; white-space: nowrap; ' + badgeStyle + '">' + deltaText + '</span>' : '') +
                  '</div>' +
                  periodHtml +
                  '<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; background: rgba(30, 41, 59, 0.8); border-radius: 12px; padding: 10px; margin-bottom: 12px; border: 1px solid rgba(51, 65, 85, 0.5); text-align: center;">' +
                    '<div style="border-right: 1px solid rgba(51, 65, 85, 0.6); padding-right: 8px;">' +
                      '<div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: -0.025em;">Önceki Veri</div>' +
                      '<div style="font-size: 14px; font-weight: 900; color: #e2e8f0; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + fromText + '">' + fromText + '</div>' +
                    '</div>' +
                    '<div style="padding-left: 4px;">' +
                      '<div style="font-size: 9px; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: -0.025em;">Şimdiki Veri</div>' +
                      '<div style="font-size: 14px; font-weight: 900; color: #ffffff; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="' + toText + '">' + toText + '</div>' +
                    '</div>' +
                  '</div>' +
                  (tooltip ? (
                    '<div style="background: rgba(30, 41, 59, 0.9); border-radius: 12px; padding: 10px; border: 1px solid rgba(51, 65, 85, 0.6); font-size: 12px; color: #cbd5e1; line-height: 1.5; display: flex; align-items: flex-start; gap: 8px;">' +
                      '<span style="color: #fbbf24; flex-shrink: 0; margin-top: 2px; display: inline-flex;">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>' +
                      '</span>' +
                      '<p style="margin: 0; font-size: 11px; line-height: 1.55; color: #e2e8f0;">' + tooltip + '</p>' +
                    '</div>'
                  ) : '') +
                  '<div style="margin-top: 10px; font-size: 9px; color: #94a3b8; text-align: center; font-weight: 500;">' +
                    '💡 Detaylı analiz ve ilgili yorumları görmek için karta tıklayabilirsiniz.' +
                  '</div>';
              }

              return '' +
                '<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 10px; margin-bottom: 12px;">' +
                  '<div style="display: flex; align-items: center; gap: 6px; min-width: 0;">' +
                    '<span style="padding: 4px; border-radius: 6px; background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); display: inline-flex; align-items: center;">' +
                      '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>' +
                    '</span>' +
                    '<span style="font-size: 12px; font-weight: 900; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' +
                      label +
                    '</span>' +
                  '</div>' +
                '</div>' +
                '<div style="background: rgba(30, 41, 59, 0.8); border-radius: 12px; padding: 12px; margin-bottom: 10px; border: 1px solid rgba(51, 65, 85, 0.5); text-align: center;">' +
                  '<div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Mevcut Değer</div>' +
                  '<div style="font-size: 18px; font-weight: 900; color: #ffffff; margin-top: 2px;">' + value + '</div>' +
                  (subValue ? '<div style="font-size: 10px; color: #818cf8; margin-top: 2px; font-weight: 600;">' + subValue + '</div>' : '') +
                '</div>' +
                (currPeriod ? '<div style="font-size: 10px; color: #94a3b8; text-align: center; margin-bottom: 8px;">Dönem: <strong style="color: #cbd5e1;">' + currPeriod + '</strong></div>' : '') +
                '<div style="font-size: 9px; color: #94a3b8; text-align: center; font-weight: 500;">' +
                  '💡 İlgili yorum ve alt başlıkları filtrelemek için karta tıklayabilirsiniz.' +
                '</div>';
            }

            function positionKpiTooltip(e) {
              const tooltipWidth = 350;
              const tooltipHeight = 250;
              let x = e.clientX + 16;
              let y = e.clientY + 16;
              if (x + tooltipWidth > window.innerWidth) {
                x = e.clientX - tooltipWidth - 16;
              }
              if (y + tooltipHeight > window.innerHeight) {
                y = Math.max(12, window.innerHeight - tooltipHeight - 12);
              }
              kpiTooltipEl.style.left = x + 'px';
              kpiTooltipEl.style.top = y + 'px';
            }

            const kpiTriggers = document.querySelectorAll('[data-kpi-card="true"]');
            kpiTriggers.forEach(el => {
              el.addEventListener('mouseenter', (e) => {
                kpiTooltipEl.innerHTML = formatKpiComparisonNarrative(el.dataset);
                positionKpiTooltip(e);
                kpiTooltipEl.classList.add('visible');
              });
              el.addEventListener('mousemove', (e) => {
                positionKpiTooltip(e);
              });
              el.addEventListener('mouseleave', () => {
                kpiTooltipEl.classList.remove('visible');
              });
            });

            window.addEventListener('scroll', () => {
              kpiTooltipEl.classList.remove('visible');
            }, { passive: true });
        });
    </script>
</body>
</html>
    `;

    const optimizedHtml = optimizeExportedHtml(html);
    const blob = new Blob([optimizedHtml], { type: 'text/html;charset=utf-8' });
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

  const handleGenerateSectionSummaries = async () => {
    if (filteredAnalytics.length === 0) {
      alert("Özetlenecek veri bulunamadı.");
      return;
    }
    
    setIsGeneratingSectionSummaries(true);
    setIsAiMenuOpen(false);
    
    try {
      const timelineData = dashboardData.satisfactionOverTime[timelineGranularity];
      let timelineContext = '';
      if (timelineData && timelineData.length > 0) {
        const peakItem = [...timelineData].sort((a, b) => b.count - a.count)[0];
        const highestScoreItem = [...timelineData].sort((a, b) => b.avgScore - a.avgScore)[0];
        const lowestScoreItem = [...timelineData].sort((a, b) => a.avgScore - b.avgScore)[0];
        const totalTimelineComments = timelineData.reduce((sum, item) => sum + item.count, 0);
        const avgTimelineComments = Math.round(totalTimelineComments / timelineData.length);
        
        const unit = timelineGranularity === 'daily' ? 'gün' : timelineGranularity === 'weekly' ? 'hafta' : timelineGranularity === 'monthly' ? 'ay' : 'yıl';
        
        timelineContext = `
      Zamana Göre Memnuniyet Skoru (${unit}lik kırılım):
      - Toplam incelenen ${unit} sayısı: ${timelineData.length}
      - Bu periyot için ortalama gelen yorum sayısı: ${avgTimelineComments} yorum / ${unit}
      - En yoğun ${unit}: ${peakItem.date} (${peakItem.count} yorum)
      - En yüksek memnuniyetli ${unit}: ${highestScoreItem.date} (%${highestScoreItem.avgScore} memnuniyet)
      - En düşük memnuniyetli ${unit}: ${lowestScoreItem.date} (%${lowestScoreItem.avgScore} memnuniyet)
      - Ham Veriler: ${JSON.stringify(timelineData.map(d => ({tarih: d.date, skor: d.avgScore, yorum_sayisi: d.count})).slice(0, 15))}
        `;
      }

      const prompt = `
      Sen 5 yıldızlı bir otelin baş veri analisti ve kalite müdürüsün.
      Aşağıdaki otel müşteri yorumları analitik verilerini kullanarak, belirtilen her bir dashboard bölümü için 3-4 cümlelik "doğal dilli", çok profesyonel, "içgörü odaklı" özetler oluştur.
      Sadece rakamları dümdüz okuma. Amacımız raporu okuyan kişinin (Genel Müdür vb.) anomalileri görmesini, dikkat çeken başarıları ve tehlikeli düşüşleri/gelişim alanlarını tespit edebilmesini sağlamaktır. Okuyucuyu yönlendirici ve açıklayıcı yorumlar kat.
      
      Genel Veriler:
      Toplam Yorum: ${dashboardData.kpis.totalComments}
      Ortalama Skor: ${dashboardData.kpis.avgScore}
      
      Kategoriler (Kategori Bazlı Memnuniyet):
      ${JSON.stringify(hierarchicalCategoryData.slice(0, 5), null, 2)}
      
      Uyruklar (Uyruk Analizi):
      ${JSON.stringify(dashboardData.nationalityAnalysis.slice(0, 5), null, 2)}
      
      Kanallar (Kanal Dağılımı):
      ${JSON.stringify(dashboardData.sourceAnalysis.slice(0, 5), null, 2)}
      
      ${timelineContext}
      
      En Çok Konuşulan Konular (Top 10):
      ${JSON.stringify(dashboardData.mostMentioned.slice(0, 10).map(m => ({ konu: m.subCategory, kategori: m.mainCategory, sayi: m.count, skor: m.avgScore })), null, 2)}
      
      En Çok Övülen Konular (Top 10):
      ${JSON.stringify(dashboardData.topPositive.slice(0, 10).map(p => ({ konu: p.subCategory, kategori: p.mainCategory, sayi: p.count, skor: p.avgScore })), null, 2)}
      
      Acil Müdahale Gerekenler - Şikayetler (Top 10):
      ${JSON.stringify(dashboardData.topNegative.slice(0, 10).map(n => ({ konu: n.subCategory, kategori: n.mainCategory, sayi: n.count, skor: n.avgScore })), null, 2)}
      
      Lütfen aşağıdaki JSON formatında yanıt ver. Sadece JSON döndür. MD veya metin kullanma.
      {
        "kpi_cards": "KPI özet kartları için içgörü...",
        "satisfaction_timeline": "Zamana göre memnuniyet tablosunun içgörülü özeti...",
        "category_satisfaction": "Kategori performansı içgörüleri...",
        "source_analysis": "Kanal dağılımına dair dikkat çeken noktalar...",
        "nationality_analysis": "Uyruk analizinin doğal dille özeti...",
        "most_mentioned_topics": "En çok konuşulan gündem konularının değerlendirmesi...",
        "top_positive_topics": "Misafirlerin en çok beğendiği konuların özeti...",
        "top_negative_topics": "Acil müdahale gerektiren zayıf yönlerin alarm niteliğinde özeti..."
      }
      `;
      
      const response = await generateAIContent(prompt, 'Dashboard Bölüm Özetleri', 'dashboardSectionSummary');
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const summaries = JSON.parse(jsonMatch[0]);
        setSectionSummaries(summaries);
      } else {
        throw new Error("Geçerli JSON bulunamadı.");
      }
    } catch (error) {
      console.error("Bölüm özetleri üretilirken hata:", error);
      alert("Bölüm özetleri üretilirken bir hata oluştu.");
    } finally {
      setIsGeneratingSectionSummaries(false);
    }
  };

  const prepareMonthlyChunks = () => {
    const parseDateLocal = (dateStr: string) => {
      if (!dateStr) return new Date();
      if (typeof dateStr === 'string' && dateStr.includes('.') && dateStr.split('.').length === 3) {
        const [d, m, y] = dateStr.split('.');
        return new Date(`${y}-${m}-${d}`);
      }
      return new Date(dateStr);
    };

    const getMonthKey = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const getMonthNameTr = (monthIndex: number) => {
      const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
      ];
      return months[monthIndex];
    };

    const currentGrouped: Record<string, CommentAnalytics[]> = {};
    filteredAnalytics.forEach(item => {
      const d = parseDateLocal(item.date || item.createdAt);
      if (!isNaN(d.getTime())) {
        const key = getMonthKey(d);
        if (!currentGrouped[key]) currentGrouped[key] = [];
        currentGrouped[key].push(item);
      }
    });

    const previousGrouped: Record<string, CommentAnalytics[]> = {};
    const compareActive = appliedFilters.isCompareActive;
    
    if (compareActive && previousFilteredAnalytics.length > 0) {
      previousFilteredAnalytics.forEach(item => {
        const d = parseDateLocal(item.date || item.createdAt);
        if (!isNaN(d.getTime())) {
          const key = getMonthKey(d);
          if (!previousGrouped[key]) previousGrouped[key] = [];
          previousGrouped[key].push(item);
        }
      });
    } else {
      analytics.forEach(item => {
        const d = parseDateLocal(item.date || item.createdAt);
        if (!isNaN(d.getTime())) {
          const key = getMonthKey(d);
          if (!previousGrouped[key]) previousGrouped[key] = [];
          previousGrouped[key].push(item);
        }
      });
    }

    const sortedCurrentKeys = Object.keys(currentGrouped).sort();
    
    return sortedCurrentKeys.map(key => {
      const [yearStr, monthStr] = key.split('-');
      const year = parseInt(yearStr);
      const monthIdx = parseInt(monthStr) - 1;
      const monthName = getMonthNameTr(monthIdx);
      
      const thisYearItems = currentGrouped[key] || [];
      const thisYearVolume = thisYearItems.length;
      const thisYearScore = thisYearVolume > 0 
        ? Math.round(thisYearItems.reduce((sum, item) => sum + (item.overallScore || 0), 0) / thisYearVolume)
        : 0;

      const topicCounts: Record<string, { count: number, totalScore: number }> = {};
      thisYearItems.forEach(item => {
        item.topics?.forEach(t => {
          const name = t.subCategory;
          if (!topicCounts[name]) topicCounts[name] = { count: 0, totalScore: 0 };
          topicCounts[name].count += 1;
          topicCounts[name].totalScore += t.score || 0;
        });
      });
      const thisYearTopTopics = Object.entries(topicCounts)
        .map(([name, val]) => ({ topic: name, count: val.count, avgScore: Math.round(val.totalScore / val.count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Channel (Source) counts
      const sourceCounts: Record<string, { count: number, totalScore: number }> = {};
      thisYearItems.forEach(item => {
        const src = item.source || 'Bilinmiyor';
        if (!sourceCounts[src]) sourceCounts[src] = { count: 0, totalScore: 0 };
        sourceCounts[src].count += 1;
        sourceCounts[src].totalScore += item.overallScore || 0;
      });
      const thisYearTopSources = Object.entries(sourceCounts)
        .map(([name, val]) => ({ source: name, count: val.count, avgScore: Math.round(val.totalScore / val.count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Nationality (Market) counts
      const nationalityCounts: Record<string, { count: number, totalScore: number }> = {};
      thisYearItems.forEach(item => {
        const nat = normalizeNationality(item.nationality);
        if (!nationalityCounts[nat]) nationalityCounts[nat] = { count: 0, totalScore: 0 };
        nationalityCounts[nat].count += 1;
        nationalityCounts[nat].totalScore += item.overallScore || 0;
      });
      const thisYearTopNationalities = Object.entries(nationalityCounts)
        .map(([name, val]) => ({ nationality: name, count: val.count, avgScore: Math.round(val.totalScore / val.count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      const lastYearKey = `${year - 1}-${monthStr}`;
      const lastYearItems = previousGrouped[lastYearKey] || [];
      const lastYearVolume = lastYearItems.length;
      const lastYearScore = lastYearVolume > 0
        ? Math.round(lastYearItems.reduce((sum, item) => sum + (item.overallScore || 0), 0) / lastYearVolume)
        : 0;

      const lastYearTopicCounts: Record<string, { count: number, totalScore: number }> = {};
      lastYearItems.forEach(item => {
        item.topics?.forEach(t => {
          const name = t.subCategory;
          if (!lastYearTopicCounts[name]) lastYearTopicCounts[name] = { count: 0, totalScore: 0 };
          lastYearTopicCounts[name].count += 1;
          lastYearTopicCounts[name].totalScore += t.score || 0;
        });
      });
      const lastYearTopTopics = Object.entries(lastYearTopicCounts)
        .map(([name, val]) => ({ topic: name, count: val.count, avgScore: Math.round(val.totalScore / val.count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Last Year Channels
      const lastYearSourceCounts: Record<string, { count: number, totalScore: number }> = {};
      lastYearItems.forEach(item => {
        const src = item.source || 'Bilinmiyor';
        if (!lastYearSourceCounts[src]) lastYearSourceCounts[src] = { count: 0, totalScore: 0 };
        lastYearSourceCounts[src].count += 1;
        lastYearSourceCounts[src].totalScore += item.overallScore || 0;
      });
      const lastYearTopSources = Object.entries(lastYearSourceCounts)
        .map(([name, val]) => ({ source: name, count: val.count, avgScore: Math.round(val.totalScore / val.count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

      // Last Year Nationalities
      const lastYearNationalityCounts: Record<string, { count: number, totalScore: number }> = {};
      lastYearItems.forEach(item => {
        const nat = normalizeNationality(item.nationality);
        if (!lastYearNationalityCounts[nat]) lastYearNationalityCounts[nat] = { count: 0, totalScore: 0 };
        lastYearNationalityCounts[nat].count += 1;
        lastYearNationalityCounts[nat].totalScore += item.overallScore || 0;
      });
      const lastYearTopNationalities = Object.entries(lastYearNationalityCounts)
        .map(([name, val]) => ({ nationality: name, count: val.count, avgScore: Math.round(val.totalScore / val.count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      return {
        monthName: `${monthName} ${year}`,
        compareMonthName: `${monthName} ${year - 1}`,
        thisYear: {
          volume: thisYearVolume,
          score: thisYearScore,
          topTopics: thisYearTopTopics,
          topSources: thisYearTopSources,
          topNationalities: thisYearTopNationalities
        },
        lastYear: {
          volume: lastYearVolume,
          score: lastYearScore,
          topTopics: lastYearTopTopics,
          topSources: lastYearTopSources,
          topNationalities: lastYearTopNationalities
        }
      };
    });
  };

  const handleGenerateDeepAnalytics = async () => {
    if (filteredAnalytics.length === 0) {
      alert("Analiz edilecek veri bulunamadı.");
      return;
    }

    setIsGeneratingDeepAnalytics(true);
    setIsAiMenuOpen(false);
    setDeepAnalyticsProgress("Veriler hazırlanıyor ve zaman dilimlerine bölünüyor...");
    
    try {
      await sleep(1000);
      const chunks = prepareMonthlyChunks();
      
      for (const chunk of chunks) {
        setDeepAnalyticsProgress(`${chunk.monthName} verileri karşılaştırılıyor...`);
        await sleep(1500);
      }

      setDeepAnalyticsProgress("Anomali taraması yapılıyor...");
      await sleep(1500);

      setDeepAnalyticsProgress("Memnuniyet ve eğilim sapmaları tespit ediliyor...");
      await sleep(1200);

      setDeepAnalyticsProgress("Stratejik rapor mizanpajı oluşturuluyor...");

      const systemPrompt = `
Rolün: 5 Yıldızlı bir otelin Stratejik Kalite Direktörü ve Kıdemli Veri Analistisin. 
Görevin: Sana parça parça verilen dönem ve geçen yılın aynı dönemine ait misafir memnuniyet verilerini, üst düzey yöneticilerin (C-Level) okuyacağı katı bir teşhis raporuna dönüştürmek.

Kesin Kurallar:
1. KESİNLİKLE operasyonel tavsiye veya aksiyon planı vermeyeceksin ("Klimayı tamir edin", "Eğitim verin" gibi cümleler yasaktır). Görevin sadece durumu teşhis etmektir.
2. Verileri tane tane, zamana yayarak (aylık değişimler, trend eğilimleri) analiz edeceksin.
3. Bu analizin bir Misafir Yorum Analizi (Guest Comment Analysis) değerlendirmesi olduğunu unutma ve dili buna göre yapılandır.
4. "Cari Dönem" ifadesi yerine sadece "Dönem" veya "Bu Dönem" ifadesini kullan.
5. "Trend Kayması" ifadesini çok fazla kullanmak rahatsız edicidir. Bunun yerine "Gidişat Eğilimi", "Algı Kayması", "Yön Değişimi", "Memnuniyet Salınımı", "Hacimsel Dalgalanma" veya "Performans Sapması" gibi daha uygun ve çeşitli profesyonel ifadeler kullanacaksın.
6. Beklenmedik dalgalanmaları, pazar (uyruk) veya kanal bazlı ani kopmaları "Anomali" başlığı altında topla.
7. Çıktıyı HTML <h3> ve <ul>-<li> formatında, üst yönetimin gözünün hemen çarpacağı net sayılarla (Skor değişim yüzdeleri, yorum hacmi farkları) tane tane listele.
      `;

      const chunksContext = chunks.map(c => `
Zaman Dilimi: ${c.monthName} vs ${c.compareMonthName}
- Dönem Yorum Hacmi: ${c.thisYear.volume} yorum, Memnuniyet Skoru: %${c.thisYear.score}
- Geçen Yıl Aynı Dönem Yorum Hacmi: ${c.lastYear.volume} yorum, Memnuniyet Skoru: %${c.lastYear.score}
- Dönem Öne Çıkan Alt Konular: ${c.thisYear.topTopics.map(t => `${t.topic} (Yorum: ${t.count}, Skor: %${t.avgScore})`).join(', ') || 'Veri Yok'}
- Geçen Yıl Aynı Dönem Öne Çıkan Alt Konular: ${c.lastYear.topTopics.map(t => `${t.topic} (Yorum: ${t.count}, Skor: %${t.avgScore})`).join(', ') || 'Veri Yok'}
- Dönem Öne Çıkan Kanallar (Kaynaklar): ${c.thisYear.topSources.map(s => `${s.source} (Yorum: ${s.count}, Skor: %${s.avgScore})`).join(', ') || 'Veri Yok'}
- Geçen Yıl Aynı Dönem Öne Çıkan Kanallar (Kaynaklar): ${c.lastYear.topSources.map(s => `${s.source} (Yorum: ${s.count}, Skor: %${s.avgScore})`).join(', ') || 'Veri Yok'}
- Dönem Öne Çıkan Uyruklar (Pazarlar): ${c.thisYear.topNationalities.map(n => `${n.nationality} (Yorum: ${n.count}, Skor: %${n.avgScore})`).join(', ') || 'Veri Yok'}
- Geçen Yıl Aynı Dönem Öne Çıkan Uyruklar (Pazarlar): ${c.lastYear.topNationalities.map(n => `${n.nationality} (Yorum: ${n.count}, Skor: %${n.avgScore})`).join(', ') || 'Veri Yok'}
      `).join('\n\n');

      const userPrompt = `
      Aşağıdaki zaman dilimi bazlı kırılımları ve karşılaştırma verilerini kullanarak, her bir dashboard modülü için derinlemesine stratejik teşhis (Deep Diagnostics) üret.
      
      Karşılaştırma Verileri:
      ${chunksContext}
      
      Lütfen her bölüm için ayrı ayrı HTML formatında teşhis yazısı içeren bir JSON yanıt döndür.
      Yalnızca geçerli bir JSON objesi döndür. Markdown etiketleri (\`\`\`json vb.) kullanma.
      
      ÖNEMLİ: JSON'da mutlaka "overall_summary" anahtarını da döndür. Bu alanda tüm sürecin bütünsel bir stratejik sentezini (Yönetici Özeti) yapmalısın. "Tüm bu sürecin özeti nedir? Aklımızda neyin kalması gerekiyor? Misafirlerimizin bu dönemki geri bildirimlerindeki ana yönelim, temel memnuniyet/hoşnutsuzluk kaynağı ve pazar/kanal dinamikleri arasındaki en kritik bağlantı nedir?" sorularının tamamına yanıt vermelisin. Kullanıcının aklında hiçbir soru işareti kalmamalıdır.
      
      JSON Şeması:
      {
        "kpi_cards": "<h3>Genel KPI Eğilim Teşhisi</h3><ul><li>...</li></ul>",
        "satisfaction_timeline": "<h3>Zaman Çizelgesi & Hacim Teşhisi</h3><ul><li>...</li></ul>",
        "category_satisfaction": "<h3>Kategori Performans Teşhisi</h3><ul><li>...</li></ul>",
        "source_analysis": "<h3>Kanal Kaynaklı Memnuniyet Teşhisi</h3><ul><li>...</li></ul>",
        "nationality_analysis": "<h3>Pazar / Uyruk Teşhisi</h3><ul><li>...</li></ul>",
        "most_mentioned_topics": "<h3>Gündem & Algı Teşhisi</h3><ul><li>...</li></ul>",
        "top_positive_topics": "<h3>Güçlü Alanlar & İstikrar Teşhisi</h3><ul><li>...</li></ul>",
        "top_negative_topics": "<h3>Zayıf Alanlar & Anomali Teşhisi</h3><ul><li>...</li></ul>",
        "overall_summary": "<h3>Misafir Yorum Analizi Stratejik Sentez & Yönetici Özeti</h3><ul><li>...</li></ul>"
      }
      `;

      const prompt = `${systemPrompt}\n\n${userPrompt}`;
      const response = await generateAIContent(prompt, 'Dashboard Derin Analizler', 'dashboardDeepAnalytics');
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const diagnostics = JSON.parse(jsonMatch[0]);
        setDeepAnalytics(diagnostics);
      } else {
        throw new Error("Geçerli JSON bulunamadı.");
      }
    } catch (error) {
      console.error("Derin analizler üretilirken hata:", error);
      alert("Derin analizler üretilirken bir hata oluştu.");
    } finally {
      setIsGeneratingDeepAnalytics(false);
      setDeepAnalyticsProgress('');
    }
  };

  const renderDeepAnalytics = (moduleId: string) => {
    if (isGeneratingDeepAnalytics) {
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 bg-amber-50/50 border border-amber-100 rounded-xl p-4 overflow-hidden relative"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5 animate-pulse">
              <TrendingUp size={14} className="animate-bounce" />
              Derin Analiz Motoru Çalışıyor...
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-600">
              {deepAnalyticsProgress || 'Veriler işleniyor...'}
            </span>
          </div>
          <div className="w-full bg-amber-100 h-1.5 rounded-full overflow-hidden">
            <motion.div 
              className="bg-gradient-to-r from-amber-500 to-indigo-600 h-full rounded-full"
              initial={{ width: "10%" }}
              animate={{ width: "95%" }}
              transition={{ duration: 15, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      );
    }

    if (!deepAnalytics[moduleId]) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 bg-amber-50/30 border border-amber-100 rounded-xl p-5 flex gap-4 relative overflow-hidden deep-analytics-block"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-amber-400 to-indigo-600"></div>
        <div className="p-2.5 bg-white rounded-xl shrink-0 h-fit shadow-sm border border-amber-100">
          <TrendingUp size={18} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0 prose prose-sm max-w-none text-slate-700">
          <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest mb-2 flex items-center gap-1">
            <span>DERİN STRATEJİK TEŞHİS</span>
          </h4>
          <div 
            className="text-sm leading-relaxed space-y-2 deep-analytics-content"
            dangerouslySetInnerHTML={{ __html: deepAnalytics[moduleId] }}
          />
        </div>
      </motion.div>
    );
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
      
      Veriler (${appliedFilters.dateFilter === 'today' ? 'Bugün' : appliedFilters.dateFilter === 'yesterday' ? 'Dün' : appliedFilters.dateFilter === '7days' ? 'Son 7 Gün' : appliedFilters.dateFilter === '30days' ? 'Son 30 Gün' : appliedFilters.dateFilter === 'thisYear' ? 'Bu Yıl' : 'Özel Tarih Aralığı'}):
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

  const renderAiSummary = (moduleId: string) => {
    if (!sectionSummaries[moduleId]) return null;
    return (
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex gap-3 relative overflow-hidden ai-summary-block"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-400 to-purple-500"></div>
        <div className="p-2 bg-white rounded-lg shrink-0 h-fit shadow-sm border border-indigo-50">
          <Sparkles size={16} className="text-indigo-500" />
        </div>
        <div>
          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-1">AI Özeti</h4>
          <p className="text-sm text-slate-700 leading-relaxed font-medium">{sectionSummaries[moduleId]}</p>
        </div>
      </motion.div>
    );
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
            onClick={handleGenerateSectionSummaries}
            disabled={isGeneratingSectionSummaries || filteredAnalytics.length === 0}
            className="px-5 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200 disabled:opacity-70"
          >
            {isGeneratingSectionSummaries ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {isGeneratingSectionSummaries ? 'Özetleniyor...' : 'AI Özeti Üret'}
          </button>
          <button 
            onClick={handleGenerateDeepAnalytics}
            disabled={isGeneratingDeepAnalytics || filteredAnalytics.length === 0}
            className="px-5 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 disabled:opacity-70"
          >
            {isGeneratingDeepAnalytics ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <TrendingUp size={16} />
            )}
            {isGeneratingDeepAnalytics ? 'Analiz Ediliyor...' : 'Derin Analizleri Çalıştır'}
          </button>
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
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 py-1">
                  <div className="grid grid-cols-2 gap-1.5">
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
                  
                  {isCompareActive && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100 mt-1">
                      <div className="space-y-0.5">
                        <span className="text-[7px] font-bold text-indigo-400 uppercase ml-0.5">Karşılaştırma (Baş.)</span>
                        <input 
                          type="date" 
                          value={customCompareStartDate}
                          onChange={(e) => setCustomCompareStartDate(e.target.value)}
                          className="w-full border border-indigo-100 rounded-md px-1.5 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 bg-indigo-50/30"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[7px] font-bold text-indigo-400 uppercase ml-0.5">Karşılaştırma (Bit.)</span>
                        <input 
                          type="date" 
                          value={customCompareEndDate}
                          onChange={(e) => setCustomCompareEndDate(e.target.value)}
                          className="w-full border border-indigo-100 rounded-md px-1.5 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 bg-indigo-50/30"
                        />
                      </div>
                    </div>
                  )}
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
                        {taxonomy?.categories && Object.keys(taxonomy.categories).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {selectedMainCategory !== 'all' && taxonomy?.categories?.[selectedMainCategory] && (
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
              onClick={handleRaporlaClick}
              disabled={isRaporlaLoading}
              className="w-full bg-emerald-600 text-white p-2.5 rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 group disabled:opacity-50"
            >
              {isRaporlaLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 size={14} className="group-hover:scale-110 transition-transform" />
              )}
              {isRaporlaLoading ? 'Yükleniyor...' : 'Raporla'}
            </button>

            <div className="relative">
              <button
                onClick={() => setIsAiMenuOpen(!isAiMenuOpen)}
                className="w-full bg-indigo-600 text-white p-2.5 rounded-lg font-bold text-[10px] flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 group"
              >
                <Sparkles size={14} className="text-amber-300 group-hover:scale-110 transition-transform" />
                AI İşlemleri
                <ChevronDown size={14} className={`transition-transform ${isAiMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isAiMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50"
                  >
                    <button
                      onClick={handleGenerateDashboardReport}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 flex items-center gap-2"
                    >
                      <FileText size={14} className="text-indigo-500" />
                      Genel Yönetim Raporu
                    </button>
                    <button
                      onClick={handleGenerateSectionSummaries}
                      disabled={isGeneratingSectionSummaries}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50 border-b border-slate-50"
                    >
                      {isGeneratingSectionSummaries ? (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-indigo-500 border-t-transparent"></div>
                      ) : (
                        <Brain size={14} className="text-indigo-500" />
                      )}
                      Bölüm Özetleri Ekle
                    </button>
                    <button
                      onClick={handleGenerateDeepAnalytics}
                      disabled={isGeneratingDeepAnalytics}
                      className="w-full text-left px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingDeepAnalytics ? (
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-amber-500 border-t-transparent"></div>
                      ) : (
                        <TrendingUp size={14} className="text-amber-500" />
                      )}
                      Derin Analizleri Çalıştır
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
          
          <div className="flex flex-col md:flex-row items-baseline md:items-center justify-between gap-4 w-full bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                <CalendarIcon size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Rapor Dönemi</span>
                <span className="text-sm font-black text-slate-800">{currentPeriodStr}</span>
              </div>
            </div>
            
            {isCompareActive && (
              <>
                <div className="hidden md:flex items-center justify-center p-2 text-slate-300">
                  <ChevronRight size={16} />
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-50 text-slate-500 rounded-md border border-slate-100">
                    <History size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Karşılaştırılan Dönem</span>
                    <span className="text-sm font-bold text-slate-600">{previousPeriodStr}</span>
                  </div>
                </div>
              </>
            )}
          </div>

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
                <div key="kpi_cards" className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { 
                        label: 'Ort. Memnuniyet', 
                        value: `%${dashboardData.kpis.avgScore}`, 
                        change: dashboardData.kpis.scoreChange, 
                        icon: Award, 
                        color: 'indigo',
                        comparison: isCompareActive && dashboardData.kpis.prevAvgScore !== undefined ? {
                          fromText: `%${dashboardData.kpis.prevAvgScore}`,
                          toText: `%${dashboardData.kpis.avgScore}`,
                          deltaText: (dashboardData.kpis.scorePointDelta ?? 0) >= 0 
                            ? `+${dashboardData.kpis.scorePointDelta} p.` 
                            : `${dashboardData.kpis.scorePointDelta} p.`,
                          isGood: (dashboardData.kpis.scorePointDelta ?? 0) >= 0,
                          tooltip: `Önceki dönem memnuniyet oranı %${dashboardData.kpis.prevAvgScore} iken bu dönem %${dashboardData.kpis.avgScore} seviyesine ulaştı (${(dashboardData.kpis.scorePointDelta ?? 0) >= 0 ? `+${dashboardData.kpis.scorePointDelta}` : `${dashboardData.kpis.scorePointDelta}`} puan değişim).`
                        } : undefined
                      },
                      { 
                        label: 'Toplam Yorum Sayısı', 
                        value: dashboardData.kpis.totalComments, 
                        change: dashboardData.kpis.commentChange, 
                        subValue: `Günlük Ort: ${(dashboardData.kpis.totalComments / daysInPeriod).toFixed(1)}`,
                        icon: MessageSquare, 
                        color: 'blue',
                        comparison: isCompareActive && dashboardData.kpis.prevTotalComments !== undefined ? {
                          fromText: `${dashboardData.kpis.prevTotalComments}`,
                          toText: `${dashboardData.kpis.totalComments}`,
                          deltaText: (dashboardData.kpis.commentCountDelta ?? 0) >= 0 
                            ? `+${dashboardData.kpis.commentCountDelta} adet` 
                            : `${dashboardData.kpis.commentCountDelta} adet`,
                          isGood: (dashboardData.kpis.commentCountDelta ?? 0) >= 0,
                          tooltip: `Önceki dönemde ${dashboardData.kpis.prevTotalComments} yorum toplanmışken bu dönem ${dashboardData.kpis.totalComments} yoruma ulaşıldı (${(dashboardData.kpis.commentCountDelta ?? 0) >= 0 ? `+${dashboardData.kpis.commentCountDelta}` : `${dashboardData.kpis.commentCountDelta}`} adet değişim).`
                        } : undefined
                      },
                      { 
                        label: 'En Başarılı Kategori', 
                        value: dashboardData.kpis.bestCategory, 
                        icon: CheckCircle2, 
                        color: 'emerald',
                        comparison: isCompareActive && dashboardData.kpis.prevBestCategory ? {
                          fromText: dashboardData.kpis.prevBestCategory,
                          toText: dashboardData.kpis.bestCategory,
                          deltaText: dashboardData.kpis.prevBestCategory === dashboardData.kpis.bestCategory 
                            ? 'Lider Korundu 👑' 
                            : 'Yeni Lider 🌟',
                          isGood: true,
                          tooltip: dashboardData.kpis.prevBestCategory === dashboardData.kpis.bestCategory
                            ? `Önceki dönemde de en başarılı kategori ${dashboardData.kpis.bestCategory} idi, liderliğini başarıyla koruyor.`
                            : `Önceki dönem en başarılı kategori ${dashboardData.kpis.prevBestCategory} iken bu dönem liderliği ${dashboardData.kpis.bestCategory} devraldı.`
                        } : undefined
                      },
                      { 
                        label: 'Gelişim Alanı', 
                        value: dashboardData.kpis.worstCategory, 
                        icon: AlertTriangle, 
                        color: 'red',
                        comparison: isCompareActive && dashboardData.kpis.prevWorstCategory ? {
                          fromText: dashboardData.kpis.prevWorstCategory,
                          toText: dashboardData.kpis.worstCategory,
                          deltaText: dashboardData.kpis.prevWorstCategory === dashboardData.kpis.worstCategory 
                            ? 'Süregelen Risk ⚠️' 
                            : 'Yeni Odak ⚡',
                          isGood: false,
                          tooltip: dashboardData.kpis.prevWorstCategory === dashboardData.kpis.worstCategory
                            ? `Önceki dönemde de en çok şikayet alan alan ${dashboardData.kpis.worstCategory} idi, acil aksiyon planı gerektiriyor.`
                            : `Önceki dönem odak alanı ${dashboardData.kpis.prevWorstCategory} iken bu dönem şikayetler ${dashboardData.kpis.worstCategory} alanında yoğunlaştı.`
                        } : undefined
                      }
                    ].map((kpi, idx) => (
                      <KpiCard
                        key={idx}
                        label={kpi.label}
                        value={kpi.value}
                        subValue={(kpi as any).subValue}
                        change={kpi.change}
                        icon={kpi.icon}
                        color={kpi.color}
                        comparison={kpi.comparison}
                        currentPeriodStr={currentPeriodStr}
                        previousPeriodStr={previousPeriodStr}
                        onClick={() => {
                          if (kpi.label === 'En Başarılı Kategori' || kpi.label === 'Gelişim Alanı') {
                            setDrillDownFilter({ type: 'category', value: String(kpi.value) });
                          } else {
                            setDrillDownFilter({ type: 'all', value: 'all' });
                          }
                        }}
                        dataFilterType={kpi.label === 'En Başarılı Kategori' || kpi.label === 'Gelişim Alanı' ? 'topic' : 'all'}
                        dataFilterValue={kpi.label === 'En Başarılı Kategori' || kpi.label === 'Gelişim Alanı' ? String(kpi.value) : 'all'}
                      />
                    ))}
                  </div>
                  {renderAiSummary('kpi_cards')}
                  {renderDeepAnalytics('kpi_cards')}
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
                      <p className="text-xs text-slate-500 mt-1">
                        {isCompareActive 
                          ? 'Seçilen periyoda göre memnuniyet skoru ve yorum hacminin önceki dönemle karşılaştırması' 
                          : 'Seçilen periyoda göre ortalama memnuniyet değişimi'}
                      </p>
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
                    <div className="h-[320px] w-full relative min-w-0 min-h-0">
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
                              <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: isCompareActive ? 25 : 10 }}>
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
                                  content={({ active, payload }) => {
                                    if (!active || !payload || !payload.length) return null;
                                    const item = payload[0].payload;
                                    const scoreDelta = item.scoreDelta;
                                    const growthRate = item.growthRate;
                                    return (
                                      <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-100 min-w-[220px]">
                                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-2 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                                          <span>{item.date}</span>
                                          {item.prevDate && <span className="text-[9px] text-slate-400 font-normal lowercase">(Önceki: {item.prevDate})</span>}
                                        </p>
                                        <div className="space-y-1.5 text-xs">
                                          <div className="flex items-center justify-between font-medium">
                                            <span className="text-indigo-600 flex items-center gap-1.5 font-bold">
                                              <span className="w-2 h-2 rounded-full bg-indigo-600"></span> Bu Dönem:
                                            </span>
                                            <span className="font-bold font-mono">%{item.avgScore} <span className="text-slate-400 text-[10px]">({item.count} yorum)</span></span>
                                          </div>
                                          {isCompareActive && item.prevAvgScore !== undefined && (
                                            <div className="flex items-center justify-between font-medium text-slate-500">
                                              <span className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-slate-300"></span> Önceki Dönem:
                                              </span>
                                              <span className="font-bold font-mono">%{item.prevAvgScore} <span className="text-slate-400 text-[10px]">({item.prevCount || 0} yorum)</span></span>
                                            </div>
                                          )}
                                          {isCompareActive && scoreDelta !== undefined && (
                                            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                                              <span className="text-slate-500">Skor Değişimi:</span>
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                                scoreDelta > 0 ? 'bg-emerald-50 text-emerald-700' : 
                                                scoreDelta < 0 ? 'bg-rose-50 text-rose-700' : 
                                                'bg-slate-100 text-slate-600'
                                              }`}>
                                                {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} puan {scoreDelta > 0 ? '↗' : scoreDelta < 0 ? '↘' : '▬'}
                                              </span>
                                            </div>
                                          )}
                                          {isCompareActive && growthRate !== undefined && item.prevCount !== undefined && (
                                            <div className="flex items-center justify-between text-[11px] font-bold">
                                              <span className="text-slate-500">Yorum Hacmi:</span>
                                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                                growthRate >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                              }`}>
                                                {growthRate >= 0 ? `+${growthRate}% ▲` : `${growthRate}% ▼`}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }}
                                />
                                {isCompareActive && (
                                  <Legend 
                                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                                    verticalAlign="bottom"
                                  />
                                )}
                                {isCompareActive && (
                                  <Line 
                                    type="monotone" 
                                    dataKey="prevAvgScore" 
                                    name="Önceki Dönem" 
                                    stroke="#94a3b8" 
                                    strokeWidth={2} 
                                    strokeDasharray="4 4" 
                                    dot={{ r: 3, fill: '#94a3b8', strokeWidth: 1.5, stroke: '#fff' }} 
                                  />
                                )}
                                <Line 
                                  type="monotone" 
                                  dataKey="avgScore" 
                                  name="Bu Dönem" 
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
                                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">
                                    {isCompareActive ? 'Yorum Sayısı (Bu / Önceki)' : 'Yorum Sayısı'}
                                  </th>
                                  <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    {isCompareActive ? 'Memnuniyet Skoru & Karşılaştırma' : 'Ort. Memnuniyet'}
                                  </th>
                                  {isCompareActive && (
                                    <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">
                                      <div>Performans Eğilimi</div>
                                      <div className="text-[8px] font-normal text-slate-400 normal-case tracking-normal">
                                        (Açıklama için üzerine gelin)
                                      </div>
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {data.map((item, idx) => {
                                  let divisor = 1;
                                  if (granularity === 'weekly') divisor = 7;
                                  if (granularity === 'monthly') divisor = 30;
                                  if (granularity === 'yearly') divisor = 365;
                                  const avgCount = (item.count / divisor).toFixed(1);
                                  const scoreDelta = item.scoreDelta;
                                  const growthRate = item.growthRate;
                                  
                                  return (
                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                      <td className="py-3 px-4 text-sm font-bold text-slate-700">
                                        <div className="flex flex-col">
                                          <span>{item.date}</span>
                                          {isCompareActive && item.prevDate && (
                                            <span className="text-[10px] text-slate-400 font-normal">Önceki: {item.prevDate}</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 text-center">
                                        {isCompareActive ? (
                                          <div className="flex flex-col items-center justify-center gap-0.5">
                                            <div className="flex items-center gap-1.5 font-mono">
                                              <span className="text-sm font-black text-slate-800">{item.count}</span>
                                              <span className="text-xs text-slate-400 font-semibold">/ {item.prevCount || 0}</span>
                                            </div>
                                            {item.prevCount !== undefined && item.prevCount > 0 ? (
                                              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 ${
                                                growthRate !== undefined && growthRate >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                              }`}>
                                                {growthRate !== undefined && growthRate >= 0 ? `+${growthRate}% ▲` : `${growthRate}% ▼`}
                                              </span>
                                            ) : (
                                              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Yeni ✨</span>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center">
                                            <span className="text-sm text-slate-500 font-mono">{item.count}</span>
                                            {granularity !== 'daily' && (
                                              <span className="text-[10px] text-slate-400 font-medium mt-0.5">Günlük Ort: {avgCount}</span>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                          <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                              <div 
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                  item.avgScore >= 80 ? 'bg-emerald-500' :
                                                  item.avgScore >= 60 ? 'bg-blue-500' :
                                                  item.avgScore >= 40 ? 'bg-amber-500' :
                                                  'bg-red-500'
                                                }`}
                                                style={{ width: `${item.avgScore}%` }}
                                              />
                                            </div>
                                            {isCompareActive && item.prevAvgScore !== undefined && (
                                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                <span>Bu: <strong className="text-slate-700 font-bold">%{item.avgScore}</strong></span>
                                                <span>Önceki: <strong className="text-slate-500 font-semibold">%{item.prevAvgScore}</strong></span>
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex flex-col items-end min-w-[50px]">
                                            <span className={`text-xs font-black ${
                                              item.avgScore >= 80 ? 'text-emerald-600' :
                                              item.avgScore >= 60 ? 'text-blue-600' :
                                              item.avgScore >= 40 ? 'text-amber-600' :
                                              'text-red-600'
                                            }`}>
                                              %{item.avgScore}
                                            </span>
                                            {isCompareActive && scoreDelta !== undefined && (
                                              <span className={`text-[10px] font-black leading-none mt-0.5 ${
                                                scoreDelta > 0 ? 'text-emerald-600' : 
                                                scoreDelta < 0 ? 'text-rose-600' : 
                                                'text-slate-400'
                                              }`}>
                                                {scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      {isCompareActive && (
                                        <td className="py-3 px-4 text-center">
                                          <PerformanceTrendBadge
                                            title={item.date}
                                            type="timeline"
                                            currCount={item.count}
                                            prevCount={item.prevCount}
                                            currScore={item.avgScore}
                                            prevScore={item.prevAvgScore}
                                            scoreDelta={scoreDelta}
                                            growthRate={growthRate}
                                            extra={item.prevDate ? `Önceki: ${item.prevDate}` : undefined}
                                          />
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {renderAiSummary('satisfaction_timeline')}
                  {renderDeepAnalytics('satisfaction_timeline')}
                </section>
              );
            }

            if (module.id === 'category_satisfaction') {
              return (
                <section key="category_satisfaction" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Kategori Bazlı Memnuniyet</h3>
                      <p className="text-xs text-slate-500">
                        {isCompareActive 
                          ? 'Ana ve alt kategorilerin önceki döneme göre puan ve yorum hacmi karşılaştırması' 
                          : 'Ana ve alt kategorilerdeki misafir deneyim puanları'}
                      </p>
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
                          margin={{ left: 10, right: 80, top: 10, bottom: 10 }}
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
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-100 min-w-[220px]">
                                  <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-2 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                                    <span>{data.name}</span>
                                    {data.isSub && <span className="text-[9px] text-slate-400 font-normal lowercase">({data.parent})</span>}
                                  </p>
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between font-medium">
                                      <span className="text-indigo-600 flex items-center gap-1.5 font-bold">
                                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span> Bu Dönem:
                                      </span>
                                      <span className="font-bold font-mono">%{data.score} <span className="text-slate-400 text-[10px]">({data.count} yorum)</span></span>
                                    </div>
                                    {isCompareActive && data.prevScore !== undefined && (
                                      <div className="flex items-center justify-between font-medium text-slate-500">
                                        <span className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full bg-slate-300"></span> Önceki Dönem:
                                        </span>
                                        <span className="font-bold font-mono">%{data.prevScore} <span className="text-slate-400 text-[10px]">({data.prevCount || 0} yorum)</span></span>
                                      </div>
                                    )}
                                    {isCompareActive && data.scoreDelta !== undefined && (
                                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-slate-500">Puan Değişimi:</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                          data.scoreDelta > 0 ? 'bg-emerald-50 text-emerald-700' : 
                                          data.scoreDelta < 0 ? 'bg-rose-50 text-rose-700' : 
                                          'bg-slate-100 text-slate-600'
                                        }`}>
                                          {data.scoreDelta > 0 ? `+${data.scoreDelta}` : data.scoreDelta} puan {data.scoreDelta > 0 ? '↗' : data.scoreDelta < 0 ? '↘' : '▬'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }}
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
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                              {isCompareActive ? 'Bahsedilme (Bu Dönem / Önceki)' : 'Bahsedilme Sayısı'}
                            </th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isCompareActive ? 'Memnuniyet Skoru & Karşılaştırma' : 'Memnuniyet Skoru'}
                            </th>
                            {isCompareActive && (
                              <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                                <div>Performans Eğilimi</div>
                                <div className="text-[8px] font-normal text-slate-400 normal-case tracking-normal">
                                  (Açıklama için üzerine gelin)
                                </div>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {hierarchicalCategoryData.map((group, gIdx) => {
                            const isExpanded = showSubCategories || expandedCategories[group.name];
                            const scoreDelta = group.scoreDelta;
                            const countDelta = group.countDelta;
                            const growthRate = group.growthRate;

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
                                <td className="py-3 px-4 text-center">
                                  {isCompareActive ? (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      <div className="flex items-center gap-1.5 font-mono">
                                        <span className="text-sm font-black text-slate-800">{group.count}</span>
                                        <span className="text-xs text-slate-400 font-semibold">/ {group.prevCount || 0}</span>
                                      </div>
                                      {group.prevCount > 0 ? (
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 ${
                                          growthRate >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {growthRate >= 0 ? `+${growthRate}% ▲` : `${growthRate}% ▼`}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Yeni ✨</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-500 font-mono font-bold">{group.count}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
                                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
                                      {isCompareActive && group.prevScore !== undefined && (
                                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                                          <span>Bu: <strong className="text-slate-700 font-bold">%{group.avgScore}</strong></span>
                                          <span>Önceki: <strong className="text-slate-500 font-semibold">%{group.prevScore}</strong></span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end min-w-[55px]">
                                      <span className={`text-xs font-black ${
                                        group.avgScore >= 80 ? 'text-emerald-600' :
                                        group.avgScore >= 60 ? 'text-blue-600' :
                                        group.avgScore >= 40 ? 'text-amber-600' :
                                        'text-red-600'
                                      }`}>
                                        %{group.avgScore}
                                      </span>
                                      {isCompareActive && scoreDelta !== undefined && (
                                        <span className={`text-[10px] font-black leading-none mt-0.5 ${
                                          scoreDelta > 0 ? 'text-emerald-600' : 
                                          scoreDelta < 0 ? 'text-rose-600' : 
                                          'text-slate-400'
                                        }`}>
                                          {scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {isCompareActive && (
                                  <td className="py-3 px-4 text-center">
                                    <PerformanceTrendBadge
                                      title={group.name}
                                      type="category"
                                      currCount={group.count}
                                      prevCount={group.prevCount}
                                      currScore={group.avgScore}
                                      prevScore={group.prevScore}
                                      scoreDelta={scoreDelta}
                                      growthRate={growthRate}
                                    />
                                  </td>
                                )}
                              </tr>
                              <AnimatePresence>
                                {isExpanded && group.subCategories.map((sub, sIdx) => {
                                  const subScoreDelta = sub.scoreDelta;
                                  const subCountDelta = sub.countDelta;
                                  const subGrowthRate = sub.growthRate;

                                  return (
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
                                    <td className="py-2 px-4 text-center">
                                      {isCompareActive ? (
                                        <div className="flex items-center justify-center gap-1.5 font-mono text-xs">
                                          <span className="font-bold text-slate-700">{sub.count}</span>
                                          <span className="text-slate-400">/ {sub.prevCount || 0}</span>
                                          {subGrowthRate !== undefined && (
                                            <span className={`text-[9px] font-bold px-1 rounded ${
                                              subGrowthRate >= 0 ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500 bg-slate-100'
                                            }`}>
                                              {subGrowthRate >= 0 ? `+${subGrowthRate}%` : `${subGrowthRate}%`}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-400 font-mono">{sub.count}</span>
                                      )}
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
                                        {isCompareActive && subScoreDelta !== undefined && (
                                          <span className={`text-[9px] font-black ${
                                            subScoreDelta > 0 ? 'text-emerald-600' : 
                                            subScoreDelta < 0 ? 'text-rose-600' : 
                                            'text-slate-400'
                                          }`}>
                                            ({subScoreDelta > 0 ? `+${subScoreDelta}` : subScoreDelta} puan)
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    {isCompareActive && (
                                      <td className="py-2 px-4 text-center">
                                        <PerformanceTrendBadge
                                          title={`${group.name} > ${sub.subCategory}`}
                                          type="subCategory"
                                          currCount={sub.count}
                                          prevCount={sub.prevCount}
                                          currScore={sub.avgScore}
                                          prevScore={sub.prevScore}
                                          scoreDelta={subScoreDelta}
                                          growthRate={subGrowthRate}
                                          size="sm"
                                        />
                                      </td>
                                    )}
                                  </motion.tr>
                                  );
                                })}
                              </AnimatePresence>
                            </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {renderAiSummary('category_satisfaction')}
                  {renderDeepAnalytics('category_satisfaction')}
                </section>
              );
            }

            if (module.id === 'source_analysis') {
              const totalCurrentSourceCount = dashboardData.sourceAnalysis.reduce((acc, cur) => acc + cur.count, 0);
              return (
                <section key="source_analysis" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Kanal Dağılımı</h3>
                      <p className="text-xs text-slate-500">
                        {isCompareActive 
                          ? 'Yorum kanalları, pazar payı ve performansın önceki dönemle karşılaştırması' 
                          : 'Yorumların geldiği platformlar ve kanal bazlı performans'}
                      </p>
                    </div>
                  </div>

                  {globalViewMode === 'chart' ? (
                    <div className="space-y-4">
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
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const data = payload[0].payload;
                                const scoreDelta = data.scoreDelta;
                                const growthRate = data.growthRate;
                                const share = totalCurrentSourceCount > 0 ? ((data.count / totalCurrentSourceCount) * 100).toFixed(1) : '0';
                                return (
                                  <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-100 min-w-[220px]">
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-2 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                                      <span>{data.name}</span>
                                      <span className="text-[10px] text-slate-400 font-bold">%{share} Pazar Payı</span>
                                    </p>
                                    <div className="space-y-1.5 text-xs">
                                      <div className="flex items-center justify-between font-medium">
                                        <span className="text-indigo-600 font-bold">Bu Dönem:</span>
                                        <span className="font-bold font-mono">%{data.avgScore} <span className="text-slate-400 text-[10px]">({data.count} yorum)</span></span>
                                      </div>
                                      {isCompareActive && data.prevScore !== undefined && (
                                        <div className="flex items-center justify-between font-medium text-slate-500">
                                          <span>Önceki Dönem:</span>
                                          <span className="font-bold font-mono">%{data.prevScore} <span className="text-slate-400 text-[10px]">({data.prevCount || 0} yorum)</span></span>
                                        </div>
                                      )}
                                      {isCompareActive && scoreDelta !== undefined && (
                                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                                          <span className="text-slate-500">Skor Değişimi:</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                            scoreDelta > 0 ? 'bg-emerald-50 text-emerald-700' : 
                                            scoreDelta < 0 ? 'bg-rose-50 text-rose-700' : 
                                            'bg-slate-100 text-slate-600'
                                          }`}>
                                            {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} puan {scoreDelta > 0 ? '↗' : scoreDelta < 0 ? '↘' : '▬'}
                                          </span>
                                        </div>
                                      )}
                                      {isCompareActive && growthRate !== undefined && data.prevCount !== undefined && (
                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                          <span className="text-slate-500">Yorum Hacmi:</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                            growthRate >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                          }`}>
                                            {growthRate >= 0 ? `+${growthRate}% ▲` : `${growthRate}% ▼`}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Legend verticalAlign="bottom" iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '15px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {isCompareActive && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                          {dashboardData.sourceAnalysis.map((item, idx) => {
                            const scoreDelta = item.scoreDelta;
                            const growthRate = item.growthRate;
                            return (
                              <div key={idx} className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                  <span className="text-xs font-bold text-slate-700 truncate">{item.name}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-slate-800">%{item.avgScore}</span>
                                  {scoreDelta !== undefined && (
                                    <span className={`text-[10px] font-black ${scoreDelta > 0 ? 'text-emerald-600' : scoreDelta < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                      {scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                  <span>{item.count} yorum</span>
                                  {growthRate !== undefined && item.prevCount !== undefined && item.prevCount > 0 && (
                                    <span className={`font-black ${growthRate >= 0 ? 'text-indigo-600' : 'text-slate-500'}`}>
                                      {growthRate >= 0 ? `+${growthRate}%` : `${growthRate}%`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kanal Kaynağı</th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                              {isCompareActive ? 'Yorum Hacmi (Bu / Önceki)' : 'Yorum Sayısı'}
                            </th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isCompareActive ? 'Memnuniyet Skoru & Karşılaştırma' : 'Memnuniyet Skoru'}
                            </th>
                            {isCompareActive && (
                              <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                                <div>Performans Eğilimi</div>
                                <div className="text-[8px] font-normal text-slate-400 normal-case tracking-normal">
                                  (Açıklama için üzerine gelin)
                                </div>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {dashboardData.sourceAnalysis.map((item, idx) => {
                            const scoreDelta = item.scoreDelta;
                            const countDelta = item.countDelta;
                            const growthRate = item.growthRate;
                            const share = totalCurrentSourceCount > 0 ? ((item.count / totalCurrentSourceCount) * 100).toFixed(1) : '0';

                            return (
                              <tr 
                                key={idx} 
                                className="hover:bg-slate-50 transition-colors cursor-pointer interactive-filter-trigger"
                                data-filter-type="source"
                                data-filter-value={item.name}
                                onClick={() => setDrillDownFilter({ type: 'source', value: item.name })}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-slate-800">{item.name}</span>
                                      <span className="text-[10px] text-slate-400 font-medium">Pay: %{share}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isCompareActive ? (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      <div className="flex items-center gap-1.5 font-mono">
                                        <span className="text-sm font-black text-slate-800">{item.count}</span>
                                        <span className="text-xs text-slate-400 font-semibold">/ {item.prevCount || 0}</span>
                                      </div>
                                      {item.prevCount !== undefined && item.prevCount > 0 ? (
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 ${
                                          growthRate !== undefined && growthRate >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {growthRate !== undefined && growthRate >= 0 ? `+${growthRate}% ▲` : `${growthRate}% ▼`}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Yeni ✨</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <span className="text-sm text-slate-500 font-mono">{item.count}</span>
                                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Ort: {(item.count / daysInPeriod).toFixed(1)}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
                                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            item.avgScore >= 80 ? 'bg-emerald-500' :
                                            item.avgScore >= 60 ? 'bg-blue-500' :
                                            item.avgScore >= 40 ? 'bg-amber-500' :
                                            'bg-red-500'
                                          }`}
                                          style={{ width: `${item.avgScore}%` }}
                                        />
                                      </div>
                                      {isCompareActive && item.prevScore !== undefined && (
                                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                                          <span>Bu: <strong className="text-slate-700 font-bold">%{item.avgScore}</strong></span>
                                          <span>Önceki: <strong className="text-slate-500 font-semibold">%{item.prevScore}</strong></span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end min-w-[50px]">
                                      <span className={`text-xs font-black ${
                                        item.avgScore >= 80 ? 'text-emerald-600' :
                                        item.avgScore >= 60 ? 'text-blue-600' :
                                        item.avgScore >= 40 ? 'text-amber-600' :
                                        'text-red-600'
                                      }`}>
                                        %{item.avgScore}
                                      </span>
                                      {isCompareActive && scoreDelta !== undefined && (
                                        <span className={`text-[10px] font-black leading-none mt-0.5 ${
                                          scoreDelta > 0 ? 'text-emerald-600' : 
                                          scoreDelta < 0 ? 'text-rose-600' : 
                                          'text-slate-400'
                                        }`}>
                                          {scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {isCompareActive && (
                                  <td className="py-3 px-4 text-center">
                                    <PerformanceTrendBadge
                                      title={item.name}
                                      type="source"
                                      currCount={item.count}
                                      prevCount={item.prevCount}
                                      currScore={item.avgScore}
                                      prevScore={item.prevScore}
                                      scoreDelta={scoreDelta}
                                      growthRate={growthRate}
                                      extra={`Pay: %${share}`}
                                    />
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {renderAiSummary('source_analysis')}
                  {renderDeepAnalytics('source_analysis')}
                </section>
              );
            }

            if (module.id === 'nationality_analysis') {
              const totalCurrentNatCount = dashboardData.nationalityAnalysis.reduce((acc, cur) => acc + cur.count, 0);
              return (
                <section key="nationality_analysis" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Uyruk Memnuniyet Endeksi</h3>
                      <p className="text-xs text-slate-500">
                        {isCompareActive 
                          ? 'Pazar bazlı ortalama skorlar, hacim ve değişimin önceki dönemle karşılaştırması' 
                          : 'Pazar bazlı ortalama skorlar ve misafir dağılımı'}
                      </p>
                    </div>
                  </div>

                  {globalViewMode === 'chart' ? (
                    <div className="w-full overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: '500px' }}>
                      <div 
                        className="w-full relative min-w-0 min-h-0 overflow-hidden" 
                        style={{ height: `${Math.max(400, (showAllNationality ? dashboardData.nationalityAnalysis.length : Math.min(10, dashboardData.nationalityAnalysis.length)) * (isCompareActive ? 52 : 45))}px` }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          layout="vertical" 
                          data={showAllNationality ? dashboardData.nationalityAnalysis : dashboardData.nationalityAnalysis.slice(0, 10)} 
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
                            content={({ active, payload, label }) => {
                              if (!active || !payload || !payload.length) return null;
                              const item = payload[0].payload;
                              const countryCode = getCountryCode(item.name);
                              const scoreDelta = item.scoreDelta;
                              const growthRate = item.growthRate;
                              return (
                                <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-100 min-w-[220px]">
                                  <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-1.5">
                                    {countryCode && (
                                      <img 
                                        src={`https://flagcdn.com/w40/${countryCode}.png`}
                                        width="18"
                                        height="12"
                                        alt=""
                                        className="rounded-sm"
                                        referrerPolicy="no-referrer"
                                      />
                                    )}
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.name}</span>
                                  </div>
                                  <div className="space-y-1.5 text-xs">
                                    <div className="flex items-center justify-between font-medium">
                                      <span className="text-indigo-600 font-bold">Bu Dönem:</span>
                                      <span className="font-bold font-mono">%{item.avgScore} <span className="text-slate-400 text-[10px]">({item.count} yorum)</span></span>
                                    </div>
                                    {isCompareActive && item.prevScore !== undefined && (
                                      <div className="flex items-center justify-between font-medium text-slate-500">
                                        <span>Önceki Dönem:</span>
                                        <span className="font-bold font-mono">%{item.prevScore} <span className="text-slate-400 text-[10px]">({item.prevCount || 0} yorum)</span></span>
                                      </div>
                                    )}
                                    {isCompareActive && scoreDelta !== undefined && (
                                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-slate-500">Skor Değişimi:</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                          scoreDelta > 0 ? 'bg-emerald-50 text-emerald-700' : 
                                          scoreDelta < 0 ? 'bg-rose-50 text-rose-700' : 
                                          'bg-slate-100 text-slate-600'
                                        }`}>
                                          {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} puan {scoreDelta > 0 ? '↗' : scoreDelta < 0 ? '↘' : '▬'}
                                        </span>
                                      </div>
                                    )}
                                    {isCompareActive && growthRate !== undefined && item.prevCount !== undefined && (
                                      <div className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-slate-500">Yorum Hacmi:</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                          growthRate >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {growthRate >= 0 ? `+${growthRate}% ▲` : `${growthRate}% ▼`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          {isCompareActive && <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontWeight: 600 }} />}
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
                            label={{ 
                              position: 'right', 
                              fontSize: 11, 
                              fontWeight: 700, 
                              fill: '#4f46e5', 
                              formatter: (val: any) => `%${val}` 
                            }}
                          >
                            {(showAllNationality ? dashboardData.nationalityAnalysis : dashboardData.nationalityAnalysis.slice(0, 10)).map((entry, index) => (
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
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                              {isCompareActive ? 'Yorum Hacmi (Bu / Önceki)' : 'Yorum Sayısı'}
                            </th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isCompareActive ? 'Memnuniyet Skoru & Karşılaştırma' : 'Memnuniyet Skoru'}
                            </th>
                            {isCompareActive && (
                              <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                                <div>Performans Eğilimi</div>
                                <div className="text-[8px] font-normal text-slate-400 normal-case tracking-normal">
                                  (Açıklama için üzerine gelin)
                                </div>
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50" data-section="nationality">
                          {dashboardData.nationalityAnalysis.map((item, idx) => {
                            const countryCode = getCountryCode(item.name);
                            const scoreDelta = item.scoreDelta;
                            const countDelta = item.countDelta;
                            const growthRate = item.growthRate;
                            const share = totalCurrentNatCount > 0 ? ((item.count / totalCurrentNatCount) * 100).toFixed(1) : '0';

                            return (
                              <tr 
                                key={idx} 
                                className={`hover:bg-slate-50 transition-colors cursor-pointer group interactive-filter-trigger ${idx >= 10 ? 'toggleable-row' : ''} ${(!showAllNationality && idx >= 10) ? 'hidden' : ''}`}
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
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-slate-800 tracking-tight truncate">{item.name}</span>
                                      <span className="text-[10px] text-slate-400 font-medium">Pay: %{share}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isCompareActive ? (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      <div className="flex items-center gap-1.5 font-mono">
                                        <span className="text-sm font-black text-slate-800">{item.count}</span>
                                        <span className="text-xs text-slate-400 font-semibold">/ {item.prevCount || 0}</span>
                                      </div>
                                      {item.prevCount !== undefined && item.prevCount > 0 ? (
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 ${
                                          growthRate !== undefined && growthRate >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {growthRate !== undefined && growthRate >= 0 ? `+${growthRate}% ▲` : `${growthRate}% ▼`}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Yeni ✨</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <span className="text-sm text-slate-500 font-mono font-bold">{item.count}</span>
                                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">Ort: {(item.count / daysInPeriod).toFixed(1)}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
                                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            item.avgScore >= 80 ? 'bg-emerald-500' :
                                            item.avgScore >= 60 ? 'bg-blue-500' :
                                            item.avgScore >= 40 ? 'bg-amber-500' :
                                            'bg-red-500'
                                          }`}
                                          style={{ width: `${item.avgScore}%` }}
                                        />
                                      </div>
                                      {isCompareActive && item.prevScore !== undefined && (
                                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                                          <span>Bu: <strong className="text-slate-700 font-bold">%{item.avgScore}</strong></span>
                                          <span>Önceki: <strong className="text-slate-500 font-semibold">%{item.prevScore}</strong></span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end min-w-[50px]">
                                      <span className={`text-xs font-black ${
                                        item.avgScore >= 80 ? 'text-emerald-600' :
                                        item.avgScore >= 60 ? 'text-blue-600' :
                                        item.avgScore >= 40 ? 'text-amber-600' :
                                        'text-red-600'
                                      }`}>
                                        %{item.avgScore}
                                      </span>
                                      {isCompareActive && scoreDelta !== undefined && (
                                        <span className={`text-[10px] font-black leading-none mt-0.5 ${
                                          scoreDelta > 0 ? 'text-emerald-600' : 
                                          scoreDelta < 0 ? 'text-rose-600' : 
                                          'text-slate-400'
                                        }`}>
                                          {scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {isCompareActive && (
                                  <td className="py-3 px-4 text-center">
                                    <PerformanceTrendBadge
                                      title={item.name}
                                      type="nationality"
                                      currCount={item.count}
                                      prevCount={item.prevCount}
                                      currScore={item.avgScore}
                                      prevScore={item.prevScore}
                                      scoreDelta={scoreDelta}
                                      growthRate={growthRate}
                                      extra={`Pay: %${share}`}
                                    />
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {dashboardData.nationalityAnalysis.length > 10 && (
                    <div className="mt-6 pt-4 border-t border-slate-50 flex justify-center">
                      <button 
                        onClick={() => setShowAllNationality(!showAllNationality)}
                        data-toggle-btn="nationality"
                        data-expanded={showAllNationality}
                        data-count={dashboardData.nationalityAnalysis.length}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all interactive-only"
                      >
                        {showAllNationality ? (
                          <>Daha Az Göster <ChevronUp size={14} /></>
                        ) : (
                          <>Tümünü Gör ({dashboardData.nationalityAnalysis.length} Ülke) <ChevronDown size={14} /></>
                        )}
                      </button>
                    </div>
                  )}
                  {renderAiSummary('nationality_analysis')}
                  {renderDeepAnalytics('nationality_analysis')}
                </section>
              );
            }

            if (module.id === 'hotel_agenda') {
              return (
                <div key="hotel_agenda" className="flex flex-col gap-8">
                  {/* Analitik & Metrik Rehber Kartı */}
                  <div className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border border-slate-200/90 rounded-2xl p-4.5 shadow-sm">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5 shadow-sm">
                        <Info size={18} />
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <p className="font-black text-slate-800 text-sm flex items-center gap-2">
                            <span>Metrik & Çok Boyutlu Duygu Analizi Rehberi</span>
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">İş Zekası & Karşılaştırma Standartları</span>
                          </p>
                        </div>
                        <p className="text-slate-600">
                          Misafir yorumları çok boyutludur: Bir konu (örneğin <strong>"Tutum/İletişim"</strong>) bazı misafirler tarafından takdir edilirken (<strong>Övgü Skoru: %85+</strong>), bazı misafirlerce eleştirilebilir (<strong>Şikayet Skoru: %19</strong>). Sistemimiz bu boyutları operasyonel netlik için 3 ayrı perspektifle sunar:
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-slate-200/70 font-medium text-[11px]">
                          <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100 flex items-start gap-2 shadow-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 mt-0.5"></span>
                            <div>
                              <strong className="text-indigo-900 block font-bold">1. En Çok Konuşulanlar (Gündem):</strong>
                              <span className="text-slate-500 text-[10px]">Tüm olumlu, nötr ve olumsuz yorumların toplam hacmi ve genel ağırlıklı ortalama puanı.</span>
                            </div>
                          </div>
                          <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 flex items-start gap-2 shadow-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-0.5"></span>
                            <div>
                              <strong className="text-emerald-900 block font-bold">2. En Çok Övülenler (Başarı):</strong>
                              <span className="text-slate-500 text-[10px]">Yalnızca memnun misafirlerin pozitif geri bildirim adedi ve övgü memnuniyet skoru.</span>
                            </div>
                          </div>
                          <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100 flex items-start gap-2 shadow-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 mt-0.5"></span>
                            <div>
                              <strong className="text-rose-900 block font-bold">3. Acil Müdahale (Risk & Şikayet):</strong>
                              <span className="text-slate-500 text-[10px]">Yalnızca şikayetçi misafirlerin olumsuz yorum adedi ve memnuniyetsizlik şiddeti.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* En Çok Konuşulanlar */}
                  <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-50 rounded-lg">
                              <TrendingUp size={18} className="text-indigo-600" />
                            </div>
                            En Çok Konuşulan Konular (Gündem Analizi)
                          </h3>
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                            Tüm Yorumlar
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {isCompareActive 
                            ? 'Otel genelinde en yüksek yorum hacmine sahip konuların önceki döneme göre toplam hacim ve puan değişimi' 
                            : 'En yüksek yorum hacmine sahip, tesis gündemini belirleyen ana ve alt konular'}
                        </p>
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
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const item = payload[0].payload;
                                return (
                                  <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-100 min-w-[240px]">
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-2 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                                      <span>{item.subCategory}</span>
                                      <span className="text-[9px] text-slate-400 font-normal lowercase">({item.mainCategory})</span>
                                    </p>
                                    <div className="space-y-1.5 text-xs">
                                      <div className="flex items-center justify-between font-medium">
                                        <span className="text-indigo-600 flex items-center gap-1.5 font-bold">
                                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span> Toplam Yorum (Bu Dönem):
                                        </span>
                                        <span className="font-bold font-mono">{item.count} yorum <span className="text-slate-500 font-normal">(Genel Skor: %{item.avgScore})</span></span>
                                      </div>
                                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                                        <span>Duygu Dağılımı:</span>
                                        <span className="font-bold font-mono text-[10px]">
                                          <strong className="text-emerald-600 font-bold">{item.positiveCount || 0} Olumlu</strong> / <strong className="text-rose-600 font-bold">{item.negativeCount || 0} Olumsuz</strong>
                                        </span>
                                      </div>
                                      {isCompareActive && (
                                        <div className="flex items-center justify-between font-medium text-slate-500 pt-1 border-t border-slate-100">
                                          <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-slate-300"></span> Önceki Dönem:
                                          </span>
                                          <span className="font-bold font-mono">{item.prevCount || 0} yorum <span className="text-slate-400 font-normal">(%{item.prevScore || 0})</span></span>
                                        </div>
                                      )}
                                      {isCompareActive && (
                                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                                          <span className="text-slate-500">Hacim / Skor Farkı:</span>
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-indigo-600 font-black">
                                              {item.countDelta !== undefined && item.countDelta >= 0 ? `+${item.countDelta}` : item.countDelta} yorum
                                            </span>
                                            {item.scoreDelta !== undefined && (
                                              <span className={`text-[10px] px-1 py-0.2 rounded font-black ${
                                                item.scoreDelta > 0 ? 'bg-emerald-50 text-emerald-700' : 
                                                item.scoreDelta < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                                              }`}>
                                                {item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta}p
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            {isCompareActive && <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />}
                            {isCompareActive && (
                              <Bar 
                                dataKey="prevCount" 
                                name="Önceki Dönem (Toplam Hacim)"
                                fill="#cbd5e1" 
                                radius={[0, 6, 6, 0]} 
                                barSize={12}
                              />
                            )}
                            <Bar 
                              dataKey="count" 
                              name="Bu Dönem (Toplam Hacim)"
                              fill="#6366f1" 
                              radius={[0, 6, 6, 0]} 
                              barSize={isCompareActive ? 12 : 24}
                              label={{ position: 'right', fontSize: 12, fontWeight: 900, fill: '#4f46e5', offset: 10 }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[760px]">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[20%]">Alt Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[14%]">Ana Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[16%]">
                                {isCompareActive ? 'Toplam Hacim (Bu / Önceki)' : 'Toplam Yorum Sayısı'}
                              </th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[18%]">
                                Duygu Dağılımı (Övgü / Şikayet)
                              </th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[16%]">
                                {isCompareActive ? 'Genel Skor & Değişim' : 'Genel Memnuniyet Skoru'}
                              </th>
                              {isCompareActive && (
                                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[16%]">
                                  <div>Gündem Dinamiği & Performans</div>
                                  <div className="text-[8px] font-normal text-slate-400 normal-case tracking-normal">
                                    (Açıklama için üzerine gelin)
                                  </div>
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50" data-section="most-mentioned">
                            {dashboardData.mostMentioned.map((item, idx) => {
                              const growthRate = item.growthRate;
                              const scoreDelta = item.scoreDelta;
                              const posRate = item.positiveRate || (item.count > 0 ? Math.round(((item.positiveCount || 0) / item.count) * 100) : 0);

                              return (
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
                                  {isCompareActive ? (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      <div className="flex items-center gap-1.5 font-mono">
                                        <span className="text-sm font-black text-indigo-600">{item.count}</span>
                                        <span className="text-xs text-slate-400 font-semibold">/ {item.prevCount || 0}</span>
                                      </div>
                                      {item.prevCount && item.prevCount > 0 ? (
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 ${
                                          growthRate !== undefined && growthRate >= 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {growthRate !== undefined && growthRate >= 0 ? `+${growthRate}% ▲` : `${growthRate}% ▼`}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Yeni Gündem ✨</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-sm font-black text-indigo-600">{item.count}</span>
                                  )}
                                </td>
                                <td className="py-4 px-4 text-center min-w-[130px]">
                                  <div className="flex flex-col gap-1 items-center">
                                    <div className="w-full h-2 bg-rose-200 rounded-full overflow-hidden flex">
                                      <div className="h-full bg-emerald-500" style={{ width: `${posRate}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between w-full text-[10px] font-bold">
                                      <span className="text-emerald-600">%{posRate} Olumlu ({item.positiveCount || 0})</span>
                                      <span className="text-rose-600">{item.negativeCount || 0} Şikayet</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 flex flex-col gap-1 min-w-[100px]">
                                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${
                                          item.avgScore >= 80 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' :
                                          item.avgScore >= 60 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]' :
                                          item.avgScore >= 40 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' :
                                          'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                                        }`} style={{ width: `${item.avgScore}%` }} />
                                      </div>
                                      {isCompareActive && item.prevScore !== undefined && (
                                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                                          <span>Bu: <strong className="text-slate-700 font-bold">%{item.avgScore}</strong></span>
                                          <span>Önceki: <strong className="text-slate-500 font-semibold">%{item.prevScore}</strong></span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-end min-w-[55px]">
                                      <span className={`text-xs font-black ${
                                        item.avgScore >= 80 ? 'text-emerald-600' :
                                        item.avgScore >= 60 ? 'text-blue-600' :
                                        item.avgScore >= 40 ? 'text-amber-600' :
                                        'text-red-600'
                                      }`}>
                                        %{item.avgScore}
                                      </span>
                                      {isCompareActive && scoreDelta !== undefined && (
                                        <span className={`text-[10px] font-black leading-none mt-0.5 ${
                                          scoreDelta > 0 ? 'text-emerald-600' : 
                                          scoreDelta < 0 ? 'text-rose-600' : 
                                          'text-slate-400'
                                        }`}>
                                          {scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {isCompareActive && (
                                  <td className="py-4 px-4 text-center">
                                    <PerformanceTrendBadge
                                      title={item.subCategory}
                                      type="topic"
                                      currCount={item.count}
                                      prevCount={item.prevCount}
                                      currScore={item.avgScore}
                                      prevScore={item.prevScore}
                                      scoreDelta={scoreDelta}
                                      growthRate={growthRate}
                                      extra={item.mainCategory}
                                    />
                                  </td>
                                )}
                              </tr>
                              );
                            })}
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
                    {renderAiSummary('most_mentioned_topics')}
                    {renderDeepAnalytics('most_mentioned_topics')}
                  </section>

                  {/* En Çok Övülenler */}
                  <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-50 rounded-lg">
                              <Award size={18} className="text-emerald-600" />
                            </div>
                            En Çok Övülen Konular (Pozitif Geri Bildirimler)
                          </h3>
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                            Yalnızca Övgüler
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {isCompareActive 
                            ? 'Misafirlerin övgüyle bahsettiği alanların önceki döneme göre övgü adedi ve memnuniyet puanı artış analizi' 
                            : 'Yalnızca olumlu geri bildirim içeren yorumlar baz alınarak misafirlerin en yüksek puan verdiği alanlar'}
                        </p>
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
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const item = payload[0].payload;
                                return (
                                  <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-100 min-w-[240px]">
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-2 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                                      <span>{item.subCategory}</span>
                                      <span className="text-[9px] text-slate-400 font-normal lowercase">({item.mainCategory})</span>
                                    </p>
                                    <div className="space-y-1.5 text-xs">
                                      <div className="flex items-center justify-between font-medium">
                                        <span className="text-emerald-600 flex items-center gap-1.5 font-bold">
                                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Övgü Memnuniyet Skoru:
                                        </span>
                                        <span className="font-bold font-mono">%{item.avgScore} <span className="text-slate-400 text-[10px]">({item.count} övgü)</span></span>
                                      </div>
                                      {item.overallScore !== undefined && (
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                          <span>Konunun Genel Ortalaması:</span>
                                          <span className="font-bold font-mono text-slate-700">%{item.overallScore} <span className="text-slate-400 font-normal">(Toplam {item.totalCount} yorum)</span></span>
                                        </div>
                                      )}
                                      {isCompareActive && (
                                        <div className="flex items-center justify-between font-medium text-slate-500 pt-1 border-t border-slate-100">
                                          <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-slate-300"></span> Önceki Dönem (Övgü):
                                          </span>
                                          <span className="font-bold font-mono">%{item.prevScore || 0} <span className="text-slate-400 text-[10px]">({item.prevCount || 0} övgü)</span></span>
                                        </div>
                                      )}
                                      {isCompareActive && item.scoreDelta !== undefined && (
                                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                                          <span className="text-slate-500">Övgü Puan Değişimi:</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                            item.scoreDelta > 0 ? 'bg-emerald-50 text-emerald-700' : 
                                            item.scoreDelta < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                                          }`}>
                                            {item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta} puan {item.scoreDelta > 0 ? '↗' : item.scoreDelta < 0 ? '↘' : '▬'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            {isCompareActive && <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />}
                            {isCompareActive && (
                              <Bar 
                                dataKey="prevScore" 
                                name="Önceki Dönem (Övgü Skoru)"
                                fill="#cbd5e1" 
                                radius={[0, 6, 6, 0]} 
                                barSize={12}
                              />
                            )}
                            <Bar 
                              dataKey="avgScore" 
                              name="Bu Dönem (Övgü Skoru)"
                              fill="#10b981" 
                              radius={[0, 6, 6, 0]} 
                              barSize={isCompareActive ? 12 : 24}
                              label={{ position: 'right', fontSize: 12, fontWeight: 900, fill: '#059669', offset: 10, formatter: (val: any) => `%${val}` }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[760px]">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[22%]">Alt Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[16%]">Ana Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[18%]">
                                {isCompareActive ? 'Övgü Hacmi (Bu / Önceki)' : 'Övgü Yorum Sayısı'}
                              </th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[24%]">
                                {isCompareActive ? 'Övgü Memnuniyet Skoru & Artış' : 'Övgü Memnuniyet Skoru'}
                              </th>
                              {isCompareActive && (
                                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[20%]">
                                  <div>Başarı Trendi & Performans</div>
                                  <div className="text-[8px] font-normal text-slate-400 normal-case tracking-normal">
                                    (Açıklama için üzerine gelin)
                                  </div>
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50" data-section="top-positive">
                            {dashboardData.topPositive.map((item, idx) => {
                              const scoreDelta = item.scoreDelta;
                              const growthRate = item.growthRate;

                              return (
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
                                  {isCompareActive ? (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      <div className="flex items-center gap-1.5 font-mono">
                                        <span className="text-sm font-black text-emerald-600">{item.count} övgü</span>
                                        <span className="text-xs text-slate-400 font-semibold">/ {item.prevCount || 0}</span>
                                      </div>
                                      {item.prevCount && item.prevCount > 0 ? (
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 ${
                                          growthRate !== undefined && growthRate >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {growthRate !== undefined && growthRate >= 0 ? `+${growthRate}% ▲` : `${growthRate}% ▼`}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">Yeni Başarı 🌱</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <span className="text-sm font-black text-emerald-600">{item.count} övgü</span>
                                      {item.totalCount > item.count && (
                                        <span className="text-[10px] text-slate-400">Toplam {item.totalCount} yorum</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
                                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${item.avgScore}%` }} />
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>Övgü Skoru: <strong className="text-emerald-700 font-bold">%{item.avgScore}</strong></span>
                                        {item.overallScore !== undefined && (
                                          <span>Genel Ort: <strong className="text-slate-600 font-medium">%{item.overallScore}</strong></span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end min-w-[55px]">
                                      <span className="text-xs font-black text-emerald-600 w-10">%{item.avgScore}</span>
                                      {isCompareActive && scoreDelta !== undefined && (
                                        <span className={`text-[10px] font-black leading-none mt-0.5 ${
                                          scoreDelta > 0 ? 'text-emerald-600' : 
                                          scoreDelta < 0 ? 'text-rose-600' : 
                                          'text-slate-400'
                                        }`}>
                                          {scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {isCompareActive && (
                                  <td className="py-4 px-4 text-center">
                                    <PerformanceTrendBadge
                                      title={item.subCategory}
                                      type="praisedTopic"
                                      currCount={item.count}
                                      prevCount={item.prevCount}
                                      currScore={item.avgScore}
                                      prevScore={item.prevScore}
                                      scoreDelta={scoreDelta}
                                      growthRate={growthRate}
                                      extra={item.mainCategory}
                                    />
                                  </td>
                                )}
                              </tr>
                              );
                            })}
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
                    {renderAiSummary('top_positive_topics')}
                    {renderDeepAnalytics('top_positive_topics')}
                  </section>

                  {/* Acil Müdahale Gerekenler */}
                  <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <div className="p-1.5 bg-rose-50 rounded-lg">
                              <AlertTriangle size={18} className="text-rose-600" />
                            </div>
                            Acil Müdahale Gerekenler (Şikayet & Risk Analizi)
                          </h3>
                          <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100">
                            Yalnızca Şikayetler
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {isCompareActive 
                            ? 'En çok şikayet alan konuların önceki döneme göre şikayet hacmi ve memnuniyetsizlik şiddeti değişimi' 
                            : 'Yalnızca olumsuz geri bildirim içeren şikayetler baz alınarak acil operasyonel müdahale bekleyen konular'}
                        </p>
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
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const item = payload[0].payload;
                                return (
                                  <div className="bg-white p-3.5 rounded-xl shadow-xl border border-slate-100 min-w-[240px]">
                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-2 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                                      <span>{item.subCategory}</span>
                                      <span className="text-[9px] text-slate-400 font-normal lowercase">({item.mainCategory})</span>
                                    </p>
                                    <div className="space-y-1.5 text-xs">
                                      <div className="flex items-center justify-between font-medium">
                                        <span className="text-rose-600 flex items-center gap-1.5 font-bold">
                                          <span className="w-2 h-2 rounded-full bg-rose-600"></span> Şikayet Skoru (Şiddeti):
                                        </span>
                                        <span className="font-bold font-mono">%{item.avgScore} <span className="text-slate-400 text-[10px]">({item.count} şikayet)</span></span>
                                      </div>
                                      {item.overallScore !== undefined && (
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                          <span>Konunun Genel Ortalaması:</span>
                                          <span className="font-bold font-mono text-slate-700">%{item.overallScore} <span className="text-slate-400 font-normal">(Toplam {item.totalCount} yorum)</span></span>
                                        </div>
                                      )}
                                      {isCompareActive && (
                                        <div className="flex items-center justify-between font-medium text-slate-500 pt-1 border-t border-slate-100">
                                          <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-slate-300"></span> Önceki Dönem (Şikayet):
                                          </span>
                                          <span className="font-bold font-mono">%{item.prevScore || 0} <span className="text-slate-400 text-[10px]">({item.prevCount || 0} şikayet)</span></span>
                                        </div>
                                      )}
                                      {isCompareActive && (
                                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                                          <span className="text-slate-500">Şikayet / Skor Değişimi:</span>
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-rose-600 font-black">
                                              {item.countDelta !== undefined && item.countDelta >= 0 ? `+${item.countDelta}` : item.countDelta} şikayet
                                            </span>
                                            {item.scoreDelta !== undefined && (
                                              <span className={`text-[10px] px-1 py-0.2 rounded font-black ${
                                                item.scoreDelta > 0 ? 'bg-emerald-50 text-emerald-700' : 
                                                item.scoreDelta < 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                                              }`}>
                                                {item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta}p
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            {isCompareActive && <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />}
                            {isCompareActive && (
                              <Bar 
                                dataKey="prevScore" 
                                name="Önceki Dönem (Şikayet Skoru)"
                                fill="#cbd5e1" 
                                radius={[0, 6, 6, 0]} 
                                barSize={12}
                              />
                            )}
                            <Bar 
                              dataKey="avgScore" 
                              name="Bu Dönem (Şikayet Skoru)"
                              fill="#ef4444" 
                              radius={[0, 6, 6, 0]} 
                              barSize={isCompareActive ? 12 : 24}
                              label={{ position: 'right', fontSize: 12, fontWeight: 900, fill: '#dc2626', offset: 10, formatter: (val: any) => `%${val}` }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[760px]">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[22%]">Alt Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[16%]">Ana Kategori</th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[18%]">
                                {isCompareActive ? 'Şikayet Hacmi (Bu / Önceki)' : 'Şikayet Yorum Sayısı'}
                              </th>
                              <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[24%]">
                                {isCompareActive ? 'Şikayet Skoru & Değişim' : 'Şikayet Skoru (Şiddeti)'}
                              </th>
                              {isCompareActive && (
                                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[20%]">
                                  <div>Risk & Müdahale Eğilimi</div>
                                  <div className="text-[8px] font-normal text-slate-400 normal-case tracking-normal">
                                    (Açıklama için üzerine gelin)
                                  </div>
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50" data-section="top-negative">
                            {dashboardData.topNegative.map((item, idx) => {
                              const scoreDelta = item.scoreDelta;
                              const growthRate = item.growthRate;

                              return (
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
                                  {isCompareActive ? (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      <div className="flex items-center gap-1.5 font-mono">
                                        <span className="text-sm font-black text-rose-600">{item.count} şikayet</span>
                                        <span className="text-xs text-slate-400 font-semibold">/ {item.prevCount || 0}</span>
                                      </div>
                                      {item.prevCount && item.prevCount > 0 ? (
                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full inline-flex items-center gap-0.5 ${
                                          growthRate !== undefined && growthRate > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                                        }`}>
                                          {growthRate !== undefined && growthRate >= 0 ? `+${growthRate}% Şikayet Artışı ⚠️` : `${growthRate}% Azalma 📉`}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Yeni Beliren Sorun ⚡</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center">
                                      <span className="text-sm font-black text-rose-600">{item.count} şikayet</span>
                                      {item.totalCount > item.count && (
                                        <span className="text-[10px] text-slate-400">Toplam {item.totalCount} yorum</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
                                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-rose-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.3)]" style={{ width: `${item.avgScore}%` }} />
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>Şikayet Skoru: <strong className="text-rose-700 font-bold">%{item.avgScore}</strong></span>
                                        {item.overallScore !== undefined && (
                                          <span>Genel Ort: <strong className="text-slate-600 font-medium">%{item.overallScore}</strong></span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end min-w-[55px]">
                                      <span className="text-xs font-black text-rose-600 w-10">%{item.avgScore}</span>
                                      {isCompareActive && scoreDelta !== undefined && (
                                        <span className={`text-[10px] font-black leading-none mt-0.5 ${
                                          scoreDelta > 0 ? 'text-emerald-600' : 
                                          scoreDelta < 0 ? 'text-rose-600' : 
                                          'text-slate-400'
                                        }`}>
                                          {scoreDelta > 0 ? `+${scoreDelta} puan` : `${scoreDelta} puan`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {isCompareActive && (
                                  <td className="py-4 px-4 text-center">
                                    <PerformanceTrendBadge
                                      title={item.subCategory}
                                      type="urgentTopic"
                                      currCount={item.count}
                                      prevCount={item.prevCount}
                                      currScore={item.avgScore}
                                      prevScore={item.prevScore}
                                      scoreDelta={scoreDelta}
                                      growthRate={growthRate}
                                      extra={item.mainCategory}
                                    />
                                  </td>
                                )}
                              </tr>
                              );
                            })}
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
                    {renderAiSummary('top_negative_topics')}
                    {renderDeepAnalytics('top_negative_topics')}
                  </section>
                </div>
              );
            }

            return null;
          })}

          {deepAnalytics['overall_summary'] && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-amber-50/50 border border-indigo-100 rounded-2xl p-6 shadow-md relative overflow-hidden mt-2"
            >
              <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-500 via-purple-500 to-amber-400"></div>
              <div className="flex gap-4">
                <div className="p-3 bg-white rounded-2xl shrink-0 h-fit shadow-md border border-indigo-100/50">
                  <Sparkles size={24} className="text-indigo-600 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-100/60 px-2.5 py-1 rounded-full uppercase tracking-widest inline-block mb-3">
                    Stratejik Sentez & Yönetici Özeti (Özet Değerlendirme)
                  </span>
                  <div 
                    className="text-sm leading-relaxed space-y-3 deep-analytics-content text-slate-700"
                    dangerouslySetInnerHTML={{ __html: deepAnalytics['overall_summary'] }}
                  />
                </div>
              </div>
            </motion.section>
          )}

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

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors">
                      <Brain size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">AI Bölüm Özetleri</p>
                      <p className="text-[10px] text-slate-500 font-medium">Her bölümün altına AI tarafından üretilmiş doğal dilli özetler ekler.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setExportOptions({ ...exportOptions, includeAiSummaries: !exportOptions.includeAiSummaries })}
                    className={`w-12 h-6 rounded-full transition-all relative ${exportOptions.includeAiSummaries ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${exportOptions.includeAiSummaries ? 'left-7' : 'left-1'}`} />
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