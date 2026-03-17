import React, { useState, useEffect, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { collection, getDocs, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CommentAnalytics, HotelTaxonomy } from '../types';
import { BarChart3, TrendingUp, AlertCircle, MessageSquare, Calendar as CalendarIcon, Award, AlertTriangle, FileText, Download, X, Save, Edit3, Trash2, Clock, Filter, Brain, Globe, Database, CheckCircle2 } from 'lucide-react';
import { generateAIContent } from '../services/aiService';
import { formatHtmlContent } from '../utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c'];

export function DashboardModule() {
  const [analytics, setAnalytics] = useState<CommentAnalytics[]>([]);
  const [taxonomy, setTaxonomy] = useState<HotelTaxonomy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [dateFilter, setDateFilter] = useState<'7days' | '30days' | 'thisYear' | 'custom'>('30days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  
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
    const currentYear = now.getFullYear();
    
    return analytics.filter(item => {
      const itemDate = new Date(item.createdAt || item.date);
      
      // Date Filter
      let dateMatch = true;
      if (dateFilter === '7days') {
        dateMatch = (now.getTime() - itemDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === '30days') {
        dateMatch = (now.getTime() - itemDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === 'thisYear') {
        dateMatch = itemDate.getFullYear() === currentYear;
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        dateMatch = itemDate >= start && itemDate <= end;
      }

      if (!dateMatch) return false;

      // Department & Topic Filter
      if (selectedDepartment !== 'all') {
        const hasDept = item.topics?.some(t => t.department === selectedDepartment);
        if (!hasDept) return false;
        
        if (selectedTopic !== 'all') {
          const hasTopic = item.topics?.some(t => t.department === selectedDepartment && t.mainTopic === selectedTopic);
          if (!hasTopic) return false;
        }
      }

      return true;
    });
  }, [analytics, dateFilter, selectedDepartment, selectedTopic]);

  const kpis = useMemo(() => {
    if (filteredAnalytics.length === 0) return { avgScore: 0, count: 0, bestDept: '-', worstDept: '-', scoreChange: 0 };

    const totalScore = filteredAnalytics.reduce((sum, item) => sum + item.overallScore, 0);
    const avgScore = totalScore / filteredAnalytics.length;

    const deptScores: Record<string, { total: number; count: number }> = {};
    filteredAnalytics.forEach(item => {
      item.topics?.forEach(topic => {
        if (!deptScores[topic.department]) {
          deptScores[topic.department] = { total: 0, count: 0 };
        }
        deptScores[topic.department].total += topic.score;
        deptScores[topic.department].count += 1;
      });
    });

    let bestDept = '-';
    let worstDept = '-';
    let maxScore = -1;
    let minScore = 101;

    Object.entries(deptScores).forEach(([dept, data]) => {
      const avg = data.total / data.count;
      if (avg > maxScore) { maxScore = avg; bestDept = dept; }
      if (avg < minScore) { minScore = avg; worstDept = dept; }
    });

    // Mock score change for demonstration
    const scoreChange = 5.2; 

    return {
      avgScore: Math.round(avgScore),
      count: filteredAnalytics.length,
      bestDept,
      worstDept,
      scoreChange
    };
  }, [filteredAnalytics]);

  const trendingTopics = useMemo(() => {
    const topics: Record<string, number> = {};
    filteredAnalytics.forEach(item => {
      item.topics?.forEach(t => {
        const key = `#${t.subTopic.replace(/\s+/g, '_')}`;
        topics[key] = (topics[key] || 0) + 1;
      });
    });
    return Object.entries(topics)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredAnalytics]);

  const departmentData = useMemo(() => {
    const deptScores: Record<string, { total: number; count: number }> = {};
    filteredAnalytics.forEach(item => {
      item.topics?.forEach(topic => {
        if (!deptScores[topic.department]) {
          deptScores[topic.department] = { total: 0, count: 0 };
        }
        deptScores[topic.department].total += topic.score;
        deptScores[topic.department].count += 1;
      });
    });

    return Object.entries(deptScores)
      .map(([name, data]) => ({
        name,
        score: Math.round(data.total / data.count)
      }))
      .sort((a, b) => b.score - a.score);
  }, [filteredAnalytics]);

  const nationalityData = useMemo(() => {
    const natScores: Record<string, { total: number; count: number }> = {};
    filteredAnalytics.forEach(item => {
      const nat = item.nationality || 'Bilinmiyor';
      if (!natScores[nat]) {
        natScores[nat] = { total: 0, count: 0 };
      }
      natScores[nat].total += item.overallScore;
      natScores[nat].count += 1;
    });

    return Object.entries(natScores)
      .map(([name, data]) => ({
        name,
        score: Math.round(data.total / data.count),
        count: data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [filteredAnalytics]);

  const timeSeriesData = useMemo(() => {
    const series: Record<string, { total: number; count: number }> = {};
    filteredAnalytics.forEach(item => {
      const dateStr = new Date(item.date || item.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
      if (!series[dateStr]) {
        series[dateStr] = { total: 0, count: 0 };
      }
      series[dateStr].total += item.overallScore;
      series[dateStr].count += 1;
    });

    return Object.entries(series).map(([date, data]) => ({
      date,
      score: Math.round(data.total / data.count)
    })).reverse(); 
  }, [filteredAnalytics]);

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
      2. Departman Performansları (En iyi ve en çok geliştirilmesi gereken departmanlar)
      3. Öne Çıkan Gündem Konuları (Trending Topics)
      4. Aksiyon Önerileri (Kaliteyi artırmak için 3 somut öneri)
      
      Veriler (${dateFilter === '7days' ? 'Son 7 Gün' : dateFilter === '30days' ? 'Son 30 Gün' : dateFilter === 'thisYear' ? 'Bu Yıl' : 'Özel Tarih Aralığı'}):
      - Toplam Yorum Sayısı: ${kpis.count}
      - Ortalama Memnuniyet: %${kpis.avgScore}
      - En Başarılı Departman: ${kpis.bestDept}
      - En Çok Şikayet Alan Departman: ${kpis.worstDept}
      
      Departman Performansları:
      ${JSON.stringify(departmentData, null, 2)}
      
      Gündem Konuları:
      ${JSON.stringify(trendingTopics, null, 2)}
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
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Header & Filters */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Brain className="text-indigo-600" />
            Bilişsel İş Zekası
          </h2>
          <p className="text-sm text-slate-500">Otonom Öğrenen Kapsamlı Zeka Analizi</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setDateFilter('7days')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateFilter === '7days' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Son 7 Gün
            </button>
            <button
              onClick={() => setDateFilter('30days')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateFilter === '30days' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Son 30 Gün
            </button>
            <button
              onClick={() => setDateFilter('thisYear')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateFilter === 'thisYear' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Bu Yıl
            </button>
            <button
              onClick={() => setDateFilter('custom')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${dateFilter === 'custom' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Özel Tarih Aralığı
            </button>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-slate-400">-</span>
              <input 
                type="date" 
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}

          <select
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value);
              setSelectedTopic('all');
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="all">Tüm Departmanlar</option>
            {taxonomy?.departments && Object.keys(taxonomy.departments).map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          {selectedDepartment !== 'all' && taxonomy?.departments[selectedDepartment] && (
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            >
              <option value="all">Tüm Konular</option>
              {Object.keys(taxonomy.departments[selectedDepartment].mainTopics).map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleGenerateDashboardReport}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <FileText size={16} />
            📄 Yönetici Raporu Üret (AI)
          </button>
          
          <button
            onClick={() => setIsSavedReportsModalOpen(true)}
            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Database size={16} />
            Kayıtlı Raporlar
            {savedReports.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-xs font-bold ml-1">
                {savedReports.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Top KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <Award className="text-indigo-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Ort. Memnuniyet</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold text-slate-800">%{kpis.avgScore}</h3>
                  <span className={`text-xs font-medium ${kpis.scoreChange >= 0 ? 'text-emerald-600' : 'text-red-600'} flex items-center`}>
                    {kpis.scoreChange >= 0 ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingUp size={12} className="mr-0.5 transform rotate-180" />}
                    {Math.abs(kpis.scoreChange)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <MessageSquare className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Analiz Edilen Yorum</p>
                <h3 className="text-2xl font-bold text-slate-800">{kpis.count}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="text-emerald-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">En Başarılı Departman</p>
                <h3 className="text-lg font-bold text-slate-800 truncate" title={kpis.bestDept}>{kpis.bestDept}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Gelişim Alanı</p>
                <h3 className="text-lg font-bold text-slate-800 truncate" title={kpis.worstDept}>{kpis.worstDept}</h3>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Trending Topics */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-1">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="text-indigo-500" size={20} />
                Gündem (Trending Topics)
              </h3>
              <div className="space-y-4">
                {trendingTopics.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                      {item.topic}
                    </span>
                    <span className="text-sm text-slate-500 font-medium">{item.count} Bahsedilme</span>
                  </div>
                ))}
                {trendingTopics.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">Veri bulunamadı.</p>
                )}
              </div>
            </div>

            {/* Department Comparison */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <BarChart3 className="text-indigo-500" size={20} />
                Departman Performansları
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Memnuniyet Skoru" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Time Series */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <CalendarIcon className="text-indigo-500" size={20} />
                Zaman Serisi Trendi
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Ort. Skor" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Nationality Analysis */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Globe className="text-indigo-500" size={20} />
                Uyruk Analizi
              </h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={nationalityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {nationalityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
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
