import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CommentAnalytics, HotelTaxonomy } from '../types';
import { HOTEL_MAIN_CATEGORIES } from '../utils/constants';
import { 
  BarChart3, TrendingUp, AlertCircle, MessageSquare, Calendar as CalendarIcon, 
  Award, AlertTriangle, FileText, Download, X, Save, Edit3, Trash2, Clock, 
  Filter, Brain, Globe, Database, CheckCircle2, PieChart as PieChartIcon,
  ChevronRight, ArrowUpRight, ArrowDownRight, Printer, Sparkles, Layout
} from 'lucide-react';
import { generateAIContent } from '../services/aiService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { getDashboardData } from '../utils/biEngine';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#71717a'];
const RADAR_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'];

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
  
  // Report State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [isSavedReportsModalOpen, setIsSavedReportsModalOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingReportType, setEditingReportType] = useState<string>('dashboard_summary');
  const [isSavingReport, setIsSavingReport] = useState(false);

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

  const dashboardData = useMemo(() => getDashboardData(filteredAnalytics), [filteredAnalytics]);

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
    <div className="h-full bg-[#f8fafc] overflow-hidden flex flex-col">
      {/* Main Cockpit Layout */}
      <div className="max-w-[1600px] w-[95%] mx-auto h-full flex gap-6 py-6 overflow-hidden">
        
        {/* Left Column: Control Panel (Sticky) */}
        <aside className="w-1/4 min-w-[320px] flex flex-col gap-6 sticky top-0 h-fit">
          {/* Brand & AI Status */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <Brain className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Yönetim Kokpiti</h2>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  AI Analiz Aktif
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Veri odaklı karar destek sistemi. Tüm kanallardan gelen misafir geri bildirimleri anlık olarak işlenmektedir.
            </p>
          </div>

          {/* Filters Section */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Filter size={16} className="text-indigo-500" />
                Denetim Filtreleri
              </h3>
              <button 
                onClick={() => {
                  setDateFilter('30days');
                  setSelectedMainCategory('all');
                  setSelectedSubCategory('all');
                  setSelectedNationalities([]);
                  setSelectedSources([]);
                }}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-tight"
              >
                Sıfırla
              </button>
            </div>

            {/* Date Presets */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rapor Dönemi</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: '7days', label: 'Son 7 Gün' },
                  { id: '30days', label: 'Son 30 Gün' },
                  { id: 'thisYear', label: 'Bu Yıl' },
                  { id: 'custom', label: 'Özel Aralık' }
                ].map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => setDateFilter(preset.id as any)}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                      dateFilter === preset.id 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {dateFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2">
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            )}

            {/* Multi-selects for Source & Nationality */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kanal Kaynağı</label>
                <select
                  multiple
                  value={selectedSources}
                  onChange={(e) => setSelectedSources(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 h-24"
                >
                  {allSources.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Misafir Uyruğu</label>
                <select
                  multiple
                  value={selectedNationalities}
                  onChange={(e) => setSelectedNationalities(Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 h-24"
                >
                  {allNationalities.map(nat => (
                    <option key={nat} value={nat}>{nat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleGenerateDashboardReport}
              className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 group"
            >
              <Sparkles size={18} className="text-amber-400 group-hover:scale-110 transition-transform" />
              AI Yönetici Özeti Üret
            </button>
            <button
              onClick={handleExportPdf}
              className="w-full bg-white text-slate-700 border border-slate-200 p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Printer size={18} className="text-slate-400" />
              Raporu PDF İndir
            </button>
            <button
              onClick={() => setIsSavedReportsModalOpen(true)}
              className="w-full bg-white text-slate-700 border border-slate-200 p-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Database size={18} className="text-slate-400" />
              Kayıtlı Raporlar ({savedReports.length})
            </button>
          </div>
        </aside>

        {/* Right Column: Graphics Area (Scrollable) */}
        <main className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar" ref={dashboardRef}>
          
          {/* Global View Mode Toggle */}
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Layout size={20} className="text-indigo-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Rapor Görünüm Modu</h4>
                <p className="text-[10px] text-slate-500 font-medium">Tüm analizleri grafik veya tablo olarak listeleyin</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setGlobalViewMode('chart')}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  globalViewMode === 'chart' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BarChart3 size={16} />
                Grafik Görünümü
              </button>
              <button
                onClick={() => setGlobalViewMode('table')}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  globalViewMode === 'table' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Database size={16} />
                Tablo Görünümü
              </button>
            </div>
          </div>

          {/* Row 1: KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
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
              <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden group">
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

          {/* Row 2: Category Performance (Horizontal Bar Chart or Table) */}
          <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Kategori Bazlı Memnuniyet</h3>
                <p className="text-xs text-slate-500">Ana ve alt kategorilerdeki misafir deneyim puanları</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setGlobalViewMode('chart')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    globalViewMode === 'chart' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <BarChart3 size={14} />
                  Grafik
                </button>
                <button
                  onClick={() => setGlobalViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    globalViewMode === 'table' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Database size={14} />
                  Tablo
                </button>
              </div>
            </div>

            {globalViewMode === 'chart' ? (
              <div className="h-[300px] w-full relative min-w-0 min-h-0">
                <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0} debounce={100}>
                  <BarChart 
                    layout="vertical" 
                    data={dashboardData.categoryPerformance} 
                    margin={{ left: 40, right: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar 
                      dataKey="score" 
                      fill="#4f46e5" 
                      radius={[0, 4, 4, 0]} 
                      barSize={20}
                      label={{ position: 'right', fontSize: 11, fontWeight: 700, fill: '#4f46e5', formatter: (val: any) => `%${val}` }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ana Kategori</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alt Kategori</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Yorum Sayısı</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Memnuniyet Skoru</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {dashboardData.mostMentioned.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                            {item.mainCategory}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-slate-700">
                          {item.subCategory}
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

          {/* Row 3: Source Analysis */}
          <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Kanal Dağılımı</h3>
                <p className="text-xs text-slate-500">Yorumların geldiği platformlar ve kanal bazlı performans</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setGlobalViewMode('chart')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    globalViewMode === 'chart' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <PieChartIcon size={14} />
                  Grafik
                </button>
                <button
                  onClick={() => setGlobalViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    globalViewMode === 'table' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Database size={14} />
                  Tablo
                </button>
              </div>
            </div>

            {globalViewMode === 'chart' ? (
              <div className="h-[300px] w-full relative min-w-0 min-h-0">
                <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0} debounce={100}>
                  <PieChart>
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
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
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

          {/* Row 4: Nationality Analysis */}
          <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Uyruk Memnuniyet Endeksi</h3>
                <p className="text-xs text-slate-500">Pazar bazlı ortalama skorlar ve misafir dağılımı</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setGlobalViewMode('chart')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    globalViewMode === 'chart' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Globe size={14} />
                  Grafik
                </button>
                <button
                  onClick={() => setGlobalViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                    globalViewMode === 'table' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Database size={14} />
                  Tablo
                </button>
              </div>
            </div>

            {globalViewMode === 'chart' ? (
              <div className="h-[350px] w-full relative min-w-0 min-h-0">
                <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0} debounce={100}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={dashboardData.nationalityAnalysis.slice(0, 8)}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar
                      name="Memnuniyet Skoru"
                      dataKey="avgScore"
                      stroke="#4f46e5"
                      fill="#4f46e5"
                      fillOpacity={0.5}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </RadarChart>
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
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="text-sm font-semibold text-slate-700">{item.name}</span>
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

          {/* Row 4: Hotel Agenda & Sub-Topics (Tables) */}
          <div className="grid grid-cols-3 gap-6">
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
                  <div key={idx} className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between group">
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
                  <div key={idx} className="p-3 hover:bg-emerald-50/20 transition-colors flex items-center justify-between">
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
                  <div key={idx} className="p-3 hover:bg-red-50/20 transition-colors flex items-center justify-between">
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

          {/* Bottom Spacing */}
          <div className="h-12 shrink-0" />
        </main>
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
