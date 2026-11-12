/**
 * EPHPHATHA UI LAYER: CANONICAL CATHOLIC BIBLE CONTROLLER (73 Books in Sacred Order)
 * Provides independent canonical Bible browsing, instant search, chapter picking,
 * and continuous sequential reading with official Catholic POC Bible (പി.ഒ.സി. ബൈബിൾ).
 */

import {
  CANONICAL_BIBLE_BOOKS,
  filterCanonicalBooks,
  getCanonicalBookByName,
  getCanonicalBookByPocId,
  getNextCanonicalChapter,
  getPrevCanonicalChapter
} from '../domain/canonicalBible.js';
import { fetchPassageWithFailover } from '../adapters/bibleFailoverGateway.js';
import { getAllRecordsMapSync, putRecord, deleteRecord } from '../adapters/indexedDbRepo.js';
import { generateAndDownloadVerseCard } from '../domain/crdtEngine.js';

export const canonicalState = {
  activeFilter: 'ALL',
  searchQuery: '',
  selectedPocId: 1,
  selectedChapter: 1,
  activeViewMode: 'catalog', // 'catalog' | 'reader'
  langMode: 'bilingual' // 'bilingual' | 'en' | 'ml'
};

let deps = {
  audioEngine: null
};

export function initCanonicalBibleView(dependencies = {}) {
  deps = { ...deps, ...dependencies };

  // 1. Search Input Filter & Enter Key Quick Jump
  const searchInput = document.getElementById('bible-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-bible-search');

  searchInput?.addEventListener('input', (e) => {
    canonicalState.searchQuery = e.target.value.trim();
    if (clearSearchBtn) {
      clearSearchBtn.classList.toggle('hidden', !canonicalState.searchQuery);
    }
    renderBibleAutocompleteDropdown();
    renderBibleCatalogGrid();
  });

  searchInput?.addEventListener('focus', () => {
    if (canonicalState.searchQuery) {
      renderBibleAutocompleteDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.bible-search-input-wrap');
    const dropdown = document.getElementById('bible-search-autocomplete');
    if (dropdown && wrap && !wrap.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const matched = filterCanonicalBooks(canonicalState.searchQuery, canonicalState.activeFilter);
      if (matched.length >= 1) {
        document.getElementById('bible-search-autocomplete')?.classList.add('hidden');
        openBibleChapterModal(matched[0]);
      }
    } else if (e.key === 'Escape') {
      document.getElementById('bible-search-autocomplete')?.classList.add('hidden');
    }
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    canonicalState.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    document.getElementById('bible-search-autocomplete')?.classList.add('hidden');
    renderBibleCatalogGrid();
    searchInput?.focus();
  });

  // Populate Quick-Jump Dropdown in Catalog and Reader Toolbar
  populateQuickBookDropdowns();

  // 2. Category Filter Pills
  document.querySelectorAll('#bible-filter-pills [data-bible-filter]').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#bible-filter-pills [data-bible-filter]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      canonicalState.activeFilter = pill.getAttribute('data-bible-filter') || 'ALL';
      renderBibleCatalogGrid();
    });
  });

  // 3. Close Chapter Modal
  document.getElementById('btn-close-chapter-modal')?.addEventListener('click', () => {
    document.getElementById('bible-chapter-modal')?.classList.add('hidden');
  });

  document.getElementById('bible-chapter-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'bible-chapter-modal') {
      document.getElementById('bible-chapter-modal')?.classList.add('hidden');
    }
  });

  // 4. Return to Books Catalog buttons
  document.getElementById('btn-bible-back-to-catalog')?.addEventListener('click', returnToCatalog);
  document.getElementById('btn-bible-return-catalog-bottom')?.addEventListener('click', returnToCatalog);

  // 5. Resume Reading Banner Button
  document.getElementById('btn-bible-resume')?.addEventListener('click', () => {
    const last = getLastReadPosition();
    if (last) {
      openCanonicalChapter(last.pocId, last.chapter);
    }
  });

  // 6. Language Switcher Pills in Reader Toolbar
  const langPills = [
    { id: 'btn-canonical-lang-en-ml', mode: 'bilingual' },
    { id: 'btn-canonical-lang-ml', mode: 'ml' },
    { id: 'btn-canonical-lang-en', mode: 'en' }
  ];

  langPills.forEach(({ id, mode }) => {
    document.getElementById(id)?.addEventListener('click', () => {
      canonicalState.langMode = mode;
      langPills.forEach(p => {
        document.getElementById(p.id)?.classList.toggle('active', p.mode === mode);
      });
      applyLanguageModeToReader();
    });
  });

  // Render initial catalog
  renderBibleCatalogGrid();

  // Initialize auto-hiding sticky toolbar on scroll down
  initToolbarAutoHideOnScroll();
}

export function renderBibleView() {
  const last = getLastReadPosition();
  const banner = document.getElementById('bible-resume-banner');
  const titleEl = document.getElementById('bible-resume-title');

  if (last && banner && titleEl) {
    const book = getCanonicalBookByPocId(last.pocId);
    titleEl.textContent = `${book.en} Chapter ${last.chapter} • ${book.ml} ${last.chapter}`;
    banner.classList.remove('hidden');
  } else if (banner) {
    banner.classList.add('hidden');
  }

  if (canonicalState.activeViewMode === 'reader') {
    document.getElementById('bible-catalog-pane')?.classList.add('hidden');
    document.getElementById('bible-reader-pane')?.classList.remove('hidden');
  } else {
    document.getElementById('bible-catalog-pane')?.classList.remove('hidden');
    document.getElementById('bible-reader-pane')?.classList.add('hidden');
    renderBibleCatalogGrid();
  }
}

export function returnToCatalog() {
  canonicalState.activeViewMode = 'catalog';
  document.getElementById('bible-reader-pane')?.classList.add('hidden');
  document.getElementById('bible-catalog-pane')?.classList.remove('hidden');
  document.querySelector('.bible-reader-toolbar')?.classList.remove('toolbar-hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderBibleView();
}

function getLastReadPosition() {
  try {
    const raw = localStorage.getItem('ephphatha_canonical_last_read');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

export function renderBibleAutocompleteDropdown() {
  const dropdown = document.getElementById('bible-search-autocomplete');
  if (!dropdown) return;

  const q = String(canonicalState.searchQuery || '').trim();
  if (!q) {
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    return;
  }

  const matched = filterCanonicalBooks(q, canonicalState.activeFilter);
  dropdown.innerHTML = '';

  if (matched.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'bible-autocomplete-empty';
    emptyRow.textContent = `No books starting with "${q}"`;
    dropdown.appendChild(emptyRow);
    dropdown.classList.remove('hidden');
    return;
  }

  const qLen = q.length;
  const qLower = q.toLowerCase();

  matched.forEach(book => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'bible-autocomplete-item';

    const enMatch = book.en.toLowerCase().startsWith(qLower);
    const enHtml = enMatch
      ? `<strong class="prefix-highlight">${book.en.slice(0, qLen)}</strong>${book.en.slice(qLen)}`
      : book.en;

    const mlMatch = (book.ml || '').toLowerCase().startsWith(qLower);
    const mlHtml = mlMatch
      ? `<strong class="prefix-highlight">${book.ml.slice(0, qLen)}</strong>${book.ml.slice(qLen)}`
      : book.ml;

    item.innerHTML = `
      <div class="bible-autocomplete-left">
        <span class="bible-autocomplete-en">${enHtml}</span>
        <span class="bible-autocomplete-ml lang-ml">${mlHtml}</span>
      </div>
      <span class="bible-autocomplete-meta">${book.chapters} Ch ➔</span>
    `;

    item.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      openBibleChapterModal(book);
    });

    dropdown.appendChild(item);
  });

  dropdown.classList.remove('hidden');
}

export function renderBibleCatalogGrid() {
  const container = document.getElementById('bible-books-grid');
  if (!container) return;

  const books = filterCanonicalBooks(canonicalState.searchQuery, canonicalState.activeFilter);
  container.innerHTML = '';

  if (books.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 2rem 1rem; color: var(--text-secondary);';
    emptyNotice.innerHTML = `
      <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🔍</div>
      <p style="font-weight: 600;">No books match "${canonicalState.searchQuery}"</p>
      <button type="button" class="ergonomic-btn" style="margin: 0.75rem auto 0; display: inline-flex;">Reset Filter</button>
    `;
    emptyNotice.querySelector('button')?.addEventListener('click', () => {
      const searchInput = document.getElementById('bible-search-input');
      if (searchInput) searchInput.value = '';
      canonicalState.searchQuery = '';
      canonicalState.activeFilter = 'ALL';
      document.querySelectorAll('#bible-filter-pills [data-bible-filter]').forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-bible-filter') === 'ALL');
      });
      document.getElementById('btn-clear-bible-search')?.classList.add('hidden');
      renderBibleCatalogGrid();
    });
    container.appendChild(emptyNotice);
    return;
  }

  books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'bible-book-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const paddedNum = String(book.pocId).padStart(2, '0');
    const badgeCategory = book.isDeuterocanonical ? `${book.category} • Deuterocanon` : book.category;

    card.innerHTML = `
      <div class="bible-book-top-row">
        <span class="bible-book-num">#${paddedNum}</span>
        <span class="bible-book-badge ${book.isDeuterocanonical ? 'deutero' : ''}">${badgeCategory}</span>
      </div>
      <div class="bible-book-name-row">
        <span class="bible-book-name-en">${book.en}</span>
        <span class="bible-book-name-ml">${book.ml}</span>
      </div>
      <div class="bible-book-bottom-row">
        <span>📖 ${book.chapters} ${book.chapters === 1 ? 'Chapter' : 'Chapters'}</span>
        <span style="color: var(--period-color); font-weight: 700;">Open ➔</span>
      </div>
    `;

    const openHandler = () => openBibleChapterModal(book);
    card.addEventListener('click', openHandler);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openHandler();
      }
    });

    container.appendChild(card);
  });
}

export function openBibleChapterModal(book) {
  const modal = document.getElementById('bible-chapter-modal');
  const titleEl = document.getElementById('bible-chapter-modal-title');
  const subtitleEl = document.getElementById('bible-chapter-modal-subtitle');
  const grid = document.getElementById('bible-modal-chapter-grid');

  if (!modal || !grid) return;

  if (titleEl) titleEl.textContent = `${book.en} • ${book.ml}`;
  if (subtitleEl) {
    const testamentName = book.testament === 'OT' ? 'Old Testament' : 'New Testament';
    const deuteroNote = book.isDeuterocanonical ? ' • Deuterocanonical' : '';
    subtitleEl.textContent = `${book.chapters} ${book.chapters === 1 ? 'Chapter' : 'Chapters'} • ${book.category} (${testamentName}${deuteroNote})`;
  }

  grid.innerHTML = '';
  for (let ch = 1; ch <= book.chapters; ch++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bible-chapter-btn';
    btn.textContent = String(ch);
    btn.title = `${book.en} Chapter ${ch}`;

    const last = getLastReadPosition();
    if (last && last.pocId === book.pocId && last.chapter === ch) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
      openCanonicalChapter(book.pocId, ch);
    });

    grid.appendChild(btn);
  }

  modal.classList.remove('hidden');
}

export async function openCanonicalChapter(pocId, chapterNum) {
  const book = getCanonicalBookByPocId(pocId);
  const ch = Math.max(1, Math.min(Number(chapterNum), book.chapters));

  canonicalState.selectedPocId = book.pocId;
  canonicalState.selectedChapter = ch;
  canonicalState.activeViewMode = 'reader';

  // Persist last read position
  try {
    localStorage.setItem('ephphatha_canonical_last_read', JSON.stringify({ pocId: book.pocId, chapter: ch }));
  } catch (_) {}

  // Switch UI view to Reader
  document.getElementById('bible-catalog-pane')?.classList.add('hidden');
  const readerPane = document.getElementById('bible-reader-pane');
  if (readerPane) readerPane.classList.remove('hidden');

  // Always ensure toolbar is visible when opening a chapter
  document.querySelector('.bible-reader-toolbar')?.classList.remove('toolbar-hidden');

  // Update Toolbar Title Badge & Quick Selectors
  const titleBadge = document.getElementById('bible-reader-title-badge');
  if (titleBadge) {
    titleBadge.textContent = `${book.en} ${ch} • ${book.ml} ${ch}`;
  }

  const readerBookSelect = document.getElementById('bible-reader-book-select');
  const readerChSelect = document.getElementById('bible-reader-ch-select');
  if (readerBookSelect) {
    readerBookSelect.value = String(book.pocId);
  }
  if (readerChSelect) {
    readerChSelect.innerHTML = '';
    for (let c = 1; c <= book.chapters; c++) {
      const opt = document.createElement('option');
      opt.value = String(c);
      opt.textContent = `Ch ${c}`;
      readerChSelect.appendChild(opt);
    }
    readerChSelect.value = String(ch);
    readerChSelect.onchange = (e) => {
      openCanonicalChapter(book.pocId, Number(e.target.value));
    };
  }

  // Calculate Next & Previous Continuous Navigation
  const prev = getPrevCanonicalChapter(book.pocId, ch);
  const next = getNextCanonicalChapter(book.pocId, ch);

  // Wire mini header buttons
  const prevMiniBtn = document.getElementById('btn-bible-prev-ch-mini');
  const nextMiniBtn = document.getElementById('btn-bible-next-ch-mini');

  if (prevMiniBtn) {
    prevMiniBtn.disabled = Boolean(prev.atStart);
    prevMiniBtn.onclick = () => openCanonicalChapter(prev.pocId, prev.chapter);
  }
  if (nextMiniBtn) {
    nextMiniBtn.disabled = Boolean(next.atEnd);
    nextMiniBtn.onclick = () => openCanonicalChapter(next.pocId, next.chapter);
  }

  // Wire bottom navigation cards
  const prevCard = document.getElementById('btn-bible-prev-ch-card');
  const nextCard = document.getElementById('btn-bible-next-ch-card');
  const prevTitle = document.getElementById('bible-prev-ch-title');
  const nextTitle = document.getElementById('bible-next-ch-title');

  if (prevCard && prevTitle) {
    if (prev.atStart) {
      prevTitle.textContent = 'Genesis 1 (Beginning)';
      prevCard.style.opacity = '0.5';
      prevCard.onclick = null;
    } else {
      prevTitle.textContent = `${prev.book.en} ${prev.chapter} • ${prev.book.ml}`;
      prevCard.style.opacity = '1';
      prevCard.onclick = () => openCanonicalChapter(prev.pocId, prev.chapter);
    }
  }

  if (nextCard && nextTitle) {
    if (next.atEnd) {
      nextTitle.textContent = 'Revelation 22 (End of Canon)';
      nextCard.style.opacity = '0.5';
      nextCard.onclick = null;
    } else {
      nextTitle.textContent = `${next.book.en} ${next.chapter} • ${next.book.ml}`;
      nextCard.style.opacity = '1';
      nextCard.onclick = () => openCanonicalChapter(next.pocId, next.chapter);
    }
  }

  // Display Loading Skeleton
  const versesStream = document.getElementById('bible-verses-stream');
  const jumpBar = document.getElementById('bible-verse-jump-bar');
  if (jumpBar) jumpBar.innerHTML = '';
  if (versesStream) {
    versesStream.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;" class="rotating-icon">⏳</div>
        <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); margin-bottom: 4px;">
          Opening ${book.en} ${ch} • ${book.ml} ${ch}...
        </div>
        <div style="font-size: 0.8rem;">Retrieving authentic Malayalam Bible text</div>
      </div>
    `;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Fetch full sequential bilingual chapter using 4-Tier failover gateway
  const refEn = `${book.en} ${ch}`;
  const refMl = `${book.ml} ${ch}`;

  try {
    const passageData = await fetchPassageWithFailover(refEn, refMl);
    renderCanonicalChapterVerses(passageData, book, ch);
  } catch (err) {
    if (versesStream) {
      versesStream.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-secondary);">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
          <p>Failed to load ${refEn}. Please check your connection.</p>
          <button type="button" class="ergonomic-btn" onclick="window.openCanonicalChapter && window.openCanonicalChapter(${pocId}, ${ch})">Retry</button>
        </div>
      `;
    }
  }
}

function renderCanonicalChapterVerses(passageData, book, chapterNum) {
  const jumpBar = document.getElementById('bible-verse-jump-bar');
  const versesStream = document.getElementById('bible-verses-stream');
  if (!jumpBar || !versesStream) return;

  jumpBar.innerHTML = '';
  versesStream.innerHTML = '';

  const verses = passageData.verses || [];
  if (verses.length === 0) {
    versesStream.innerHTML = `<div style="text-align: center; padding: 2rem;">No verses available for this chapter.</div>`;
    return;
  }

  const bookmarksMap = getAllRecordsMapSync('bookmarks');

  verses.forEach((v, idx) => {
    const vDomId = `canonical-verse-${chapterNum}-${v.verse}`;
    const bookmarkId = `bm_canonical_${book.pocId}_${chapterNum}_v${v.verse}`;
    const isBookmarked = Boolean(bookmarksMap[bookmarkId]);

    // 1. Quick-Jump Pill
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'verse-pill';
    pill.textContent = `v.${v.verse}`;
    pill.addEventListener('click', () => {
      const target = document.getElementById(vDomId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('audio-active-verse');
        setTimeout(() => target.classList.remove('audio-active-verse'), 1800);
      }
    });
    jumpBar.appendChild(pill);

    // 2. Verse Card
    const card = document.createElement('article');
    card.className = 'verse-card';
    card.id = vDomId;

    const header = document.createElement('div');
    header.className = 'verse-card-header';

    const numBadge = document.createElement('span');
    numBadge.className = 'verse-num-badge';
    numBadge.textContent = `${book.en} ${chapterNum}:${v.verse}`;

    const actions = document.createElement('div');
    actions.className = 'verse-actions';

    // Speak Button (TTS)
    const speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'verse-icon-btn';
    speakBtn.textContent = '🔊 Read';
    speakBtn.title = 'Listen to this verse aloud';
    speakBtn.addEventListener('click', () => {
      if (deps.audioEngine) {
        deps.audioEngine.speakVerseAloud(v.en, 'en-US');
      }
    });

    // Bookmark Button
    const bmBtn = document.createElement('button');
    bmBtn.type = 'button';
    bmBtn.className = `verse-icon-btn ${isBookmarked ? 'active-bookmark' : ''}`;
    bmBtn.textContent = isBookmarked ? '🔖 Saved' : '🔖';
    bmBtn.title = isBookmarked ? 'Remove bookmark' : 'Bookmark verse';
    bmBtn.addEventListener('click', async () => {
      const activeBookmarks = getAllRecordsMapSync('bookmarks');
      if (activeBookmarks[bookmarkId]) {
        await deleteRecord('bookmarks', bookmarkId);
        bmBtn.classList.remove('active-bookmark');
        bmBtn.textContent = '🔖';
      } else {
        const bookmarkRecord = {
          id: bookmarkId,
          dayNumber: null,
          periodName: book.category,
          referenceEn: `${book.en} ${chapterNum}:${v.verse}`,
          referenceMl: `${book.ml} ${chapterNum}:${v.verse}`,
          verseNumber: v.verse,
          en: v.en,
          ml: v.ml
        };
        await putRecord('bookmarks', bookmarkRecord);
        bmBtn.classList.add('active-bookmark');
        bmBtn.textContent = '🔖 Saved';
      }
    });

    // Share Button
    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'verse-icon-btn';
    shareBtn.textContent = '🎨 Share';
    shareBtn.title = 'Share verse or generate image card';
    shareBtn.addEventListener('click', async () => {
      const shareText = `"${v.en}"\n\n"${v.ml}"\n\n— ${book.en} ${chapterNum}:${v.verse} (${book.ml})\nEphphatha Sanctuary`;
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${book.en} ${chapterNum}:${v.verse}`,
            text: shareText,
            url: window.location.href
          });
          return;
        } catch (_) {}
      }
      try {
        await navigator.clipboard.writeText(shareText);
        alert(`Copied ${book.en} ${chapterNum}:${v.verse} to clipboard!`);
      } catch (_) {
        generateAndDownloadVerseCard({
          referenceEn: `${book.en} ${chapterNum}:${v.verse}`,
          referenceMl: `${book.ml} ${chapterNum}:${v.verse}`,
          en: v.en,
          ml: v.ml,
          periodHex: '#2B8CBE'
        });
      }
    });

    actions.appendChild(speakBtn);
    actions.appendChild(bmBtn);
    actions.appendChild(shareBtn);

    header.appendChild(numBadge);
    header.appendChild(actions);
    card.appendChild(header);

    // Verse Text Container
    const body = document.createElement('div');
    body.className = 'verse-body';

    // English Text
    const enP = document.createElement('p');
    enP.className = 'verse-text-en canonical-verse-en';
    enP.textContent = v.en;
    body.appendChild(enP);

    // Malayalam POC Text
    if (v.ml) {
      const mlP = document.createElement('p');
      mlP.className = 'verse-text-ml canonical-verse-ml';
      mlP.textContent = v.ml;
      body.appendChild(mlP);
    }

    // Latin Nova Vulgata Text (Rendered only if Latin is enabled by user)
    const showLatin = localStorage.getItem('ephphatha_show_latin') === 'true';
    if (v.la) {
      const laP = document.createElement('p');
      laP.className = 'verse-text-latin canonical-verse-la';
      laP.innerHTML = `<em>Vulgata:</em> "${v.la}"`;
      if (!showLatin) laP.style.display = 'none';
      body.appendChild(laP);
    }

    card.appendChild(body);
    versesStream.appendChild(card);
  });

  applyLanguageModeToReader();
}

export function applyLanguageModeToReader() {
  const mode = canonicalState.langMode;
  document.querySelectorAll('.canonical-verse-en').forEach(el => {
    el.style.display = (mode === 'bilingual' || mode === 'en') ? 'block' : 'none';
  });
  document.querySelectorAll('.canonical-verse-ml').forEach(el => {
    el.style.display = (mode === 'bilingual' || mode === 'ml') ? 'block' : 'none';
  });
  const showLatin = localStorage.getItem('ephphatha_show_latin') === 'true';
  document.querySelectorAll('.canonical-verse-la').forEach(el => {
    el.style.display = showLatin ? 'block' : 'none';
  });
}

/**
 * Populates Quick-Jump Book selector dropdown in Catalog & Reader Toolbar
 */
function populateQuickBookDropdowns() {
  const quickSelect = document.getElementById('bible-quick-book-dropdown');
  const readerBookSelect = document.getElementById('bible-reader-book-select');

  const groups = [
    { label: 'Pentateuch / Torah (5)', filter: b => b.pocId >= 1 && b.pocId <= 5 },
    { label: 'Historical Books (16)', filter: b => b.category === 'Historical' },
    { label: 'Wisdom & Poetry (7)', filter: b => b.category === 'Wisdom' },
    { label: 'Prophetic Books (18)', filter: b => b.category === 'Prophets' },
    { label: 'Gospels & Acts (5)', filter: b => b.category === 'Gospel' || b.en === 'Acts' },
    { label: 'Epistles & Letters (21)', filter: b => b.category === 'Epistle' },
    { label: 'Apocalypse / Revelation (1)', filter: b => b.en === 'Revelation' }
  ];

  if (quickSelect) {
    quickSelect.innerHTML = '<option value="">⚡ Jump to Book (All 73 Books)...</option>';
    groups.forEach(g => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = g.label;
      CANONICAL_BIBLE_BOOKS.filter(g.filter).forEach(b => {
        const opt = document.createElement('option');
        opt.value = String(b.pocId);
        opt.textContent = `${b.pocId}. ${b.en} (${b.ml}) — ${b.chapters} ch`;
        optgroup.appendChild(opt);
      });
      quickSelect.appendChild(optgroup);
    });

    quickSelect.addEventListener('change', (e) => {
      const pocId = Number(e.target.value);
      if (pocId) {
        const book = getCanonicalBookByPocId(pocId);
        if (book) {
          openBibleChapterModal(book);
          quickSelect.value = '';
        }
      }
    });
  }

  if (readerBookSelect) {
    readerBookSelect.innerHTML = '';
    CANONICAL_BIBLE_BOOKS.forEach(b => {
      const opt = document.createElement('option');
      opt.value = String(b.pocId);
      opt.textContent = `${b.en} • ${b.ml}`;
      readerBookSelect.appendChild(opt);
    });

    readerBookSelect.addEventListener('change', (e) => {
      const pocId = Number(e.target.value);
      if (pocId) {
        openCanonicalChapter(pocId, 1);
      }
    });
  }
}

/**
 * Auto-hiding sticky navigation bar when scrolling down to read,
 * smoothly returning when scrolling up to navigate.
 */
function initToolbarAutoHideOnScroll() {
  let lastScrollY = window.scrollY || 0;
  let ticking = false;
  const SCROLL_THRESHOLD = 8; // Small delta to prevent micro-jitter

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        handleToolbarScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  function handleToolbarScroll() {
    const readerPane = document.getElementById('bible-reader-pane');
    if (!readerPane || readerPane.classList.contains('hidden')) return;

    const toolbar = document.querySelector('.bible-reader-toolbar');
    if (!toolbar) return;

    const currentScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const delta = currentScrollY - lastScrollY;

    // Always show toolbar when near the top of the passage
    if (currentScrollY <= 40) {
      toolbar.classList.remove('toolbar-hidden');
      lastScrollY = currentScrollY;
      return;
    }

    // Ignore tiny scroll changes
    if (Math.abs(delta) < SCROLL_THRESHOLD) {
      return;
    }

    if (delta > 0) {
      // User is scrolling DOWN to read verses -> hide toolbar to maximize vertical reading area
      toolbar.classList.add('toolbar-hidden');
    } else {
      // User is scrolling UP -> reveal navigation toolbar
      toolbar.classList.remove('toolbar-hidden');
    }

    lastScrollY = currentScrollY;
  }
}
