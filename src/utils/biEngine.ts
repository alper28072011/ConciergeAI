import { CommentAnalytics } from '../types';

export interface MostMentionedTopic {
  mainCategory: string;
  subCategory: string;
  count: number;
  avgScore: number;
}

export interface TopPositiveTopic {
  mainCategory: string;
  subCategory: string;
  count: number;
  avgScore: number;
  weightedScore: number;
}

export interface TopNegativeTopic {
  mainCategory: string;
  subCategory: string;
  count: number;
  avgScore: number;
}

export interface SourceAnalysis {
  name: string;
  count: number;
  avgScore: number;
}

export interface NationalityAnalysis {
  name: string;
  count: number;
  avgScore: number;
}

export interface CategoryPerformance {
  name: string;
  score: number;
  count: number;
}

export interface DashboardData {
  kpis: {
    avgScore: number;
    totalComments: number;
    bestCategory: string;
    worstCategory: string;
    scoreChange: number;
    commentChange: number;
  };
  categoryPerformance: CategoryPerformance[];
  mostMentioned: MostMentionedTopic[];
  topPositive: TopPositiveTopic[];
  topNegative: TopNegativeTopic[];
  sourceAnalysis: SourceAnalysis[];
  nationalityAnalysis: NationalityAnalysis[];
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
    .map(data => ({
      mainCategory: data.mainCategory,
      subCategory: data.subCategory,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count)
    }))
    .sort((a, b) => a.avgScore - b.avgScore);
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

export const getDashboardData = (analytics: CommentAnalytics[]): DashboardData => {
  if (analytics.length === 0) {
    return {
      kpis: { avgScore: 0, totalComments: 0, bestCategory: '-', worstCategory: '-', scoreChange: 0, commentChange: 0 },
      categoryPerformance: [],
      mostMentioned: [],
      topPositive: [],
      topNegative: [],
      sourceAnalysis: [],
      nationalityAnalysis: []
    };
  }

  const avgScore = Math.round(analytics.reduce((sum, item) => sum + item.overallScore, 0) / analytics.length);
  const categoryPerf = calculateCategoryPerformance(analytics);
  
  return {
    kpis: {
      avgScore,
      totalComments: analytics.length,
      bestCategory: categoryPerf[0]?.name || '-',
      worstCategory: categoryPerf[categoryPerf.length - 1]?.name || '-',
      scoreChange: 4.2, // Mocked for now
      commentChange: 12.5 // Mocked for now
    },
    categoryPerformance: categoryPerf,
    mostMentioned: calculateMostMentioned(analytics),
    topPositive: calculateTopPositive(analytics),
    topNegative: calculateTopNegative(analytics),
    sourceAnalysis: calculateSourceAnalysis(analytics),
    nationalityAnalysis: calculateNationalityAnalysis(analytics)
  };
};
