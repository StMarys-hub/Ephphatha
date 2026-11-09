/**
 * EPHPHATHA DOMAIN LAYER: CANONICAL 73-BOOK CATHOLIC BIBLE REGISTRY & NAVIGATION ENGINE
 * Pure domain logic: Zero UI / DOM coupling.
 *
 * Defines the complete 73-book Catholic Canon:
 * - 46 Old Testament Books (including the 7 Deuterocanonicals)
 * - 27 New Testament Books
 * - Precise chapter counts, categories, Malayalam POC names, and sequential continuous navigation.
 */

export const CANONICAL_BIBLE_BOOKS = [
  // =========================================================================
  // OLD TESTAMENT — PENTATEUCH / TORAH (5 Books)
  // =========================================================================
  {
    pocId: 1, id: 1, en: 'Genesis', ml: 'ഉൽപത്തി',
    aliases: ['gen', 'ge', 'gn'], testament: 'OT', category: 'Pentateuch',
    chapters: 50, isDeuterocanonical: false
  },
  {
    pocId: 2, id: 2, en: 'Exodus', ml: 'പുറപ്പാട്',
    aliases: ['exo', 'ex'], testament: 'OT', category: 'Pentateuch',
    chapters: 40, isDeuterocanonical: false
  },
  {
    pocId: 3, id: 3, en: 'Leviticus', ml: 'ലേവ്യർ',
    aliases: ['lev', 'le', 'lv'], testament: 'OT', category: 'Pentateuch',
    chapters: 27, isDeuterocanonical: false
  },
  {
    pocId: 4, id: 4, en: 'Numbers', ml: 'സംഖ്യ',
    aliases: ['num', 'nu', 'nm'], testament: 'OT', category: 'Pentateuch',
    chapters: 36, isDeuterocanonical: false
  },
  {
    pocId: 5, id: 5, en: 'Deuteronomy', ml: 'നിയമാവർത്തനം',
    aliases: ['deut', 'dt', 'de'], testament: 'OT', category: 'Pentateuch',
    chapters: 34, isDeuterocanonical: false
  },

  // =========================================================================
  // OLD TESTAMENT — HISTORICAL BOOKS (16 Books)
  // =========================================================================
  {
    pocId: 6, id: 6, en: 'Joshua', ml: 'ജോഷ്വാ',
    aliases: ['josh', 'jos', 'jsh'], testament: 'OT', category: 'Historical',
    chapters: 24, isDeuterocanonical: false
  },
  {
    pocId: 7, id: 7, en: 'Judges', ml: 'ന്യായാധിപന്മാർ',
    aliases: ['judg', 'jdg', 'jg'], testament: 'OT', category: 'Historical',
    chapters: 21, isDeuterocanonical: false
  },
  {
    pocId: 8, id: 8, en: 'Ruth', ml: 'റൂത്ത്',
    aliases: ['ru', 'rth'], testament: 'OT', category: 'Historical',
    chapters: 4, isDeuterocanonical: false
  },
  {
    pocId: 9, id: 9, en: '1 Samuel', ml: '1 സാമുവൽ',
    aliases: ['1 sam', '1sam', '1sa', '1s'], testament: 'OT', category: 'Historical',
    chapters: 31, isDeuterocanonical: false
  },
  {
    pocId: 10, id: 10, en: '2 Samuel', ml: '2 സാമുവൽ',
    aliases: ['2 sam', '2sam', '2sa', '2s'], testament: 'OT', category: 'Historical',
    chapters: 24, isDeuterocanonical: false
  },
  {
    pocId: 11, id: 11, en: '1 Kings', ml: '1 രാജാക്കന്മാർ',
    aliases: ['1 kgs', '1kgs', '1ki', '1k'], testament: 'OT', category: 'Historical',
    chapters: 22, isDeuterocanonical: false
  },
  {
    pocId: 12, id: 12, en: '2 Kings', ml: '2 രാജാക്കന്മാർ',
    aliases: ['2 kgs', '2kgs', '2ki', '2k'], testament: 'OT', category: 'Historical',
    chapters: 25, isDeuterocanonical: false
  },
  {
    pocId: 13, id: 13, en: '1 Chronicles', ml: '1 ദിനവൃത്താന്തം',
    aliases: ['1 chr', '1chr', '1ch'], testament: 'OT', category: 'Historical',
    chapters: 29, isDeuterocanonical: false
  },
  {
    pocId: 14, id: 14, en: '2 Chronicles', ml: '2 ദിനവൃത്താന്തം',
    aliases: ['2 chr', '2chr', '2ch'], testament: 'OT', category: 'Historical',
    chapters: 36, isDeuterocanonical: false
  },
  {
    pocId: 15, id: 15, en: 'Ezra', ml: 'എസ്രാ',
    aliases: ['ezr', 'ez'], testament: 'OT', category: 'Historical',
    chapters: 10, isDeuterocanonical: false
  },
  {
    pocId: 16, id: 16, en: 'Nehemiah', ml: 'നെഹമിയ',
    aliases: ['neh', 'ne'], testament: 'OT', category: 'Historical',
    chapters: 13, isDeuterocanonical: false
  },
  {
    pocId: 17, id: 68, en: 'Tobit', ml: 'തോബിത്',
    aliases: ['tob', 'tb'], testament: 'OT', category: 'Historical',
    chapters: 14, isDeuterocanonical: true
  },
  {
    pocId: 18, id: 69, en: 'Judith', ml: 'യൂദിത്ത്',
    aliases: ['jdt', 'jth'], testament: 'OT', category: 'Historical',
    chapters: 16, isDeuterocanonical: true
  },
  {
    pocId: 19, id: 17, en: 'Esther', ml: 'എസ്തേർ',
    aliases: ['est', 'es'], testament: 'OT', category: 'Historical',
    chapters: 22, isDeuterocanonical: false
  },
  {
    pocId: 20, id: 74, en: '1 Maccabees', ml: '1 മക്കബായർ',
    aliases: ['1 macc', '1macc', '1ma', '1m'], testament: 'OT', category: 'Historical',
    chapters: 16, isDeuterocanonical: true
  },
  {
    pocId: 21, id: 75, en: '2 Maccabees', ml: '2 മക്കബായർ',
    aliases: ['2 macc', '2macc', '2ma', '2m'], testament: 'OT', category: 'Historical',
    chapters: 15, isDeuterocanonical: true
  },

  // =========================================================================
  // OLD TESTAMENT — WISDOM & POETRY (7 Books)
  // =========================================================================
  {
    pocId: 22, id: 18, en: 'Job', ml: 'ജോബ്',
    aliases: ['jb'], testament: 'OT', category: 'Wisdom',
    chapters: 42, isDeuterocanonical: false
  },
  {
    pocId: 23, id: 19, en: 'Psalms', ml: 'സങ്കീർത്തനങ്ങൾ',
    aliases: ['psalm', 'ps', 'psa'], testament: 'OT', category: 'Wisdom',
    chapters: 150, isDeuterocanonical: false
  },
  {
    pocId: 24, id: 20, en: 'Proverbs', ml: 'സുഭാഷിതങ്ങൾ',
    aliases: ['prov', 'prv', 'pr'], testament: 'OT', category: 'Wisdom',
    chapters: 31, isDeuterocanonical: false
  },
  {
    pocId: 25, id: 21, en: 'Ecclesiastes', ml: 'സഭാപ്രസംഗകൻ',
    aliases: ['eccl', 'ecc', 'ec'], testament: 'OT', category: 'Wisdom',
    chapters: 12, isDeuterocanonical: false
  },
  {
    pocId: 26, id: 22, en: 'Song of Solomon', ml: 'ഉത്തമഗീതം',
    aliases: ['song', 'cant', 'canticles', 'sos'], testament: 'OT', category: 'Wisdom',
    chapters: 8, isDeuterocanonical: false
  },
  {
    pocId: 27, id: 70, en: 'Wisdom', ml: 'ജ്ഞാനം',
    aliases: ['wis', 'ws'], testament: 'OT', category: 'Wisdom',
    chapters: 19, isDeuterocanonical: true
  },
  {
    pocId: 28, id: 71, en: 'Sirach', ml: 'പ്രഭാഷകൻ',
    aliases: ['sir', 'ecclesiasticus', 'si'], testament: 'OT', category: 'Wisdom',
    chapters: 51, isDeuterocanonical: true
  },

  // =========================================================================
  // OLD TESTAMENT — PROPHETS (18 Books: 6 Major + 12 Minor)
  // =========================================================================
  {
    pocId: 29, id: 23, en: 'Isaiah', ml: 'ഏശയ്യാ',
    aliases: ['isa', 'is'], testament: 'OT', category: 'Prophet',
    chapters: 66, isDeuterocanonical: false
  },
  {
    pocId: 30, id: 24, en: 'Jeremiah', ml: 'ജെറെമിയ',
    aliases: ['jer', 'jr'], testament: 'OT', category: 'Prophet',
    chapters: 52, isDeuterocanonical: false
  },
  {
    pocId: 31, id: 25, en: 'Lamentations', ml: 'വിലാപങ്ങൾ',
    aliases: ['lam', 'la'], testament: 'OT', category: 'Prophet',
    chapters: 5, isDeuterocanonical: false
  },
  {
    pocId: 32, id: 73, en: 'Baruch', ml: 'ബാറൂക്ക്',
    aliases: ['bar', 'ba'], testament: 'OT', category: 'Prophet',
    chapters: 6, isDeuterocanonical: true
  },
  {
    pocId: 33, id: 26, en: 'Ezekiel', ml: 'എസെക്കിയേൽ',
    aliases: ['ezek', 'ezk', 'eze'], testament: 'OT', category: 'Prophet',
    chapters: 48, isDeuterocanonical: false
  },
  {
    pocId: 34, id: 27, en: 'Daniel', ml: 'ദാനീയേൽ',
    aliases: ['dan', 'dn'], testament: 'OT', category: 'Prophet',
    chapters: 14, isDeuterocanonical: false
  },
  {
    pocId: 35, id: 28, en: 'Hosea', ml: 'ഹോസിയാ',
    aliases: ['hos', 'ho'], testament: 'OT', category: 'Prophet',
    chapters: 14, isDeuterocanonical: false
  },
  {
    pocId: 36, id: 29, en: 'Joel', ml: 'ജോയേൽ',
    aliases: ['jl', 'joe'], testament: 'OT', category: 'Prophet',
    chapters: 3, isDeuterocanonical: false
  },
  {
    pocId: 37, id: 30, en: 'Amos', ml: 'ആമോസ്',
    aliases: ['am'], testament: 'OT', category: 'Prophet',
    chapters: 9, isDeuterocanonical: false
  },
  {
    pocId: 38, id: 31, en: 'Obadiah', ml: 'ഒബാദിയ',
    aliases: ['obad', 'ob'], testament: 'OT', category: 'Prophet',
    chapters: 1, isDeuterocanonical: false
  },
  {
    pocId: 39, id: 32, en: 'Jonah', ml: 'യോനാ',
    aliases: ['jon', 'jnh'], testament: 'OT', category: 'Prophet',
    chapters: 4, isDeuterocanonical: false
  },
  {
    pocId: 40, id: 33, en: 'Micah', ml: 'മിക്കാ',
    aliases: ['mic', 'mc'], testament: 'OT', category: 'Prophet',
    chapters: 7, isDeuterocanonical: false
  },
  {
    pocId: 41, id: 34, en: 'Nahum', ml: 'നാഹും',
    aliases: ['nah', 'na'], testament: 'OT', category: 'Prophet',
    chapters: 3, isDeuterocanonical: false
  },
  {
    pocId: 42, id: 35, en: 'Habakkuk', ml: 'ഹബക്കുക്ക്',
    aliases: ['hab', 'hb'], testament: 'OT', category: 'Prophet',
    chapters: 3, isDeuterocanonical: false
  },
  {
    pocId: 43, id: 36, en: 'Zephaniah', ml: 'സെഫാനിയ',
    aliases: ['zeph', 'zep', 'zp'], testament: 'OT', category: 'Prophet',
    chapters: 3, isDeuterocanonical: false
  },
  {
    pocId: 44, id: 37, en: 'Haggai', ml: 'ഹഗ്ഗായി',
    aliases: ['hag', 'hg'], testament: 'OT', category: 'Prophet',
    chapters: 2, isDeuterocanonical: false
  },
  {
    pocId: 45, id: 38, en: 'Zechariah', ml: 'സഖറിയാ',
    aliases: ['zech', 'zec', 'zc'], testament: 'OT', category: 'Prophet',
    chapters: 14, isDeuterocanonical: false
  },
  {
    pocId: 46, id: 39, en: 'Malachi', ml: 'മലാക്കി',
    aliases: ['mal', 'ml'], testament: 'OT', category: 'Prophet',
    chapters: 4, isDeuterocanonical: false
  },

  // =========================================================================
  // NEW TESTAMENT — GOSPELS & ACTS (5 Books)
  // =========================================================================
  {
    pocId: 47, id: 40, en: 'Matthew', ml: 'മത്തായി',
    aliases: ['matt', 'mt'], testament: 'NT', category: 'Gospel',
    chapters: 28, isDeuterocanonical: false
  },
  {
    pocId: 48, id: 41, en: 'Mark', ml: 'മർക്കോസ്',
    aliases: ['mk', 'mrk'], testament: 'NT', category: 'Gospel',
    chapters: 16, isDeuterocanonical: false
  },
  {
    pocId: 49, id: 42, en: 'Luke', ml: 'ലൂക്കാ',
    aliases: ['lk', 'luk'], testament: 'NT', category: 'Gospel',
    chapters: 24, isDeuterocanonical: false
  },
  {
    pocId: 50, id: 43, en: 'John', ml: 'യോഹന്നാൻ',
    aliases: ['jn', 'jhn'], testament: 'NT', category: 'Gospel',
    chapters: 21, isDeuterocanonical: false
  },
  {
    pocId: 51, id: 44, en: 'Acts', ml: 'അപ്പ. പ്രവർത്തനങ്ങൾ',
    aliases: ['acts', 'act'], testament: 'NT', category: 'Historical',
    chapters: 28, isDeuterocanonical: false
  },

  // =========================================================================
  // NEW TESTAMENT — PAULINE EPISTLES & HEBREWS (14 Books)
  // =========================================================================
  {
    pocId: 52, id: 45, en: 'Romans', ml: 'റോമാ',
    aliases: ['rom', 'rm'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 16, isDeuterocanonical: false
  },
  {
    pocId: 53, id: 46, en: '1 Corinthians', ml: '1 കൊറിന്തോസ്',
    aliases: ['1 cor', '1cor', '1co'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 16, isDeuterocanonical: false
  },
  {
    pocId: 54, id: 47, en: '2 Corinthians', ml: '2 കൊറിന്തോസ്',
    aliases: ['2 cor', '2cor', '2co'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 13, isDeuterocanonical: false
  },
  {
    pocId: 55, id: 48, en: 'Galatians', ml: 'ഗലാത്തിയാ',
    aliases: ['gal', 'ga'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 6, isDeuterocanonical: false
  },
  {
    pocId: 56, id: 49, en: 'Ephesians', ml: 'എഫേസോസ്',
    aliases: ['eph', 'ep'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 6, isDeuterocanonical: false
  },
  {
    pocId: 57, id: 50, en: 'Philippians', ml: 'ഫിലിപ്പി',
    aliases: ['phil', 'php', 'pp'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 4, isDeuterocanonical: false
  },
  {
    pocId: 58, id: 51, en: 'Colossians', ml: 'കൊളോസോസ്',
    aliases: ['col', 'co'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 4, isDeuterocanonical: false
  },
  {
    pocId: 59, id: 52, en: '1 Thessalonians', ml: '1 തെസലോനിക്കാ',
    aliases: ['1 thess', '1thess', '1th'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 5, isDeuterocanonical: false
  },
  {
    pocId: 60, id: 53, en: '2 Thessalonians', ml: '2 തെസലോനിക്കാ',
    aliases: ['2 thess', '2thess', '2th'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 3, isDeuterocanonical: false
  },
  {
    pocId: 61, id: 54, en: '1 Timothy', ml: '1 തിമോത്തേയോസ്',
    aliases: ['1 tim', '1tim', '1ti'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 6, isDeuterocanonical: false
  },
  {
    pocId: 62, id: 55, en: '2 Timothy', ml: '2 തിമോത്തേയോസ്',
    aliases: ['2 tim', '2tim', '2ti'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 4, isDeuterocanonical: false
  },
  {
    pocId: 63, id: 56, en: 'Titus', ml: 'തീത്തോസ്',
    aliases: ['tit', 'ti'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 3, isDeuterocanonical: false
  },
  {
    pocId: 64, id: 57, en: 'Philemon', ml: 'ഫിലെമോൻ',
    aliases: ['phlm', 'phm', 'pm'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 1, isDeuterocanonical: false
  },
  {
    pocId: 65, id: 58, en: 'Hebrews', ml: 'ഹെബ്രായർ',
    aliases: ['heb', 'he'], testament: 'NT', category: 'Pauline Epistle',
    chapters: 13, isDeuterocanonical: false
  },

  // =========================================================================
  // NEW TESTAMENT — CATHOLIC / GENERAL EPISTLES (7 Books)
  // =========================================================================
  {
    pocId: 66, id: 59, en: 'James', ml: 'യാക്കോബ്',
    aliases: ['jas', 'jm'], testament: 'NT', category: 'Catholic Epistle',
    chapters: 5, isDeuterocanonical: false
  },
  {
    pocId: 67, id: 60, en: '1 Peter', ml: '1 പത്രോസ്',
    aliases: ['1 pet', '1pet', '1pe', '1p'], testament: 'NT', category: 'Catholic Epistle',
    chapters: 5, isDeuterocanonical: false
  },
  {
    pocId: 68, id: 61, en: '2 Peter', ml: '2 പത്രോസ്',
    aliases: ['2 pet', '2pet', '2pe', '2p'], testament: 'NT', category: 'Catholic Epistle',
    chapters: 3, isDeuterocanonical: false
  },
  {
    pocId: 69, id: 62, en: '1 John', ml: '1 യോഹന്നാൻ',
    aliases: ['1 jn', '1jn', '1j'], testament: 'NT', category: 'Catholic Epistle',
    chapters: 5, isDeuterocanonical: false
  },
  {
    pocId: 70, id: 63, en: '2 John', ml: '2 യോഹന്നാൻ',
    aliases: ['2 jn', '2jn', '2j'], testament: 'NT', category: 'Catholic Epistle',
    chapters: 1, isDeuterocanonical: false
  },
  {
    pocId: 71, id: 64, en: '3 John', ml: '3 യോഹന്നാൻ',
    aliases: ['3 jn', '3jn', '3j'], testament: 'NT', category: 'Catholic Epistle',
    chapters: 1, isDeuterocanonical: false
  },
  {
    pocId: 72, id: 65, en: 'Jude', ml: 'യുദാസ്',
    aliases: ['jud', 'jd'], testament: 'NT', category: 'Catholic Epistle',
    chapters: 1, isDeuterocanonical: false
  },

  // =========================================================================
  // NEW TESTAMENT — APOCALYPSE / PROPHECY (1 Book)
  // =========================================================================
  {
    pocId: 73, id: 66, en: 'Revelation', ml: 'വെളിപാട്',
    aliases: ['rev', 'rv', 'apocalypse'], testament: 'NT', category: 'Apocalypse',
    chapters: 22, isDeuterocanonical: false
  }
];

export function getCanonicalBookByPocId(pocId) {
  const num = Number(pocId);
  return CANONICAL_BIBLE_BOOKS.find(b => b.pocId === num) || CANONICAL_BIBLE_BOOKS[0];
}

export function getCanonicalBookByName(rawName) {
  if (!rawName) return CANONICAL_BIBLE_BOOKS[0];
  const query = String(rawName).trim().toLowerCase();
  
  // Exact match on English or Malayalam name
  const exact = CANONICAL_BIBLE_BOOKS.find(b =>
    b.en.toLowerCase() === query ||
    b.ml.toLowerCase() === query ||
    b.aliases.includes(query)
  );
  if (exact) return exact;

  // Prefix or partial match
  const partial = CANONICAL_BIBLE_BOOKS.find(b =>
    b.en.toLowerCase().startsWith(query) ||
    b.ml.toLowerCase().startsWith(query) ||
    b.aliases.some(a => a.startsWith(query))
  );
  return partial || CANONICAL_BIBLE_BOOKS[0];
}

/**
 * Filters the 73 books by search query and category pill filter.
 */
export function filterCanonicalBooks(searchQuery = '', categoryFilter = 'ALL') {
  const q = String(searchQuery || '').trim().toLowerCase();
  return CANONICAL_BIBLE_BOOKS.filter(book => {
    // 1. Category Filter
    if (categoryFilter === 'OT' && book.testament !== 'OT') return false;
    if (categoryFilter === 'NT' && book.testament !== 'NT') return false;
    if (categoryFilter === 'GOSPEL' && book.category !== 'Gospel') return false;
    if (categoryFilter === 'WISDOM' && book.category !== 'Wisdom') return false;
    if (categoryFilter === 'DEUTERO' && !book.isDeuterocanonical) return false;

    // 2. Prefix-Anchored Search Query (Starts-With `A*` instead of `*A*`)
    if (!q) return true;
    const enLower = book.en.toLowerCase();
    const mlLower = (book.ml || '').toLowerCase();
    return enLower.startsWith(q) || mlLower.startsWith(q);
  });
}

/**
 * Computes the next chapter sequentially across the entire 73-book Catholic Canon.
 * Transitions seamlessly across books (e.g. Genesis 50 -> Exodus 1, Luke 24 -> John 1).
 */
export function getNextCanonicalChapter(currentPocId, currentChapter) {
  const book = getCanonicalBookByPocId(currentPocId);
  const ch = Number(currentChapter);

  if (ch < book.chapters) {
    return { pocId: book.pocId, book, chapter: ch + 1 };
  }

  // Cross into the next book
  if (book.pocId < 73) {
    const nextBook = getCanonicalBookByPocId(book.pocId + 1);
    return { pocId: nextBook.pocId, book: nextBook, chapter: 1 };
  }

  // End of Revelation
  return { pocId: 73, book, chapter: book.chapters, atEnd: true };
}

/**
 * Computes the previous chapter sequentially across the entire 73-book Catholic Canon.
 * Transitions backwards across books (e.g. Exodus 1 -> Genesis 50, John 1 -> Luke 24).
 */
export function getPrevCanonicalChapter(currentPocId, currentChapter) {
  const book = getCanonicalBookByPocId(currentPocId);
  const ch = Number(currentChapter);

  if (ch > 1) {
    return { pocId: book.pocId, book, chapter: ch - 1 };
  }

  // Cross into the previous book
  if (book.pocId > 1) {
    const prevBook = getCanonicalBookByPocId(book.pocId - 1);
    return { pocId: prevBook.pocId, book: prevBook, chapter: prevBook.chapters };
  }

  // Beginning of Genesis
  return { pocId: 1, book, chapter: 1, atStart: true };
}
