import { CommentAnalytics } from '../types';
import { normalizeNationality } from './nationality';

export interface MostMentionedTopic {
  mainCategory: string;
  subCategory: string;
  count: number;
  avgScore: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  positiveRate: number;
  prevScore?: number;
  prevCount?: number;
  scoreDelta?: number;
  countDelta?: number;
  growthRate?: number;
}

export interface TopPositiveTopic {
  mainCategory: string;
  subCategory: string;
  count: number; // Övgü Yorum Sayısı (Positive count)
  avgScore: number; // Övgü Memnuniyet Skoru (Positive avg score)
  totalCount: number; // Toplam Yorum Sayısı (All mentions)
  overallScore: number; // Konunun Tüm Yorumlardaki Genel Skoru
  negativeCount: number; // Varsa şikayet sayısı
  weightedScore: number;
  prevScore?: number; // Önceki dönem övgü skoru
  prevCount?: number; // Önceki dönem övgü adedi
  scoreDelta?: number;
  countDelta?: number;
  growthRate?: number;
}

export interface TopNegativeTopic {
  mainCategory: string;
  subCategory: string;
  count: number; // Şikayet Yorum Sayısı (Negative count)
  avgScore: number; // Şikayet Memnuniyet Skoru (Negative avg score)
  totalCount: number; // Toplam Yorum Sayısı (All mentions)
  overallScore: number; // Konunun Tüm Yorumlardaki Genel Skoru
  positiveCount: number; // Varsa övgü sayısı
  weightedScore: number;
  prevScore?: number; // Önceki dönem şikayet skoru
  prevCount?: number; // Önceki dönem şikayet adedi
  scoreDelta?: number;
  countDelta?: number;
  growthRate?: number;
}

export interface SourceAnalysis {
  name: string;
  count: number;
  avgScore: number;
  prevScore?: number;
  prevCount?: number;
  scoreDelta?: number;
  countDelta?: number;
  growthRate?: number;
}

export interface NationalityAnalysis {
  name: string;
  count: number;
  avgScore: number;
  prevScore?: number;
  prevCount?: number;
  scoreDelta?: number;
  countDelta?: number;
  growthRate?: number;
}

export interface CategoryPerformance {
  name: string;
  score: number;
  count: number;
  prevScore?: number;
  prevCount?: number;
  scoreDelta?: number;
  countDelta?: number;
  growthRate?: number;
}

export interface SatisfactionOverTime {
  date: string;
  avgScore: number;
  count: number;
  prevDate?: string;
  prevAvgScore?: number;
  prevCount?: number;
  scoreDelta?: number;
  countDelta?: number;
  growthRate?: number;
}

export interface DashboardData {
  kpis: {
    avgScore: number;
    totalComments: number;
    bestCategory: string;
    worstCategory: string;
    scoreChange?: number;
    commentChange?: number;
    prevAvgScore?: number;
    prevTotalComments?: number;
    prevBestCategory?: string;
    prevWorstCategory?: string;
    scorePointDelta?: number;
    commentCountDelta?: number;
  };
  categoryPerformance: CategoryPerformance[];
  mostMentioned: MostMentionedTopic[];
  topPositive: TopPositiveTopic[];
  topNegative: TopNegativeTopic[];
  sourceAnalysis: SourceAnalysis[];
  nationalityAnalysis: NationalityAnalysis[];
  satisfactionOverTime: {
    daily: SatisfactionOverTime[];
    weekly: SatisfactionOverTime[];
    monthly: SatisfactionOverTime[];
    yearly: SatisfactionOverTime[];
  };
}

export const calculateMostMentioned = (analytics: CommentAnalytics[]): MostMentionedTopic[] => {
  const topicMap = new Map<string, { 
    count: number; 
    totalScore: number; 
    posCount: number;
    negCount: number;
    neuCount: number;
    mainCategory: string; 
    subCategory: string; 
  }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      const key = `${topic.mainCategory}|${topic.subCategory}`;
      if (!topicMap.has(key)) {
        topicMap.set(key, { 
          count: 0, 
          totalScore: 0, 
          posCount: 0,
          negCount: 0,
          neuCount: 0,
          mainCategory: topic.mainCategory, 
          subCategory: topic.subCategory 
        });
      }
      const data = topicMap.get(key)!;
      data.count += 1;
      data.totalScore += topic.score;
      if (topic.sentiment === 'positive' || topic.score >= 70) {
        data.posCount += 1;
      } else if (topic.sentiment === 'negative' || topic.score < 40) {
        data.negCount += 1;
      } else {
        data.neuCount += 1;
      }
    });
  });

  return Array.from(topicMap.values())
    .map(data => ({
      mainCategory: data.mainCategory,
      subCategory: data.subCategory,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count),
      positiveCount: data.posCount,
      negativeCount: data.negCount,
      neutralCount: data.neuCount,
      positiveRate: data.count > 0 ? Math.round((data.posCount / data.count) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);
};

export const calculateTopPositive = (analytics: CommentAnalytics[]): TopPositiveTopic[] => {
  const topicMap = new Map<string, { 
    posCount: number; 
    posScore: number; 
    totalCount: number;
    totalScore: number;
    negCount: number;
    mainCategory: string; 
    subCategory: string; 
  }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      const key = `${topic.mainCategory}|${topic.subCategory}`;
      if (!topicMap.has(key)) {
        topicMap.set(key, { 
          posCount: 0, 
          posScore: 0, 
          totalCount: 0,
          totalScore: 0,
          negCount: 0,
          mainCategory: topic.mainCategory, 
          subCategory: topic.subCategory 
        });
      }
      const data = topicMap.get(key)!;
      data.totalCount += 1;
      data.totalScore += topic.score;
      if (topic.sentiment === 'positive' || topic.score >= 70) {
        data.posCount += 1;
        data.posScore += topic.score;
      } else if (topic.sentiment === 'negative' || topic.score < 40) {
        data.negCount += 1;
      }
    });
  });

  return Array.from(topicMap.values())
    .filter(data => data.posCount > 0)
    .map(data => {
      const avgScore = Math.round(data.posScore / data.posCount);
      const overallScore = Math.round(data.totalScore / data.totalCount);
      return {
        mainCategory: data.mainCategory,
        subCategory: data.subCategory,
        count: data.posCount,
        avgScore,
        totalCount: data.totalCount,
        overallScore,
        negativeCount: data.negCount,
        weightedScore: avgScore * Math.log10(data.posCount + 1)
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
};

export const calculateTopNegative = (analytics: CommentAnalytics[]): TopNegativeTopic[] => {
  const topicMap = new Map<string, { 
    negCount: number; 
    negScore: number; 
    totalCount: number;
    totalScore: number;
    posCount: number;
    mainCategory: string; 
    subCategory: string; 
  }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      const key = `${topic.mainCategory}|${topic.subCategory}`;
      if (!topicMap.has(key)) {
        topicMap.set(key, { 
          negCount: 0, 
          negScore: 0, 
          totalCount: 0,
          totalScore: 0,
          posCount: 0,
          mainCategory: topic.mainCategory, 
          subCategory: topic.subCategory 
        });
      }
      const data = topicMap.get(key)!;
      data.totalCount += 1;
      data.totalScore += topic.score;
      if (topic.sentiment === 'negative' || topic.score < 40) {
        data.negCount += 1;
        data.negScore += topic.score;
      } else if (topic.sentiment === 'positive' || topic.score >= 70) {
        data.posCount += 1;
      }
    });
  });

  return Array.from(topicMap.values())
    .filter(data => data.negCount > 0)
    .map(data => {
      const avgScore = Math.round(data.negScore / data.negCount);
      const overallScore = Math.round(data.totalScore / data.totalCount);
      return {
        mainCategory: data.mainCategory,
        subCategory: data.subCategory,
        count: data.negCount,
        avgScore,
        totalCount: data.totalCount,
        overallScore,
        positiveCount: data.posCount,
        // Criticality: High mention count + Low score = High weighted score
        weightedScore: (100 - avgScore) * Math.log10(data.negCount + 1)
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
};

export const calculateSourceAnalysis = (analytics: CommentAnalytics[]): SourceAnalysis[] => {
  const sourceMap = new Map<string, { count: number; totalScore: number }>();

  analytics.forEach(item => {
    const source = item.source || 'Bilinmiyor';
    if (!sourceMap.has(source)) {
      sourceMap.set(source, { count: 0, totalScore: 0 });
    }
    const data = sourceMap.get(source)!;
    data.count += 1;
    data.totalScore += item.overallScore;
  });

  return Array.from(sourceMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    avgScore: Math.round(data.totalScore / data.count)
  })).sort((a, b) => b.count - a.count);
};

export const calculateNationalityAnalysis = (analytics: CommentAnalytics[]): NationalityAnalysis[] => {
  const natMap = new Map<string, { count: number; totalScore: number }>();

  analytics.forEach(item => {
    const nat = normalizeNationality(item.nationality);
    if (!natMap.has(nat)) {
      natMap.set(nat, { count: 0, totalScore: 0 });
    }
    const data = natMap.get(nat)!;
    data.count += 1;
    data.totalScore += item.overallScore;
  });

  return Array.from(natMap.entries()).map(([name, data]) => ({
    name,
    count: data.count,
    avgScore: Math.round(data.totalScore / data.count)
  })).sort((a, b) => b.count - a.count);
};

export const calculateCategoryPerformance = (analytics: CommentAnalytics[]): CategoryPerformance[] => {
  const catMap = new Map<string, { count: number; totalScore: number }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      if (!catMap.has(topic.mainCategory)) {
        catMap.set(topic.mainCategory, { count: 0, totalScore: 0 });
      }
      const data = catMap.get(topic.mainCategory)!;
      data.count += 1;
      data.totalScore += topic.score;
    });
  });

  return Array.from(catMap.entries()).map(([name, data]) => ({
    name,
    score: Math.round(data.totalScore / data.count),
    count: data.count
  })).sort((a, b) => b.score - a.score);
};

export const getWeekNumber = (d: Date) => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const calculateSatisfactionOverTime = (analytics: CommentAnalytics[], previousAnalytics?: CommentAnalytics[]) => {
  const process = (groupBy: (d: Date) => { key: string; display: string; timestamp: number }, dataset: CommentAnalytics[]) => {
    const map = new Map<string, { totalScore: number; count: number; display: string; timestamp: number }>();
    dataset.forEach(item => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;
      const { key, display, timestamp } = groupBy(d);
      if (!map.has(key)) map.set(key, { totalScore: 0, count: 0, display, timestamp });
      const data = map.get(key)!;
      data.totalScore += item.overallScore;
      data.count += 1;
    });

    return Array.from(map.values())
      .map(data => ({
        date: data.display,
        avgScore: Math.round(data.totalScore / data.count),
        count: data.count,
        timestamp: data.timestamp
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  };

  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

  const mergeTimeline = (
    currentList: { date: string; avgScore: number; count: number; timestamp: number }[],
    prevList: { date: string; avgScore: number; count: number; timestamp: number }[]
  ): SatisfactionOverTime[] => {
    if (!previousAnalytics || prevList.length === 0) {
      return currentList.map(({ timestamp, ...rest }) => rest);
    }

    return currentList.map((item, idx) => {
      const prevItem = prevList[idx];
      const prevAvgScore = prevItem ? prevItem.avgScore : undefined;
      const prevCount = prevItem ? prevItem.count : undefined;
      const prevDate = prevItem ? prevItem.date : undefined;
      const scoreDelta = prevAvgScore !== undefined ? (item.avgScore - prevAvgScore) : undefined;
      const countDelta = prevCount !== undefined ? (item.count - prevCount) : undefined;
      const growthRate = (prevCount && prevCount > 0)
        ? Math.round(((item.count - prevCount) / prevCount) * 100)
        : (item.count > 0 ? 100 : 0);

      return {
        date: item.date,
        avgScore: item.avgScore,
        count: item.count,
        prevDate,
        prevAvgScore,
        prevCount,
        scoreDelta,
        countDelta,
        growthRate
      };
    });
  };

  const groupByDaily = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return {
      key: `${yyyy}-${mm}-${dd}`,
      display: `${dd}.${mm}.${yyyy}`,
      timestamp: new Date(yyyy, d.getMonth(), d.getDate()).getTime()
    };
  };

  const groupByWeekly = (d: Date) => {
    const weekNumber = getWeekNumber(d);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    startOfWeek.setHours(0, 0, 0, 0);
    return {
      key: `${startOfWeek.getFullYear()}-W${weekNumber}`,
      display: `${weekNumber}. Hafta`,
      timestamp: startOfWeek.getTime()
    };
  };

  const groupByMonthly = (d: Date) => {
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      display: `${months[d.getMonth()]} ${d.getFullYear()}`,
      timestamp: new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    };
  };

  const groupByYearly = (d: Date) => {
    return {
      key: `${d.getFullYear()}`,
      display: `${d.getFullYear()}`,
      timestamp: new Date(d.getFullYear(), 0, 1).getTime()
    };
  };

  return {
    daily: mergeTimeline(process(groupByDaily, analytics), previousAnalytics ? process(groupByDaily, previousAnalytics) : []),
    weekly: mergeTimeline(process(groupByWeekly, analytics), previousAnalytics ? process(groupByWeekly, previousAnalytics) : []),
    monthly: mergeTimeline(process(groupByMonthly, analytics), previousAnalytics ? process(groupByMonthly, previousAnalytics) : []),
    yearly: mergeTimeline(process(groupByYearly, analytics), previousAnalytics ? process(groupByYearly, previousAnalytics) : [])
  };
};

export const getDashboardData = (analytics: CommentAnalytics[], previousAnalytics?: CommentAnalytics[]): DashboardData => {
  if (analytics.length === 0) {
    return {
      kpis: { avgScore: 0, totalComments: 0, bestCategory: '-', worstCategory: '-' },
      categoryPerformance: [],
      mostMentioned: [],
      topPositive: [],
      topNegative: [],
      sourceAnalysis: [],
      nationalityAnalysis: [],
      satisfactionOverTime: { daily: [], weekly: [], monthly: [], yearly: [] }
    };
  }

  const avgScore = Math.round(analytics.reduce((sum, item) => sum + item.overallScore, 0) / analytics.length);
  const categoryPerf = calculateCategoryPerformance(analytics);
  const mostMentioned = calculateMostMentioned(analytics);
  const topPositive = calculateTopPositive(analytics);
  const topNegative = calculateTopNegative(analytics);
  const sourceAnalysis = calculateSourceAnalysis(analytics);
  const nationalityAnalysis = calculateNationalityAnalysis(analytics);
  
  let scoreChange: number | undefined = undefined;
  let commentChange: number | undefined = undefined;
  let prevAvgScoreVal: number | undefined = undefined;
  let prevTotalCommentsVal: number | undefined = undefined;
  let prevBestCatVal: string | undefined = undefined;
  let prevWorstCatVal: string | undefined = undefined;
  let scorePointDeltaVal: number | undefined = undefined;
  let commentCountDeltaVal: number | undefined = undefined;

  if (previousAnalytics && previousAnalytics.length > 0) {
    const prevAvgScore = Math.round(previousAnalytics.reduce((sum, item) => sum + item.overallScore, 0) / previousAnalytics.length);
    prevAvgScoreVal = prevAvgScore;
    scorePointDeltaVal = avgScore - prevAvgScore;
    if (prevAvgScore > 0) {
      scoreChange = Math.round(((avgScore - prevAvgScore) / prevAvgScore) * 100 * 10) / 10;
    } else {
      scoreChange = avgScore > 0 ? 100 : 0;
    }
    
    const prevTotalComments = previousAnalytics.length;
    prevTotalCommentsVal = prevTotalComments;
    commentCountDeltaVal = analytics.length - prevTotalComments;
    if (prevTotalComments > 0) {
      commentChange = Math.round(((analytics.length - prevTotalComments) / prevTotalComments) * 100 * 10) / 10;
    } else {
      commentChange = analytics.length > 0 ? 100 : 0;
    }

    const prevCategoryPerf = calculateCategoryPerformance(previousAnalytics);
    if (prevCategoryPerf.length > 0) {
      prevBestCatVal = prevCategoryPerf[0]?.name || '-';
      prevWorstCatVal = prevCategoryPerf[prevCategoryPerf.length - 1]?.name || '-';
    }
    categoryPerf.forEach(cat => {
      const prevCat = prevCategoryPerf.find(p => p.name === cat.name);
      if (prevCat) {
        cat.prevScore = prevCat.score;
        cat.prevCount = prevCat.count;
        cat.scoreDelta = cat.score - prevCat.score;
        cat.countDelta = cat.count - prevCat.count;
      } else {
        cat.prevScore = 0;
        cat.prevCount = 0;
        cat.scoreDelta = cat.score;
        cat.countDelta = cat.count;
      }
    });

    const prevMostMentioned = calculateMostMentioned(previousAnalytics);
    mostMentioned.forEach(topic => {
      const prevTopic = prevMostMentioned.find(p => p.mainCategory === topic.mainCategory && p.subCategory === topic.subCategory);
      if (prevTopic) {
        topic.prevScore = prevTopic.avgScore;
        topic.prevCount = prevTopic.count;
        topic.scoreDelta = topic.avgScore - prevTopic.avgScore;
        topic.countDelta = topic.count - prevTopic.count;
        topic.growthRate = prevTopic.count > 0 ? Math.round(((topic.count - prevTopic.count) / prevTopic.count) * 100) : 100;
      } else {
        topic.prevScore = 0;
        topic.prevCount = 0;
        topic.scoreDelta = topic.avgScore;
        topic.countDelta = topic.count;
        topic.growthRate = 100;
      }
    });

    const prevTopPositive = calculateTopPositive(previousAnalytics);
    topPositive.forEach(topic => {
      const prevTopic = prevTopPositive.find(p => p.mainCategory === topic.mainCategory && p.subCategory === topic.subCategory);
      if (prevTopic) {
        topic.prevScore = prevTopic.avgScore;
        topic.prevCount = prevTopic.count;
        topic.scoreDelta = topic.avgScore - prevTopic.avgScore;
        topic.countDelta = topic.count - prevTopic.count;
        topic.growthRate = prevTopic.count > 0 ? Math.round(((topic.count - prevTopic.count) / prevTopic.count) * 100) : 100;
      } else {
        topic.prevScore = 0;
        topic.prevCount = 0;
        topic.scoreDelta = topic.avgScore;
        topic.countDelta = topic.count;
        topic.growthRate = 100;
      }
    });

    const prevTopNegative = calculateTopNegative(previousAnalytics);
    topNegative.forEach(topic => {
      const prevTopic = prevTopNegative.find(p => p.mainCategory === topic.mainCategory && p.subCategory === topic.subCategory);
      if (prevTopic) {
        topic.prevScore = prevTopic.avgScore;
        topic.prevCount = prevTopic.count;
        topic.scoreDelta = topic.avgScore - prevTopic.avgScore;
        topic.countDelta = topic.count - prevTopic.count;
        topic.growthRate = prevTopic.count > 0 ? Math.round(((topic.count - prevTopic.count) / prevTopic.count) * 100) : 100;
      } else {
        topic.prevScore = 0;
        topic.prevCount = 0;
        topic.scoreDelta = topic.avgScore;
        topic.countDelta = topic.count;
        topic.growthRate = 100;
      }
    });

    const prevSourceAnalysis = calculateSourceAnalysis(previousAnalytics);
    sourceAnalysis.forEach(source => {
      const prevSource = prevSourceAnalysis.find(p => p.name === source.name);
      if (prevSource) {
        source.prevScore = prevSource.avgScore;
        source.prevCount = prevSource.count;
        source.scoreDelta = source.avgScore - prevSource.avgScore;
        source.countDelta = source.count - prevSource.count;
        source.growthRate = prevSource.count > 0 ? Math.round(((source.count - prevSource.count) / prevSource.count) * 100) : 100;
      } else {
        source.prevScore = 0;
        source.prevCount = 0;
        source.scoreDelta = source.avgScore;
        source.countDelta = source.count;
        source.growthRate = 100;
      }
    });

    const prevNationalityAnalysis = calculateNationalityAnalysis(previousAnalytics);
    nationalityAnalysis.forEach(nat => {
      const prevNat = prevNationalityAnalysis.find(p => p.name === nat.name);
      if (prevNat) {
        nat.prevScore = prevNat.avgScore;
        nat.prevCount = prevNat.count;
        nat.scoreDelta = nat.avgScore - prevNat.avgScore;
        nat.countDelta = nat.count - prevNat.count;
        nat.growthRate = prevNat.count > 0 ? Math.round(((nat.count - prevNat.count) / prevNat.count) * 100) : 100;
      } else {
        nat.prevScore = 0;
        nat.prevCount = 0;
        nat.scoreDelta = nat.avgScore;
        nat.countDelta = nat.count;
        nat.growthRate = 100;
      }
    });
  } else if (previousAnalytics && previousAnalytics.length === 0) {
    scoreChange = avgScore > 0 ? 100 : 0;
    commentChange = analytics.length > 0 ? 100 : 0;
    categoryPerf.forEach(cat => {
      cat.prevScore = 0;
      cat.prevCount = 0;
      cat.scoreDelta = cat.score;
      cat.countDelta = cat.count;
      cat.growthRate = 100;
    });
    mostMentioned.forEach(topic => {
      topic.prevScore = 0;
      topic.prevCount = 0;
      topic.scoreDelta = topic.avgScore;
      topic.countDelta = topic.count;
      topic.growthRate = 100;
    });
    topPositive.forEach(topic => {
      topic.prevScore = 0;
      topic.prevCount = 0;
      topic.scoreDelta = topic.avgScore;
      topic.countDelta = topic.count;
      topic.growthRate = 100;
    });
    topNegative.forEach(topic => {
      topic.prevScore = 0;
      topic.prevCount = 0;
      topic.scoreDelta = topic.avgScore;
      topic.countDelta = topic.count;
      topic.growthRate = 100;
    });
    sourceAnalysis.forEach(source => {
      source.prevScore = 0;
      source.prevCount = 0;
      source.scoreDelta = source.avgScore;
      source.countDelta = source.count;
      source.growthRate = 100;
    });
    nationalityAnalysis.forEach(nat => {
      nat.prevScore = 0;
      nat.prevCount = 0;
      nat.scoreDelta = nat.avgScore;
      nat.countDelta = nat.count;
      nat.growthRate = 100;
    });
  }

  return {
    kpis: {
      avgScore,
      totalComments: analytics.length,
      bestCategory: categoryPerf[0]?.name || '-',
      worstCategory: categoryPerf[categoryPerf.length - 1]?.name || '-',
      scoreChange,
      commentChange,
      prevAvgScore: prevAvgScoreVal,
      prevTotalComments: prevTotalCommentsVal,
      prevBestCategory: prevBestCatVal,
      prevWorstCategory: prevWorstCatVal,
      scorePointDelta: scorePointDeltaVal,
      commentCountDelta: commentCountDeltaVal
    },
    categoryPerformance: categoryPerf,
    mostMentioned,
    topPositive,
    topNegative,
    sourceAnalysis,
    nationalityAnalysis,
    satisfactionOverTime: calculateSatisfactionOverTime(analytics, previousAnalytics)
  };
};
