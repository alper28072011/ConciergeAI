export interface UnifiedTopicAnalysis {
  mainCategory: string;
  subCategory: string;
  score: number;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface CommentAnalytics {
  commentId: string;
  resId: string;
  date: string;
  source: string;
  nationality: string;
  overallScore: number;
  comment?: string;
  topics: UnifiedTopicAnalysis[];
  createdAt: string;
}

export interface HotelTaxonomy {
  categories: {
    [mainCategory: string]: string[]; /* subCategory list */
  }
}

export interface UnifiedTimelineAction {
  id: string;
  date: string;
  type: 'elektra' | 'ai_letter' | 'template' | 'manual' | 'welcome_call' | 'survey_sent' | 'whatsapp_sent' | 'report';
  description: string;
  content?: string;
  commentId?: string | number;
  resId?: string | number;
  source?: string;
  actionCategory?: 'ikram' | 'ayricalik' | 'iletisim' | 'operasyon' | 'diger';
}

export const PREDEFINED_ACTIONS = [
  { label: 'Meyve Sepeti 🍎', category: 'ikram', description: 'Odaya meyve sepeti ikramı yapıldı.' },
  { label: 'Şarap İkramı 🍷', category: 'ikram', description: 'Odaya şarap ikramı yapıldı.' },
  { label: 'Geç Çıkış ⏰', category: 'ayricalik', description: 'Misafire geç çıkış (Late Check-out) ayrıcalığı tanındı.' },
  { label: 'Erken Giriş 🌅', category: 'ayricalik', description: 'Misafire erken giriş (Early Check-in) ayrıcalığı tanındı.' },
  { label: 'A la Carte 🍽️', category: 'ayricalik', description: 'A la Carte restoran rezervasyonu yapıldı.' },
  { label: 'Özür Mektubu 🙇', category: 'iletisim', description: 'Misafire yaşanan aksaklık nedeniyle özür mektubu gönderildi.' },
  { label: 'Hoş Geldiniz Araması 📞', category: 'iletisim', description: 'Misafire odaya giriş sonrası hoş geldiniz araması yapıldı.' },
  { label: 'Oda Değişimi 🛏️', category: 'operasyon', description: 'Misafirin odası değiştirildi (Room Move).' },
  { label: 'Teknik Servis 🔧', category: 'operasyon', description: 'Odadaki teknik bir arıza için teknik servis yönlendirildi.' },
] as const;

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
  ARRIVALTIME?: string;
  DEPARTURETIME?: string;
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
  languageOrder?: string[];
  createdAt: string;
}

export interface PhonebookContact {
  id: string;
  fullName: string;
  department: string;
  phoneNumber: string;
  createdAt: string;
}

export type AIFeature = 'sentimentAnalysis' | 'letterGeneration' | 'translation' | 'deepAnalysis' | 'templateTranslation' | 'dashboardReport' | 'bulkReport';

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
