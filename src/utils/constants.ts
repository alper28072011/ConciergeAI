export const HOTEL_MAIN_CATEGORIES = [
  'Yiyecek Deneyimi',
  'İçecek Deneyimi',
  'Konaklama / Oda',
  'Personel',
  'Temizlik',
  'Yüzme & Plaj',
  'Eğlence & Animasyon',
  'Tesis & Olanaklar',
  'Atmosfer & Ortam',
  'Hizmet & Operasyon',
  'Genel / Diğer'
] as const;

export type HotelMainCategory = typeof HOTEL_MAIN_CATEGORIES[number];
