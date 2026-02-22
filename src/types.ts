export interface CommentData {
  COMMENTID: string;
  HOTELID: string;
  COMMENTDATE: string;
  COMMENT: string;
  ANSWER: string;
  SOURCENAME: string;
  NATIONALITY: string;
  GUESTNAME: string;
  GROUPNAME: string;
}

export interface ApiSettings {
  baseUrl: string;
  token: string;
  hotelId: string;
  startDate: string;
  endDate: string;
}
