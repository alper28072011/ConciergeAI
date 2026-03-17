import React, { useState, useEffect, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { collection, getDocs, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { CommentAnalytics } from '../types';
import { BarChart3, TrendingUp, AlertCircle, MessageSquare, Calendar as CalendarIcon, Award, AlertTriangle, FileText, Download, X, Save, Edit3, Trash2, Clock } from 'lucide-react';
import { generateAIContent } from '../services/aiService';
import { formatHtmlContent } from '../utils';

export function DashboardModule() {
  const [analytics, setAnalytics] = useState<CommentAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'7days' | '30days' | 'thisMonth'>('30days');
  
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
    return analytics.filter(item => {
      const itemDate = new Date(item.createdAt || item.date);
      if (dateFilter === '7days') {
        return (now.getTime() - itemDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === '30days') {
        return (now.getTime() - itemDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
      } else if (dateFilter === 'thisMonth') {
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [analytics, dateFilter]);

  const kpis = useMemo(() => {
    if (filteredAnalytics.length === 0) return { avgScore: 0, count: 0, bestDept: '-', worstDept: '-' };

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

    return {
      avgScore: Math.round(avgScore),
      count: filteredAnalytics.length,
      bestDept,
      worstDept
    };
  }, [filteredAnalytics]);

  const departmentPerformance = useMemo(() => {
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
      .map(([dept, data]) => ({
        department: dept,
        score: Math.round(data.total / data.count)
      }))
      .sort((a, b) => b.score - a.score);
  }, [filteredAnalytics]);

  const tagCloud = useMemo(() => {
    const topics: Record<string, { count: number; totalScore: number }> = {};
    filteredAnalytics.forEach(item => {
      item.topics?.forEach(topic => {
        if (!topics[topic.topic]) {
          topics[topic.topic] = { count: 0, totalScore: 0 };
        }
        topics[topic.topic].count += 1;
        topics[topic.topic].totalScore += topic.score;
      });
    });

    return Object.entries(topics)
      .map(([topic, data]) => ({
        topic,
        count: data.count,
        avgScore: Math.round(data.totalScore / data.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30); // Top 30 topics
  }, [filteredAnalytics]);

  const criticalAlarms = useMemo(() => {
    const alarms: { commentId: string; rawText: string; topics: string[]; score: number; date: string }[] = [];
    filteredAnalytics.forEach(item => {
      const badTopics = item.topics?.filter(t => t.score < 30) || [];
      if (badTopics.length > 0) {
        alarms.push({
          commentId: item.commentId,
          rawText: item.rawText,
          topics: badTopics.map(t => t.topic),
          score: item.overallScore,
          date: item.date
        });
      }
    });
    return alarms.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
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
      3. Öne Çıkan Konular (Misafirlerin en çok bahsettiği konular)
      4. Kritik Alarmlar (Acil çözülmesi gereken kronik sorunlar)
      5. Aksiyon Önerileri (Kaliteyi artırmak için 3 somut öneri)
      
      Veriler (${dateFilter === '7days' ? 'Son 7 Gün' : dateFilter === '30days' ? 'Son 30 Gün' : 'Bu Ay'}):
      - Toplam Yorum Sayısı: ${kpis.count}
      - Ortalama Memnuniyet: %${kpis.avgScore}
      - En Başarılı Departman: ${kpis.bestDept}
      - En Çok Şikayet Alan Departman: ${kpis.worstDept}
      
      Departman Performansları:
      ${JSON.stringify(departmentPerformance, null, 2)}
      
      Öne Çıkan Konular (Etiketler):
      ${JSON.stringify(tagCloud.slice(0, 10), null, 2)}
      
      Kritik Alarmlar:
      ${JSON.stringify(criticalAlarms.map(a => ({ konular: a.topics, skor: a.score, metin: a.rawText })), null, 2)}
      `;

      const report = await generateAIContent(prompt, 'Yönetim Faaliyet Raporu Üretimi', 'dashboardReport');
      setGeneratedReport(report.replace(/\*\*/g, '')); // Ekstra güvenlik için yıldızları temizle
      
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

  const openSavedReport = (report: any) => {
    setGeneratedReport(report.reportContent);
    setEditingReportId(report.id);
    setEditingReportType(report.type || 'dashboard_summary');
    setIsSavedReportsModalOpen(false);
    setIsReportModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">İş Zekası & Analitik</h1>
          <p className="text-slate-500 mt-1">Yapay zeka destekli derin yorum analizi ve içgörüler</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <button
              onClick={() => setDateFilter('7days')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${dateFilter === '7days' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Son 7 Gün
            </button>
            <button
              onClick={() => setDateFilter('30days')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${dateFilter === '30days' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Son 30 Gün
            </button>
            <button
              onClick={() => setDateFilter('thisMonth')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${dateFilter === 'thisMonth' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Bu Ay
            </button>
          </div>
          
          <button
            onClick={() => setIsSavedReportsModalOpen(true)}
            className="px-4 py-2.5 bg-white text-slate-700 font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Clock size={18} />
            Geçmiş Raporlar
          </button>
          <button
            onClick={handleGenerateDashboardReport}
            disabled={isGeneratingReport || filteredAnalytics.length === 0}
            className="px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <FileText size={18} />
            Yönetim Raporu Üret (AI)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-xl">
              <TrendingUp className="text-indigo-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Ortalama Memnuniyet</p>
              <h3 className="text-2xl font-bold text-slate-900">%{kpis.avgScore}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-xl">
              <MessageSquare className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Analiz Edilen Yorum</p>
              <h3 className="text-2xl font-bold text-slate-900">{kpis.count}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-xl">
              <Award className="text-emerald-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">En Başarılı Departman</p>
              <h3 className="text-lg font-bold text-slate-900 truncate max-w-[150px]" title={kpis.bestDept}>{kpis.bestDept}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-xl">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">En Çok Şikayet Alan</p>
              <h3 className="text-lg font-bold text-slate-900 truncate max-w-[150px]" title={kpis.worstDept}>{kpis.worstDept}</h3>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Department Performance */}
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <BarChart3 className="text-slate-400" size={20} />
            Departman Performansı
          </h3>
          <div className="space-y-5">
            {departmentPerformance.map((dept, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-700">{dept.department}</span>
                  <span className="font-bold text-slate-900">%{dept.score}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full ${
                      dept.score > 70 ? 'bg-emerald-500' : 
                      dept.score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${dept.score}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {departmentPerformance.length === 0 && (
              <div className="text-center text-slate-500 py-4 text-sm">Veri bulunamadı</div>
            )}
          </div>
        </div>

        {/* Tag Cloud */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <MessageSquare className="text-slate-400" size={20} />
            Gelişmiş Etiket Bulutu
          </h3>
          <div className="flex flex-wrap gap-3 items-center justify-center p-4 min-h-[300px]">
            {tagCloud.map((tag, idx) => {
              // Calculate font size based on count (min 12px, max 32px)
              const maxCount = Math.max(...tagCloud.map(t => t.count));
              const minCount = Math.min(...tagCloud.map(t => t.count));
              const fontSize = minCount === maxCount 
                ? 16 
                : 12 + ((tag.count - minCount) / (maxCount - minCount)) * 20;

              return (
                <span 
                  key={idx}
                  className={`inline-block transition-transform hover:scale-110 cursor-default px-2 py-1 rounded-lg ${
                    tag.avgScore > 70 ? 'text-emerald-600 bg-emerald-50/50' : 
                    tag.avgScore >= 40 ? 'text-amber-600 bg-amber-50/50' : 'text-red-600 bg-red-50/50'
                  }`}
                  style={{ fontSize: `${fontSize}px`, fontWeight: tag.count > maxCount * 0.7 ? 700 : 500 }}
                  title={`${tag.count} bahsetme, Ortalama Skor: %${tag.avgScore}`}
                >
                  #{tag.topic}
                </span>
              );
            })}
            {tagCloud.length === 0 && (
              <div className="text-slate-500 text-sm">Analiz edilmiş etiket bulunamadı</div>
            )}
          </div>
        </div>
      </div>

      {/* Critical Alarms */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <AlertCircle className="text-red-500" size={20} />
          Dikkat Gerektirenler (Skor &lt; %30)
        </h3>
        <div className="space-y-4">
          {criticalAlarms.map((alarm, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-red-100 bg-red-50/30 hover:bg-red-50/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-wrap gap-2">
                  {alarm.topics.map((topic, tidx) => (
                    <span key={tidx} className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-md">
                      {topic}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <CalendarIcon size={12} />
                  {new Date(alarm.date).toLocaleDateString('tr-TR')}
                </span>
              </div>
              <p className="text-slate-700 text-sm line-clamp-2 mt-2">{alarm.rawText}</p>
            </div>
          ))}
          {criticalAlarms.length === 0 && (
            <div className="text-center text-slate-500 py-8 text-sm bg-slate-50 rounded-xl border border-slate-100 border-dashed">
              Harika! Kritik seviyede şikayet bulunmuyor.
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                {editingReportType === 'dashboard_summary' ? 'Yönetim Faaliyet Raporu' : 'Toplu Vaka Çözüm Raporu'}
              </h3>
              <button 
                onClick={() => setIsReportModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                disabled={isGeneratingReport}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  <p className="text-slate-600 font-medium animate-pulse">Yapay Zeka Raporu Hazırlıyor...</p>
                  <p className="text-slate-400 text-sm">Tüm departman verileri ve yorumlar analiz ediliyor.</p>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-3xl mx-auto">
                  {/* Antetli Kağıt Görünümü */}
                  <div className="border-b-2 border-slate-800 pb-6 mb-8 text-center">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase">
                      {editingReportType === 'dashboard_summary' ? 'Yönetim Faaliyet Raporu' : 'Toplu Vaka Çözüm Raporu'}
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                      {editingReportType === 'dashboard_summary' 
                        ? `${dateFilter === '7days' ? 'Haftalık' : dateFilter === '30days' ? 'Aylık' : 'Dönemsel'} Performans Özeti`
                        : 'Toplu Vaka Çözüm ve Aksiyon Özeti'}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">{new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  
                  <div className="mt-6">
                    <ReactQuill 
                      theme="snow" 
                      value={generatedReport} 
                      onChange={setGeneratedReport}
                      className="bg-white"
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, 4, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                          ['clean']
                        ]
                      }}
                    />
                  </div>
                  
                  <div className="mt-12 pt-6 border-t border-slate-200 flex justify-between items-center text-sm text-slate-500">
                    <div>
                      <span className="font-medium text-slate-700">Raporlayan:</span> Yapay Zeka Asistanı
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Veri Seti:</span> {kpis.count} Yorum
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsReportModalOpen(false)}
                className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
                disabled={isGeneratingReport}
              >
                Kapat
              </button>
              {!isGeneratingReport && generatedReport && (
                <>
                  <button
                    onClick={handleSaveReport}
                    disabled={isSavingReport}
                    className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <Save size={18} />
                    {isSavingReport ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedReport.replace(/<[^>]*>?/gm, ''));
                      alert("Rapor metni panoya kopyalandı.");
                    }}
                    className="px-6 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <FileText size={18} />
                    Kopyala
                  </button>
                  <button
                    onClick={() => {
                      alert("PDF indirme özelliği yakında eklenecektir.");
                    }}
                    className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Download size={18} />
                    PDF İndir
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Saved Reports Modal */}
      {isSavedReportsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Clock size={20} className="text-indigo-600" />
                Geçmiş Yönetim Raporları
              </h3>
              <button 
                onClick={() => setIsSavedReportsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
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
                        <p className="text-sm text-slate-500 mt-1">
                          Oluşturulma: {new Date(report.createdAt).toLocaleString('tr-TR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openSavedReport(report)}
                          className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                          title="Görüntüle / Düzenle"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                          title="Sil"
                        >
                          <Trash2 size={18} />
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
