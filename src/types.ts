export interface CommentData {
  ID?: string;
  HOTELID?: string;
  DETAILTYPE?: string;
  DEPNAME?: string;
  GROUPNAME: string;
  COMMENTID: string;
  COMMENTDATE: string;
  COMMENT: string;
  ANSWER: string;
  SOURCENAME: string;
  AGENCY?: string;
  NATIONALITY: string;
  LOCATION?: string;
  CREATION_DATE?: string;
  MARKET?: string;
  GUESTNAME?: string;
  TAGS?: string[];
}

export interface ApiSettings {
  baseUrl: string;
  token: string;
  hotelId: string;
  action: string;
  objectName: string;
}
