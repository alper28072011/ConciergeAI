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

export interface GuestData {
  RESID: string;
  ROOMNO: string;
  GUESTNAMES: string;
  CHECKIN: string;
  CHECKOUT: string;
  AGENCY: string;
  ROOMTYPE: string;
  TOTALPRICE: number;
  hasComment?: boolean;
  commentData?: CommentData;
}

export interface ApiSettings {
  baseUrl: string;
  loginToken: string;
  hotelId: string;
  commentPayloadTemplate?: string;
  guestPayloadTemplate?: string;
  geminiApiKey?: string;
}
