export interface TopicAnalysis {
  topic: string;
  department: string;
  score: number;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface CommentAnalytics {
  commentId: string;
  resId: string;
  date: string;
  rawText: string;
  overallScore: number;
  topics: TopicAnalysis[];
  createdAt: string;
}

export interface UnifiedTimelineAction {
  id: string;
  date: string;
  type: 'elektra' | 'ai_letter' | 'template' | 'manual' | 'welcome_call' | 'survey_sent' | 'whatsapp_sent';
  description: string;
  content?: string;
  commentId?: string | number;
  resId?: string | number;
  source?: string;
}

export interface CommentData {
  ID: string;
  HOTELID: string;
  COMMENTDATE: string;
  COMMENT: string;
  ANSWER?: string;
  PHONE?: string;
  EMAIL?: string;
  NATIONALITY?: string;
  ROOMNO?: string;
  GUESTID?: number;
  RESNAMEID_LOOKUP?: string;
  COMMENTSOURCEID_NAME?: string;
  CHECKIN?: string;
  CHECKOUT?: string;
  GDPRCONFIRMED?: boolean;
  EMAILCONFIRMED?: boolean;
  PHONECONFIRMED?: boolean;
  SMSCONFIRMED?: boolean;
  WHATSAPPCONFIRMED?: boolean;
  SCORE?: number;
  details?: {
    depName: string;
    groupName: string;
    type: string;
    detail: string;
  }[];
}

export interface CommentDetailData {
  ID: number;
  HOTELID: number;
  DETAILTYPE: string;
  DEPNAME: string;
  GROUPNAME: string;
  DETAIL: string;
  COMMENTID: number;
  COMMENTDATE: string;
  COMMENT: string;
  ANSWER: string;
  SOURCENAME: string;
  FULLNAME: string;
  RESID: number;
}

export interface GroupedCommentDetail {
  COMMENTID: number;
  COMMENTDATE: string;
  COMMENT: string;
  ANSWER: string;
  SOURCENAME: string;
  FULLNAME: string;
  RESID: number;
  details: {
    depName: string;
    groupName: string;
    type: string;
    detail: string;
  }[];
}

export interface GuestData {
  RESID: string;
  ROOMNO: string;
  GUESTNAMES: string;
  CHECKIN: string;
  CHECKOUT: string;
  AGENCY: string;
  ROOMTYPE: string;
  TOTALPRICE: number;
  RESGUESTID?: number;
  CONTACTGUESTID?: number;
  CONTACTPERSON?: string;
  CONTACTPHONE?: string;
  CONTACTEMAIL?: string;
  NATIONALITY?: string;
  hasComment?: boolean;
  comments?: GroupedCommentDetail[];
  surveySent?: boolean;
  sentimentScore?: number;
  sentimentAnalysisDate?: string;
  generatedLetter?: string;
  letterSentDate?: string;
  welcomeCallStatus?: 'not_called' | 'answered_all_good' | 'answered_has_request' | 'no_answer';
  welcomeCallNotes?: string;
  welcomeCallDate?: string;
  timelineActions?: UnifiedTimelineAction[];
}

export interface LetterTemplate {
  id: string;
  name: string;
  contents: Record<string, string>;
  createdAt: string;
}

export interface PhonebookContact {
  id: string;
  fullName: string;
  department: string;
  phoneNumber: string;
  createdAt: string;
}

export type AIFeature = 'sentimentAnalysis' | 'letterGeneration' | 'translation' | 'deepAnalysis' | 'templateTranslation';

export interface ApiSettings {
  baseUrl: string;
  loginToken: string;
  hotelId: string;
  commentPayloadTemplate?: string;
  commentDetailPayloadTemplate?: string;
  inhousePayloadTemplate?: string;
  reservationPayloadTemplate?: string;
  checkoutPayloadTemplate?: string;
  geminiApiKey?: string;
  geminiModel?: 'gemini-2.5-flash-lite' | 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3.1-pro-preview';
  featureModels?: Partial<Record<AIFeature, string>>;
}

export interface AILog {
  id?: string;
  action: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  timestamp: string;
}

export type GuestListTab = 'inhouse' | 'reservation' | 'checkout';
