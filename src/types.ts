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
  GUESTID?: number;
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
  RESGUESTID?: number;
  CONTACTGUESTID?: number;
  CONTACTPERSON?: string;
  CONTACTPHONE?: string;
  CONTACTEMAIL?: string;
  hasComment?: boolean;
  comments?: CommentData[];
}

export interface ApiSettings {
  baseUrl: string;
  loginToken: string;
  hotelId: string;
  commentPayloadTemplate?: string;
  inhousePayloadTemplate?: string;
  reservationPayloadTemplate?: string;
  checkoutPayloadTemplate?: string;
  geminiApiKey?: string;
}

export type GuestListTab = 'inhouse' | 'reservation' | 'checkout';
