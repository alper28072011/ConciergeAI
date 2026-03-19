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
  Settings, Eye, EyeOff, LayoutGrid, List, ChevronDown, ChevronUp, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateAIContent } from '../services/aiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { getDashboardData } from '../utils/biEngine';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

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

const AVAILABLE_MODULES = [
  { id: 'kpi_cards', label: 'KPI Özet Kartları', icon: LayoutGrid },
  { id: 'category_satisfaction', label: 'Kategori Bazlı Memnuniyet', icon: BarChart3 },
  { id: 'source_analysis', label: 'Kanal Dağılımı (OTA)', icon: PieChartIcon },
  { id: 'nationality_analysis', label: 'Uyruk Memnuniyet Endeksi', icon: Globe },
  { id: 'hotel_agenda', label: 'Otel Gündemi & Alt Konular', icon: List },
];

export function DashboardModule() {
  const [analytics, setAnalytics] = useState<CommentAnalytics[]>([]);
  const [taxonomy, setTaxonomy] = useState<HotelTaxonomy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  // Filters
  const [dateFilter, setDateFilter] = useState<'7days' | '30days' | 'thisYear' | 'custom'>('30days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('all');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('all');
  const [selectedNationalities, setSelectedNationalities] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [globalViewMode, setGlobalViewMode] = useState<'chart' | 'table'>('chart');
  const [showSubCategories, setShowSubCategories] = useState(false);
  const [activeModules, setActiveModules] = useState<string[]>(['kpi_cards', 'category_satisfaction', 'source_analysis', 'nationality_analysis', 'hotel_agenda']);
  const [modulesOrder, setModulesOrder] = useState(AVAILABLE_MODULES);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [drillDownFilter, setDrillDownFilter] = useState<{ type: 'category' | 'source' | 'nationality' | 'all', value: string }>({ type: 'all', value: 'all' });
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const currentPrefsRef = useRef<any>(null);

  useEffect(() => {
    currentPrefsRef.current = {
      userId,
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
    };
  }, [userId, modulesOrder, activeModules, globalViewMode, dateFilter, customStartDate, customEndDate, selectedMainCategory, selectedSubCategory, selectedNationalities, selectedSources]);

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

  // Load User Preferences
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const defaultState = {
          modulesOrder: AVAILABLE_MODULES.map(m => m.id),
          activeModules: ['kpi_cards', 'category_satisfaction', 'source_analysis', 'nationality_analysis', 'hotel_agenda'],
          globalViewMode: 'chart',
          dateFilter: '30days',
          customStartDate: '',
          customEndDate: '',
          selectedMainCategory: 'all',
          selectedSubCategory: 'all',
          selectedNationalities: [],
          selectedSources: [],
        };

        try {
          const docRef = doc(db, 'user_preferences', user.uid);
          const docSnap = await getDoc(docRef);
          
          let resolvedState = { ...defaultState };
          let resolvedModulesOrder = AVAILABLE_MODULES;

          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Resolve modules order safely
            let resolvedModulesOrderIds = defaultState.modulesOrder;
            
            if (data.modulesOrder && Array.isArray(data.modulesOrder)) {
              const ordered = data.modulesOrder.map((id: string) => 
                AVAILABLE_MODULES.find(m => m.id === id)
              ).filter(Boolean) as typeof AVAILABLE_MODULES;
              const missing = AVAILABLE_MODULES.filter(m => !data.modulesOrder.includes(m.id));
              resolvedModulesOrder = [...ordered, ...missing];
              resolvedModulesOrderIds = resolvedModulesOrder.map(m => m.id);
            }

            resolvedState = {
              modulesOrder: resolvedModulesOrderIds,
              activeModules: data.activeModules || defaultState.activeModules,
              globalViewMode: data.globalViewMode || defaultState.globalViewMode,
              dateFilter: data.dateFilter || defaultState.dateFilter,
              customStartDate: data.customStartDate || defaultState.customStartDate,
              customEndDate: data.customEndDate || defaultState.customEndDate,
              selectedMainCategory: data.selectedMainCategory || defaultState.selectedMainCategory,
              selectedSubCategory: data.selectedSubCategory || defaultState.selectedSubCategory,
              selectedNationalities: data.selectedNationalities || defaultState.selectedNationalities,
              selectedSources: data.selectedSources || defaultState.selectedSources,
            };
          }

          // Apply to React States
          setModulesOrder(resolvedModulesOrder);
          setActiveModules(resolvedState.activeModules);
          setGlobalViewMode(resolvedState.globalViewMode as any);
          setDateFilter(resolvedState.dateFilter as any);
          setCustomStartDate(resolvedState.customStartDate);
          setCustomEndDate(resolvedState.customEndDate);
          setSelectedMainCategory(resolvedState.selectedMainCategory);
          setSelectedSubCategory(resolvedState.selectedSubCategory);
          setSelectedNationalities(resolvedState.selectedNationalities);
          setSelectedSources(resolvedState.selectedSources);

        } catch (error) {
          console.error("Tercihler yüklenirken hata:", error);
          try {
            handleFirestoreError(error, OperationType.GET, `user_preferences/${user.uid}`);
          } catch (e) { /* Logged */ }
        } finally {
          setIsInitialLoad(false);
        }
      } else {
        setUserId(null);
        setIsInitialLoad(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Save User Preferences Function
  const handleSavePreferences = async () => {
    // Stale Closure'u önlemek için doğrudan güncel Ref'i (Kara Kutuyu) okuyoruz
    const prefs = currentPrefsRef.current;

    if (!prefs || !prefs.userId) {
      alert("Sistem oturumunuzu senkronize ediyor, lütfen 1 saniye bekleyip tekrar deneyin.");
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      // userId'yi kayıttan ayır, kalanı veritabanına gönder
      const { userId: uid, ...dataToSave } = prefs;

      await setDoc(doc(db, 'user_preferences', uid), {
        ...dataToSave,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
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

  // Otonom Yorum Senkronizasyonu (Silent Background Sync)
  useEffect(() => {
    const syncMissingComments = async () => {
      try {
        // 1. Eksik metinli yorumları tespit et
        const missingComments = analytics.filter(c => !c.comment || c.comment.trim() === '' || c.comment === 'Yorum metni sistemde bulunamadı.');
        if (missingComments.length === 0) return; // Eksik yoksa dur.

        const missingIds = missingComments.map(c => Number(c.commentId)).filter(id => !isNaN(id));
        if (missingIds.length === 0) return;

        // 2. API Ayarlarını çek
        const savedSettings = localStorage.getItem('hotelApiSettings');
        if (!savedSettings) return;
        const settings = JSON.parse(savedSettings);
        if (!settings.commentPayloadTemplate) return;

        // 3. Elektra IN operatörü ile toplu sorgu hazırla
        const basePayload = JSON.parse(settings.commentPayloadTemplate);
        const payload = {
          ...basePayload,
          Select: ["ID", "COMMENT"],
          Where: [
            ...((basePayload.Where && Array.isArray(basePayload.Where)) ? basePayload.Where : []),
            { Column: "ID", Operator: "IN", Value: missingIds }
          ],
          Paging: { Current: 1, ItemsPerPage: 5000 }
        };

        // 4. Arka planda sessizce çek
        const response = await executeElektraQuery(payload);
        
        // 5. Firebase'i sessizce güncelle (onSnapshot sayesinde UI otomatik yenilenecek)
        if (response && Array.isArray(response)) {
          response.forEach(async (item: any) => {
            if (item.ID && item.COMMENT) {
              const docRef = doc(db, 'comment_analytics', String(item.ID));
              await updateDoc(docRef, { comment: item.COMMENT }).catch(e => console.warn("Sessiz güncelleme atlandı:", e));
            }
          });
        }
      } catch (error) {
        console.error("Arka plan yorum senkronizasyonu hatası:", error);
      }
    };

    // Sayfa yüklenmesini engellememek için 2 saniye gecikmeli (debounce) çalıştır
    const timeoutId = setTimeout(() => {
      syncMissingComments();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [analytics]);

  useEffect(() => {
    setIsLoading(true);
    
    // Fetch Taxonomy
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

    // Fetch Analytics
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

    return () => unsubscribe();
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

  const filteredAnalytics = useMemo(() => {
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

    return analytics.filter(item => {
      let itemDate = parseDate(item.date);
      if (isNaN(itemDate.getTime())) {
        itemDate = parseDate(item.createdAt);
      }
      
      // Date Filter
      let dateMatch = true;
      if (dateFilter === '7days') {
        const diffTime = now.getTime() - itemDate.getTime();
        dateMatch = diffTime >= 0 && diffTime <= 7 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === '30days') {
        const diffTime = now.getTime() - itemDate.getTime();
        dateMatch = diffTime >= 0 && diffTime <= 30 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === 'thisYear') {
        dateMatch = itemDate.getFullYear() === currentYear;
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        dateMatch = itemDate >= start && itemDate <= end;
      }

      if (!dateMatch) return false;

      // Category & SubCategory Filter
      if (selectedMainCategory !== 'all') {
        const hasCategory = item.topics?.some(t => t.mainCategory === selectedMainCategory);
        if (!hasCategory) return false;
        
        if (selectedSubCategory !== 'all') {
          const hasSub = item.topics?.some(t => t.mainCategory === selectedMainCategory && t.subCategory === selectedSubCategory);
          if (!hasSub) return false;
        }
      }

      // Nationality Filter
      if (selectedNationalities.length > 0) {
        if (!selectedNationalities.includes(item.nationality || 'Bilinmiyor')) return false;
      }

      // Source Filter
      if (selectedSources.length > 0) {
        if (!selectedSources.includes(item.source || 'Bilinmiyor')) return false;
      }

      return true;
    });
  }, [analytics, dateFilter, customStartDate, customEndDate, selectedMainCategory, selectedSubCategory, selectedNationalities, selectedSources]);

  const drillDownComments = useMemo(() => {
    if (drillDownFilter.type === 'all') return filteredAnalytics;
    
    return filteredAnalytics.filter(item => {
      if (drillDownFilter.type === 'category') {
        return item.topics?.some(t => t.subCategory === drillDownFilter.value || t.mainCategory === drillDownFilter.value);
      }
      if (drillDownFilter.type === 'source') return item.source === drillDownFilter.value;
      if (drillDownFilter.type === 'nationality') return item.nationality === drillDownFilter.value;
      return true;
    });
  }, [filteredAnalytics, drillDownFilter]);

  const dashboardData = useMemo(() => getDashboardData(filteredAnalytics), [filteredAnalytics]);

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
    if (!showSubCategories) {
      return dashboardData.categoryPerformance.map(item => ({
        ...item,
        isSub: false
      }));
    }

    const flatData: any[] = [];
    hierarchicalCategoryData.forEach(group => {
      flatData.push({
        name: group.name,
        score: group.avgScore,
        count: group.count,
        isSub: false
      });
      group.subCategories.forEach(sub => {
        flatData.push({
          name: sub.subCategory,
          score: sub.avgScore,
          count: sub.count,
          isSub: true,
          parent: group.name
        });
      });
    });
    return flatData;
  }, [hierarchicalCategoryData, dashboardData.categoryPerformance, showSubCategories]);

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

  const handleExportPdf = async () => {
    if (!dashboardRef.current) return;
    
    try {
      const element = dashboardRef.current;
      const dataUrl = await toPng(element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Otel_CRM_Kokpit_Raporu_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('PDF oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.');
    }
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
      
      Veriler (${dateFilter === '7days' ? 'Son 7 Gün' : dateFilter === '30days' ? 'Son 30 Gün' : dateFilter === 'thisYear' ? 'Bu Yıl' : 'Özel Tarih Aralığı'}):
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
            <div className="space-y-2">
              <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Dönem</label>
              <div className="grid grid-cols-2 gap-1">
                {[
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

            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-1.5 animate-in fade-in slide-in-from-top-1">
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

            {/* Multi-selects for Source & Nationality */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Kaynak</label>
                <select
                  multiple
                  value={selectedSources}
                  onChange={(e) => setSelectedSources(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value))}
                  className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500/20 h-20 custom-scrollbar"
                >
                  {allSources.map(source => (
                    <option key={source} value={source} className="py-0.5 px-1 rounded mb-0.5">{source}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Uyruk</label>
                <select
                  multiple
                  value={selectedNationalities}
                  onChange={(e) => setSelectedNationalities(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value))}
                  className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-[10px] text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500/20 h-20 custom-scrollbar"
                >
                  {allNationalities.map(nat => (
                    <option key={nat} value={nat} className="py-0.5 px-1 rounded mb-0.5">{nat}</option>
                  ))}
                </select>
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
                onClick={handleExportPdf}
                className="bg-white text-slate-700 border border-slate-200 p-2 rounded-lg font-bold text-[9px] flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all shadow-sm"
              >
                <Printer size={14} className="text-slate-400" />
                PDF
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
                      label: 'Analiz Edilen Yorum', 
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
                      className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-indigo-300 transition-all"
                      onClick={() => {
                        if (kpi.label === 'En Başarılı Kategori' || kpi.label === 'Gelişim Alanı') {
                          setDrillDownFilter({ type: 'category', value: kpi.value });
                        } else {
                          setDrillDownFilter({ type: 'all', value: 'all' });
                        }
                      }}
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

            if (module.id === 'category_satisfaction') {
              return (
                <section key="category_satisfaction" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Kategori Bazlı Memnuniyet</h3>
                      <p className="text-xs text-slate-500">Ana ve alt kategorilerdeki misafir deneyim puanları</p>
                    </div>
                    <button
                      onClick={() => setShowSubCategories(!showSubCategories)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        showSubCategories 
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Layers size={14} />
                      {showSubCategories ? 'Alt Konuları Gizle' : 'Alt Konuları Göster'}
                    </button>
                  </div>

                  {globalViewMode === 'chart' ? (
                    <div className={`w-full relative min-w-0 min-h-0 transition-all duration-500 ${showSubCategories ? 'h-[900px]' : 'h-[450px]'}`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          layout="vertical" 
                          data={categoryChartData} 
                          margin={{ left: 10, right: 60, top: 10, bottom: 10 }}
                          onClick={(data: any) => {
                            if (data && data.activeLabel) {
                              setDrillDownFilter({ type: 'category', value: data.activeLabel });
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
                          <Bar 
                            dataKey="score" 
                            radius={[0, 4, 4, 0]} 
                            barSize={showSubCategories ? 12 : 20}
                            label={{ position: 'right', fontSize: 10, fontWeight: 700, fill: '#4f46e5', formatter: (val: any) => `%${val}` }}
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.isSub ? '#818cf8' : '#4f46e5'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategori</th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Yorum Sayısı</th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memnuniyet Skoru</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {hierarchicalCategoryData.map((group, gIdx) => (
                            <React.Fragment key={gIdx}>
                              <tr 
                                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                onClick={() => setDrillDownFilter({ type: 'category', value: group.name })}
                              >
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
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
                                        className={`h-full rounded-full ${
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
                                {showSubCategories && group.subCategories.map((sub, sIdx) => (
                                  <motion.tr
                                    key={`${gIdx}-${sIdx}`}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.2, delay: sIdx * 0.03 }}
                                    className="bg-slate-50/50 hover:bg-indigo-50 transition-colors cursor-pointer border-l-2 border-indigo-200"
                                    onClick={() => setDrillDownFilter({ type: 'category', value: sub.subCategory })}
                                  >
                                    <td className="py-2 px-4 pl-8">
                                      <span className="text-xs font-medium text-slate-600">
                                        ↳ {sub.subCategory}
                                      </span>
                                    </td>
                                    <td className="py-2 px-4 text-xs text-slate-400 text-center font-mono">
                                      {sub.count}
                                    </td>
                                    <td className="py-2 px-4">
                                      <div className="flex items-center gap-3">
                                        <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden min-w-[100px]">
                                          <div 
                                            className={`h-full rounded-full ${
                                              sub.avgScore >= 80 ? 'bg-emerald-400' :
                                              sub.avgScore >= 60 ? 'bg-blue-400' :
                                              sub.avgScore >= 40 ? 'bg-amber-400' :
                                              'bg-red-400'
                                            }`}
                                            style={{ width: `${sub.avgScore}%` }}
                                          />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 w-10">
                                          %{sub.avgScore}
                                        </span>
                                      </div>
                                    </td>
                                  </motion.tr>
                                ))}
                              </AnimatePresence>
                            </React.Fragment>
                          ))}
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
                            {dashboardData.sourceAnalysis.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
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
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memnuniyet Skoru</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {dashboardData.sourceAnalysis.map((item, idx) => (
                            <tr 
                              key={idx} 
                              className="hover:bg-slate-50 transition-colors cursor-pointer"
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
                    <div 
                      className="w-full relative min-w-0 min-h-0 overflow-hidden" 
                      style={{ height: `${Math.max(400, dashboardData.nationalityAnalysis.length * 40)}px` }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          layout="vertical" 
                          data={dashboardData.nationalityAnalysis} 
                          margin={{ left: 20, right: 60, top: 10, bottom: 10 }}
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
                            tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                            width={120}
                          />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar 
                            dataKey="avgScore" 
                            radius={[0, 4, 4, 0]} 
                            barSize={20}
                            label={{ position: 'right', fontSize: 10, fontWeight: 700, fill: '#4f46e5', formatter: (val: any) => `%${val}` }}
                          >
                            {dashboardData.nationalityAnalysis.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.avgScore >= 80 ? '#10b981' : entry.avgScore >= 60 ? '#4f46e5' : entry.avgScore >= 40 ? '#f59e0b' : '#ef4444'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uyruk / Pazar</th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Yorum Sayısı</th>
                            <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memnuniyet Skoru</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {dashboardData.nationalityAnalysis.map((item, idx) => (
                            <tr 
                              key={idx} 
                              className="hover:bg-slate-50 transition-colors cursor-pointer group"
                              onClick={() => setDrillDownFilter({ type: 'nationality', value: item.name })}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  <span className="text-sm font-bold text-slate-800 tracking-tight">{item.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-500 text-center font-mono font-bold">
                                {item.count}
                              </td>
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
                  )}
                </section>
              );
            }

            if (module.id === 'hotel_agenda') {
              return (
                <div key="hotel_agenda" className="grid grid-cols-3 gap-6">
                  {/* Most Mentioned */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={14} className="text-indigo-500" />
                        En Çok Konuşulanlar
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {dashboardData.mostMentioned.slice(0, 6).map((item, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer"
                          onClick={() => setDrillDownFilter({ type: 'category', value: item.subCategory })}
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{item.subCategory}</p>
                            <p className="text-[10px] text-slate-400">{item.mainCategory}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-slate-700">{item.count}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Yorum</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Positive */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-emerald-50/30">
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2">
                        <Award size={14} className="text-emerald-500" />
                        En Çok Övülenler
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {dashboardData.topPositive.slice(0, 6).map((item, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 hover:bg-emerald-50/20 transition-colors flex items-center justify-between cursor-pointer"
                          onClick={() => setDrillDownFilter({ type: 'category', value: item.subCategory })}
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800">{item.subCategory}</p>
                            <p className="text-[10px] text-slate-400">{item.mainCategory}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-xs font-black text-emerald-600">%{item.avgScore}</p>
                            </div>
                            <ChevronRight size={12} className="text-slate-300" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Negative (Urgency) */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-red-50/30">
                      <h4 className="text-xs font-black text-red-900 uppercase tracking-widest flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-500" />
                        Acil Müdahale Gerekenler
                      </h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {dashboardData.topNegative.slice(0, 6).map((item, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 hover:bg-red-50/20 transition-colors flex items-center justify-between cursor-pointer"
                          onClick={() => setDrillDownFilter({ type: 'category', value: item.subCategory })}
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800">{item.subCategory}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-slate-400">{item.mainCategory}</p>
                              <span className="text-[8px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">Kritik</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-red-600">%{item.avgScore}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Skor</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                  {drillDownFilter.type === 'all' ? 'Tüm Filtrelenmiş Yorumlar' : `${drillDownFilter.value} Analizi`}
                </p>
              </div>
              {drillDownFilter.type !== 'all' && (
                <button 
                  onClick={() => setDrillDownFilter({ type: 'all', value: 'all' })}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
                  title="Filtreyi Temizle"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-3">
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

                  return (
                    <div key={commentData.commentId || idx} className="p-4 rounded-2xl border border-slate-100 bg-white hover:border-indigo-200 transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">{commentData.source}</span>
                          <span className="text-[10px] font-bold text-slate-400">{new Date(commentData.date).toLocaleDateString('tr-TR')}</span>
                        </div>
                        <div className="text-xs font-black text-slate-600">{commentData.overallScore}/100</div>
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
                        {commentData.topics?.map((topic, tidx) => (
                          <span key={tidx} className="text-[8px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">
                            {topic.subCategory}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/30">
              <p className="text-[10px] font-bold text-slate-400 text-center uppercase">
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

    </div>
  );
}
