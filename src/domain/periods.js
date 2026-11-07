/**
 * EPHPHATHA DOMAIN LAYER: 12 PERIODS OF SALVATION HISTORY & 365-DAY CURRICULUM ENGINE
 * Architecture: Pure Domain Logic (Zero UI / DOM coupling)
 */

export const DEFAULT_PERIODS = [
  {
    id: 1, code: '01', name: 'Early World', name_ml: 'ആദിമ ലോകം',
    span: 'Genesis 1–11', span_ml: 'ഉൽപത്തി 1–11', day_start: 1, day_end: 4,
    theme: 'Creation & Fall', theme_ml: 'സൃഷ്ടിയും വീഴ്ചയും',
    accent_hex: '#2B8CBE', bg_soft_light: '#EBF5FA', bg_soft_dark: '#1D3244',
    gdrive_folder: '/01_Early_World/',
    era_date: 'Primeval History (Creation – c. 2000 BC)',
    geography: 'Eden, Mesopotamia, Tigris & Euphrates Valley, Babel',
    lineage: 'Adam & Eve → Seth → Enoch → Noah → Shem'
  },
  {
    id: 2, code: '02', name: 'Patriarchs', name_ml: 'പിതാക്കന്മാർ',
    span: 'Genesis 12–50', span_ml: 'ഉൽപത്തി 12–50', day_start: 5, day_end: 26,
    theme: 'Covenant Fathers', theme_ml: 'ഉടമ്പടിയുടെ പിതാക്കന്മാർ',
    accent_hex: '#8E2430', bg_soft_light: '#F9ECEE', bg_soft_dark: '#381F28',
    gdrive_folder: '/02_Patriarchs/',
    era_date: 'c. 2000 – 1650 BC (Middle Bronze Age)',
    geography: 'Ur, Haran, Canaan (Shechem, Bethel, Hebron), Egypt',
    lineage: 'Abraham & Sarah → Isaac & Rebekah → Jacob (Israel) → 12 Tribes'
  },
  {
    id: 3, code: '03', name: 'Egypt & Exodus', name_ml: 'ഈജിപ്തും പുറപ്പാടും',
    span: 'Exodus 1–40', span_ml: 'പുറപ്പാട് 1–40', day_start: 27, day_end: 53,
    theme: 'Liberation & Law', theme_ml: 'വിമോചനവും നിയമവും',
    accent_hex: '#C62828', bg_soft_light: '#FDECEC', bg_soft_dark: '#3F2026',
    gdrive_folder: '/03_Egypt_And_Exodus/',
    era_date: 'c. 1650 – 1260 BC (Late Bronze Age)',
    geography: 'Goshen (Nile Delta), Red Sea, Mount Sinai (Horeb)',
    lineage: 'Levi → Kohath → Amram → Moses, Aaron & Miriam'
  },
  {
    id: 4, code: '04', name: 'Desert Wanderings', name_ml: 'മരുഭൂമിയിലെ യാത്ര',
    span: 'Numbers 1–36', span_ml: 'സംഖ്യ 1–36', day_start: 54, day_end: 79,
    theme: 'Wilderness Testing', theme_ml: 'മരുഭൂമിയിലെ പരീക്ഷണങ്ങൾ',
    accent_hex: '#A47551', bg_soft_light: '#F7F1EB', bg_soft_dark: '#382E29',
    gdrive_folder: '/04_Desert_Wanderings/',
    era_date: 'c. 1260 – 1220 BC (40 Years in the Wilderness)',
    geography: 'Sinai Wilderness, Kadesh-Barnea, Plains of Moab',
    lineage: 'Moses & Eleazar → Joshua & Caleb'
  },
  {
    id: 5, code: '05', name: 'Conquest & Judges', name_ml: 'കാനാൻ വിജയവും ന്യായാധിപന്മാരും',
    span: 'Joshua, Judges, 1 Sam 1–8', span_ml: 'ജോഷ്വ, ന്യായാധിപന്മാർ, 1 സാമുവൽ 1–8', day_start: 80, day_end: 115,
    theme: 'Promised Land', theme_ml: 'വാഗ്ദത്ത ഭൂമി',
    accent_hex: '#2E7D32', bg_soft_light: '#EAF5EB', bg_soft_dark: '#1E3529',
    gdrive_folder: '/05_Conquest_And_Judges/',
    era_date: 'c. 1220 – 1050 BC (Iron Age I)',
    geography: 'Jordan River, Jericho, Shiloh, Hill Country of Judah',
    lineage: 'Joshua → Deborah, Gideon, Samson → Ruth & Boaz → Samuel'
  },
  {
    id: 6, code: '06', name: 'Royal Kingdom', name_ml: 'രാജകീയ രാജ്യം',
    span: '1 Sam 9–31, 2 Sam, 1 Kgs 1–11', span_ml: '1 സാമുവൽ 9–31, 2 സാമുവൽ, 1 രാജാക്കന്മാർ 1–11', day_start: 116, day_end: 162,
    theme: 'Davidic Throne', theme_ml: 'ദാവീദിന്റെ സിംഹാസനം',
    accent_hex: '#6A1B9A', bg_soft_light: '#F3EAF9', bg_soft_dark: '#2E1F3F',
    gdrive_folder: '/06_Royal_Kingdom/',
    era_date: 'c. 1050 – 930 BC (United Monarchy)',
    geography: 'Hebron, Jerusalem (City of David & Solomon’s Temple)',
    lineage: 'Saul → King David → King Solomon'
  },
  {
    id: 7, code: '07', name: 'Divided Kingdom', name_ml: 'വിഭജിക്കപ്പെട്ട രാജ്യം',
    span: '1 Kgs 12–22, 2 Kgs 1–16', span_ml: '1 രാജാക്കന്മാർ 12–22, 2 രാജാക്കന്മാർ 1–16', day_start: 163, day_end: 203,
    theme: 'North vs. South', theme_ml: 'ഇസ്രായേലും യൂദായും',
    accent_hex: '#475569', bg_soft_light: '#EEF2F6', bg_soft_dark: '#283242',
    gdrive_folder: '/07_Divided_Kingdom/',
    era_date: '930 – 722 BC',
    geography: 'Samaria (North) & Jerusalem (South)',
    lineage: 'Rehoboam, Hezekiah (South) | Elijah, Elisha, Hosea, Amos (North)'
  },
  {
    id: 8, code: '08', name: 'Exile', name_ml: 'പ്രവാസം',
    span: '2 Kings 17–25', span_ml: '2 രാജാക്കന്മാർ 17–25', day_start: 204, day_end: 245,
    theme: 'Captivity & Hope', theme_ml: 'പ്രവാസവും പ്രത്യാശയും',
    accent_hex: '#0284C7', bg_soft_light: '#E6F4FB', bg_soft_dark: '#193347',
    gdrive_folder: '/08_Exile/',
    era_date: '722 – 538 BC (Assyrian & Babylonian Captivities)',
    geography: 'Nineveh, Jerusalem, Babylon (Chebar Canal)',
    lineage: 'Josiah → Zedekiah | Prophets Jeremiah, Ezekiel, Daniel, Tobit'
  },
  {
    id: 9, code: '09', name: 'Return', name_ml: 'മടങ്ങിവരവ്',
    span: 'Ezra, Nehemiah', span_ml: 'എസ്രാ, നെഹെമിയ', day_start: 246, day_end: 274,
    theme: 'Rebuilding Jerusalem', theme_ml: 'ജെറുസലേമിന്റെ പുനർനിർമ്മാണം',
    accent_hex: '#D97706', bg_soft_light: '#FDF3E7', bg_soft_dark: '#3B2D1F',
    gdrive_folder: '/09_Return/',
    era_date: '538 – c. 400 BC (Persian Period)',
    geography: 'Babylon, Susa, Rebuilt Jerusalem & Second Temple',
    lineage: 'Zerubbabel, Ezra, Nehemiah, Esther, Haggai, Zechariah, Malachi'
  },
  {
    id: 10, code: '10', name: 'Maccabean Revolt', name_ml: 'മക്കബായ വിപ്ലവം',
    span: '1 Maccabees', span_ml: '1 മക്കബായർ', day_start: 275, day_end: 297,
    theme: 'Heroic Fidelity', theme_ml: 'ധീരമായ വിശ്വസ്തത',
    accent_hex: '#EA580C', bg_soft_light: '#FDEEE7', bg_soft_dark: '#3E261E',
    gdrive_folder: '/10_Maccabean_Revolt/',
    era_date: '175 – 63 BC (Hellenistic Period)',
    geography: 'Modin, Judea, Rededicated Temple in Jerusalem',
    lineage: 'Mattathias → Judas Maccabeus, Jonathan, Simon'
  },
  {
    id: 11, code: '11', name: 'Messianic Fulfillment', name_ml: 'മിശിഹായുടെ പൂർത്തീകരണം',
    span: 'Luke & The Four Gospels', span_ml: 'ലൂക്കാ & നാല് സുവിശേഷങ്ങൾ', day_start: 298, day_end: 335,
    theme: 'Christ the Redeemer', theme_ml: 'ക്രിസ്തു രക്ഷകൻ',
    accent_hex: '#B4831E', bg_soft_light: '#FAF3E3', bg_soft_dark: '#372F20',
    gdrive_folder: '/11_Messianic_Fulfillment/',
    era_date: 'c. 4 BC – AD 33',
    geography: 'Nazareth, Bethlehem, Sea of Galilee, Jerusalem, Golgotha',
    lineage: 'Jesus of Nazareth, Incarnate Word & Redeemer'
  },
  {
    id: 12, code: '12', name: 'The Church', name_ml: 'തിരുസഭ',
    span: 'Acts, Epistles, Revelation', span_ml: 'അപ്പ. പ്രവർത്തനങ്ങൾ, ലേഖനങ്ങൾ, വെളിപാട്', day_start: 336, day_end: 365,
    theme: 'Holy Spirit & Mission', theme_ml: 'പരിശുദ്ധാത്മാവും പ്രേഷിതദൗത്യവും',
    accent_hex: '#3B82F6', bg_soft_light: '#EBF2FE', bg_soft_dark: '#1E2E4A',
    gdrive_folder: '/12_The_Church/',
    era_date: 'AD 33 – c. AD 95 (Apostolic Era & New Jerusalem)',
    geography: 'Jerusalem, Antioch, Corinth, Rome, Patmos',
    lineage: 'Peter, Paul, John & the Apostles → The Universal Church'
  }
];

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

  const periodBookMappings = {
    1: { book: 'Genesis', book_ml: 'ഉൽപത്തി', supp: 'Job', supp_ml: 'ജോബ്', chStart: 1 },
    2: { book: 'Genesis', book_ml: 'ഉൽപത്തി', supp: 'Job', supp_ml: 'ജോബ്', chStart: 12 },
    3: { book: 'Exodus', book_ml: 'പുറപ്പാട്', supp: 'Leviticus', supp_ml: 'ലേവ്യർ', chStart: 1 },
    4: { book: 'Numbers', book_ml: 'സംഖ്യ', supp: 'Deuteronomy', supp_ml: 'നിയമാവർത്തനം', chStart: 1 },
    5: { book: 'Joshua & Judges', book_ml: 'ജോഷ്വ & ന്യായാധിപന്മാർ', supp: 'Ruth', supp_ml: 'റൂത്ത്', chStart: 1 },
    6: { book: '1 & 2 Samuel', book_ml: '1 & 2 സാമുവൽ', supp: '1 Chronicles', supp_ml: '1 ദിനവൃത്താന്തം', chStart: 1 },
    7: { book: '1 & 2 Kings', book_ml: '1 & 2 രാജാക്കന്മാർ', supp: 'Isaiah & Hosea', supp_ml: 'ഏശയ്യാ & ഹോസിയാ', chStart: 12 },
    8: { book: '2 Kings & Jeremiah', book_ml: '2 രാജാക്കന്മാർ & ജെറമിയ', supp: 'Ezekiel & Daniel', supp_ml: 'എസെക്കിയേൽ & ദാനിയേൽ', chStart: 1 },
    9: { book: 'Ezra & Nehemiah', book_ml: 'എസ്രാ & നെഹെമിയ', supp: 'Esther & Zechariah', supp_ml: 'എസ്തേർ & സഖറിയാ', chStart: 1 },
    10: { book: '1 Maccabees', book_ml: '1 മക്കബായർ', supp: 'Sirach & Wisdom', supp_ml: 'പ്രഭാഷകൻ & ജ്ഞാനം', chStart: 1 },
    11: { book: 'Luke, Mark, Matthew & John', book_ml: 'ലൂക്കാ, മർക്കോസ്, മത്തായി & യോഹന്നാൻ', supp: 'Messianic Prophecies', supp_ml: 'മിശിഹാ പ്രവചനങ്ങൾ', chStart: 1 },
    12: { book: 'Acts of the Apostles', book_ml: 'അപ്പസ്തോലന്മാരുടെ പ്രവർത്തനങ്ങൾ', supp: 'Pauline Epistles & Revelation', supp_ml: 'പൗലോസിന്റെ ലേഖനങ്ങൾ & വെളിപാട്', chStart: 1 }
  };

  for (let day = 1; day <= 365; day++) {
    const period = periods.find(p => day >= p.day_start && day <= p.day_end) || periods[0];
    const dayOffsetInPeriod = day - period.day_start;
    const mapping = periodBookMappings[period.id];
    const chA = mapping.chStart + dayOffsetInPeriod * 2;
    const chB = chA + 1;
    const psalmNum = ((day - 1) % 150) + 1;
    const paddedDay = String(day).padStart(3, '0');

    if (featuredDays[String(day)]) {
      scheduleByDay[day] = {
        ...featuredDays[String(day)],
        period
      };
    } else {
      scheduleByDay[day] = {
        day_number: day,
        period_id: period.id,
        period,
        episode_title: `${period.name} — Day ${dayOffsetInPeriod + 1}: ${ period.theme }`,
        episode_title_ml: `${period.name_ml} — ദിവസം ${dayOffsetInPeriod + 1}: ${ period.theme_ml }`,
        readings: {
          narrative: `${mapping.book} ${chA}–${chB}`,
          narrative_ml: `${mapping.book_ml} ${chA}–${chB}`,
          supplemental: `${mapping.supp} ${dayOffsetInPeriod + 1}`,
          supplemental_ml: `${mapping.supp_ml} ${dayOffsetInPeriod + 1}`,
          psalm_wisdom: day % 3 === 0 ? `Proverbs ${((day - 1) % 31) + 1}` : `Psalm ${psalmNum}`,
          psalm_wisdom_ml: day % 3 === 0 ? `സുഭാഷിതങ്ങൾ ${((day - 1) % 31) + 1}` : `സങ്കീർത്തനങ്ങൾ ${psalmNum}`
        },
        gdrive_audio_file_id: `1Ephphatha_Day_${paddedDay}_${period.code}_64kbps_HEAAC`,
        audio_duration_sec: 1200 + ((day * 37) % 420),
        historical_context: {
          era_date: period.era_date,
          geography: period.geography,
          lineage: period.lineage,
          summary: `Day ${day} continues the ${period.name} narrative (${period.span}), illuminating the theme of ${period.theme} within the unfolding covenant plan of Salvation History.`,
          summary_ml: `രക്ഷാകര ചരിത്രത്തിലെ '${period.name_ml}' (${period.span_ml}) കാലഘട്ടത്തിലൂടെയുള്ള ${day}-ാം ദിവസത്തെ വായനയും ധ്യാനവും.`,
          reflection_prompt: `As you meditate on ${mapping.book} ${chA}–${chB} and Psalm ${psalmNum}, how is the Lord speaking "Ephphatha — Be Opened" into your life today?`
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

