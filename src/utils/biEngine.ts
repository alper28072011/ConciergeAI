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
        weightedScore: avgScore * Math.log10(data.count + 1) // Simple weighting
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
    .sort((a, b) => a.avgScore - b.avgScore); // Lowest score first
};
