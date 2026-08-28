/**
 * Comprehensive Nationality / Country Normalization Utility
 * Maps various formats (ISO-2, ISO-3, English names, Turkish names, PMS codes, uppercase/lowercase)
 * to standardized Turkish country names and ISO country codes.
 */

// Turkish-aware lowercasing
export const toTurkishLower = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ş/g, 'ş')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase()
    .trim();
};

export const toCleanKey = (str: string): string => {
  if (!str) return '';
  const lower = toTurkishLower(str);
  // Remove non-alphanumeric chars (like brackets, hyphens, dots)
  return lower.replace(/[^a-z0-9ıüğşöç]/g, ' ').replace(/\s+/g, ' ').trim();
};

interface CountryDef {
  canonicalName: string;
  code: string; // 2-letter ISO code for flagcdn
  aliases: string[];
}

const COUNTRY_DEFINITIONS: CountryDef[] = [
  {
    canonicalName: 'Türkiye',
    code: 'tr',
    aliases: [
      'tr', 'tur', 'turkey', 'türkiye', 'turkiye', 'turkıye', 'turk', 'türk', 'turkish',
      'tc', 't c', 'turkiye cumhuriyeti', 'türkiye cumhuriyeti', 'yerli', 'domestic'
    ]
  },
  {
    canonicalName: 'Almanya',
    code: 'de',
    aliases: [
      'de', 'deu', 'ger', 'germany', 'almanya', 'deutschland', 'german', 'deutsch'
    ]
  },
  {
    canonicalName: 'Rusya',
    code: 'ru',
    aliases: [
      'ru', 'rus', 'russia', 'rusya', 'russian', 'russian federation', 'rusya federasyonu'
    ]
  },
  {
    canonicalName: 'İngiltere',
    code: 'gb',
    aliases: [
      'gb', 'gbr', 'uk', 'united kingdom', 'great britain', 'england', 'ingiltere', 'ingıltere',
      'birlesik krallik', 'birleşik krallık', 'british', 'eng'
    ]
  },
  {
    canonicalName: 'Hollanda',
    code: 'nl',
    aliases: [
      'nl', 'nld', 'netherlands', 'hollanda', 'dutch', 'nederland', 'holland'
    ]
  },
  {
    canonicalName: 'Belçika',
    code: 'be',
    aliases: [
      'be', 'bel', 'belgium', 'belçika', 'belcika', 'belgique'
    ]
  },
  {
    canonicalName: 'Fransa',
    code: 'fr',
    aliases: [
      'fr', 'fra', 'france', 'fransa', 'french', 'français'
    ]
  },
  {
    canonicalName: 'Ukrayna',
    code: 'ua',
    aliases: [
      'ua', 'ukr', 'ukraine', 'ukrayna', 'ukrainian'
    ]
  },
  {
    canonicalName: 'Polonya',
    code: 'pl',
    aliases: [
      'pl', 'pol', 'poland', 'polonya', 'polish', 'polska'
    ]
  },
  {
    canonicalName: 'İsviçre',
    code: 'ch',
    aliases: [
      'ch', 'che', 'switzerland', 'isviçre', 'isvicre', 'ısvıcre', 'swiss', 'schweiz', 'suisse'
    ]
  },
  {
    canonicalName: 'Avusturya',
    code: 'at',
    aliases: [
      'at', 'aut', 'austria', 'avusturya', 'austrian', 'österreich', 'osterreich'
    ]
  },
  {
    canonicalName: 'Kazakistan',
    code: 'kz',
    aliases: [
      'kz', 'kaz', 'kazakhstan', 'kazakistan', 'kazakıstan', 'kazakh'
    ]
  },
  {
    canonicalName: 'Azerbaycan',
    code: 'az',
    aliases: [
      'az', 'aze', 'azerbaijan', 'azerbaycan', 'azeri'
    ]
  },
  {
    canonicalName: 'İran',
    code: 'ir',
    aliases: [
      'ir', 'irn', 'iran', 'iranian', 'ıran'
    ]
  },
  {
    canonicalName: 'Irak',
    code: 'iq',
    aliases: [
      'iq', 'irq', 'iraq', 'irak', 'ırak', 'iraqi'
    ]
  },
  {
    canonicalName: 'ABD',
    code: 'us',
    aliases: [
      'us', 'usa', 'united states', 'amerika', 'amerika birlesik devletleri',
      'amerika birleşik devletleri', 'abd', 'american'
    ]
  },
  {
    canonicalName: 'İtalya',
    code: 'it',
    aliases: [
      'it', 'ita', 'italy', 'italya', 'ıtalya', 'italian', 'italia'
    ]
  },
  {
    canonicalName: 'İspanya',
    code: 'es',
    aliases: [
      'es', 'esp', 'spain', 'ispanya', 'ıspanya', 'spanish', 'españa', 'espana'
    ]
  },
  {
    canonicalName: 'İsveç',
    code: 'se',
    aliases: [
      'se', 'swe', 'sweden', 'isveç', 'isvec', 'ısvec', 'swedish', 'sverige'
    ]
  },
  {
    canonicalName: 'Norveç',
    code: 'no',
    aliases: [
      'no', 'nor', 'norway', 'norveç', 'norvec', 'norwegian', 'norge'
    ]
  },
  {
    canonicalName: 'Danimarka',
    code: 'dk',
    aliases: [
      'dk', 'dnk', 'denmark', 'danimarka', 'danish', 'danmark'
    ]
  },
  {
    canonicalName: 'Finlandiya',
    code: 'fi',
    aliases: [
      'fi', 'fin', 'finland', 'finlandiya', 'fınlandıya', 'finnish', 'suomi'
    ]
  },
  {
    canonicalName: 'Yunanistan',
    code: 'gr',
    aliases: [
      'gr', 'grc', 'greece', 'yunanistan', 'greek', 'hellas'
    ]
  },
  {
    canonicalName: 'Bulgaristan',
    code: 'bg',
    aliases: [
      'bg', 'bgr', 'bulgaria', 'bulgaristan', 'bulgarian'
    ]
  },
  {
    canonicalName: 'Romanya',
    code: 'ro',
    aliases: [
      'ro', 'rou', 'romania', 'romanya', 'romanian'
    ]
  },
  {
    canonicalName: 'Özbekistan',
    code: 'uz',
    aliases: [
      'uz', 'uzb', 'uzbekistan', 'özbekistan', 'ozbekistan'
    ]
  },
  {
    canonicalName: 'Türkmenistan',
    code: 'tm',
    aliases: [
      'tm', 'tkm', 'turkmenistan', 'türkmenistan'
    ]
  },
  {
    canonicalName: 'Kırgızistan',
    code: 'kg',
    aliases: [
      'kg', 'kgz', 'kyrgyzstan', 'kırgızistan', 'kirgizistan'
    ]
  },
  {
    canonicalName: 'Suriye',
    code: 'sy',
    aliases: [
      'sy', 'syr', 'syria', 'suriye'
    ]
  },
  {
    canonicalName: 'Lübnan',
    code: 'lb',
    aliases: [
      'lb', 'lbn', 'lebanon', 'lübnan', 'lubnan'
    ]
  },
  {
    canonicalName: 'Ürdün',
    code: 'jo',
    aliases: [
      'jo', 'jor', 'jordan', 'ürdün', 'urdun'
    ]
  },
  {
    canonicalName: 'Mısır',
    code: 'eg',
    aliases: [
      'eg', 'egy', 'egypt', 'mısır', 'misir', 'egyptian'
    ]
  },
  {
    canonicalName: 'Suudi Arabistan',
    code: 'sa',
    aliases: [
      'sa', 'sau', 'ksa', 'saudi arabia', 'suudi arabistan'
    ]
  },
  {
    canonicalName: 'Birleşik Arap Emirlikleri',
    code: 'ae',
    aliases: [
      'ae', 'are', 'uae', 'united arab emirates', 'birlesik arap emirlikleri',
      'birleşik arap emirlikleri', 'bae', 'dubai'
    ]
  },
  {
    canonicalName: 'Katar',
    code: 'qa',
    aliases: [
      'qa', 'qat', 'qatar', 'katar'
    ]
  },
  {
    canonicalName: 'Kuveyt',
    code: 'kw',
    aliases: [
      'kw', 'kwt', 'kuwait', 'kuveyt'
    ]
  },
  {
    canonicalName: 'Bahreyn',
    code: 'bh',
    aliases: [
      'bh', 'bhr', 'bahrain', 'bahreyn'
    ]
  },
  {
    canonicalName: 'Umman',
    code: 'om',
    aliases: [
      'om', 'omn', 'oman', 'umman'
    ]
  },
  {
    canonicalName: 'İsrail',
    code: 'il',
    aliases: [
      'il', 'isr', 'israel', 'israil', 'israili', 'israeli', 'ısraıl'
    ]
  },
  {
    canonicalName: 'Çin',
    code: 'cn',
    aliases: [
      'cn', 'chn', 'china', 'çin', 'cin', 'chinese'
    ]
  },
  {
    canonicalName: 'Japonya',
    code: 'jp',
    aliases: [
      'jp', 'jpn', 'japan', 'japonya', 'japanese'
    ]
  },
  {
    canonicalName: 'Güney Kore',
    code: 'kr',
    aliases: [
      'kr', 'kor', 'south korea', 'korea', 'güney kore', 'guney kore'
    ]
  },
  {
    canonicalName: 'Hindistan',
    code: 'in',
    aliases: [
      'in', 'ind', 'india', 'hindistan', 'hındıstan', 'indian'
    ]
  },
  {
    canonicalName: 'Pakistan',
    code: 'pk',
    aliases: [
      'pk', 'pak', 'pakistan'
    ]
  },
  {
    canonicalName: 'Kanada',
    code: 'ca',
    aliases: [
      'ca', 'can', 'canada', 'kanada', 'canadian'
    ]
  },
  {
    canonicalName: 'Meksika',
    code: 'mx',
    aliases: [
      'mx', 'mex', 'mexico', 'meksika', 'mexican'
    ]
  },
  {
    canonicalName: 'Brezilya',
    code: 'br',
    aliases: [
      'br', 'bra', 'brazil', 'brezilya', 'brasil', 'brazilian'
    ]
  },
  {
    canonicalName: 'Arjantin',
    code: 'ar',
    aliases: [
      'ar', 'arg', 'argentina', 'arjantin', 'argentine'
    ]
  },
  {
    canonicalName: 'Avustralya',
    code: 'au',
    aliases: [
      'au', 'aus', 'australia', 'avustralya', 'australian'
    ]
  },
  {
    canonicalName: 'Yeni Zelanda',
    code: 'nz',
    aliases: [
      'nz', 'nzl', 'new zealand', 'yeni zelanda'
    ]
  },
  {
    canonicalName: 'Güney Afrika',
    code: 'za',
    aliases: [
      'za', 'zaf', 'south africa', 'güney afrika', 'guney afrika'
    ]
  },
  {
    canonicalName: 'Fas',
    code: 'ma',
    aliases: [
      'ma', 'mar', 'morocco', 'fas', 'maroc'
    ]
  },
  {
    canonicalName: 'Tunus',
    code: 'tn',
    aliases: [
      'tn', 'tun', 'tunisia', 'tunus', 'tunisie'
    ]
  },
  {
    canonicalName: 'Cezayir',
    code: 'dz',
    aliases: [
      'dz', 'dza', 'algeria', 'cezayir', 'algérie'
    ]
  },
  {
    canonicalName: 'Libya',
    code: 'ly',
    aliases: [
      'ly', 'lby', 'libya'
    ]
  },
  {
    canonicalName: 'Nijerya',
    code: 'ng',
    aliases: [
      'ng', 'nga', 'nigeria', 'nijerya'
    ]
  },
  {
    canonicalName: 'Gürcistan',
    code: 'ge',
    aliases: [
      'ge', 'geo', 'georgia', 'gürcistan', 'gurcistan'
    ]
  },
  {
    canonicalName: 'Ermenistan',
    code: 'am',
    aliases: [
      'am', 'arm', 'armenia', 'ermenistan'
    ]
  },
  {
    canonicalName: 'Kıbrıs',
    code: 'cy',
    aliases: [
      'cy', 'cyp', 'cyprus', 'kıbrıs', 'kibris', 'kktc', 'kuzey kıbrıs', 'kuzey kibris'
    ]
  },
  {
    canonicalName: 'Malta',
    code: 'mt',
    aliases: [
      'mt', 'mlt', 'malta'
    ]
  },
  {
    canonicalName: 'Macaristan',
    code: 'hu',
    aliases: [
      'hu', 'hun', 'hungary', 'macaristan', 'magyarország'
    ]
  },
  {
    canonicalName: 'Çekya',
    code: 'cz',
    aliases: [
      'cz', 'cze', 'czechia', 'czech republic', 'çekya', 'cekya'
    ]
  },
  {
    canonicalName: 'Slovakya',
    code: 'sk',
    aliases: [
      'sk', 'svk', 'slovakia', 'slovakya'
    ]
  },
  {
    canonicalName: 'İrlanda',
    code: 'ie',
    aliases: [
      'ie', 'irl', 'ireland', 'irlanda', 'ırlanda'
    ]
  },
  {
    canonicalName: 'Lüksemburg',
    code: 'lu',
    aliases: [
      'lu', 'lux', 'luxembourg', 'lüksemburg', 'luksemburg'
    ]
  },
  {
    canonicalName: 'Sırbistan',
    code: 'rs',
    aliases: [
      'rs', 'srb', 'serbia', 'sırbistan', 'sirbistan'
    ]
  },
  {
    canonicalName: 'Hırvatistan',
    code: 'hr',
    aliases: [
      'hr', 'hrv', 'croatia', 'hırvatistan', 'hirvatistan', 'hrvatska'
    ]
  },
  {
    canonicalName: 'Slovenya',
    code: 'si',
    aliases: [
      'si', 'svn', 'slovenia', 'slovenya'
    ]
  },
  {
    canonicalName: 'Bosna Hersek',
    code: 'ba',
    aliases: [
      'ba', 'bih', 'bosnia', 'bosnia and herzegovina', 'bosna hersek', 'bosna-hersek'
    ]
  },
  {
    canonicalName: 'Karadağ',
    code: 'me',
    aliases: [
      'me', 'mne', 'montenegro', 'karadağ', 'karadag'
    ]
  },
  {
    canonicalName: 'Arnavutluk',
    code: 'al',
    aliases: [
      'al', 'alb', 'albania', 'arnavutluk'
    ]
  },
  {
    canonicalName: 'Kuzey Makedonya',
    code: 'mk',
    aliases: [
      'mk', 'mkd', 'north macedonia', 'macedonia', 'kuzey makedonya', 'makedonya'
    ]
  },
  {
    canonicalName: 'Estonya',
    code: 'ee',
    aliases: [
      'ee', 'est', 'estonia', 'estonya'
    ]
  },
  {
    canonicalName: 'Letonya',
    code: 'lv',
    aliases: [
      'lv', 'lva', 'latvia', 'letonya'
    ]
  },
  {
    canonicalName: 'Litvanya',
    code: 'lt',
    aliases: [
      'lt', 'ltu', 'lithuania', 'litvanya', 'lıtvanya'
    ]
  },
  {
    canonicalName: 'Beyaz Rusya',
    code: 'by',
    aliases: [
      'by', 'blr', 'belarus', 'beyaz rusya'
    ]
  },
  {
    canonicalName: 'Moldova',
    code: 'md',
    aliases: [
      'md', 'mda', 'moldova'
    ]
  },
  {
    canonicalName: 'Kosova',
    code: 'xk',
    aliases: [
      'xk', 'xkx', 'kosovo', 'kosova'
    ]
  },
  {
    canonicalName: 'İzlanda',
    code: 'is',
    aliases: [
      'is', 'isl', 'iceland', 'izlanda', 'ızlanda'
    ]
  },
  {
    canonicalName: 'Portekiz',
    code: 'pt',
    aliases: [
      'pt', 'prt', 'portugal', 'portekiz'
    ]
  }
];

// Lookup caches
const NAME_TO_CANONICAL = new Map<string, string>();
const NAME_TO_CODE = new Map<string, string>();

COUNTRY_DEFINITIONS.forEach(def => {
  // Key canonical name
  const canClean = toCleanKey(def.canonicalName);
  NAME_TO_CANONICAL.set(canClean, def.canonicalName);
  NAME_TO_CODE.set(canClean, def.code);

  def.aliases.forEach(alias => {
    const aliasClean = toCleanKey(alias);
    if (aliasClean) {
      NAME_TO_CANONICAL.set(aliasClean, def.canonicalName);
      NAME_TO_CODE.set(aliasClean, def.code);
    }
  });
});

/**
 * Normalizes any nationality/country string into its canonical display name.
 * e.g. "TR", "TURKEY", "türkiye", "TUR", "TC" -> "Türkiye"
 */
export function normalizeNationality(raw?: string | null): string {
  if (!raw) return 'Bilinmiyor';
  const clean = toCleanKey(raw);
  if (!clean) return 'Bilinmiyor';

  if (NAME_TO_CANONICAL.has(clean)) {
    return NAME_TO_CANONICAL.get(clean)!;
  }

  // Check if starts with a known code/name (e.g. "TR - TURKEY" or "TR (TURKEY)")
  for (const [key, canonical] of NAME_TO_CANONICAL.entries()) {
    if (clean === key || clean.startsWith(key + ' ') || clean.endsWith(' ' + key)) {
      return canonical;
    }
  }

  // Capitalize first letters if not in dictionary
  return raw.trim();
}

/**
 * Returns 2-letter ISO country code for flag icons (flagcdn).
 */
export function getStandardCountryCode(raw?: string | null): string {
  if (!raw) return '';
  const clean = toCleanKey(raw);
  if (!clean) return '';

  if (NAME_TO_CODE.has(clean)) {
    return NAME_TO_CODE.get(clean)!;
  }

  for (const [key, code] of NAME_TO_CODE.entries()) {
    if (clean === key || clean.startsWith(key + ' ') || clean.endsWith(' ' + key)) {
      return code;
    }
  }

  return '';
}
