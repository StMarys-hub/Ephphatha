/**
 * EPHPHATHA DOMAIN LAYER: 12 PERIODS OF SALVATION HISTORY & 365-DAY CURRICULUM ENGINE
 * Architecture: Pure Domain Logic (Zero UI / DOM coupling)
 */

import { DAILY_TITLES } from './dailyTitles.js';

export const DEFAULT_PERIODS = [
  {
    id: 1, code: '01', name: 'Early World', name_ml: 'ആദിമ ലോകം',
    span: 'Genesis 1–11', span_ml: 'ഉൽപത്തി 1–11', day_start: 1, day_end: 4,
    theme: 'Creation & Fall', theme_ml: 'സൃഷ്ടിയും വീഴ്ചയും',
    accent_hex: '#5B8CAE', bg_soft_light: '#EEF4F8', bg_soft_dark: '#222B34',
    gdrive_folder: '/01_Early_World/',
    era_date: 'Primeval History (Creation – c. 2000 BC)',
    geography: 'Eden, Mesopotamia, Tigris & Euphrates Valley, Babel',
    lineage: 'Adam & Eve → Seth → Enoch → Noah → Shem'
  },
  {
    id: 2, code: '02', name: 'Patriarchs', name_ml: 'പിതാക്കന്മാർ',
    span: 'Genesis 12–50', span_ml: 'ഉൽപത്തി 12–50', day_start: 5, day_end: 26,
    theme: 'Covenant Fathers', theme_ml: 'ഉടമ്പടിയുടെ പിതാക്കന്മാർ',
    accent_hex: '#9E5B66', bg_soft_light: '#F6EEF0', bg_soft_dark: '#2E2328',
    gdrive_folder: '/02_Patriarchs/',
    era_date: 'c. 2000 – 1650 BC (Middle Bronze Age)',
    geography: 'Ur, Haran, Canaan (Shechem, Bethel, Hebron), Egypt',
    lineage: 'Abraham & Sarah → Isaac & Rebekah → Jacob (Israel) → 12 Tribes'
  },
  {
    id: 3, code: '03', name: 'Egypt & Exodus', name_ml: 'ഈജിപ്തും പുറപ്പാടും',
    span: 'Exodus 1–40', span_ml: 'പുറപ്പാട് 1–40', day_start: 27, day_end: 53,
    theme: 'Liberation & Law', theme_ml: 'വിമോചനവും നിയമവും',
    accent_hex: '#A85A5A', bg_soft_light: '#F7EFEF', bg_soft_dark: '#2F2325',
    gdrive_folder: '/03_Egypt_And_Exodus/',
    era_date: 'c. 1650 – 1260 BC (Late Bronze Age)',
    geography: 'Goshen (Nile Delta), Red Sea, Mount Sinai (Horeb)',
    lineage: 'Levi → Kohath → Amram → Moses, Aaron & Miriam'
  },
  {
    id: 4, code: '04', name: 'Desert Wanderings', name_ml: 'മരുഭൂമിയിലെ യാത്ര',
    span: 'Numbers 1–36', span_ml: 'സംഖ്യ 1–36', day_start: 54, day_end: 79,
    theme: 'Wilderness Testing', theme_ml: 'മരുഭൂമിയിലെ പരീക്ഷണങ്ങൾ',
    accent_hex: '#9C7A5B', bg_soft_light: '#F5F0EB', bg_soft_dark: '#2D2824',
    gdrive_folder: '/04_Desert_Wanderings/',
    era_date: 'c. 1260 – 1220 BC (40 Years in the Wilderness)',
    geography: 'Sinai Wilderness, Kadesh-Barnea, Plains of Moab',
    lineage: 'Moses & Eleazar → Joshua & Caleb'
  },
  {
    id: 5, code: '05', name: 'Conquest & Judges', name_ml: 'കാനാൻ വിജയവും ന്യായാധിപന്മാരും',
    span: 'Joshua, Judges, 1 Sam 1–8', span_ml: 'ജോഷ്വ, ന്യായാധിപന്മാർ, 1 സാമുവൽ 1–8', day_start: 80, day_end: 115,
    theme: 'Promised Land', theme_ml: 'വാഗ്ദത്ത ഭൂമി',
    accent_hex: '#578A66', bg_soft_light: '#EDF4EF', bg_soft_dark: '#222D27',
    gdrive_folder: '/05_Conquest_And_Judges/',
    era_date: 'c. 1220 – 1050 BC (Iron Age I)',
    geography: 'Jordan River, Jericho, Shiloh, Hill Country of Judah',
    lineage: 'Joshua → Deborah, Gideon, Samson → Ruth & Boaz → Samuel'
  },
  {
    id: 6, code: '06', name: 'Royal Kingdom', name_ml: 'രാജകീയ രാജ്യം',
    span: '1 Sam 9–31, 2 Sam, 1 Kgs 1–11', span_ml: '1 സാമുവൽ 9–31, 2 സാമുവൽ, 1 രാജാക്കന്മാർ 1–11', day_start: 116, day_end: 162,
    theme: 'Davidic Throne', theme_ml: 'ദാവീദിന്റെ സിംഹാസനം',
    accent_hex: '#846B9F', bg_soft_light: '#F2EEF6', bg_soft_dark: '#292433',
    gdrive_folder: '/06_Royal_Kingdom/',
    era_date: 'c. 1050 – 930 BC (United Monarchy)',
    geography: 'Hebron, Jerusalem (City of David & Solomon’s Temple)',
    lineage: 'Saul → King David → King Solomon'
  },
  {
    id: 7, code: '07', name: 'Divided Kingdom', name_ml: 'വിഭജിക്കപ്പെട്ട രാജ്യം',
    span: '1 Kgs 12–22, 2 Kgs 1–16', span_ml: '1 രാജാക്കന്മാർ 12–22, 2 രാജാക്കന്മാർ 1–16', day_start: 163, day_end: 203,
    theme: 'North vs. South', theme_ml: 'ഇസ്രായേലും യൂദായും',
    accent_hex: '#6B7C8E', bg_soft_light: '#EFF2F5', bg_soft_dark: '#252A32',
    gdrive_folder: '/07_Divided_Kingdom/',
    era_date: '930 – 722 BC',
    geography: 'Samaria (North) & Jerusalem (South)',
    lineage: 'Rehoboam, Hezekiah (South) | Elijah, Elisha, Hosea, Amos (North)'
  },
  {
    id: 8, code: '08', name: 'Exile', name_ml: 'പ്രവാസം',
    span: '2 Kings 17–25', span_ml: '2 രാജാക്കന്മാർ 17–25', day_start: 204, day_end: 245,
    theme: 'Captivity & Hope', theme_ml: 'പ്രവാസവും പ്രത്യാശയും',
    accent_hex: '#5484A4', bg_soft_light: '#ECF2F7', bg_soft_dark: '#212A33',
    gdrive_folder: '/08_Exile/',
    era_date: '722 – 538 BC (Assyrian & Babylonian Captivities)',
    geography: 'Nineveh, Jerusalem, Babylon (Chebar Canal)',
    lineage: 'Josiah → Zedekiah | Prophets Jeremiah, Ezekiel, Daniel, Tobit'
  },
  {
    id: 9, code: '09', name: 'Return', name_ml: 'മടങ്ങിവരവ്',
    span: 'Ezra, Nehemiah', span_ml: 'എസ്രാ, നെഹെമിയ', day_start: 246, day_end: 274,
    theme: 'Rebuilding Jerusalem', theme_ml: 'ജെറുസലേമിന്റെ പുനർനിർമ്മാണം',
    accent_hex: '#AE844B', bg_soft_light: '#F7F2EA', bg_soft_dark: '#2E2921',
    gdrive_folder: '/09_Return/',
    era_date: '538 – c. 400 BC (Persian Period)',
    geography: 'Babylon, Susa, Rebuilt Jerusalem & Second Temple',
    lineage: 'Zerubbabel, Ezra, Nehemiah, Esther, Haggai, Zechariah, Malachi'
  },
  {
    id: 10, code: '10', name: 'Maccabean Revolt', name_ml: 'മക്കബായ വിപ്ലവം',
    span: '1 Maccabees', span_ml: '1 മക്കബായർ', day_start: 275, day_end: 297,
    theme: 'Heroic Fidelity', theme_ml: 'ധീരമായ വിശ്വസ്തത',
    accent_hex: '#AC6E4E', bg_soft_light: '#F7EFEA', bg_soft_dark: '#2F2622',
    gdrive_folder: '/10_Maccabean_Revolt/',
    era_date: '175 – 63 BC (Hellenistic Period)',
    geography: 'Modin, Judea, Rededicated Temple in Jerusalem',
    lineage: 'Mattathias → Judas Maccabeus, Jonathan, Simon'
  },
  {
    id: 11, code: '11', name: 'Messianic Fulfillment', name_ml: 'മിശിഹായുടെ പൂർത്തീകരണം',
    span: 'Luke & The Four Gospels', span_ml: 'ലൂക്കാ & നാല് സുവിശേഷങ്ങൾ', day_start: 298, day_end: 335,
    theme: 'Christ the Redeemer', theme_ml: 'ക്രിസ്തു രക്ഷകൻ',
    accent_hex: '#A88948', bg_soft_light: '#F6F2E8', bg_soft_dark: '#2D2920',
    gdrive_folder: '/11_Messianic_Fulfillment/',
    era_date: 'c. 4 BC – AD 33',
    geography: 'Nazareth, Bethlehem, Sea of Galilee, Jerusalem, Golgotha',
    lineage: 'Jesus of Nazareth, Incarnate Word & Redeemer'
  },
  {
    id: 12, code: '12', name: 'The Church', name_ml: 'തിരുസഭ',
    span: 'Acts, Epistles, Revelation', span_ml: 'അപ്പ. പ്രവർത്തനങ്ങൾ, ലേഖനങ്ങൾ, വെളിപാട്', day_start: 336, day_end: 365,
    theme: 'Holy Spirit & Mission', theme_ml: 'പരിശുദ്ധാത്മാവും പ്രേഷിതദൗത്യവും',
    accent_hex: '#5D7FA8', bg_soft_light: '#EDF1F7', bg_soft_dark: '#222935',
    gdrive_folder: '/12_The_Church/',
    era_date: 'AD 33 – c. AD 95 (Apostolic Era & New Jerusalem)',
    geography: 'Jerusalem, Antioch, Corinth, Rome, Patmos',
    lineage: 'Peter, Paul, John & the Apostles → The Universal Church'
  }
];

/**
 * Eye-Comfort Subdued Muted Indicators across all 12 Periods
 * Uses low-saturation muted pastels & soft jewel tones for gentle prolonged reading in Slate-Charcoal Dark Mode & Parchment Light Mode.
 */
export const PERIOD_THEME_TOKENS = {
  1: {
    light: { accent: '#3E6F8E', text: '#2F5770', bgSoft: '#ECF3F7' },
    dark:  { accent: '#6C9BB8', text: '#9CC0D6', bgSoft: 'rgba(108, 155, 184, 0.12)' }
  },
  2: {
    light: { accent: '#874C56', text: '#6E3B44', bgSoft: '#F5ECEE' },
    dark:  { accent: '#B57882', text: '#D4A5AD', bgSoft: 'rgba(181, 120, 130, 0.12)' }
  },
  3: {
    light: { accent: '#8F4B4B', text: '#733A3A', bgSoft: '#F6EDED' },
    dark:  { accent: '#B87474', text: '#D6A3A3', bgSoft: 'rgba(184, 116, 116, 0.12)' }
  },
  4: {
    light: { accent: '#826347', text: '#684E37', bgSoft: '#F4EFE9' },
    dark:  { accent: '#B39172', text: '#CFB59D', bgSoft: 'rgba(179, 145, 114, 0.12)' }
  },
  5: {
    light: { accent: '#447252', text: '#34593F', bgSoft: '#EBF2ED' },
    dark:  { accent: '#6D9E7B', text: '#9AC2A6', bgSoft: 'rgba(109, 158, 123, 0.12)' }
  },
  6: {
    // Period 6: Royal Kingdom — Soft muted amethyst/lavender in dark mode; subdued plum in light mode
    light: { accent: '#6D5487', text: '#55406B', bgSoft: '#F0ECF5' },
    dark:  { accent: '#9B84B5', text: '#C1B0D6', bgSoft: 'rgba(155, 132, 181, 0.13)' }
  },
  7: {
    light: { accent: '#526273', text: '#3E4B59', bgSoft: '#EDF0F3' },
    dark:  { accent: '#8394A6', text: '#B0BDCB', bgSoft: 'rgba(131, 148, 166, 0.12)' }
  },
  8: {
    light: { accent: '#3E6B89', text: '#2E526B', bgSoft: '#EBF1F6' },
    dark:  { accent: '#6896B5', text: '#99BBD1', bgSoft: 'rgba(104, 150, 181, 0.12)' }
  },
  9: {
    light: { accent: '#8C6836', text: '#6E5027', bgSoft: '#F5EFE6' },
    dark:  { accent: '#BA9662', text: '#D6BC94', bgSoft: 'rgba(186, 150, 98, 0.12)' }
  },
  10: {
    light: { accent: '#8F593D', text: '#70442D', bgSoft: '#F5EDE8' },
    dark:  { accent: '#B88265', text: '#D4AC96', bgSoft: 'rgba(184, 130, 101, 0.12)' }
  },
  11: {
    light: { accent: '#876D35', text: '#695326', bgSoft: '#F4F0E6' },
    dark:  { accent: '#B59B60', text: '#D2BF92', bgSoft: 'rgba(181, 155, 96, 0.12)' }
  },
  12: {
    light: { accent: '#46658C', text: '#344D6B', bgSoft: '#EBF0F6' },
    dark:  { accent: '#7293BA', text: '#A1B9D6', bgSoft: 'rgba(114, 147, 186, 0.12)' }
  }
};

/**
 * Returns accessible contrast-optimized color tokens for a given period ID.
 */
export function getPeriodTokens(periodId, isDark = true) {
  const pId = Number(periodId) || 1;
  const pTokens = PERIOD_THEME_TOKENS[pId] || PERIOD_THEME_TOKENS[1];
  return isDark ? pTokens.dark : pTokens.light;
}

/**
 * Deterministically builds all 365 days of the curriculum, merging online overrides
 * from `schedule_manifest_v3.json` with algorithmic canonical mapping across the 12 periods.
 */
export function buildFull365Curriculum(manifestData = {}) {
  const periods = Array.isArray(manifestData.periods) && manifestData.periods.length === 12
    ? manifestData.periods
    : DEFAULT_PERIODS;

  const featuredDays = manifestData.featured_days || {};
  const scheduleByDay = {};

  // Canonical multi-book sequences per period so every generated day has valid book names & chapter numbers
  const periodCanonicalStreams = {
    1: {
      narrative: [{ book: 'Genesis', book_ml: 'ഉൽപത്തി', start: 1, max: 11 }],
      supp: [{ book: 'Job', book_ml: 'ജോബ്', start: 1, max: 8 }]
    },
    2: {
      narrative: [{ book: 'Genesis', book_ml: 'ഉൽപത്തി', start: 12, max: 50 }],
      supp: [{ book: 'Job', book_ml: 'ജോബ്', start: 9, max: 42 }]
    },
    3: {
      narrative: [{ book: 'Exodus', book_ml: 'പുറപ്പാട്', start: 1, max: 40 }],
      supp: [{ book: 'Leviticus', book_ml: 'ലേവ്യാപുസ്തകം', start: 1, max: 27 }]
    },
    4: {
      narrative: [{ book: 'Numbers', book_ml: 'സംഖ്യാപുസ്തകം', start: 1, max: 36 }],
      supp: [{ book: 'Deuteronomy', book_ml: 'ആവര്‍ത്തനപുസ്തകം', start: 1, max: 34 }]
    },
    5: {
      narrative: [
        { book: 'Joshua', book_ml: 'യോശുവ', start: 1, max: 24 },
        { book: 'Judges', book_ml: 'ന്യായാധിപന്മാര്‍', start: 1, max: 21 }
      ],
      supp: [
        { book: 'Ruth', book_ml: 'രൂത്ത്', start: 1, max: 4 },
        { book: '1 Samuel', book_ml: '1 ശമൂവേൽ', start: 1, max: 8 }
      ]
    },
    6: {
      narrative: [
        { book: '1 Samuel', book_ml: '1 ശമൂവേൽ', start: 9, max: 31 },
        { book: '2 Samuel', book_ml: '2 ശമൂവേൽ', start: 1, max: 24 },
        { book: '1 Kings', book_ml: '1 രാജാക്കന്മാര്‍', start: 1, max: 11 }
      ],
      supp: [
        { book: '1 Chronicles', book_ml: '1 ദിനവൃത്താന്തം', start: 1, max: 29 },
        { book: '2 Chronicles', book_ml: '2 ദിനവൃത്താന്തം', start: 1, max: 9 }
      ]
    },
    7: {
      narrative: [
        { book: '1 Kings', book_ml: '1 രാജാക്കന്മാര്‍', start: 12, max: 22 },
        { book: '2 Kings', book_ml: '2 രാജാക്കന്മാര്‍', start: 1, max: 16 }
      ],
      supp: [
        { book: 'Isaiah', book_ml: 'യെശയ്യാവ്', start: 1, max: 39 },
        { book: 'Hosea', book_ml: 'ഹോശേയ', start: 1, max: 14 },
        { book: 'Amos', book_ml: 'ആമോസ്', start: 1, max: 9 }
      ]
    },
    8: {
      narrative: [
        { book: '2 Kings', book_ml: '2 രാജാക്കന്മാര്‍', start: 17, max: 25 },
        { book: 'Jeremiah', book_ml: 'യിരെമ്യാവ്', start: 1, max: 52 }
      ],
      supp: [
        { book: 'Ezekiel', book_ml: 'യെഹെസ്കേൽ', start: 1, max: 48 },
        { book: 'Daniel', book_ml: 'ദാനീയേൽ', start: 1, max: 12 }
      ]
    },
    9: {
      narrative: [
        { book: 'Ezra', book_ml: 'എസ്രാ', start: 1, max: 10 },
        { book: 'Nehemiah', book_ml: 'നെഹെമ്യാവ്', start: 1, max: 13 },
        { book: 'Esther', book_ml: 'എസ്ഥേര്‍', start: 1, max: 10 }
      ],
      supp: [
        { book: 'Haggai', book_ml: 'ഹഗ്ഗായി', start: 1, max: 2 },
        { book: 'Zechariah', book_ml: 'സെഖര്യാവ്', start: 1, max: 14 },
        { book: 'Malachi', book_ml: 'മലാഖി', start: 1, max: 4 }
      ]
    },
    10: {
      narrative: [
        { book: '1 Maccabees', book_ml: '1 മക്കബായർ', start: 1, max: 16 },
        { book: '2 Maccabees', book_ml: '2 മക്കബായർ', start: 1, max: 15 }
      ],
      supp: [
        { book: 'Wisdom', book_ml: 'ജ്ഞാനം', start: 1, max: 19 },
        { book: 'Sirach', book_ml: 'പ്രഭാഷകൻ', start: 1, max: 51 }
      ]
    },
    11: {
      narrative: [
        { book: 'Luke', book_ml: 'ലൂക്കൊസ്', start: 1, max: 24 },
        { book: 'Matthew', book_ml: 'മത്തായി', start: 1, max: 28 },
        { book: 'Mark', book_ml: 'മര്‍ക്കൊസ്', start: 1, max: 16 },
        { book: 'John', book_ml: 'യോഹന്നാന്‍', start: 1, max: 21 }
      ],
      supp: [
        { book: 'Isaiah', book_ml: 'യെശയ്യാവ്', start: 40, max: 66 },
        { book: 'Hebrews', book_ml: 'എബ്രായര്‍', start: 1, max: 13 }
      ]
    },
    12: {
      narrative: [
        { book: 'Acts', book_ml: 'അപ്പൊ. പ്രവൃത്തികള്‍', start: 1, max: 28 },
        { book: 'Revelation', book_ml: 'വെളിപ്പാട്', start: 1, max: 22 }
      ],
      supp: [
        { book: 'Romans', book_ml: 'റോമര്‍', start: 1, max: 16 },
        { book: '1 Corinthians', book_ml: '1 കൊരിന്ത്യര്‍', start: 1, max: 16 },
        { book: '2 Corinthians', book_ml: '2 കൊരിന്ത്യര്‍', start: 1, max: 13 },
        { book: 'Ephesians', book_ml: 'എഫെസ്യര്‍', start: 1, max: 6 }
      ]
    }
  };

  function pickCanonicalPassage(streamList, offsetIdx, chaptersPerDay = 2) {
    const flatChapters = [];
    for (const item of streamList) {
      for (let ch = item.start; ch <= item.max; ch++) {
        flatChapters.push({ book: item.book, book_ml: item.book_ml, ch });
      }
    }
    if (flatChapters.length === 0) {
      return { en: 'Genesis 1', ml: 'ഉൽപത്തി 1' };
    }
    const startPos = (offsetIdx * chaptersPerDay) % flatChapters.length;
    const first = flatChapters[startPos];
    if (chaptersPerDay === 1) {
      return { en: `${first.book} ${first.ch}`, ml: `${first.book_ml} ${first.ch}` };
    }
    const second = flatChapters[Math.min(flatChapters.length - 1, startPos + 1)];
    if (second && second.book === first.book && second.ch > first.ch) {
      return { en: `${first.book} ${first.ch}–${second.ch}`, ml: `${first.book_ml} ${first.ch}–${second.ch}` };
    }
    return { en: `${first.book} ${first.ch}`, ml: `${first.book_ml} ${first.ch}` };
  }

  for (let day = 1; day <= 365; day++) {
    const period = periods.find(p => day >= p.day_start && day <= p.day_end) || periods[0];
    const dayOffsetInPeriod = day - period.day_start;
    const streams = periodCanonicalStreams[period.id] || periodCanonicalStreams[1];
    const narrPair = pickCanonicalPassage(streams.narrative, dayOffsetInPeriod, 2);
    const suppPair = pickCanonicalPassage(streams.supp, dayOffsetInPeriod, 1);
    const psalmNum = ((day - 1) % 150) + 1;
    const paddedDay = String(day).padStart(3, '0');

    if (featuredDays[String(day)]) {
      scheduleByDay[day] = {
        ...featuredDays[String(day)],
        period
      };
    } else {
      const dailyTitle = DAILY_TITLES[day];
      scheduleByDay[day] = {
        day_number: day,
        period_id: period.id,
        period,
        episode_title: dailyTitle?.en || `${period.name} — Day ${dayOffsetInPeriod + 1}: ${period.theme}`,
        episode_title_ml: dailyTitle?.ml || `${period.name_ml} — ദിവസം ${dayOffsetInPeriod + 1}: ${period.theme_ml}`,
        readings: {
          narrative: narrPair.en,
          narrative_ml: narrPair.ml,
          supplemental: suppPair.en,
          supplemental_ml: suppPair.ml,
          psalm_wisdom: day % 3 === 0 ? `Proverbs ${((day - 1) % 31) + 1}` : `Psalm ${psalmNum}`,
          psalm_wisdom_ml: day % 3 === 0 ? `സദൃശവാക്യങ്ങള്‍ ${((day - 1) % 31) + 1}` : `സങ്കീർത്തനങ്ങൾ ${psalmNum}`
        },
        gdrive_audio_file_id: `1Ephphatha_Day_${paddedDay}_${period.code}_64kbps_HEAAC`,
        audio_duration_sec: 1200 + ((day * 37) % 420),
        historical_context: {
          era_date: period.era_date,
          geography: period.geography,
          lineage: period.lineage,
          summary: `Day ${day} continues the ${period.name} narrative (${period.span}), illuminating the theme of ${period.theme} within the unfolding covenant plan of Salvation History.`,
          summary_ml: `രക്ഷാകര ചരിത്രത്തിലെ '${period.name_ml}' (${period.span_ml}) കാലഘട്ടത്തിലൂടെയുള്ള ${day}-ാം ദിവസത്തെ വായനയും ധ്യാനവും.`,
          reflection_prompt: `As you meditate on ${narrPair.en} and Psalm ${psalmNum}, how is the Lord speaking "Ephphatha — Be Opened" into your life today?`
        }
      };
    }
  }

  return { periods, scheduleByDay };
}

/**
 * Grace-First Streak Engine
 * Computes active reading streak, Grace Shield protection (prevents punitive streak loss
 * on a missed day), and overall 365-day progress metrics.
 */
export function calculateGraceStreak(completedDaysMap = {}, currentSelectedDay = 1) {
  const completedNumbers = Object.keys(completedDaysMap)
    .filter(k => completedDaysMap[k]?.completed)
    .map(Number)
    .sort((a, b) => a - b);

  const totalCompleted = completedNumbers.length;
  const percentComplete = Math.min(100, Number(((totalCompleted / 365) * 100).toFixed(1)));

  if (totalCompleted === 0) {
    return {
      streakDays: 0,
      totalCompleted: 0,
      percentComplete: 0,
      graceShieldsAvailable: 2,
      graceShieldActiveToday: false,
      nextRecommendedDay: 1
    };
  }

  // Count consecutive or 1-day-grace-bridged streak from highest completed day backwards
  let streak = 1;
  let graceUsed = 0;
  for (let i = completedNumbers.length - 1; i > 0; i--) {
    const diff = completedNumbers[i] - completedNumbers[i - 1];
    if (diff === 1) {
      streak++;
    } else if (diff === 2 && graceUsed < 2) {
      // Grace Shield bridges a 1-day gap without breaking the believer's encouragement!
      streak++;
      graceUsed++;
    } else {
      break;
    }
  }

  const maxDay = completedNumbers[completedNumbers.length - 1];
  const nextRecommendedDay = Math.min(365, maxDay + 1);

  return {
    streakDays: streak,
    totalCompleted,
    percentComplete,
    graceShieldsAvailable: Math.max(0, 2 - graceUsed),
    graceShieldActiveToday: graceUsed > 0,
    nextRecommendedDay
  };
}

