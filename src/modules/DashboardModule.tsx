import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CommentAnalytics } from '../types';
import { BarChart3, TrendingUp, AlertCircle, MessageSquare, Calendar as CalendarIcon, Award, AlertTriangle } from 'lucide-react';

export function DashboardModule() {
  const [analytics, setAnalytics] = useState<CommentAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'7days' | '30days' | 'thisMonth'>('30days');

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
    </div>
  );
}
