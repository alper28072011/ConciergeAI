export interface CommentData {
  ID: string;
  HOTELID: string;
  COMMENTDATE: string;
  COMMENT: string;
  ANSWER?: string;
  RESNAMEID_LOOKUP?: string;
  PHONE?: string;
  EMAIL?: string;
  NATIONALITY?: string;
  ROOMNO?: string;
  GUESTID?: string;
  COMMENTSOURCEID_NAME?: string;
  CHECKIN?: string;
  CHECKOUT?: string;
  GDPRCONFIRMED?: boolean;
  EMAILCONFIRMED?: boolean;
  PHONECONFIRMED?: boolean;
  SMSCONFIRMED?: boolean;
  WHATSAPPCONFIRMED?: boolean;
  SCORE?: number;
}

export interface ApiSettings {
  baseUrl: string;
  loginToken: string;
  hotelId: string;
}

export interface ElektraQueryPayload {
  Parameters?: Record<string, any>;
  Action: string;
  Object: string;
  Select?: string[];
  Where?: Array<{ Column: string; Operator: string; Value: any }>;
  OrderBy?: Array<{ Column: string; Direction: 'ASC' | 'DESC' }>;
  Paging?: { ItemsPerPage: number; Current: number };
  TotalCount?: boolean;
  Joins?: any[];
  LoginToken?: string;
}
