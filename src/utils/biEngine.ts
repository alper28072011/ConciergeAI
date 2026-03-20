import { CommentAnalytics } from '../types';

export interface MostMentionedTopic {
  mainCategory: string;
  subCategory: string;
  count: number;
  avgScore: number;
  prevScore?: number;
  prevCount?: number;
}

export interface TopPositiveTopic {
  mainCategory: string;
  subCategory: string;
  count: number;
  avgScore: number;
  weightedScore: number;
  prevScore?: number;
  prevCount?: number;
}

export interface TopNegativeTopic {
  mainCategory: string;
  subCategory: string;
  count: number;
  avgScore: number;
  weightedScore: number;
  prevScore?: number;
  prevCount?: number;
}

export interface SourceAnalysis {
  name: string;
  count: number;
  avgScore: number;
  prevScore?: number;
  prevCount?: number;
}

export interface NationalityAnalysis {
  name: string;
  count: number;
  avgScore: number;
  prevScore?: number;
  prevCount?: number;
}

export interface CategoryPerformance {
  name: string;
  score: number;
  count: number;
  prevScore?: number;
  prevCount?: number;
}

export interface SatisfactionOverTime {
  date: string;
  avgScore: number;
  count: number;
}

export interface DashboardData {
  kpis: {
    avgScore: number;
    totalComments: number;
    bestCategory: string;
    worstCategory: string;
    scoreChange?: number;
    commentChange?: number;
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
  const topicMap = new Map<string, { count: number; totalScore: number; mainCategory: string; subCategory: string }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      const key = `${topic.mainCategory}|${topic.subCategory}`;
      if (!topicMap.has(key)) {
        topicMap.set(key, { count: 0, totalScore: 0, mainCategory: topic.mainCategory, subCategory: topic.subCategory });
      }
      const data = topicMap.get(key)!;
      data.count += 1;
      data.totalScore += topic.score;
    });
  });

  return Array.from(topicMap.values())
    .map(data => ({
      mainCategory: data.mainCategory,
      subCategory: data.subCategory,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count)
    }))
    .sort((a, b) => b.count - a.count);
};

export const calculateTopPositive = (analytics: CommentAnalytics[]): TopPositiveTopic[] => {
  const topicMap = new Map<string, { count: number; totalScore: number; mainCategory: string; subCategory: string }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      if (topic.sentiment === 'positive' || topic.score >= 70) {
        const key = `${topic.mainCategory}|${topic.subCategory}`;
        if (!topicMap.has(key)) {
          topicMap.set(key, { count: 0, totalScore: 0, mainCategory: topic.mainCategory, subCategory: topic.subCategory });
        }
        const data = topicMap.get(key)!;
        data.count += 1;
        data.totalScore += topic.score;
      }
    });
  });

  return Array.from(topicMap.values())
    .map(data => {
      const avgScore = Math.round(data.totalScore / data.count);
      return {
        mainCategory: data.mainCategory,
        subCategory: data.subCategory,
        count: data.count,
        avgScore,
        weightedScore: avgScore * Math.log10(data.count + 1)
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
};

export const calculateTopNegative = (analytics: CommentAnalytics[]): TopNegativeTopic[] => {
  const topicMap = new Map<string, { count: number; totalScore: number; mainCategory: string; subCategory: string }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      if (topic.sentiment === 'negative' || topic.score < 40) {
        const key = `${topic.mainCategory}|${topic.subCategory}`;
        if (!topicMap.has(key)) {
          topicMap.set(key, { count: 0, totalScore: 0, mainCategory: topic.mainCategory, subCategory: topic.subCategory });
        }
        const data = topicMap.get(key)!;
        data.count += 1;
        data.totalScore += topic.score;
      }
    });
  });

  return Array.from(topicMap.values())
    .map(data => {
      const avgScore = Math.round(data.totalScore / data.count);
      return {
        mainCategory: data.mainCategory,
        subCategory: data.subCategory,
        count: data.count,
        avgScore,
        // Criticality: High mention count + Low score = High weighted score
        weightedScore: (100 - avgScore) * Math.log10(data.count + 1)
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
    const nat = item.nationality || 'Bilinmiyor';
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

export const calculateSatisfactionOverTime = (analytics: CommentAnalytics[]) => {
  const sortByDate = (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime();

  const process = (groupBy: (d: Date) => string) => {
    const map = new Map<string, { totalScore: number; count: number }>();
    analytics.forEach(item => {
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;
      const key = groupBy(d);
      if (!map.has(key)) map.set(key, { totalScore: 0, count: 0 });
      const data = map.get(key)!;
      data.totalScore += item.overallScore;
      data.count += 1;
    });
    return Array.from(map.entries())
      .map(([date, data]) => ({
        date,
        avgScore: Math.round(data.totalScore / data.count),
        count: data.count
      }))
      .sort(sortByDate);
  };

  return {
    daily: process(d => d.toISOString().split('T')[0]),
    weekly: process(d => {
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      return startOfWeek.toISOString().split('T')[0];
    }),
    monthly: process(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`),
    yearly: process(d => `${d.getFullYear()}`)
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

  if (previousAnalytics && previousAnalytics.length > 0) {
    const prevAvgScore = Math.round(previousAnalytics.reduce((sum, item) => sum + item.overallScore, 0) / previousAnalytics.length);
    if (prevAvgScore > 0) {
      scoreChange = Math.round(((avgScore - prevAvgScore) / prevAvgScore) * 100 * 10) / 10;
    } else {
      scoreChange = avgScore > 0 ? 100 : 0;
    }
    
    const prevTotalComments = previousAnalytics.length;
    if (prevTotalComments > 0) {
      commentChange = Math.round(((analytics.length - prevTotalComments) / prevTotalComments) * 100 * 10) / 10;
    } else {
      commentChange = analytics.length > 0 ? 100 : 0;
    }

    const prevCategoryPerf = calculateCategoryPerformance(previousAnalytics);
    categoryPerf.forEach(cat => {
      const prevCat = prevCategoryPerf.find(p => p.name === cat.name);
      if (prevCat) {
        cat.prevScore = prevCat.score;
        cat.prevCount = prevCat.count;
      } else {
        cat.prevScore = 0;
        cat.prevCount = 0;
      }
    });

    const prevMostMentioned = calculateMostMentioned(previousAnalytics);
    mostMentioned.forEach(topic => {
      const prevTopic = prevMostMentioned.find(p => p.mainCategory === topic.mainCategory && p.subCategory === topic.subCategory);
      if (prevTopic) {
        topic.prevScore = prevTopic.avgScore;
        topic.prevCount = prevTopic.count;
      } else {
        topic.prevScore = 0;
        topic.prevCount = 0;
      }
    });

    const prevTopPositive = calculateTopPositive(previousAnalytics);
    topPositive.forEach(topic => {
      const prevTopic = prevTopPositive.find(p => p.mainCategory === topic.mainCategory && p.subCategory === topic.subCategory);
      if (prevTopic) {
        topic.prevScore = prevTopic.avgScore;
        topic.prevCount = prevTopic.count;
      } else {
        topic.prevScore = 0;
        topic.prevCount = 0;
      }
    });

    const prevTopNegative = calculateTopNegative(previousAnalytics);
    topNegative.forEach(topic => {
      const prevTopic = prevTopNegative.find(p => p.mainCategory === topic.mainCategory && p.subCategory === topic.subCategory);
      if (prevTopic) {
        topic.prevScore = prevTopic.avgScore;
        topic.prevCount = prevTopic.count;
      } else {
        topic.prevScore = 0;
        topic.prevCount = 0;
      }
    });

    const prevSourceAnalysis = calculateSourceAnalysis(previousAnalytics);
    sourceAnalysis.forEach(source => {
      const prevSource = prevSourceAnalysis.find(p => p.name === source.name);
      if (prevSource) {
        source.prevScore = prevSource.avgScore;
        source.prevCount = prevSource.count;
      } else {
        source.prevScore = 0;
        source.prevCount = 0;
      }
    });

    const prevNationalityAnalysis = calculateNationalityAnalysis(previousAnalytics);
    nationalityAnalysis.forEach(nat => {
      const prevNat = prevNationalityAnalysis.find(p => p.name === nat.name);
      if (prevNat) {
        nat.prevScore = prevNat.avgScore;
        nat.prevCount = prevNat.count;
      } else {
        nat.prevScore = 0;
        nat.prevCount = 0;
      }
    });
  } else if (previousAnalytics && previousAnalytics.length === 0) {
    scoreChange = avgScore > 0 ? 100 : 0;
    commentChange = analytics.length > 0 ? 100 : 0;
    categoryPerf.forEach(cat => {
      cat.prevScore = 0;
      cat.prevCount = 0;
    });
    mostMentioned.forEach(topic => {
      topic.prevScore = 0;
      topic.prevCount = 0;
    });
    topPositive.forEach(topic => {
      topic.prevScore = 0;
      topic.prevCount = 0;
    });
    topNegative.forEach(topic => {
      topic.prevScore = 0;
      topic.prevCount = 0;
    });
    sourceAnalysis.forEach(source => {
      source.prevScore = 0;
      source.prevCount = 0;
    });
    nationalityAnalysis.forEach(nat => {
      nat.prevScore = 0;
      nat.prevCount = 0;
    });
  }

  return {
    kpis: {
      avgScore,
      totalComments: analytics.length,
      bestCategory: categoryPerf[0]?.name || '-',
      worstCategory: categoryPerf[categoryPerf.length - 1]?.name || '-',
      scoreChange,
      commentChange
    },
    categoryPerformance: categoryPerf,
    mostMentioned,
    topPositive,
    topNegative,
    sourceAnalysis,
    nationalityAnalysis,
    satisfactionOverTime: calculateSatisfactionOverTime(analytics)
  };
};
