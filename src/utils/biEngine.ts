import { CommentAnalytics } from '../types';

export interface MostMentionedTopic {
  department: string;
  mainTopic: string;
  subTopic: string;
  count: number;
  avgScore: number;
}

export interface TopPositiveTopic {
  department: string;
  mainTopic: string;
  subTopic: string;
  count: number;
  avgScore: number;
  weightedScore: number;
}

export interface TopNegativeTopic {
  department: string;
  mainTopic: string;
  subTopic: string;
  count: number;
  avgScore: number;
}

export const calculateMostMentioned = (analytics: CommentAnalytics[]): MostMentionedTopic[] => {
  const topicMap = new Map<string, { count: number; totalScore: number; department: string; mainTopic: string; subTopic: string }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      const key = `${topic.department}|${topic.mainTopic}|${topic.subTopic}`;
      if (!topicMap.has(key)) {
        topicMap.set(key, { count: 0, totalScore: 0, department: topic.department, mainTopic: topic.mainTopic, subTopic: topic.subTopic });
      }
      const data = topicMap.get(key)!;
      data.count += 1;
      data.totalScore += topic.score;
    });
  });

  return Array.from(topicMap.values())
    .map(data => ({
      department: data.department,
      mainTopic: data.mainTopic,
      subTopic: data.subTopic,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count)
    }))
    .sort((a, b) => b.count - a.count);
};

export const calculateTopPositive = (analytics: CommentAnalytics[]): TopPositiveTopic[] => {
  const topicMap = new Map<string, { count: number; totalScore: number; department: string; mainTopic: string; subTopic: string }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      if (topic.sentiment === 'positive' || topic.score >= 70) {
        const key = `${topic.department}|${topic.mainTopic}|${topic.subTopic}`;
        if (!topicMap.has(key)) {
          topicMap.set(key, { count: 0, totalScore: 0, department: topic.department, mainTopic: topic.mainTopic, subTopic: topic.subTopic });
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
        department: data.department,
        mainTopic: data.mainTopic,
        subTopic: data.subTopic,
        count: data.count,
        avgScore,
        weightedScore: avgScore * Math.log10(data.count + 1) // Simple weighting
      };
    })
    .sort((a, b) => b.weightedScore - a.weightedScore);
};

export const calculateTopNegative = (analytics: CommentAnalytics[]): TopNegativeTopic[] => {
  const topicMap = new Map<string, { count: number; totalScore: number; department: string; mainTopic: string; subTopic: string }>();

  analytics.forEach(item => {
    item.topics?.forEach(topic => {
      if (topic.sentiment === 'negative' || topic.score < 40) {
        const key = `${topic.department}|${topic.mainTopic}|${topic.subTopic}`;
        if (!topicMap.has(key)) {
          topicMap.set(key, { count: 0, totalScore: 0, department: topic.department, mainTopic: topic.mainTopic, subTopic: topic.subTopic });
        }
        const data = topicMap.get(key)!;
        data.count += 1;
        data.totalScore += topic.score;
      }
    });
  });

  return Array.from(topicMap.values())
    .map(data => ({
      department: data.department,
      mainTopic: data.mainTopic,
      subTopic: data.subTopic,
      count: data.count,
      avgScore: Math.round(data.totalScore / data.count)
    }))
    .sort((a, b) => a.avgScore - b.avgScore); // Lowest score first
};
