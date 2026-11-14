/**
 * EPHPHATHA SHARED UI MODULE: SEAMLESS VERSE-BY-VERSE VERSION SWITCHER
 * Drives zero-footprint, instant translation cycling across English (RSV2CE ↔ BSB ↔ WEB)
 * and Malayalam (POC ↔ MOV) on both 'Reading' and 'Bible' pages with scroll-anchor
 * stability, conflict-free gestures, and bounded memory hygiene.
 */

import {
  ENGLISH_BIBLE_VERSIONS,
  MALAYALAM_BIBLE_VERSIONS,
  fetchChapterTranslationMap,
  getDefaultLanguageVersions,
  prefetchChapterAlternates
} from '../adapters/bibleFailoverGateway.js?v=3.5.34';

const viewScopes = new Map(); // viewId -> { scopeKey, overrides: Map<string, VerseSwitchRecord> }
const prefetchControllers = new Map(); // viewId -> { timerId, abortController }

/**
 * Resets per-verse override state cleanly whenever a view navigates to a new chapter/day/translation,
 * while preserving overrides when re-rendering within the exact same scope (e.g., lang mode toggle).
 */
export function beginVerseVersionScope(viewId, scopeKey) {
  const existing = viewScopes.get(viewId);
  if (existing && existing.scopeKey === scopeKey) {
    return existing;
  }
  const fresh = {
    scopeKey,
    overrides: new Map()
  };
  viewScopes.set(viewId, fresh);
  return fresh;
}

/**
 * Schedules quiet idle preloading of alternate English/Malayalam versions for visible chapters.
 */
export function schedulePassageVersionPrefetch(viewId, chapterTargets = []) {
  const prev = prefetchControllers.get(viewId);
  if (prev) {
    if (prev.timerId) clearTimeout(prev.timerId);
    if (prev.abortController) {
      try { prev.abortController.abort(); } catch (_) {}
    }
  }

  if (!Array.isArray(chapterTargets) || chapterTargets.length === 0) return;

  const abortController = new AbortController();
  const run = () => {
    if (abortController.signal.aborted) return;
    prefetchChapterAlternates(chapterTargets, { signal: abortController.signal }).catch(() => {});
  };

  const timerId = setTimeout(() => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => run(), { timeout: 1200 });
    } else {
      run();
    }
  }, 240);

  prefetchControllers.set(viewId, { timerId, abortController });
}

/**
 * Formats `.verse-num-badge` consistently across Reading and Bible views with interactive
 * language segments and non-intrusive visual state when a verse differs from page default.
 */
export function formatVerseRefBadge(badgeEl, refEn, refMl, bookMl, mode, versionMeta = null) {
  if (!badgeEl) return;
  badgeEl.textContent = '';

  const enChanged = Boolean(versionMeta?.enVer && versionMeta?.defaultEnVer && versionMeta.enVer !== versionMeta.defaultEnVer);
  const mlChanged = Boolean(versionMeta?.mlVer && versionMeta?.defaultMlVer && versionMeta.mlVer !== versionMeta.defaultMlVer);
  const anyChanged = enChanged || mlChanged;

  badgeEl.classList.toggle('version-switched', anyChanged);

  if (mode === 'ml' && refMl) {
    const mlSpan = document.createElement('span');
    mlSpan.className = `verse-ref-part lang-ml ${mlChanged ? 'lang-part-switched' : ''}`.trim();
    mlSpan.dataset.switchLang = 'ml';
    mlSpan.textContent = refMl;
    badgeEl.appendChild(mlSpan);
  } else if (mode === 'bilingual' && bookMl) {
    const enSpan = document.createElement('span');
    enSpan.className = `verse-ref-part ${enChanged ? 'lang-part-switched' : ''}`.trim();
    enSpan.dataset.switchLang = 'en';
    enSpan.textContent = refEn;

    const sep = document.createElement('span');
    sep.className = 'verse-ref-sep';
    sep.textContent = '•';

    const mlSpan = document.createElement('span');
    mlSpan.className = `verse-ref-part lang-ml ${mlChanged ? 'lang-part-switched' : ''}`.trim();
    mlSpan.dataset.switchLang = 'ml';
    mlSpan.textContent = bookMl;

    badgeEl.appendChild(enSpan);
    badgeEl.appendChild(sep);
    badgeEl.appendChild(mlSpan);
  } else {
    const enSpan = document.createElement('span');
    enSpan.className = `verse-ref-part ${enChanged ? 'lang-part-switched' : ''}`.trim();
    enSpan.dataset.switchLang = 'en';
    enSpan.textContent = refEn;
    badgeEl.appendChild(enSpan);
  }

  const activeTags = [];
  if (enChanged) activeTags.push(versionMeta.enVer);
  if (mlChanged) activeTags.push(versionMeta.mlVer);
  const verNote = activeTags.length > 0 ? ` [${activeTags.join(' / ')}]` : '';

  badgeEl.setAttribute('role', 'button');
  badgeEl.setAttribute('tabindex', '0');
  badgeEl.setAttribute(
    'aria-label',
    `${refEn}${verNote} — Tap to switch translation, hold or right-click to go back`
  );
  badgeEl.title = `Tap to switch translation (${activeTags.length ? activeTags.join(' • ') : 'Default'}) • Hold / Shift+Click for previous`;
}

/**
 * Updates a verse paragraph's text in-place and shows an inline muted version badge
 * only when switched away from the page's default translation.
 */
export function setVerseParagraphContent(pEl, text, activeVer, defaultVer, animate = false) {
  if (!pEl) return;
  const cleanText = String(text || '');
  const isSwitched = Boolean(activeVer && defaultVer && activeVer !== defaultVer);

  pEl.textContent = '';
  pEl.appendChild(document.createTextNode(cleanText));
  pEl.dataset.activeVer = activeVer || defaultVer || '';

  if (isSwitched) {
    const tag = document.createElement('span');
    tag.className = 'verse-inline-ver-tag';
    tag.setAttribute('aria-label', `Translation: ${activeVer}`);
    tag.textContent = activeVer;
    pEl.appendChild(tag);
  }

  if (animate) {
    pEl.classList.remove('verse-text-swapping');
    void pEl.offsetWidth;
    pEl.classList.add('verse-text-swapping');
    const clearAnim = () => pEl.classList.remove('verse-text-swapping');
    pEl.addEventListener('animationend', clearAnim, { once: true });
    setTimeout(clearAnim, 200);
  }
}

/**
 * Returns the live displayed clean English and Malayalam strings for a verse card
 * (excluding visual inline version tags so Read, Bookmark, and Share remain clean).
 */
export function getActiveVerseTexts(viewId, verseKey, fallbackEn = '', fallbackMl = '') {
  const rec = viewScopes.get(viewId)?.overrides.get(verseKey);
  if (!rec) {
    return { en: fallbackEn, ml: fallbackMl };
  }
  return {
    en: rec.currentEn || fallbackEn,
    ml: rec.currentMl || fallbackMl
  };
}

/**
 * Returns existing record or initializes record for a verse within its active scope,
 * preserving previously switched translations across intra-chapter re-renders.
 */
function ensureVerseRecord(config) {
  const scope = beginVerseVersionScope(config.viewId, config.scopeKey);
  const existing = scope.overrides.get(config.verseKey);
  const defaults = getDefaultLanguageVersions(config.preferredVersion, config.location.bookId);
  const defaultEnVer = config.actualEnVer || defaults.en;
  const defaultMlVer = config.actualMlVer || defaults.ml;

  if (existing) {
    existing.cardEl = config.cardEl;
    existing.badgeEl = config.badgeEl;
    existing.enEl = config.enEl;
    existing.mlEl = config.mlEl;
    existing.mode = config.mode;
    existing.refEn = config.refEn;
    existing.refMl = config.refMl;
    existing.bookMl = config.bookMl;
    return existing;
  }

  const record = {
    viewId: config.viewId,
    verseKey: config.verseKey,
    location: config.location,
    refEn: config.refEn,
    refMl: config.refMl,
    bookMl: config.bookMl,
    mode: config.mode,
    defaultEnVer,
    defaultMlVer,
    enVer: defaultEnVer,
    mlVer: defaultMlVer,
    defaultEn: config.defaultEn || '',
    defaultMl: config.defaultMl || '',
    currentEn: config.defaultEn || '',
    currentMl: config.defaultMl || '',
    cardEl: config.cardEl,
    badgeEl: config.badgeEl,
    enEl: config.enEl,
    mlEl: config.mlEl,
    isSwapping: false,
    onFeedback: config.onFeedback || null
  };

  scope.overrides.set(config.verseKey, record);
  return record;
}

function getOrderedCycleForLanguage(langGroup, defaultVer) {
  const base = langGroup === 'ml' ? MALAYALAM_BIBLE_VERSIONS : ENGLISH_BIBLE_VERSIONS;
  const idx = base.indexOf(defaultVer);
  if (idx <= 0) return [...base];
  return [...base.slice(idx), ...base.slice(0, idx)];
}

/**
 * Cycles a single verse forward (+1) or backward (-1) within English or Malayalam translations,
 * locking scroll position around card height adjustments and avoiding unavailable versions.
 */
async function cycleVerseTranslation(record, langGroup, direction = 1) {
  if (!record || record.isSwapping) return;

  const targetLang = langGroup === 'ml' ? 'ml' : 'en';
  const defaultVer = targetLang === 'ml' ? record.defaultMlVer : record.defaultEnVer;
  const currentVer = targetLang === 'ml' ? record.mlVer : record.enVer;
  const targetEl = targetLang === 'ml' ? record.mlEl : record.enEl;

  // If currently hidden in the user's selected reading mode, do not swap invisibly
  if (!targetEl || targetEl.style.display === 'none') return;

  const cycle = getOrderedCycleForLanguage(targetLang, defaultVer);
  if (cycle.length <= 1) return;

  const startIdx = Math.max(0, cycle.indexOf(currentVer));
  record.isSwapping = true;

  const loadingTimer = setTimeout(() => {
    record.badgeEl?.classList.add('verse-switching-loading');
  }, 50);

  try {
    let nextVer = null;
    let nextText = null;
    let sawOffline = false;

    for (let step = 1; step < cycle.length; step++) {
      const candidateIdx = (startIdx + (direction * step) + cycle.length * 4) % cycle.length;
      const candidateVer = cycle[candidateIdx];

      if (candidateVer === defaultVer) {
        nextVer = defaultVer;
        nextText = targetLang === 'ml' ? record.defaultMl : record.defaultEn;
        break;
      }

      const mapResult = await fetchChapterTranslationMap(
        candidateVer,
        record.location.bookId,
        record.location.pocId,
        record.location.chapter
      );

      if (mapResult?.status === 'ok' && mapResult.versesByNum) {
        const fetchedVerse = mapResult.versesByNum.get(Number(record.location.verse));
        if (fetchedVerse) {
          nextVer = candidateVer;
          nextText = fetchedVerse;
          break;
        }
      } else if (mapResult?.status === 'offline') {
        sawOffline = true;
      }
    }

    if (!nextVer || !nextText) {
      if (typeof record.onFeedback === 'function') {
        record.onFeedback(
          sawOffline
            ? 'Offline — connect once to load alternate translation'
            : `Only ${defaultVer} is available for this passage`
        );
      }
      return;
    }

    // Preserve exact viewport Y anchor of the tapped/swiped card across text length changes
    const beforeTop = record.cardEl.getBoundingClientRect().top;

    if (targetLang === 'ml') {
      record.mlVer = nextVer;
      record.currentMl = nextText;
      setVerseParagraphContent(record.mlEl, nextText, nextVer, record.defaultMlVer, true);
    } else {
      record.enVer = nextVer;
      record.currentEn = nextText;
      setVerseParagraphContent(record.enEl, nextText, nextVer, record.defaultEnVer, true);
    }

    formatVerseRefBadge(record.badgeEl, record.refEn, record.refMl, record.bookMl, record.mode, {
      enVer: record.enVer,
      defaultEnVer: record.defaultEnVer,
      mlVer: record.mlVer,
      defaultMlVer: record.defaultMlVer
    });

    const afterTop = record.cardEl.getBoundingClientRect().top;
    const scrollDelta = afterTop - beforeTop;
    if (Math.abs(scrollDelta) > 0.5) {
      window.scrollBy(0, scrollDelta);
    }
  } finally {
    clearTimeout(loadingTimer);
    record.badgeEl?.classList.remove('verse-switching-loading');
    record.isSwapping = false;
  }
}

function resolveBadgeTargetLanguage(eventTarget, mode) {
  if (mode === 'ml') return 'ml';
  if (mode === 'en') return 'en';
  const partEl = eventTarget?.closest?.('[data-switch-lang]');
  const attr = partEl?.getAttribute?.('data-switch-lang');
  return attr === 'ml' ? 'ml' : 'en';
}

/**
 * Registers a verse card, updates initial text/badge from scope state, and binds conflict-free
 * tap / long-press / keyboard / touch-swipe handlers for verse-level translation switching.
 */
export function attachVerseVersionSwitcher(config) {
  const record = ensureVerseRecord(config);

  if (record.enEl) {
    setVerseParagraphContent(record.enEl, record.currentEn, record.enVer, record.defaultEnVer, false);
  }
  if (record.mlEl) {
    setVerseParagraphContent(record.mlEl, record.currentMl, record.mlVer, record.defaultMlVer, false);
  }

  formatVerseRefBadge(record.badgeEl, record.refEn, record.refMl, record.bookMl, record.mode, {
    enVer: record.enVer,
    defaultEnVer: record.defaultEnVer,
    mlVer: record.mlVer,
    defaultMlVer: record.defaultMlVer
  });

  // 1. Interactive Reference Badge: Tap = Forward, Long-Press / Right-Click / Shift+Click = Backward
  const badge = record.badgeEl;
  if (badge) {
    let pressTimer = null;
    let pressStartX = 0;
    let pressStartY = 0;
    let longPressFired = false;
    let pressLang = 'en';

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    badge.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      longPressFired = false;
      pressStartX = e.clientX;
      pressStartY = e.clientY;
      pressLang = resolveBadgeTargetLanguage(e.target, record.mode);
      cancelPress();
      pressTimer = setTimeout(() => {
        longPressFired = true;
        pressTimer = null;
        cycleVerseTranslation(record, pressLang, -1);
      }, 420);
    });

    badge.addEventListener('pointermove', (e) => {
      if (!pressTimer) return;
      if (Math.hypot(e.clientX - pressStartX, e.clientY - pressStartY) > 8) {
        cancelPress();
      }
    });

    badge.addEventListener('pointerup', cancelPress);
    badge.addEventListener('pointercancel', cancelPress);

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelPress();
      if (longPressFired) {
        longPressFired = false;
        return;
      }
      const lang = resolveBadgeTargetLanguage(e.target, record.mode);
      cycleVerseTranslation(record, lang, e.shiftKey ? -1 : 1);
    });

    badge.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cancelPress();
      const lang = resolveBadgeTargetLanguage(e.target, record.mode);
      cycleVerseTranslation(record, lang, -1);
    });

    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        const defaultLang = record.mode === 'ml' ? 'ml' : 'en';
        cycleVerseTranslation(record, defaultLang, e.shiftKey ? -1 : 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        cycleVerseTranslation(record, record.mode === 'ml' ? 'ml' : 'en', 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        cycleVerseTranslation(record, record.mode === 'ml' ? 'ml' : 'en', -1);
      }
    });
  }

  // 2. Conflict-Free Touch Swipe on Verse Card (Guarded against vertical scroll, text selection & OS edge swipes)
  const card = record.cardEl;
  if (card) {
    let swipeState = null;

    card.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) {
        swipeState = null;
        return;
      }
      const interactive = e.target?.closest?.('button, input, a, .verse-num-badge, .verse-actions, .verse-note-editor');
      if (interactive) {
        swipeState = null;
        return;
      }
      const touch = e.touches[0];
      const vw = window.innerWidth || document.documentElement.clientWidth || 390;
      // Preserve OS/browser back-forward edge swipe zones (36px from each viewport edge)
      if (touch.clientX < 36 || touch.clientX > vw - 36) {
        swipeState = null;
        return;
      }
      const startedInMl = Boolean(e.target?.closest?.('.verse-text-ml'));
      const lang = record.mode === 'ml'
        ? 'ml'
        : (record.mode === 'bilingual' && startedInMl ? 'ml' : 'en');

      swipeState = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        startTime: Date.now(),
        cancelled: false,
        lang
      };
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!swipeState || swipeState.cancelled || e.touches.length !== 1) return;
      const touch = e.touches[0];
      swipeState.lastX = touch.clientX;
      swipeState.lastY = touch.clientY;
      const dx = touch.clientX - swipeState.startX;
      const dy = touch.clientY - swipeState.startY;
      // Cancel immediately if vertical scrolling is detected so native 60fps scroll never stalls
      if (Math.abs(dy) > 14 && Math.abs(dy) >= Math.abs(dx) * 0.7) {
        swipeState.cancelled = true;
      }
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
      if (!swipeState || swipeState.cancelled) {
        swipeState = null;
        return;
      }
      const dt = Date.now() - swipeState.startTime;
      const dx = swipeState.lastX - swipeState.startX;
      const dy = swipeState.lastY - swipeState.startY;
      const sel = window.getSelection ? String(window.getSelection()) : '';
      const targetLang = swipeState.lang;
      swipeState = null;

      if (sel.length > 0 || dt >= 380) return;
      if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 2.2) {
        // Prevent synthetic click on `.verse-body-tappable` from toggling bookmark highlight
        card.dataset.suppressBookmarkUntil = String(Date.now() + 420);
        cycleVerseTranslation(record, targetLang, dx < 0 ? 1 : -1);
      }
    }, { passive: true });

    card.addEventListener('touchcancel', () => {
      swipeState = null;
    }, { passive: true });
  }

  return record;
}

/**
 * Updates `.verse-num-badge` state during client-side language mode toggles (e.g. Canonical Bible EN+മല / EN / മല)
 * without losing active per-verse translation overrides or interactive segments.
 */
export function refreshVerseBadgeForMode(viewId, verseKey, nextMode) {
  const rec = viewScopes.get(viewId)?.overrides.get(verseKey);
  if (!rec || !rec.badgeEl) return;
  rec.mode = nextMode;
  formatVerseRefBadge(rec.badgeEl, rec.refEn, rec.refMl, rec.bookMl, nextMode, {
    enVer: rec.enVer,
    defaultEnVer: rec.defaultEnVer,
    mlVer: rec.mlVer,
    defaultMlVer: rec.defaultMlVer
  });
}

/**
 * Updates a uniform icon-only verse action button cleanly without changing its outer width.
 */
export function updateVerseActionButton(btn, { icon, title, isActive } = {}) {
  if (!btn) return;
  if (typeof isActive === 'boolean') {
    btn.classList.toggle('bookmarked', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  }
  if (title !== undefined) {
    btn.title = title;
    btn.setAttribute('aria-label', title);
  }
  const iconEl = btn.querySelector('.verse-btn-icon');
  if (iconEl && icon !== undefined) iconEl.textContent = icon;
}

/**
 * Builds a uniform, fixed-footprint icon-only button for verse toolbars
 * so toggling states never shifts neighboring controls or squeezes the reference badge.
 */
export function createVerseActionButton({ icon, title, isActive = false, onClick }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `verse-icon-btn verse-action-tile ${isActive ? 'bookmarked' : ''}`.trim();
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.setAttribute('aria-pressed', String(Boolean(isActive)));

  const iconEl = document.createElement('span');
  iconEl.className = 'verse-btn-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon;

  btn.appendChild(iconEl);
  if (typeof onClick === 'function') {
    btn.addEventListener('click', onClick);
  }
  return btn;
}
