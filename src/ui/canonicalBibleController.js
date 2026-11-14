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
import { getAllRecordsMapSync, getAllRecordsSync, putRecord, deleteRecord } from '../adapters/indexedDbRepo.js';
import { generateAndDownloadVerseCard } from '../domain/crdtEngine.js';

export const canonicalState = {
  activeFilter: 'ALL',
  searchQuery: '',
  searchMode: 'books', // 'books' | 'verses'
  selectedPocId: 1,
  selectedChapter: 1,
  activeViewMode: 'catalog', // 'catalog' | 'reader'
  langMode: 'bilingual' // 'bilingual' | 'en' | 'ml'
};

let verseSearchDebounceId = null;

let deps = {
  audioEngine: null
};

export function initCanonicalBibleView(dependencies = {}) {
  deps = { ...deps, ...dependencies };

  // 1. Search Input Filter & Enter Key Quick Jump + Full-Text Verse Search Mode
  const searchInput = document.getElementById('bible-search-input');
  const clearSearchBtn = document.getElementById('btn-clear-bible-search');
  const modeBooksBtn = document.getElementById('btn-search-mode-books');
  const modeVersesBtn = document.getElementById('btn-search-mode-verses');

  const setSearchMode = (mode) => {
    canonicalState.searchMode = mode === 'verses' ? 'verses' : 'books';
    const isVerses = canonicalState.searchMode === 'verses';
    modeBooksBtn?.classList.toggle('active', !isVerses);
    modeVersesBtn?.classList.toggle('active', isVerses);

    if (searchInput) {
      searchInput.placeholder = isVerses
        ? 'Search verses in EN or മലയാളം (e.g. light, shepherd, സ്നേഹം)...'
        : 'Search book by starting letter (e.g. M → Matthew, Mark, Malachi...)';
    }

    document.getElementById('bible-search-autocomplete')?.classList.add('hidden');
    document.getElementById('bible-filter-pills')?.classList.toggle('hidden', isVerses);
    document.getElementById('bible-books-grid')?.classList.toggle('hidden', isVerses);
    document.getElementById('bible-verse-search-results')?.classList.toggle('hidden', !isVerses);

    if (isVerses) {
      renderBibleVerseSearchResults(canonicalState.searchQuery);
    } else {
      renderBibleCatalogGrid();
    }
  };

  modeBooksBtn?.addEventListener('click', () => setSearchMode('books'));
  modeVersesBtn?.addEventListener('click', () => {
    setSearchMode('verses');
    searchInput?.focus();
  });

  searchInput?.addEventListener('input', (e) => {
    canonicalState.searchQuery = e.target.value.trim();
    if (clearSearchBtn) {
      clearSearchBtn.classList.toggle('hidden', !canonicalState.searchQuery);
    }
    if (canonicalState.searchMode === 'verses') {
      if (verseSearchDebounceId) clearTimeout(verseSearchDebounceId);
      verseSearchDebounceId = setTimeout(() => {
        renderBibleVerseSearchResults(canonicalState.searchQuery);
      }, 150);
    } else {
      renderBibleAutocompleteDropdown();
      renderBibleCatalogGrid();
    }
  });

  searchInput?.addEventListener('focus', () => {
    if (canonicalState.searchMode === 'books' && canonicalState.searchQuery) {
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
      if (canonicalState.searchMode === 'verses') {
        if (verseSearchDebounceId) clearTimeout(verseSearchDebounceId);
        renderBibleVerseSearchResults(canonicalState.searchQuery);
        return;
      }
      const matched = filterCanonicalBooks(canonicalState.searchQuery, canonicalState.activeFilter);
      if (matched.length >= 1) {
        document.getElementById('bible-search-autocomplete')?.classList.add('hidden');
        openBibleChapterModal(matched[0]);
      } else if (canonicalState.searchQuery.length >= 2) {
        setSearchMode('verses');
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
    if (canonicalState.searchMode === 'verses') {
      renderBibleVerseSearchResults('');
    } else {
      renderBibleCatalogGrid();
    }
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

  // Initialize zero-footprint contextual Quick Search & Scroll-to-Top on Bible catalog
  initCatalogQuickSearchTrigger();
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
    const icon = document.createElement('div');
    icon.style.cssText = 'font-size: 1.5rem; margin-bottom: 0.5rem;';
    icon.textContent = '🔍';

    const msg = document.createElement('p');
    msg.style.fontWeight = '600';
    msg.textContent = `No books match "${canonicalState.searchQuery}"`;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-top: 0.75rem;';

    if (canonicalState.searchQuery.length >= 2) {
      const searchVersesBtn = document.createElement('button');
      searchVersesBtn.type = 'button';
      searchVersesBtn.className = 'ergonomic-btn primary-period';
      searchVersesBtn.textContent = `🔍 Search "${canonicalState.searchQuery}" in Verses`;
      searchVersesBtn.addEventListener('click', () => {
        document.getElementById('btn-search-mode-verses')?.click();
      });
      btnRow.appendChild(searchVersesBtn);
    }

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'ergonomic-btn';
    resetBtn.textContent = 'Reset Filter';
    resetBtn.addEventListener('click', () => {
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
    btnRow.appendChild(resetBtn);

    emptyNotice.appendChild(icon);
    emptyNotice.appendChild(msg);
    emptyNotice.appendChild(btnRow);
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

function appendHighlightedText(parentEl, text, query) {
  const str = String(text || '');
  const q = String(query || '').trim();
  if (!q) {
    parentEl.textContent = str;
    return;
  }
  const lower = str.toLowerCase();
  const qLower = q.toLowerCase();
  let lastIdx = 0;
  let idx = lower.indexOf(qLower, lastIdx);
  while (idx !== -1) {
    if (idx > lastIdx) {
      parentEl.appendChild(document.createTextNode(str.slice(lastIdx, idx)));
    }
    const mark = document.createElement('mark');
    mark.className = 'bible-search-mark';
    mark.textContent = str.slice(idx, idx + q.length);
    parentEl.appendChild(mark);
    lastIdx = idx + q.length;
    idx = lower.indexOf(qLower, lastIdx);
  }
  if (lastIdx < str.length) {
    parentEl.appendChild(document.createTextNode(str.slice(lastIdx)));
  }
}

export function renderBibleVerseSearchResults(rawQuery = '') {
  const container = document.getElementById('bible-verse-search-results');
  if (!container) return;
  container.textContent = '';

  const q = String(rawQuery || '').trim();
  if (q.length < 2) {
    const hint = document.createElement('div');
    hint.className = 'bible-verse-search-hint';
    hint.textContent = 'Type at least 2 characters to search English & Malayalam verses in your local Scripture vault.';
    container.appendChild(hint);
    return;
  }

  const qLower = q.toLowerCase();
  const cachedPassages = getAllRecordsSync('scripture_cache') || [];
  const seenRefs = new Set();
  const matches = [];

  for (const passage of cachedPassages) {
    const verses = Array.isArray(passage?.verses) ? passage.verses : [];
    for (const v of verses) {
      const enText = String(v.en || '');
      const mlText = String(v.ml || '');
      const refEn = String(v.ref_en || passage.reference_en || '');
      const refMl = String(v.ref_ml || passage.reference_ml || '');
      if (
        enText.toLowerCase().includes(qLower) ||
        mlText.toLowerCase().includes(qLower) ||
        refEn.toLowerCase().includes(qLower)
      ) {
        const dedupeKey = `${refEn}|${v.verse}`;
        if (seenRefs.has(dedupeKey)) continue;
        seenRefs.add(dedupeKey);
        matches.push({ passage, v, refEn, refMl });
      }
    }
  }

  const summary = document.createElement('div');
  summary.className = 'bible-verse-search-summary';
  const maxShow = 50;
  summary.textContent = matches.length === 0
    ? `No cached verses match "${q}". Open chapters in the Bible Reader to cache more books offline.`
    : (matches.length > maxShow
      ? `Showing top ${maxShow} of ${matches.length} matches for "${q}"`
      : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'} for "${q}"`);
  container.appendChild(summary);

  if (matches.length === 0) return;

  const bookmarksMap = getAllRecordsMapSync('bookmarks');

  matches.slice(0, maxShow).forEach(({ passage, v, refEn, refMl }) => {
    // Parse book & chapter from refEn (e.g. "Genesis 1:3" or "1 Samuel 3:10")
    const refMatch = refEn.match(/^(.+?)\s+(\d+)(?::(\d+))?$/);
    const parsedBook = refMatch ? getCanonicalBookByName(refMatch[1]) : null;
    const parsedChapter = refMatch ? Number(refMatch[2]) : (v.chapter || 1);

    const card = document.createElement('article');
    card.className = 'verse-card bible-search-result-card';

    const header = document.createElement('div');
    header.className = 'verse-card-header';

    const refBadge = document.createElement('span');
    refBadge.className = 'verse-num-badge';
    refBadge.textContent = refMl ? `${refEn} • ${refMl}` : refEn;

    const actions = document.createElement('div');
    actions.className = 'verse-actions';

    const bmId = parsedBook
      ? `bm_canonical_${parsedBook.pocId}_${parsedChapter}_v${v.verse}`
      : `bm_search_${refEn.replace(/\s+/g, '_')}_v${v.verse}`;
    const isSaved = Boolean(bookmarksMap[bmId]);
    if (isSaved) card.classList.add('verse-highlighted');

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = `verse-icon-btn ${isSaved ? 'active-bookmark' : ''}`;
    saveBtn.textContent = isSaved ? '🔖 Saved' : '🔖 Save';
    saveBtn.addEventListener('click', async () => {
      const active = getAllRecordsMapSync('bookmarks');
      if (active[bmId]) {
        await deleteRecord('bookmarks', bmId);
        saveBtn.classList.remove('active-bookmark');
        saveBtn.textContent = '🔖 Save';
        card.classList.remove('verse-highlighted');
      } else {
        await putRecord('bookmarks', {
          id: bmId,
          dayNumber: null,
          periodName: parsedBook?.category || 'Scripture',
          referenceEn: refEn || `${passage.reference_en}:${v.verse}`,
          referenceMl: refMl || `${passage.reference_ml}:${v.verse}`,
          verseNumber: v.verse,
          en: v.en,
          ml: v.ml || ''
        });
        saveBtn.classList.add('active-bookmark');
        saveBtn.textContent = '🔖 Saved';
        card.classList.add('verse-highlighted');
      }
    });
    actions.appendChild(saveBtn);

    if (parsedBook) {
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'verse-icon-btn';
      openBtn.textContent = 'Open Ch ➔';
      openBtn.addEventListener('click', async () => {
        await openCanonicalChapter(parsedBook.pocId, parsedChapter);
        const target = document.getElementById(`canonical-verse-${parsedChapter}-${v.verse}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.add('audio-active-verse');
          setTimeout(() => target.classList.remove('audio-active-verse'), 2200);
        }
      });
      actions.appendChild(openBtn);
    }

    header.appendChild(refBadge);
    header.appendChild(actions);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'verse-body';
    if (v.en) {
      const pEn = document.createElement('p');
      pEn.className = 'verse-text-en';
      appendHighlightedText(pEn, v.en, q);
      body.appendChild(pEn);
    }
    if (v.ml) {
      const pMl = document.createElement('p');
      pMl.className = 'verse-text-ml lang-ml';
      appendHighlightedText(pMl, v.ml, q);
      body.appendChild(pMl);
    }
    card.appendChild(body);
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
    const existingBookmark = bookmarksMap[bookmarkId] || null;
    const isBookmarked = Boolean(existingBookmark);

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
    card.className = `verse-card ${isBookmarked ? 'verse-highlighted' : ''}`;
    card.id = vDomId;
    card.dataset.verseNumber = String(v.verse);

    const header = document.createElement('div');
    header.className = 'verse-card-header';

    const numBadge = document.createElement('span');
    numBadge.className = 'verse-num-badge';
    numBadge.dataset.refEn = `${book.en} ${chapterNum}:${v.verse}`;
    numBadge.dataset.refMl = `${book.ml} ${chapterNum}:${v.verse}`;
    numBadge.dataset.bookMl = book.ml;
    numBadge.textContent = numBadge.dataset.refEn;

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

    // Bookmark / Highlight Button
    const bmBtn = document.createElement('button');
    bmBtn.type = 'button';
    bmBtn.className = `verse-icon-btn ${isBookmarked ? 'active-bookmark' : ''}`;
    bmBtn.textContent = isBookmarked ? '🔖 Saved' : '🔖';
    bmBtn.title = isBookmarked ? 'Remove highlight & bookmark' : 'Highlight & bookmark verse';

    const notePreview = document.createElement('div');
    notePreview.className = `verse-note-chip ${existingBookmark?.note ? '' : 'hidden'}`;
    if (existingBookmark?.note) {
      notePreview.textContent = `📝 ${existingBookmark.note}`;
    }

    const toggleHighlightAndBookmark = async (forceSaveNote = null) => {
      const activeBookmarks = getAllRecordsMapSync('bookmarks');
      const existing = activeBookmarks[bookmarkId];
      if (existing && forceSaveNote === null) {
        await deleteRecord('bookmarks', bookmarkId);
        bmBtn.classList.remove('active-bookmark');
        bmBtn.textContent = '🔖';
        card.classList.remove('verse-highlighted');
        notePreview.classList.add('hidden');
        notePreview.textContent = '';
      } else {
        const bookmarkRecord = {
          id: bookmarkId,
          dayNumber: null,
          periodName: book.category,
          referenceEn: `${book.en} ${chapterNum}:${v.verse}`,
          referenceMl: `${book.ml} ${chapterNum}:${v.verse}`,
          verseNumber: v.verse,
          en: v.en,
          ml: v.ml,
          note: forceSaveNote !== null ? forceSaveNote : (existing?.note || '')
        };
        await putRecord('bookmarks', bookmarkRecord);
        bmBtn.classList.add('active-bookmark');
        bmBtn.textContent = '🔖 Saved';
        card.classList.add('verse-highlighted');
        if (bookmarkRecord.note) {
          notePreview.textContent = `📝 ${bookmarkRecord.note}`;
          notePreview.classList.remove('hidden');
        } else {
          notePreview.classList.add('hidden');
        }
      }
    };

    bmBtn.addEventListener('click', () => toggleHighlightAndBookmark(null));

    // Inline Note Button
    const noteBtn = document.createElement('button');
    noteBtn.type = 'button';
    noteBtn.className = `verse-icon-btn ${existingBookmark?.note ? 'active-bookmark' : ''}`;
    noteBtn.textContent = '📝';
    noteBtn.title = 'Add or edit personal note';

    const noteEditor = document.createElement('div');
    noteEditor.className = 'verse-note-editor hidden';
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'verse-note-input';
    noteInput.placeholder = 'Write a short reflection or note...';
    noteInput.maxLength = 240;
    noteInput.value = existingBookmark?.note || '';

    const noteSaveBtn = document.createElement('button');
    noteSaveBtn.type = 'button';
    noteSaveBtn.className = 'verse-icon-btn active-bookmark';
    noteSaveBtn.textContent = 'Save';
    noteSaveBtn.addEventListener('click', async () => {
      const cleanNote = noteInput.value.trim();
      await toggleHighlightAndBookmark(cleanNote);
      noteBtn.classList.toggle('active-bookmark', Boolean(cleanNote));
      noteEditor.classList.add('hidden');
    });
    noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') noteSaveBtn.click();
    });
    noteEditor.appendChild(noteInput);
    noteEditor.appendChild(noteSaveBtn);

    noteBtn.addEventListener('click', () => {
      const activeBookmarks = getAllRecordsMapSync('bookmarks');
      noteInput.value = activeBookmarks[bookmarkId]?.note || '';
      noteEditor.classList.toggle('hidden');
      if (!noteEditor.classList.contains('hidden')) {
        noteInput.focus();
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
    actions.appendChild(noteBtn);
    actions.appendChild(shareBtn);

    header.appendChild(numBadge);
    header.appendChild(actions);
    card.appendChild(header);

    // Verse Text Container (Tap-to-Highlight / Bookmark)
    const body = document.createElement('div');
    body.className = 'verse-body verse-body-tappable';
    body.title = 'Tap verse to highlight & save to Saved tab';
    body.addEventListener('click', () => {
      const sel = window.getSelection ? String(window.getSelection()) : '';
      if (sel.length > 0) return; // Don't toggle if user is selecting text
      toggleHighlightAndBookmark(null);
    });

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
    card.appendChild(notePreview);
    card.appendChild(noteEditor);
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
  document.querySelectorAll('#bible-verses-stream .verse-num-badge').forEach(badge => {
    const refEn = badge.dataset.refEn || '';
    const refMl = badge.dataset.refMl || '';
    const bookMl = badge.dataset.bookMl || '';
    badge.textContent = '';
    if (mode === 'ml' && refMl) {
      const mlSpan = document.createElement('span');
      mlSpan.className = 'lang-ml';
      mlSpan.textContent = refMl;
      badge.appendChild(mlSpan);
    } else if (mode === 'bilingual' && bookMl) {
      badge.appendChild(document.createTextNode(refEn));
      const sep = document.createElement('span');
      sep.className = 'verse-ref-sep';
      sep.textContent = '•';
      const mlSpan = document.createElement('span');
      mlSpan.className = 'lang-ml';
      mlSpan.textContent = bookMl;
      badge.appendChild(sep);
      badge.appendChild(mlSpan);
    } else {
      badge.textContent = refEn;
    }
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

/**
 * Zero-Footprint Quick Search & Scroll-to-Top on the Bible Catalog:
 * - Zero permanent screen footprint (stays hidden while search input is in view).
 * - Appears only when search bar is scrolled out of view AND user scrolls upward,
 *   then auto-hides after 2.8s of scroll idle.
 * - Focuses the search input synchronously inside the user tap so mobile keyboards
 *   open immediately while smoothly scrolling to the top.
 */
function initCatalogQuickSearchTrigger() {
  const pillBtn = document.getElementById('btn-bible-quick-search');
  const searchInput = document.getElementById('bible-search-input');
  const viewBible = document.getElementById('view-bible');
  const catalogPane = document.getElementById('bible-catalog-pane');
  const bibleNavBtn = document.querySelector('[data-nav-tab="bible"]');

  if (!pillBtn || !searchInput || !viewBible || !catalogPane) return;

  let isSearchBarVisible = true;
  let lastScrollY = window.scrollY || 0;
  let ticking = false;
  let hideTimerId = null;

  const isCatalogActive = () =>
    !viewBible.classList.contains('hidden') && !catalogPane.classList.contains('hidden');

  const hidePill = () => {
    if (hideTimerId) {
      clearTimeout(hideTimerId);
      hideTimerId = null;
    }
    pillBtn.classList.remove('visible');
  };

  const showPillWithIdleAutoHide = () => {
    if (!isCatalogActive() || isSearchBarVisible) {
      hidePill();
      return;
    }
    pillBtn.classList.add('visible');
    if (hideTimerId) clearTimeout(hideTimerId);
    hideTimerId = setTimeout(() => {
      pillBtn.classList.remove('visible');
      hideTimerId = null;
    }, 2800);
  };

  const triggerTopAndSearchFocus = () => {
    hidePill();
    // Focus synchronously within user gesture so mobile keyboards open immediately
    searchInput.focus({ preventScroll: true });
    if (searchInput.value) {
      searchInput.select();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  pillBtn.addEventListener('click', triggerTopAndSearchFocus);

  // Tapping the active Bible bottom-nav tab while scrolled down also jumps to search
  bibleNavBtn?.addEventListener('click', () => {
    const currentY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    if (isCatalogActive() && currentY > 120) {
      triggerTopAndSearchFocus();
    }
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isSearchBarVisible = Boolean(entry?.isIntersecting);
        if (isSearchBarVisible) {
          hidePill();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(searchInput);
  }

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const currentY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
        const delta = currentY - lastScrollY;
        lastScrollY = currentY;

        if (!isCatalogActive() || currentY <= 180) {
          hidePill();
          return;
        }

        if (!('IntersectionObserver' in window)) {
          isSearchBarVisible = currentY <= 220;
        }

        if (delta < -6 && !isSearchBarVisible) {
          showPillWithIdleAutoHide();
        } else if (delta > 16) {
          hidePill();
        }
      });
    },
    { passive: true }
  );
}
