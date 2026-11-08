/**
 * EPHPHATHA UI LAYER: REACTIVE APPLICATION CONTROLLER
 * Connects Domain (12 Periods, Grace Streak, WebAuthn + AES-GCM + HMAC Security)
 * and Adapters (IndexedDB <5ms Vault, 4-Tier Bible Failover, HTTP 206 Audio Engine, BackgroundSync).
 */

import { EphphathaAudioEngine, formatSecondsAsTime, normalizeGoogleDriveAudioId } from '../adapters/audioEngine.js';
import {
  circuitBreakerState,
  fetchPassageWithFailover,
  initScriptureVault,
  onFailoverEvent
} from '../adapters/bibleFailoverGateway.js';
import {
  createNewCohortInstance,
  fetchCohortByInviteCode,
  generateUniqueInviteCode,
  getActiveCohortCode,
  getLocalMemberIdentity,
  joinExistingCohortByCode,
  normalizeAndValidateInviteCode,
  onCohortStateChange,
  publishCohortPrayerRequest,
  publishCohortReflection,
  purgeLegacyPrototypeFellowships,
  setActiveCohortCode,
  supportCohortItem,
  syncMemberProgressToActiveCohort
} from '../adapters/fellowshipGateway.js';
import {
  clearStore,
  deleteRecord,
  getAllRecordsMapSync,
  getAllRecordsSync,
  getRecordSync,
  initLocalVault,
  onStorageLatency,
  putRecord
} from '../adapters/indexedDbRepo.js';
import {
  enqueueCloudSyncMutation,
  flushSyncOutboxNow,
  initBackgroundSyncLifecycle,
  onSyncStatusChange
} from '../adapters/syncWorkerClient.js';
import { buildFull365Curriculum, calculateGraceStreak, getPeriodTokens } from '../domain/periods.js';
import {
  getGoogleSheetsSyncUrl,
  setGoogleSheetsSyncUrl,
  isGoogleSheetsConfigured,
  testGoogleSheetsConnection,
  loginAndRetrieveUserData,
  syncUserDataToGoogleSheet,
  syncDayProgressToGoogleSheet,
  onGoogleSheetsSyncStatus
} from '../adapters/googleSheetsAdapter.js';
import {
  LECTIO_DIVINA_STEPS,
  generateAndDownloadVerseCard,
  mergeCrdtShardMaps,
  nextHlcTimestamp
} from '../domain/crdtEngine.js';
import {
  authenticateWithDeviceBiometrics,
  decodeEntitiesForTextContent,
  decryptJournalReflection,
  encryptJournalReflection,
  getRateLimiterStatus,
  onSecurityTelemetry,
  sanitizeUserString
} from '../domain/securityEngine.js';
import {
  initCanonicalBibleView,
  renderBibleView,
  openCanonicalChapter,
  applyLanguageModeToReader
} from './canonicalBibleController.js';

const appState = {
  theme: localStorage.getItem('ephphatha_theme') || 'dark', // Default to soothing Warm Dusk (#1E2430)
  fontScale: localStorage.getItem('ephphatha_font_scale') || '100',
  activeTab: 'sanctuary', // 'sanctuary' | 'curriculum' | 'fellowship' | 'vault'
  inspectorOpen: window.innerWidth >= 1100, // Closed by default on mobile / tablets
  selectedDay: Number(localStorage.getItem('ephphatha_selected_day')) || 1,
  activeReadingSlot: 'narrative', // 'narrative' | 'supplemental' | 'psalm_wisdom'
  langMode: localStorage.getItem('ephphatha_lang_mode') || 'bilingual', // 'bilingual' | 'en' | 'ml'
  showLatinVulgate: localStorage.getItem('ephphatha_show_latin') === 'true', // Default to false
  preferredBibleVersion: localStorage.getItem('ephphatha_preferred_bible_version') || 'POC',
  verseWeight: localStorage.getItem('ephphatha_verse_weight') || 'strong',
  periods: [],
  scheduleByDay: {},
  currentPassageData: null,
  userProfile: null,
  lastIdbLatencyMs: 0.18,
  telemetryFeed: [],
  previewCohortCode: generateUniqueInviteCode(6)
};

const audioEngine = new EphphathaAudioEngine();

export async function bootstrapEphphathaApp() {
  // 1. Apply eye-soothing theme (#FAF7F2 Parchment or #1E2430 Warm Dusk — Never #000000) & Font Scale
  applyTheme(appState.theme);
  applyFontScale(appState.fontScale);
  applyTypographyAndLanguagePreferences();

  // 2. Initialize Local-First IndexedDB Vault (<5ms) & Tier-3/4 Scripture Vault
  await initLocalVault();
  if (localStorage.getItem('ephphatha_poc_scripture_v335') !== 'true') {
    await clearStore('scripture_cache');
    localStorage.setItem('ephphatha_poc_scripture_v335', 'true');
  }
  await initScriptureVault();
  initBackgroundSyncLifecycle();

  // 3. Audio Continuous Autoplay: When daily audio finishes, advance to next day and auto-play
  audioEngine.onEnded(async (finishedDay) => {
    if (appState.selectedDay < 365) {
      const nextDay = appState.selectedDay + 1;
      await selectDay(nextDay);
      audioEngine.play();
    }
  });

  // 3. Load saved biometric profile if present
  const savedProfile = localStorage.getItem('ephphatha_biometric_profile_v3');
  if (savedProfile) {
    try { appState.userProfile = JSON.parse(savedProfile); } catch (_) { /* ignore */ }
  }

  // 4. Purge any legacy prototype/mock fellowship data & initialize live Cohort Gateway
  await purgeLegacyPrototypeFellowships();
  onCohortStateChange(() => {
    renderFellowshipView();
  });

  // 5. Hydrate 365-Day Dynamic Online Curriculum (`schedule_manifest_v3.json`)
  await loadDynamicCurriculumManifest();

  // 6. Wire Telemetry & Security Listeners
  wireTelemetryStreams();

  // 7. Bind Top Header, Navigation, Modals, and Inspector Controls
  bindGlobalControls();

  // 8. Initialize Canonical Catholic Bible Navigator (73 Books)
  initCanonicalBibleView({ audioEngine });
  if (typeof window !== 'undefined') {
    window.openCanonicalChapter = openCanonicalChapter;
  }

  // Initialize inspector state based on screen width
  const shell = document.getElementById('workspace-shell');
  const inspector = document.getElementById('telemetry-inspector');
  if (shell) shell.classList.toggle('inspector-open', appState.inspectorOpen);
  if (inspector) inspector.classList.toggle('hidden', !appState.inspectorOpen);

  // 8. Select initial Day and render full UI
  await selectDay(appState.selectedDay, { initialBoot: true });
  await initializeFellowshipOnBoot();
  renderFellowshipView();
  renderCurriculumMapView();
  renderVaultView();
  renderUserProfileBadge();

  // 9. Initialize Google Sheets Master Database sync & multi-user live polling
  initGoogleSheetsSyncOnBoot();
}

async function initGoogleSheetsSyncOnBoot() {
  const sheetsInput = document.getElementById('input-sheets-sync-url');
  if (sheetsInput) {
    sheetsInput.value = getGoogleSheetsSyncUrl();
  }
  updateSheetsSyncStatusBadge();

  onGoogleSheetsSyncStatus(snapshot => {
    updateSheetsSyncStatusBadge(snapshot);
  });

  // If user profile is already saved and online, retrieve latest cloud data in background
  const identity = getLocalMemberIdentity();
  const userName = appState.userProfile?.displayName || identity.name;
  if (userName && navigator.onLine) {
    try {
      const cloudRes = await loginAndRetrieveUserData(userName, appState.userProfile?.credentialIdHex);
      if (cloudRes.found && cloudRes.progressMap) {
        const localProgress = getAllRecordsMapSync('progress');
        const mergeResult = mergeCrdtShardMaps(localProgress, cloudRes.progressMap);
        for (const rec of Object.values(mergeResult.merged)) {
          await putRecord('progress', rec);
        }
        if (cloudRes.user?.activeCohortCode && !getActiveCohortCode()) {
          setActiveCohortCode(cloudRes.user.activeCohortCode);
        }
        restoreUserSettingsFromCloudProfile(cloudRes.user);
        refreshGraceStreakHeader();
        renderCurriculumMapView();
        renderDayHeroCard(appState.scheduleByDay[appState.selectedDay]);
        const note = document.getElementById('user-profile-status-note');
        if (note) {
          note.textContent = `✓ Cloud Sync Active: ${userName} (${cloudRes.completedCount} days synced)`;
          note.style.color = 'var(--text-accent)';
        }
      }
    } catch (_) { /* offline / graceful degradation */ }
  }

  // Multi-user Fellowship periodic polling (every 25 seconds when on Fellowship tab)
  setInterval(async () => {
    if (appState.activeTab === 'fellowship' && navigator.onLine && !appState.forceShowCohortGateway) {
      const code = getActiveCohortCode();
      if (code) {
        try {
          await fetchCohortByInviteCode(code);
          renderFellowshipView();
        } catch (_) { /* ignore background poll errors */ }
      }
    }
  }, 25000);
}

function updateSheetsSyncStatusBadge(snapshot) {
  const badge = document.getElementById('sheets-sync-status-badge');
  if (!badge) return;
  if (isGoogleSheetsConfigured()) {
    badge.textContent = snapshot?.status === 'CONNECTED' ? '✅ Google Sheet: Connected' : '☁️ Google Sheet: Active';
    badge.style.color = 'var(--text-accent)';
  } else {
    badge.textContent = 'Google Sheet: Direct / Edge Proxy';
    badge.style.color = 'var(--text-secondary)';
  }
}

async function loadDynamicCurriculumManifest() {
  let manifestJson = {};
  try {
    const res = await fetch('./data/schedule_manifest_v3.json');
    if (res.ok) {
      manifestJson = await res.json();
      pushTelemetryLog('SCHEDULE_HYDRATED', 'Loaded schedule_manifest_v3.json (Stale-While-Revalidate)');
    }
  } catch (_) {
    pushTelemetryLog('SCHEDULE_OFFLINE_CACHE', 'Hydrated 365-day curriculum from deterministic local manifest');
  }

  const built = buildFull365Curriculum(manifestJson);
  appState.periods = built.periods;
  appState.scheduleByDay = built.scheduleByDay;

  // Auto-discover any newly uploaded audio files in Google Drive if Root Folder ID is configured
  const savedRootFolderId = localStorage.getItem('ephphatha_root_folder_id');
  if (savedRootFolderId && audioEngine.edgeProxyBaseUrl && navigator.onLine) {
    fetch(`${audioEngine.edgeProxyBaseUrl}/discover/${encodeURIComponent(savedRootFolderId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.dayMap) {
          for (const [dKey, fId] of Object.entries(data.dayMap)) {
            localStorage.setItem(`ephphatha_gdrive_id_day_${dKey}`, fId);
            if (appState.scheduleByDay[Number(dKey)]) {
              appState.scheduleByDay[Number(dKey)].gdrive_audio_file_id = fId;
            }
          }
          renderDayHeroCard(appState.scheduleByDay[appState.selectedDay]);
          audioEngine.loadDayAudio(appState.scheduleByDay[appState.selectedDay], 0);
          pushTelemetryLog('AUTO_DRIVE_DISCOVERY', `Auto-synced ${data.discoveredCount || 0} audio files from Google Drive folder`);
        }
      })
      .catch(() => {});
  }

  populateDayDropdown();
  renderPeriodsRibbon();
}

async function initializeFellowshipOnBoot() {
  // Check if user opened a shared Cohort Invitation Deep-Link (`?cohort=XXXXXX&cohortName=...`)
  try {
    const params = new URLSearchParams(window.location.search);
    const urlCohort = params.get('cohort');
    if (urlCohort) {
      const check = normalizeAndValidateInviteCode(urlCohort);
      if (check.valid) {
        const joinInput = document.getElementById('input-join-cohort-code');
        if (joinInput) joinInput.value = check.code;
        appState.forceShowCohortGateway = true;
        appState.pendingInviteCohortName = params.get('cohortName') || '';
        switchMainTab('fellowship');
        showCohortGatewayAlert(`Invitation Code "${check.code}" detected from share link. Enter your name below to join!`, false);
        return;
      }
    }
  } catch (_) { /* ignore */ }

  const activeCode = getActiveCohortCode();
  if (activeCode) {
    try {
      await fetchCohortByInviteCode(activeCode);
      await syncMemberProgressToActiveCohort(getCurrentProgressMetrics());
    } catch (_) { /* offline fallback uses local IndexedDB */ }
  }
}

/* ============================================================================
 * THEME ENGINE & SENIOR-FIRST FONT SCALER
 * ============================================================================ */
function applyTheme(themeMode) {
  appState.theme = themeMode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', appState.theme);
  localStorage.setItem('ephphatha_theme', appState.theme);

  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    themeBtn.textContent = appState.theme === 'dark' ? '☀️' : '🌙';
    themeBtn.title = appState.theme === 'dark'
      ? 'Switch to Warm Parchment Light Mode (#FAF7F2)'
      : 'Switch to Warm Dusk Dark Mode (#1E2430)';
  }

  // Keep mobile status bar / system chrome color in sync with active theme (eliminates black top band in Light Mode)
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', appState.theme === 'dark' ? '#1E2430' : '#FAF7F2');
  }

  // Re-apply active period soft background for current theme
  const dayObj = appState.scheduleByDay[appState.selectedDay];
  if (dayObj?.period) {
    applyPeriodColorTokens(dayObj.period);
  }
}

function applyPeriodColorTokens(period) {
  if (!period) return;
  const isDark = appState.theme === 'dark';
  const tokens = getPeriodTokens(period.id, isDark);
  document.documentElement.style.setProperty('--period-color', tokens.accent);
  document.documentElement.style.setProperty('--period-text', tokens.text);
  document.documentElement.style.setProperty('--period-bg-soft', tokens.bgSoft);
}

export function applyTypographyAndLanguagePreferences() {
  document.documentElement.setAttribute('data-verse-weight', appState.verseWeight || 'strong');
  document.body.setAttribute('data-lang-pref', appState.langMode || 'bilingual');
  document.body.classList.toggle('show-latin-vulgata', Boolean(appState.showLatinVulgate));
}

function applyFontScale(scaleStr) {
  const valid = ['100', '112', '125'].includes(String(scaleStr)) ? String(scaleStr) : '100';
  appState.fontScale = valid;
  document.documentElement.setAttribute('data-font-scale', valid);
  localStorage.setItem('ephphatha_font_scale', valid);

  const fontBtn = document.getElementById('btn-font-scaler');
  if (fontBtn) {
    fontBtn.textContent = valid === '100' ? 'AA' : `AA ${valid}%`;
  }
}

/* ============================================================================
 * DAY & PERIOD SELECTION + 4-TIER SCRIPTURE LOADING
 * ============================================================================ */
export async function selectDay(dayNum, options = {}) {
  const clamped = Math.max(1, Math.min(365, Number(dayNum) || 1));
  appState.selectedDay = clamped;
  localStorage.setItem('ephphatha_selected_day', String(clamped));

  const daySchedule = appState.scheduleByDay[clamped];
  if (!daySchedule) return;

  // 1. Morph Dynamic Period Theme Tokens (--period-color & --period-bg-soft)
  applyPeriodColorTokens(daySchedule.period);

  // 2. Update Period Ribbon & Day Dropdown
  renderPeriodsRibbon();
  const selectEl = document.getElementById('day-select-dropdown');
  if (selectEl) selectEl.value = String(clamped);

  // 3. Render Day Hero & Historical Context
  renderDayHeroCard(daySchedule);

  // 4. Load Audio Metadata & Saved Timestamp from IndexedDB (<5ms)
  const savedProgress = getRecordSync('progress', String(clamped));
  audioEngine.loadDayAudio(daySchedule, savedProgress?.audioTimestampSec || 0);

  // 5. Load Active Reading Slot Passage via 4-Tier Failover Pipeline
  await loadActiveReadingSlot(daySchedule);

  // 6. Load Encrypted Prayer Reflection for this Day
  await loadDayJournalEntry(clamped, daySchedule);

  // 7. Refresh Grace Streak Banner
  refreshGraceStreakHeader();

  if (!options.initialBoot) {
    pushTelemetryLog('DAY_SELECTED', `Switched to Day ${clamped} (${daySchedule.period.name})`);
  }
}

function renderPeriodsRibbon() {
  const strip = document.getElementById('periods-strip');
  if (!strip) return;
  strip.textContent = '';

  const currentPeriodId = appState.scheduleByDay[appState.selectedDay]?.period_id || 1;

  appState.periods.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `period-chip ${p.id === currentPeriodId ? 'active' : ''}`;
    btn.setAttribute('aria-label', `Period ${p.code}: ${p.name}`);

    const dot = document.createElement('span');
    dot.className = 'period-dot';
    dot.style.backgroundColor = p.accent_hex;

    const meta = document.createElement('div');
    meta.className = 'period-chip-meta';

    const codeSpan = document.createElement('span');
    codeSpan.className = 'period-chip-code';
    codeSpan.textContent = `PERIOD ${p.code} • DAYS ${p.day_start}–${p.day_end}`;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'period-chip-name';
    nameSpan.textContent = `${p.name} (${p.name_ml})`;

    meta.appendChild(codeSpan);
    meta.appendChild(nameSpan);
    btn.appendChild(dot);
    btn.appendChild(meta);

    btn.addEventListener('click', () => {
      selectDay(p.day_start);
      const acc = document.getElementById('periods-accordion');
      if (acc) acc.removeAttribute('open');
    });

    strip.appendChild(btn);
  });
}

function populateDayDropdown() {
  const selectEl = document.getElementById('day-select-dropdown');
  if (!selectEl) return;
  selectEl.textContent = '';

  for (let d = 1; d <= 365; d++) {
    const item = appState.scheduleByDay[d];
    const opt = document.createElement('option');
    opt.value = String(d);
    opt.textContent = `Day ${d} — ${item.episode_title} (${item.period.name})`;
    selectEl.appendChild(opt);
  }
}

function renderDayHeroCard(daySchedule) {
  const badgeEl = document.getElementById('hero-period-badge');
  if (badgeEl) {
    badgeEl.textContent = `Period ${daySchedule.period.code} • ${daySchedule.period.name} (${daySchedule.period.span})`;
  }

  const folderEl = document.getElementById('hero-gdrive-node');
  const rawStoredId = localStorage.getItem(`ephphatha_gdrive_id_day_${daySchedule.day_number}`);
  const customFileId = normalizeGoogleDriveAudioId(rawStoredId);
  if (customFileId) {
    // Also repair localStorage if it held the old un-stripped URL
    if (customFileId !== rawStoredId) {
      localStorage.setItem(`ephphatha_gdrive_id_day_${daySchedule.day_number}`, customFileId);
    }
    daySchedule.gdrive_audio_file_id = customFileId;
  } else {
    daySchedule.gdrive_audio_file_id = normalizeGoogleDriveAudioId(daySchedule.gdrive_audio_file_id);
  }
  if (folderEl) {
    folderEl.textContent = `Daily Audio Narration • ${daySchedule.period.name}`;
  }
  const idInput = document.getElementById('input-day-gdrive-id');
  if (idInput) {
    idInput.value = daySchedule.gdrive_audio_file_id || '';
  }

  const titleEn = document.getElementById('hero-title-en');
  if (titleEn) titleEn.textContent = `Day ${daySchedule.day_number}: ${daySchedule.episode_title}`;

  const titleMl = document.getElementById('hero-title-ml');
  if (titleMl) titleMl.textContent = daySchedule.episode_title_ml || '';

  const ctx = daySchedule.historical_context || {};
  setText('ctx-era-date', ctx.era_date || '');
  setText('ctx-geography', ctx.geography || '');
  setText('ctx-lineage', ctx.lineage || '');
  setText('ctx-summary', `${ctx.summary || ''} ${ctx.summary_ml ? ' — ' + ctx.summary_ml : ''}`);

  // Update Mark Complete Button state
  const progressRec = getRecordSync('progress', String(daySchedule.day_number));
  const isDone = Boolean(progressRec?.completed);
  const completeBtn = document.getElementById('btn-mark-day-complete');
  if (completeBtn) {
    completeBtn.textContent = isDone ? '✅ Done' : '☐ Complete';
    completeBtn.className = isDone ? 'complete-action-btn primary-period' : 'complete-action-btn';
  }

  // Update Reading Slot Tab labels (Concise Scannable Micro-copy)
  const slots = [
    { key: 'narrative', label: '1. Narrative', ref: daySchedule.readings.narrative, refMl: daySchedule.readings.narrative_ml },
    { key: 'supplemental', label: '2. Supplemental', ref: daySchedule.readings.supplemental, refMl: daySchedule.readings.supplemental_ml },
    { key: 'psalm_wisdom', label: '3. Psalm', ref: daySchedule.readings.psalm_wisdom, refMl: daySchedule.readings.psalm_wisdom_ml }
  ];

  const slotContainer = document.getElementById('reading-slot-tabs');
  if (slotContainer) {
    slotContainer.textContent = '';
    slots.forEach(s => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `slot-tab ${appState.activeReadingSlot === s.key ? 'active' : ''}`;

      const topSpan = document.createElement('span');
      topSpan.textContent = `${s.label}: ${s.ref}`;

      const subSpan = document.createElement('span');
      subSpan.className = 'slot-tab-sub lang-ml';
      subSpan.textContent = s.refMl || '';

      btn.appendChild(topSpan);
      btn.appendChild(subSpan);

      btn.addEventListener('click', () => {
        appState.activeReadingSlot = s.key;
        renderDayHeroCard(daySchedule);
        loadActiveReadingSlot(daySchedule);
      });

      slotContainer.appendChild(btn);
    });
  }
}

let activeScriptureAbortController = null;

async function loadActiveReadingSlot(daySchedule) {
  const slotKey = appState.activeReadingSlot;
  const refEn = daySchedule.readings[slotKey] || daySchedule.readings.narrative;
  const refMl = daySchedule.readings[`${slotKey}_ml`] || '';

  // 1. Instant Cache Render: Check IndexedDB synchronously/instantly (<1ms)
  // This completely eliminates any app freeze or lag during rapid day switching!
  const cached = getRecordSync('scripture_cache', refEn);
  if (cached && cached.verses?.length) {
    appState.currentPassageData = cached;
    renderScriptureVerses(cached);
  }

  // 2. Abort prior in-flight fetch
  if (activeScriptureAbortController) {
    try { activeScriptureAbortController.abort(); } catch (_) {}
  }
  activeScriptureAbortController = new AbortController();

  try {
    const passageData = await fetchPassageWithFailover(refEn, refMl, {
      signal: activeScriptureAbortController.signal,
      preferredVersion: appState.preferredBibleVersion
    });
    if (passageData) {
      appState.currentPassageData = passageData;
      renderScriptureVerses(passageData);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('Scripture fetch error:', err);
    }
  }
}

function renderScriptureVerses(passageData) {
  if (!passageData) return;

  const totalVerses = passageData.verses?.length || 0;
  setText('reader-active-ref', `${passageData.reference_en} • ${passageData.reference_ml || ''} (${totalVerses} Verses)`);
  const tierEl = document.getElementById('reader-tier-badge');
  if (tierEl) {
    tierEl.textContent = `Tier ${passageData.activeTier || 1}`;
    tierEl.title = `${passageData.tierBadge} (${passageData.latencyMs.toFixed(1)}ms)`;
  }

  // Render Quick-Jump Verse Pills
  const jumpBar = document.getElementById('verse-jump-bar');
  const versesList = document.getElementById('verses-list');
  if (!jumpBar || !versesList) return;

  jumpBar.textContent = '';
  versesList.textContent = '';

  const bookmarksMap = getAllRecordsMapSync('bookmarks');
  const distinctChapters = new Set(passageData.verses.map(v => v.chapter).filter(Boolean));
  const hasMultipleChapters = distinctChapters.size > 1;
  let lastRenderedChapter = null;

  passageData.verses.forEach((v, idx) => {
    const chKey = v.chapter ? `${v.chapter}_` : '';
    const verseDomId = `verse-card-${chKey}${v.verse}`;
    const bookmarkId = `bm_d${appState.selectedDay}_${passageData.reference_en}_${chKey}v${v.verse}`;
    const isBookmarked = Boolean(bookmarksMap[bookmarkId]);
    const displayRefEn = v.ref_en || (v.chapter ? `${passageData.reference_en.replace(/\s+\d+.*$/, '')} ${v.chapter}:${v.verse}` : `${passageData.reference_en} : ${v.verse}`);
    const displayRefMl = v.ref_ml || passageData.reference_ml || '';

    // Render Chapter Section Header when transitioning chapters in a multi-chapter reading
    if (hasMultipleChapters && v.chapter && v.chapter !== lastRenderedChapter) {
      lastRenderedChapter = v.chapter;
      const chBanner = document.createElement('div');
      chBanner.className = 'chapter-divider-banner';
      const bookTitleEn = displayRefEn.replace(/\s+\d+:\d+$/, '');
      const bookTitleMl = displayRefMl ? displayRefMl.replace(/\s+\d+:\d+$/, '') : '';
      chBanner.textContent = bookTitleMl
        ? `📖 ${bookTitleEn} — Chapter ${v.chapter} • ${bookTitleMl} ${v.chapter}`
        : `📖 ${bookTitleEn} — Chapter ${v.chapter}`;
      versesList.appendChild(chBanner);
    }

    // 1. Quick-Jump Pill
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'verse-pill';
    pill.textContent = hasMultipleChapters && v.chapter ? `${v.chapter}:${v.verse}` : `v.${v.verse}`;
    pill.addEventListener('click', () => {
      const target = document.getElementById(verseDomId);
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
    card.id = verseDomId;
    card.dataset.verseIndex = String(idx);

    const header = document.createElement('div');
    header.className = 'verse-card-header';

    const numBadge = document.createElement('span');
    numBadge.className = 'verse-num-badge';
    numBadge.textContent = displayRefEn;

    const actions = document.createElement('div');
    actions.className = 'verse-actions';

    // Listen Aloud (TTS) button for verse
    const speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'verse-icon-btn';
    speakBtn.textContent = '🔊 Read';
    speakBtn.title = 'Read this verse aloud';
    speakBtn.addEventListener('click', () => {
      audioEngine.speakVerseAloud(v.en, 'en-US');
    });

    // Bookmark 1-tap button
    const bmBtn = document.createElement('button');
    bmBtn.type = 'button';
    bmBtn.className = `verse-icon-btn ${isBookmarked ? 'bookmarked' : ''}`;
    bmBtn.textContent = isBookmarked ? '🔖 Saved' : '🔖';
    bmBtn.title = 'Bookmark Verse';
    bmBtn.addEventListener('click', async () => {
      await toggleVerseBookmark(bookmarkId, displayRefEn, displayRefMl, v);
      renderScriptureVerses(appState.currentPassageData);
      renderVaultView();
    });

    // 1-Tap Bilingual Devotional Verse Image Card Generator
    const shareCardBtn = document.createElement('button');
    shareCardBtn.type = 'button';
    shareCardBtn.className = 'verse-icon-btn';
    shareCardBtn.textContent = '🎨 Share';
    shareCardBtn.title = 'Download High-DPI Bilingual Verse Image Card';
    shareCardBtn.addEventListener('click', async () => {
      const periodObj = appState.scheduleByDay[appState.selectedDay]?.period;
      await generateAndDownloadVerseCard({
        dayNumber: appState.selectedDay,
        periodName: periodObj?.name || 'Salvation History',
        periodAccentHex: periodObj?.accent_hex || '#2B8CBE',
        referenceEn: displayRefEn,
        referenceMl: displayRefMl,
        verseNumber: v.verse,
        textEn: v.en,
        textMl: v.ml
      });
      pushTelemetryLog('VERSE_CARD_GENERATED', `Rendered 1080x1080 bilingual verse card for ${displayRefEn}`);
    });

    actions.appendChild(speakBtn);
    actions.appendChild(bmBtn);
    actions.appendChild(shareCardBtn);
    header.appendChild(numBadge);
    header.appendChild(actions);

    const grid = document.createElement('div');
    grid.className = `verse-bilingual-grid ${appState.langMode === 'bilingual' ? 'parallel-mode' : ''}`;

    if (appState.langMode === 'bilingual' || appState.langMode === 'en') {
      const enPara = document.createElement('p');
      enPara.className = 'verse-text-en';
      enPara.lang = 'en';
      enPara.textContent = v.en;
      grid.appendChild(enPara);
    }

    if (appState.langMode === 'bilingual' || appState.langMode === 'ml') {
      const mlPara = document.createElement('p');
      mlPara.className = 'verse-text-ml lang-ml';
      mlPara.lang = 'ml';
      mlPara.textContent = v.ml;
      grid.appendChild(mlPara);
    }

    card.appendChild(header);
    card.appendChild(grid);

    if (appState.showLatinVulgate && v.la) {
      const laPara = document.createElement('p');
      laPara.className = 'verse-text-la';
      laPara.lang = 'la';
      laPara.textContent = `Vulgata: "${v.la}"`;
      card.appendChild(laPara);
    }

    versesList.appendChild(card);
  });
}

async function toggleVerseBookmark(bookmarkId, refEn, refMl, verseObj) {
  const existing = getRecordSync('bookmarks', bookmarkId);
  if (existing) {
    const res = await deleteRecord('bookmarks', bookmarkId);
    updateIdbLatencyDisplay(res.latencyMs);
    await enqueueCloudSyncMutation('REMOVE_BOOKMARK', 'appDataFolder/bookmarks.json', { id: bookmarkId });
  } else {
    const record = {
      id: bookmarkId,
      dayNumber: appState.selectedDay,
      periodName: appState.scheduleByDay[appState.selectedDay]?.period?.name || '',
      referenceEn: refEn,
      referenceMl: refMl,
      verseNumber: verseObj.verse,
      en: verseObj.en,
      ml: verseObj.ml
    };
    const res = await putRecord('bookmarks', record);
    updateIdbLatencyDisplay(res.latencyMs);
    await enqueueCloudSyncMutation('ADD_BOOKMARK', 'appDataFolder/bookmarks.json', record);
  }
}

/* ============================================================================
 * AES-GCM 256-BIT ENCRYPTED PRAYER JOURNAL
 * ============================================================================ */
async function loadDayJournalEntry(dayNum, daySchedule) {
  setText('journal-prompt-text', daySchedule.historical_context?.reflection_prompt || '');
  const textarea = document.getElementById('journal-textarea');
  const cipherPreview = document.getElementById('journal-cipher-preview');
  if (!textarea) return;

  const storedEnvelope = getRecordSync('journals_encrypted', `journal_day_${dayNum}`);
  if (storedEnvelope && storedEnvelope.ciphertext) {
    const credentialSeed = appState.userProfile?.credentialIdHex || 'default-device-credential';
    const plain = await decryptJournalReflection(storedEnvelope, credentialSeed);
    textarea.value = plain;
    if (cipherPreview) {
      cipherPreview.textContent = '🔒 Saved & Encrypted';
      cipherPreview.title = `AES-256-GCM Ciphertext: ${storedEnvelope.ciphertext.slice(0, 32)}...`;
    }
  } else {
    textarea.value = '';
    if (cipherPreview) {
      cipherPreview.textContent = '🔒 Private & Encrypted';
    }
  }
}

async function saveCurrentDayJournal() {
  const textarea = document.getElementById('journal-textarea');
  const cipherPreview = document.getElementById('journal-cipher-preview');
  if (!textarea) return;

  const rawText = textarea.value.trim();
  const credentialSeed = appState.userProfile?.credentialIdHex || 'default-device-credential';
  const encryptedEnvelope = await encryptJournalReflection(rawText, credentialSeed);

  const record = {
    id: `journal_day_${appState.selectedDay}`,
    dayNumber: appState.selectedDay,
    episodeTitle: appState.scheduleByDay[appState.selectedDay]?.episode_title || '',
    ...encryptedEnvelope
  };

  const writeRes = await putRecord('journals_encrypted', record);
  updateIdbLatencyDisplay(writeRes.latencyMs);

  if (cipherPreview) {
    cipherPreview.textContent = `✅ Saved (${writeRes.latencyMs}ms)`;
    cipherPreview.title = `AES-256-GCM Ciphertext: ${encryptedEnvelope.ciphertext.slice(0, 32)}...`;
  }

  await enqueueCloudSyncMutation('SAVE_ENCRYPTED_JOURNAL', 'appDataFolder/journals.json', {
    dayNumber: appState.selectedDay,
    alg: encryptedEnvelope.alg,
    iv: encryptedEnvelope.iv,
    ciphertext: encryptedEnvelope.ciphertext
  });

  renderVaultView();
}

/* ============================================================================
 * PRODUCTION FELLOWSHIP & ISOLATED COHORT SYSTEM
 * Zero Hardcoded Data • Invite-Code Access Control • Reflections & Prayer Wall
 * ============================================================================ */
function getCurrentProgressMetrics() {
  const completedMap = getAllRecordsMapSync('progress');
  const metrics = calculateGraceStreak(completedMap, appState.selectedDay);
  const completedToday = Boolean(completedMap[String(appState.selectedDay)]?.completed);
  return {
    selectedDay: appState.selectedDay,
    totalCompleted: metrics.totalCompleted,
    streakDays: metrics.streakDays,
    isPlayingAudio: audioEngine.isPlaying,
    activityStatus: audioEngine.isPlaying
      ? `Listening Now • Day ${appState.selectedDay}`
      : completedToday
        ? `Completed Day ${appState.selectedDay}`
        : `Reading Day ${appState.selectedDay}`
  };
}

function showCohortGatewayAlert(message, isError = false) {
  const alertEl = document.getElementById('cohort-gateway-alert');
  if (!alertEl) return;
  if (!message) {
    alertEl.classList.add('hidden');
    alertEl.textContent = '';
    return;
  }
  alertEl.textContent = message;
  alertEl.classList.remove('hidden');
  alertEl.classList.toggle('error', Boolean(isError));
}

function formatRelativeDateShort(isoStr) {
  if (!isoStr) return 'Just now';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return 'Recent';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderFellowshipView() {
  const gatewayPanel = document.getElementById('fellowship-gateway-panel');
  const activeWorkspace = document.getElementById('fellowship-active-workspace');
  const cancelGatewayBtn = document.getElementById('btn-cancel-cohort-gateway');
  if (!gatewayPanel || !activeWorkspace) return;

  // Populate saved member name in Gateway forms if available
  const identity = getLocalMemberIdentity();
  const joinNameInput = document.getElementById('input-join-member-name');
  const createNameInput = document.getElementById('input-create-member-name');
  if (joinNameInput && !joinNameInput.value && identity.name) joinNameInput.value = identity.name;
  if (createNameInput && !createNameInput.value && identity.name) createNameInput.value = identity.name;

  // Ensure live preview code is always generated and displayed in the Create Cohort card
  if (!appState.previewCohortCode) {
    appState.previewCohortCode = generateUniqueInviteCode(6);
  }
  const previewCodeEl = document.getElementById('preview-generated-code');
  if (previewCodeEl) {
    previewCodeEl.textContent = appState.previewCohortCode;
  }

  // Render quick-switcher for any cohorts previously joined on this device
  const allSavedCohorts = getAllRecordsSync('fellowships').filter(c => c.schemaVersion >= 3 && c.inviteCode);
  const switcherWrap = document.getElementById('my-cohorts-switcher-wrap');
  const switcherPills = document.getElementById('my-cohorts-pills');
  if (switcherWrap && switcherPills) {
    switcherPills.textContent = '';
    if (allSavedCohorts.length > 0) {
      switcherWrap.classList.remove('hidden');
      allSavedCohorts.forEach(c => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `verse-pill ${c.inviteCode === getActiveCohortCode() ? 'active' : ''}`;
        pill.textContent = `${c.cohortName} (${c.inviteCode})`;
        pill.addEventListener('click', async () => {
          setActiveCohortCode(c.inviteCode);
          appState.forceShowCohortGateway = false;
          showCohortGatewayAlert('');
          await fetchCohortByInviteCode(c.inviteCode);
          renderFellowshipView();
        });
        switcherPills.appendChild(pill);
      });
    } else {
      switcherWrap.classList.add('hidden');
    }
  }

  const activeCode = getActiveCohortCode();
  const activeCohort = activeCode ? getRecordSync('fellowships', `cohort_${activeCode}`) : null;

  if (!activeCohort || appState.forceShowCohortGateway) {
    gatewayPanel.classList.remove('hidden');
    activeWorkspace.classList.add('hidden');
    if (cancelGatewayBtn) {
      cancelGatewayBtn.classList.toggle('hidden', !activeCohort);
    }
    return;
  }

  // Show Active Isolated Cohort Workspace
  gatewayPanel.classList.add('hidden');
  activeWorkspace.classList.remove('hidden');

  setText('fellowship-cohort-title', decodeEntitiesForTextContent(activeCohort.cohortName));
  setText('fellowship-invite-code', activeCohort.inviteCode);
  setText(
    'cohort-sync-status-badge',
    navigator.onLine ? `🔒 Isolated • Online Synced` : `🔒 Isolated • Offline Cache`
  );

  const daySchedule = appState.scheduleByDay[appState.selectedDay];
  const refTag = daySchedule?.readings?.narrative || `Day ${appState.selectedDay}`;
  setText('reflection-day-tag', `Sharing insight on Day ${appState.selectedDay} • ${refTag}`);

  const members = Array.isArray(activeCohort.members) ? activeCohort.members : [];
  const reflections = Array.isArray(activeCohort.reflections) ? activeCohort.reflections : [];
  const prayers = Array.isArray(activeCohort.prayers) ? activeCohort.prayers : [];

  setText('count-cohort-members', String(members.length));
  setText('count-cohort-reflections', String(reflections.length));
  setText('count-cohort-prayers', String(prayers.length));

  // 1. Render Cohort Members & Progress Sync Grid
  const membersGrid = document.getElementById('fellowship-members-grid');
  if (membersGrid) {
    membersGrid.textContent = '';
    if (members.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-stream-state';
      empty.textContent = 'No members in this cohort yet. Share your invitation code above to invite fellow pilgrims.';
      membersGrid.appendChild(empty);
    } else {
      members.forEach(member => {
        const card = document.createElement('div');
        card.className = 'member-card';

        const top = document.createElement('div');
        const nameEl = document.createElement('h4');
        const isSelf = member.id === identity.memberId;
        nameEl.textContent = `${decodeEntitiesForTextContent(member.name)}${isSelf ? ' (You)' : ''}`;

        const roleEl = document.createElement('div');
        roleEl.style.fontSize = '0.76rem';
        roleEl.style.color = 'var(--text-secondary)';
        roleEl.textContent = decodeEntitiesForTextContent(member.role || 'Pilgrim Member');

        const statusBadge = document.createElement('span');
        statusBadge.className = 'crypto-badge';
        statusBadge.style.display = 'inline-block';
        statusBadge.style.marginTop = '6px';
        statusBadge.textContent = `${decodeEntitiesForTextContent(member.activityStatus || 'Active')} • ${member.completedDaysCount || 0}/365 Done • 🔥 ${member.streakDays || 0}d`;

        top.appendChild(nameEl);
        top.appendChild(roleEl);
        top.appendChild(statusBadge);

        const bottom = document.createElement('div');
        bottom.style.display = 'flex';
        bottom.style.justifyContent = 'space-between';
        bottom.style.alignItems = 'center';

        const encourageBtn = document.createElement('button');
        encourageBtn.type = 'button';
        encourageBtn.className = 'verse-icon-btn';
        encourageBtn.textContent = `🙏 Encourage (${member.encouragements || 0})`;
        encourageBtn.addEventListener('click', async () => {
          const res = await supportCohortItem('ENCOURAGE_MEMBER', member.id);
          if (res?.latencyMs) updateIdbLatencyDisplay(res.latencyMs);
          renderFellowshipView();
        });

        const updatedTag = document.createElement('span');
        updatedTag.className = 'stream-meta-tag';
        updatedTag.textContent = `Day ${member.currentDay || 1}`;

        bottom.appendChild(encourageBtn);
        bottom.appendChild(updatedTag);
        card.appendChild(top);
        card.appendChild(bottom);
        membersGrid.appendChild(card);
      });
    }
  }

  // 2. Render Spiritual Reflection Stream
  const reflectionsList = document.getElementById('cohort-reflections-list');
  if (reflectionsList) {
    reflectionsList.textContent = '';
    if (reflections.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-stream-state';
      empty.textContent = 'No reflections shared in this cohort yet. Be the first to share an insight from today’s Scripture reading!';
      reflectionsList.appendChild(empty);
    } else {
      reflections.forEach(refl => {
        const item = document.createElement('article');
        item.className = 'stream-item-card';

        const header = document.createElement('div');
        header.className = 'stream-item-header';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'stream-author-name';
        authorSpan.textContent = decodeEntitiesForTextContent(refl.authorName || 'Pilgrim Member');

        const metaSpan = document.createElement('span');
        metaSpan.className = 'verse-num-badge';
        metaSpan.textContent = decodeEntitiesForTextContent(refl.passageRef || `Day ${refl.dayNumber || 1}`);

        header.appendChild(authorSpan);
        header.appendChild(metaSpan);

        const body = document.createElement('p');
        body.className = 'stream-item-body';
        body.textContent = decodeEntitiesForTextContent(refl.content);

        const footer = document.createElement('div');
        footer.className = 'stream-item-footer';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'stream-meta-tag';
        timeSpan.textContent = formatRelativeDateShort(refl.createdAt);

        const amenBtn = document.createElement('button');
        amenBtn.type = 'button';
        amenBtn.className = 'verse-icon-btn';
        amenBtn.textContent = `🙏 Amen (${refl.amenCount || 0})`;
        amenBtn.addEventListener('click', async () => {
          await supportCohortItem('AMEN_REFLECTION', refl.id);
          renderFellowshipView();
        });

        footer.appendChild(timeSpan);
        footer.appendChild(amenBtn);

        item.appendChild(header);
        item.appendChild(body);
        item.appendChild(footer);
        reflectionsList.appendChild(item);
      });
    }
  }

  // 3. Render Cohort Prayer Requests Wall (Supporting Anonymous Requests)
  const prayersList = document.getElementById('cohort-prayers-list');
  if (prayersList) {
    prayersList.textContent = '';
    if (prayers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-stream-state';
      empty.textContent = 'No prayer requests posted in this cohort yet. Share a prayer intention (publicly or anonymously) so your community can intercede with you.';
      prayersList.appendChild(empty);
    } else {
      prayers.forEach(prayer => {
        const item = document.createElement('article');
        item.className = `stream-item-card ${prayer.isAnswered ? 'answered' : ''}`;

        const header = document.createElement('div');
        header.className = 'stream-item-header';

        const authorSpan = document.createElement('span');
        authorSpan.className = 'stream-author-name';
        authorSpan.textContent = prayer.isAnonymous
          ? '🕶️ Anonymous Pilgrim'
          : decodeEntitiesForTextContent(prayer.authorName || 'Pilgrim Member');

        const badgesWrap = document.createElement('div');
        badgesWrap.style.display = 'flex';
        badgesWrap.style.gap = '6px';
        badgesWrap.style.alignItems = 'center';

        const catBadge = document.createElement('span');
        catBadge.className = 'verse-num-badge';
        catBadge.textContent = decodeEntitiesForTextContent(prayer.category || 'General Petition');
        badgesWrap.appendChild(catBadge);

        if (prayer.isAnswered) {
          const ansBadge = document.createElement('span');
          ansBadge.className = 'crypto-badge';
          ansBadge.textContent = '✨ Answered';
          badgesWrap.appendChild(ansBadge);
        }

        header.appendChild(authorSpan);
        header.appendChild(badgesWrap);

        const body = document.createElement('p');
        body.className = 'stream-item-body';
        body.textContent = decodeEntitiesForTextContent(prayer.content);

        const footer = document.createElement('div');
        footer.className = 'stream-item-footer';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'stream-meta-tag';
        timeSpan.textContent = formatRelativeDateShort(prayer.createdAt);

        const actionsWrap = document.createElement('div');
        actionsWrap.style.display = 'flex';
        actionsWrap.style.gap = '6px';

        const prayBtn = document.createElement('button');
        prayBtn.type = 'button';
        prayBtn.className = 'verse-icon-btn';
        prayBtn.textContent = `🙏 Praying (${prayer.prayingCount || 0})`;
        prayBtn.addEventListener('click', async () => {
          await supportCohortItem('PRAY_FOR_REQUEST', prayer.id);
          renderFellowshipView();
        });

        const answeredBtn = document.createElement('button');
        answeredBtn.type = 'button';
        answeredBtn.className = 'verse-icon-btn';
        answeredBtn.textContent = prayer.isAnswered ? '↺ Reopen' : '✓ Answered';
        answeredBtn.title = 'Toggle Answered Praise Report';
        answeredBtn.addEventListener('click', async () => {
          await supportCohortItem('TOGGLE_PRAYER_ANSWERED', prayer.id);
          renderFellowshipView();
        });

        actionsWrap.appendChild(prayBtn);
        actionsWrap.appendChild(answeredBtn);
        footer.appendChild(timeSpan);
        footer.appendChild(actionsWrap);

        item.appendChild(header);
        item.appendChild(body);
        item.appendChild(footer);
        prayersList.appendChild(item);
      });
    }
  }
}

/* ============================================================================
 * 365-DAY CURRICULUM EXPLORER & BOOKMARKS VAULT VIEW
 * ============================================================================ */
function renderCurriculumMapView() {
  const container = document.getElementById('curriculum-periods-container');
  if (!container) return;
  container.textContent = '';

  const progressMap = getAllRecordsMapSync('progress');

  appState.periods.forEach(period => {
    const card = document.createElement('div');
    card.className = 'reader-card';
    card.style.borderLeft = `6px solid ${period.accent_hex}`;

    const totalDaysInPeriod = period.day_end - period.day_start + 1;
    let completedInPeriod = 0;
    for (let d = period.day_start; d <= period.day_end; d++) {
      if (progressMap[String(d)]?.completed) completedInPeriod++;
    }

    const header = document.createElement('div');
    header.className = 'section-header-row';

    const title = document.createElement('h3');
    title.textContent = `Period ${period.code}: ${period.name} (${period.name_ml}) — ${period.span}`;

    const progBadge = document.createElement('span');
    progBadge.className = 'crypto-badge';
    progBadge.textContent = `${completedInPeriod} / ${totalDaysInPeriod} Days Complete`;

    header.appendChild(title);
    header.appendChild(progBadge);

    const desc = document.createElement('p');
    desc.style.fontSize = '0.88rem';
    desc.style.color = 'var(--text-secondary)';
    desc.style.marginBottom = '0.75rem';
    desc.textContent = `${period.era_date} • Focus: ${period.theme} (${period.theme_ml})`;

    const pillWrap = document.createElement('div');
    pillWrap.style.display = 'flex';
    pillWrap.style.flexWrap = 'wrap';
    pillWrap.style.gap = '0.4rem';

    for (let d = period.day_start; d <= period.day_end; d++) {
      const isDone = Boolean(progressMap[String(d)]?.completed);
      const dayBtn = document.createElement('button');
      dayBtn.type = 'button';
      dayBtn.className = 'verse-pill';
      if (isDone) {
        dayBtn.style.backgroundColor = period.accent_hex;
        dayBtn.style.color = '#FFFFFF';
      }
      dayBtn.textContent = isDone ? `✓ Day ${d}` : `Day ${d}`;
      dayBtn.addEventListener('click', () => {
        switchMainTab('sanctuary');
        selectDay(d);
      });
      pillWrap.appendChild(dayBtn);
    }

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(pillWrap);
    container.appendChild(card);
  });
}

function renderVaultView() {
  const bmContainer = document.getElementById('vault-bookmarks-list');
  if (!bmContainer) return;
  bmContainer.textContent = '';

  const bookmarks = getAllRecordsSync('bookmarks');
  if (bookmarks.length === 0) {
    const empty = document.createElement('p');
    empty.style.color = 'var(--text-secondary)';
    empty.textContent = 'No bookmarked verses yet. Tap "🔖 Bookmark" on any verse in the Sanctuary Reader to save it here.';
    bmContainer.appendChild(empty);
  } else {
    bookmarks.forEach(bm => {
      const item = document.createElement('div');
      item.className = 'verse-card';

      const head = document.createElement('strong');
      head.textContent = `Day ${bm.dayNumber} (${bm.periodName}) — ${bm.referenceEn}:${bm.verseNumber}`;

      const pEn = document.createElement('p');
      pEn.className = 'verse-text-en';
      pEn.style.marginTop = '0.35rem';
      pEn.textContent = bm.en;

      const pMl = document.createElement('p');
      pMl.className = 'verse-text-ml lang-ml';
      pMl.textContent = bm.ml || '';

      item.appendChild(head);
      item.appendChild(pEn);
      item.appendChild(pMl);
      bmContainer.appendChild(item);
    });
  }
}

/* ============================================================================
 * GRACE STREAK, PROGRESS & TELEMETRY STREAMING
 * ============================================================================ */
function refreshGraceStreakHeader() {
  const progressMap = getAllRecordsMapSync('progress');
  const stats = calculateGraceStreak(progressMap, appState.selectedDay);

  const el = document.getElementById('header-streak-count');
  if (el) {
    el.textContent = `🔥 ${stats.streakDays}d`;
    el.title = `🔥 ${stats.streakDays}d Streak • 🛡️ ${stats.graceShieldsAvailable} Grace Shields • ${stats.percentComplete}% Complete`;
  }
}

function updateIdbLatencyDisplay(ms) {
  appState.lastIdbLatencyMs = ms;
  setText('metric-idb-latency', `${ms} ms (<5ms SLA)`);
}

function pushTelemetryLog(tag, message) {
  const entry = `[${new Date().toLocaleTimeString()}] [${tag}] ${message}`;
  appState.telemetryFeed.unshift(entry);
  if (appState.telemetryFeed.length > 40) appState.telemetryFeed.pop();

  const logList = document.getElementById('telemetry-log-list');
  if (!logList) return;
  logList.textContent = '';
  appState.telemetryFeed.forEach(line => {
    const div = document.createElement('div');
    div.className = 'telemetry-entry';
    div.textContent = line;
    logList.appendChild(div);
  });
}

function wireTelemetryStreams() {
  onStorageLatency(metric => {
    updateIdbLatencyDisplay(metric.durationMs);
  });

  onFailoverEvent((evt) => {
    setText('metric-active-tier', `Tier ${evt.tierNumber} (${evt.latencyMs}ms)`);
    pushTelemetryLog(`FAILOVER_T${evt.tierNumber}`, `${evt.status}: ${evt.passageRef} (${evt.latencyMs}ms) ${evt.reason || ''}`);
  });

  onSecurityTelemetry(secEvt => {
    const rate = getRateLimiterStatus();
    setText('metric-rate-tokens', `${rate.remainingTokens} / ${rate.capacity} rpm`);
    pushTelemetryLog(secEvt.type, `[${secEvt.severity}] ${secEvt.summary}`);
  });

  onSyncStatusChange(syncSnap => {
    setText('metric-outbox-count', `${syncSnap.pendingCount} pending (${syncSnap.status})`);
    if (syncSnap.signedEnvelope) {
      setText('metric-hmac-sig', syncSnap.signedEnvelope.signature.slice(0, 24) + '...');
    }
    pushTelemetryLog('CLOUD_SYNC', `Status: ${syncSnap.status} (Pending Outbox: ${syncSnap.pendingCount})`);
  });

  audioEngine.onStateChange(audioState => {
    const playBtn = document.getElementById('btn-audio-play-pause');
    if (playBtn) playBtn.textContent = audioState.isPlaying ? '⏸' : '▶';

    setText('audio-time-current', formatSecondsAsTime(audioState.currentTimeSec));
    setText('audio-time-total', formatSecondsAsTime(audioState.durationSec));
    const badgeEl = document.getElementById('audio-prefetch-badge');
    if (badgeEl) {
      badgeEl.textContent = audioState.isPlaying ? '🟢 Playing' : '● Audio Ready';
      badgeEl.title = audioState.isPlaying ? 'Audio Narration Playing' : 'Audio Narration Ready';
    }

    const scrubber = document.getElementById('audio-scrubber');
    if (scrubber) {
      scrubber.max = String(audioState.durationSec);
      scrubber.value = String(Math.floor(audioState.currentTimeSec));
    }

    // Highlight active verse during audio playback
    if (audioState.isPlaying && appState.currentPassageData?.verses?.length) {
      const verseCount = appState.currentPassageData.verses.length;
      const activeIdx = Math.floor((audioState.currentTimeSec / 15)) % verseCount;
      document.querySelectorAll('.verse-card').forEach((el, idx) => {
        el.classList.toggle('audio-active-verse', idx === activeIdx);
      });
    }
  });
}

/* ============================================================================
 * GLOBAL CONTROLS & EVENT BINDINGS
 * ============================================================================ */
function isRunningStandaloneOrFullscreen() {
  return Boolean(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  );
}

async function enterFullScreenAppMode() {
  const docEl = document.documentElement;
  try {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen({ navigationUI: 'hide' });
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    }
  } catch (_) {
    // Ignore if blocked by iOS Safari (where Add to Home Screen is used)
  }
  syncFullscreenUiState();
}

async function toggleFullScreenAppMode() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } else {
      await enterFullScreenAppMode();
    }
  } catch (_) { /* ignore */ }
  syncFullscreenUiState();
}

function syncFullscreenUiState() {
  const isFs = isRunningStandaloneOrFullscreen();
  const fsBtn = document.getElementById('btn-toggle-fullscreen');
  if (fsBtn) {
    fsBtn.textContent = isFs ? '🗗' : '⛶';
    fsBtn.title = isFs ? 'Exit Full Screen' : 'Enter Full Screen (Hide Address Bar)';
  }
}

function bindGlobalControls() {
  // Theme Switcher
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    applyTheme(appState.theme === 'dark' ? 'light' : 'dark');
  });

  // Full-Screen App Mode (Toggle cleanly via header button)
  document.getElementById('btn-toggle-fullscreen')?.addEventListener('click', () => {
    toggleFullScreenAppMode();
  });
  document.addEventListener('fullscreenchange', syncFullscreenUiState);
  document.addEventListener('webkitfullscreenchange', syncFullscreenUiState);
  window.addEventListener('resize', syncFullscreenUiState);
  syncFullscreenUiState();

  // Capture Native Android/Chrome PWA Install Prompt (`beforeinstallprompt`)
  let deferredInstallPrompt = null;
  const installBtn = document.getElementById('btn-banner-install-pwa');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn?.classList.remove('hidden');
    syncFullscreenUiState();
  });
  installBtn?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(() => null);
    deferredInstallPrompt = null;
    installBtn.classList.add('hidden');
  });

  // 1-Tap Senior-First Font Scaler (AA)
  document.getElementById('btn-font-scaler')?.addEventListener('click', () => {
    const order = ['100', '112', '125'];
    const next = order[(order.indexOf(appState.fontScale) + 1) % order.length];
    applyFontScale(next);
  });

  // Slide-Over Settings & Telemetry Drawer Toggle
  document.getElementById('btn-open-settings-drawer')?.addEventListener('click', () => {
    document.getElementById('settings-drawer-backdrop')?.classList.remove('hidden');
  });
  document.getElementById('btn-close-settings-drawer')?.addEventListener('click', () => {
    document.getElementById('settings-drawer-backdrop')?.classList.add('hidden');
  });
  document.getElementById('settings-drawer-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'settings-drawer-backdrop') {
      document.getElementById('settings-drawer-backdrop')?.classList.add('hidden');
    }
  });

  // Day Selector & Smart Audio Link / Folder / Bulk JSON Mapper Controls
  document.getElementById('btn-set-day-gdrive-id')?.addEventListener('click', async () => {
    const val = (document.getElementById('input-day-gdrive-id')?.value || '').trim();
    if (!val) return;

    // Case 1: User pasted JSON array or object (e.g. `[{"day":3,"fileId":"..."},...]` or `{"1":"...", "3":"..."}`)
    const jsonCandidate = val.startsWith('[') || val.startsWith('{')
      ? val
      : (val.includes('{') && val.includes('}') ? `[${val}]` : '');

    if (jsonCandidate) {
      try {
        const parsed = JSON.parse(jsonCandidate);
        let count = 0;

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const dNum = Number(item.day || item.day_number || item.dayNumber);
            const fileIdVal = item.fileId || item.file_id || item.gdrive_audio_file_id || item.id;
            const cleanId = normalizeGoogleDriveAudioId(String(fileIdVal || ''));
            if (dNum >= 1 && dNum <= 365 && cleanId) {
              localStorage.setItem(`ephphatha_gdrive_id_day_${dNum}`, cleanId);
              if (appState.scheduleByDay[dNum]) {
                appState.scheduleByDay[dNum].gdrive_audio_file_id = cleanId;
              }
              count++;
            }
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          for (const [dayKey, fileIdVal] of Object.entries(parsed)) {
            const dNum = Number(dayKey);
            const cleanId = typeof fileIdVal === 'object' && fileIdVal !== null
              ? normalizeGoogleDriveAudioId(String(fileIdVal.fileId || fileIdVal.id || ''))
              : normalizeGoogleDriveAudioId(String(fileIdVal || ''));
            if (dNum >= 1 && dNum <= 365 && cleanId) {
              localStorage.setItem(`ephphatha_gdrive_id_day_${dNum}`, cleanId);
              if (appState.scheduleByDay[dNum]) {
                appState.scheduleByDay[dNum].gdrive_audio_file_id = cleanId;
              }
              count++;
            }
          }
        }

        if (count > 0) {
          await selectDay(appState.selectedDay);
          pushTelemetryLog('BULK_AUDIO_MAP_IMPORTED', `Bound ${count} Google Drive audio files across curriculum!`);
          alert(`Successfully bound audio for ${count} days!`);
          return;
        }
      } catch (err) {
        console.warn('JSON audio parse error:', err);
      }
    }

    // Case 2: User pasted a Google Drive Folder URL (`https://drive.google.com/drive/folders/<FOLDER_ID>`)
    const folderMatch = val.match(/\/folders\/([a-zA-Z0-9_-]{15,})/);
    if (folderMatch) {
      const folderId = folderMatch[1];
      localStorage.setItem('ephphatha_root_folder_id', folderId);
      pushTelemetryLog('DRIVE_FOLDER_SCAN', `Scanning Google Drive folder ${folderId} for Day 001..365 audio...`);
      try {
        const res = await fetch(`${audioEngine.edgeProxyBaseUrl}/discover/${encodeURIComponent(folderId)}`);
        if (res.ok) {
          const data = await res.json();
          const dayMap = data.dayMap || {};
          for (const [dKey, fId] of Object.entries(dayMap)) {
            localStorage.setItem(`ephphatha_gdrive_id_day_${dKey}`, fId);
            if (appState.scheduleByDay[Number(dKey)]) {
              appState.scheduleByDay[Number(dKey)].gdrive_audio_file_id = fId;
            }
          }
          await selectDay(appState.selectedDay);
          pushTelemetryLog('DRIVE_FOLDER_SYNCED', `Auto-discovered ${data.discoveredCount || 0} audio files from Drive folder!`);
          return;
        }
      } catch (_) { /* fallback below */ }
    }

    // Case 3: Single File Share Link (`https://drive.google.com/file/d/<ID>/view`) or Raw File ID
    const cleanId = normalizeGoogleDriveAudioId(val);
    if (!cleanId) return;
    localStorage.setItem(`ephphatha_gdrive_id_day_${appState.selectedDay}`, cleanId);
    const daySchedule = appState.scheduleByDay[appState.selectedDay];
    if (daySchedule) {
      daySchedule.gdrive_audio_file_id = cleanId;
      renderDayHeroCard(daySchedule);
      audioEngine.loadDayAudio(daySchedule, 0);
      pushTelemetryLog('GDRIVE_AUDIO_ID_BOUND', `Bound Day ${appState.selectedDay} to Google Drive ID: ${cleanId}`);
    }
  });
  // Day Navigation with Auto-Play Continuity (If playing, immediately plays new day)
  document.getElementById('btn-prev-day')?.addEventListener('click', async () => {
    if (appState.selectedDay <= 1) return;
    const wasPlaying = audioEngine.isPlaying;
    await selectDay(appState.selectedDay - 1);
    if (wasPlaying) {
      audioEngine.play();
    }
  });
  document.getElementById('btn-next-day')?.addEventListener('click', async () => {
    if (appState.selectedDay >= 365) return;
    const wasPlaying = audioEngine.isPlaying;
    await selectDay(appState.selectedDay + 1);
    if (wasPlaying) {
      audioEngine.play();
    }
  });
  document.getElementById('day-select-dropdown')?.addEventListener('change', async (e) => {
    const wasPlaying = audioEngine.isPlaying;
    await selectDay(Number(e.target.value));
    if (wasPlaying) {
      audioEngine.play();
    }
  });

  // Mark Day Complete (<5ms Optimistic IndexedDB write)
  document.getElementById('btn-mark-day-complete')?.addEventListener('click', async () => {
    const dayStr = String(appState.selectedDay);
    const existing = getRecordSync('progress', dayStr);
    const nextCompleted = !existing?.completed;

    const res = await putRecord('progress', {
      id: dayStr,
      dayNumber: appState.selectedDay,
      completed: nextCompleted,
      audioTimestampSec: Math.floor(audioEngine.currentTimeSec)
    });
    updateIdbLatencyDisplay(res.latencyMs);

    renderDayHeroCard(appState.scheduleByDay[appState.selectedDay]);
    refreshGraceStreakHeader();
    renderCurriculumMapView();
    await syncMemberProgressToActiveCohort(getCurrentProgressMetrics());

    // Sync Day Progress to Google Sheets Backend asynchronously
    const identity = getLocalMemberIdentity();
    const userId = appState.userProfile?.credentialIdHex || identity.memberId;
    const inviteCode = getActiveCohortCode();
    syncDayProgressToGoogleSheet({
      userId,
      dayNumber: appState.selectedDay,
      completed: nextCompleted,
      audioTimestampSec: Math.floor(audioEngine.currentTimeSec),
      inviteCode,
      memberMetrics: getCurrentProgressMetrics()
    }).catch(() => {});

    showCloudSyncToast(nextCompleted ? '☁️ Completed & Synced' : '☁️ Updated');

    await enqueueCloudSyncMutation('MARK_DAY_COMPLETE', 'appDataFolder/progress_log.json', {
      dayNumber: appState.selectedDay,
      completed: nextCompleted
    });
  });

  // Language Mode Switcher (Parallel Bilingual / English / Malayalam POC)
  document.querySelectorAll('[data-lang-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.langMode = btn.getAttribute('data-lang-mode') || 'bilingual';
      document.querySelectorAll('[data-lang-mode]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-lang-mode') === appState.langMode);
      });
      renderScriptureVerses(appState.currentPassageData);
    });
  });

  // Encrypted Journal Save
  document.getElementById('btn-save-journal')?.addEventListener('click', () => {
    saveCurrentDayJournal();
  });

  // Production Fellowship & Isolated Cohort Controls
  bindFellowshipModuleEvents();

  // Audio Player Controls
  document.getElementById('btn-audio-play-pause')?.addEventListener('click', () => {
    audioEngine.togglePlay();
  });
  document.getElementById('btn-audio-back-15')?.addEventListener('click', () => {
    audioEngine.skip(-15);
  });
  document.getElementById('btn-audio-fwd-15')?.addEventListener('click', () => {
    audioEngine.skip(15);
  });
  document.getElementById('btn-audio-speed')?.addEventListener('click', (e) => {
    const rate = audioEngine.cyclePlaybackRate();
    e.currentTarget.textContent = `${rate}x`;
  });
  document.getElementById('audio-scrubber')?.addEventListener('input', (e) => {
    audioEngine.seekTo(Number(e.target.value));
  });

  // Bottom Navigation Tabs
  document.querySelectorAll('[data-nav-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchMainTab(btn.getAttribute('data-nav-tab'));
    });
  });

  // ==========================================================================
  // PILGRIM AUTH MODAL & SEAMLESS ACCOUNT CONTROLS
  // ==========================================================================
  const openSettingsDrawer = () => {
    document.getElementById('settings-drawer-backdrop')?.classList.remove('hidden');
    renderUserProfileBadge();
  };
  const closeSettingsDrawer = () => {
    document.getElementById('settings-drawer-backdrop')?.classList.add('hidden');
  };

  document.getElementById('btn-header-auth')?.addEventListener('click', () => {
    if (appState.userProfile?.displayName) {
      openSettingsDrawer();
    } else {
      openAuthModal('signin');
    }
  });

  document.getElementById('btn-open-auth-modal')?.addEventListener('click', () => {
    closeSettingsDrawer();
    openAuthModal('create');
  });

  document.getElementById('btn-close-auth-modal')?.addEventListener('click', closeAuthModal);
  document.getElementById('btn-auth-continue-guest')?.addEventListener('click', closeAuthModal);
  document.getElementById('btn-auth-reg-guest')?.addEventListener('click', closeAuthModal);

  document.getElementById('btn-tab-signin')?.addEventListener('click', () => switchAuthTab('signin'));
  document.getElementById('btn-tab-create')?.addEventListener('click', () => switchAuthTab('create'));

  // 1-Tap Biometric Sign In inside Modal
  document.getElementById('btn-auth-biometric-signin')?.addEventListener('click', async () => {
    const savedName = localStorage.getItem('ephphatha_member_name_v3') || 'Ephphatha Pilgrim';
    setAuthModalAlert('Authenticating with Face ID / Fingerprint / Passkey...', false);
    try {
      const profile = await executeCloudLoginAndRestore(savedName);
      setAuthModalAlert(`✓ Welcome back, ${profile.displayName}!`, false);
      setTimeout(() => closeAuthModal(), 1200);
      showCloudSyncToast('☁️ Synced');
    } catch (_) {
      setAuthModalAlert('Biometric prompt was cancelled or not yet registered. Enter your name below to sign in.', true);
    }
  });

  // Submit Sign In Form
  document.getElementById('form-auth-signin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameVal = (document.getElementById('input-auth-login-name')?.value || '').trim();
    if (!nameVal) {
      setAuthModalAlert('Please enter your Pilgrim Name or Email.', true);
      return;
    }
    setAuthModalAlert('Signing in and retrieving your reading journey from cloud...', false);
    try {
      const profile = await executeCloudLoginAndRestore(nameVal);
      setAuthModalAlert(`✓ Welcome back, ${profile.displayName}! All progress restored.`, false);
      setTimeout(() => closeAuthModal(), 1200);
      showCloudSyncToast('☁️ Synced');
    } catch (err) {
      setAuthModalAlert(err.message || 'Could not sign in. Please check your connection.', true);
    }
  });

  // Submit Create Account Form
  document.getElementById('form-auth-create')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameVal = (document.getElementById('input-auth-reg-name')?.value || '').trim();
    const contactVal = (document.getElementById('input-auth-reg-contact')?.value || '').trim();
    const pinVal = (document.getElementById('input-auth-reg-pin')?.value || '').trim();
    const enableBiometrics = Boolean(document.getElementById('chk-auth-enable-biometrics')?.checked);

    if (!nameVal) {
      setAuthModalAlert('Please enter your name.', true);
      return;
    }

    setAuthModalAlert('Creating your sanctuary cloud account...', false);
    try {
      let profile = null;
      if (enableBiometrics && window.PublicKeyCredential) {
        try {
          profile = await authenticateWithDeviceBiometrics(nameVal);
        } catch (_) { /* fallback below */ }
      }
      if (!profile) {
        const identity = getLocalMemberIdentity(nameVal);
        profile = {
          displayName: nameVal,
          credentialIdHex: identity.memberId,
          email: contactVal,
          pin: pinVal,
          authMethod: pinVal ? 'Passcode PIN' : 'Device Profile',
          authenticatedAt: new Date().toISOString()
        };
        localStorage.setItem('ephphatha_biometric_profile_v3', JSON.stringify(profile));
      } else {
        profile.email = contactVal;
        profile.pin = pinVal;
        localStorage.setItem('ephphatha_biometric_profile_v3', JSON.stringify(profile));
      }

      appState.userProfile = profile;
      localStorage.setItem('ephphatha_member_name_v3', nameVal);

      // Immediately sync local progress map to cloud
      const localMap = getAllRecordsMapSync('progress');
      await syncUserDataToGoogleSheet(profile, localMap);

      renderUserProfileBadge();
      setAuthModalAlert(`✓ Account created! Welcome, ${nameVal}.`, false);
      setTimeout(() => closeAuthModal(), 1200);
      showCloudSyncToast('☁️ Account Created');
    } catch (err) {
      setAuthModalAlert(err.message || 'Could not create account.', true);
    }
  });

  // Drawer Sign Out
  document.getElementById('btn-drawer-sign-out')?.addEventListener('click', () => {
    if (confirm('Sign out of your account on this device? Your reading progress remains safely backed up in the cloud.')) {
      appState.userProfile = null;
      localStorage.removeItem('ephphatha_biometric_profile_v3');
      renderUserProfileBadge();
      showCloudSyncToast('Signed Out');
    }
  });

  // Drawer Manual Sync Now
  document.getElementById('btn-drawer-sync-now')?.addEventListener('click', async () => {
    if (!appState.userProfile?.displayName) return;
    showCloudSyncToast('🔄 Syncing...');
    try {
      const localMap = getAllRecordsMapSync('progress');
      await syncUserDataToGoogleSheet(appState.userProfile, localMap);
      const activeCode = getActiveCohortCode();
      if (activeCode) await fetchCohortByInviteCode(activeCode).catch(() => {});
      renderUserProfileBadge();
      renderFellowshipView();
      showCloudSyncToast('☁️ Synced');
    } catch (_) {
      showCloudSyncToast('Offline');
    }
  });

  // Audio Playback Speed Buttons in Drawer
  document.querySelectorAll('[data-set-speed]').forEach(btn => {
    btn.addEventListener('click', () => {
      const spd = Number(btn.getAttribute('data-set-speed') || 1);
      audioEngine.setPlaybackRate(spd);
      document.querySelectorAll('[data-set-speed]').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
      const speedBtn = document.getElementById('btn-audio-speed');
      if (speedBtn) speedBtn.textContent = `${spd}x`;
    });
  });

  // Drawer Settings: 1. Primary Bible Translation (Persisted to Profile & Cloud)
  const selBibleVer = document.getElementById('select-primary-bible-version');
  if (selBibleVer) {
    selBibleVer.value = appState.preferredBibleVersion;
    selBibleVer.addEventListener('change', async (e) => {
      const ver = e.target.value;
      appState.preferredBibleVersion = ver;
      localStorage.setItem('ephphatha_preferred_bible_version', ver);
      if (appState.userProfile) {
        appState.userProfile.preferredBibleVersion = ver;
        localStorage.setItem('ephphatha_biometric_profile_v3', JSON.stringify(appState.userProfile));
        const localMap = getAllRecordsMapSync('progress');
        syncUserDataToGoogleSheet(appState.userProfile, localMap).catch(() => {});
      }
      showCloudSyncToast(`📖 Bible: ${ver}`);
      await loadActiveReadingSlot(appState.scheduleByDay[appState.selectedDay]);
    });
  }

  // Drawer Settings: 2. Default Scripture Display Languages
  const selReadingLang = document.getElementById('select-reading-languages');
  if (selReadingLang) {
    selReadingLang.value = appState.langMode;
    selReadingLang.addEventListener('change', (e) => {
      const mode = e.target.value;
      appState.langMode = mode;
      localStorage.setItem('ephphatha_lang_mode', mode);
      applyTypographyAndLanguagePreferences();
      if (appState.userProfile) {
        appState.userProfile.langPreference = mode;
        localStorage.setItem('ephphatha_biometric_profile_v3', JSON.stringify(appState.userProfile));
        const localMap = getAllRecordsMapSync('progress');
        syncUserDataToGoogleSheet(appState.userProfile, localMap).catch(() => {});
      }
      renderScriptureVerses(appState.currentPassageData);
      applyLanguageModeToReader();
    });
  }

  // Drawer Settings: 3. Show Latin Nova Vulgata (Default: OFF)
  const chkLatin = document.getElementById('chk-show-latin-vulgate');
  if (chkLatin) {
    chkLatin.checked = Boolean(appState.showLatinVulgate);
    chkLatin.addEventListener('change', (e) => {
      const show = e.target.checked;
      appState.showLatinVulgate = show;
      localStorage.setItem('ephphatha_show_latin', String(show));
      applyTypographyAndLanguagePreferences();
      if (appState.userProfile) {
        appState.userProfile.showLatinVulgate = show;
        localStorage.setItem('ephphatha_biometric_profile_v3', JSON.stringify(appState.userProfile));
        const localMap = getAllRecordsMapSync('progress');
        syncUserDataToGoogleSheet(appState.userProfile, localMap).catch(() => {});
      }
      renderScriptureVerses(appState.currentPassageData);
      applyLanguageModeToReader();
    });
  }

  // Drawer Settings: 4. Scripture Typography Weight
  const selWeight = document.getElementById('select-verse-weight');
  if (selWeight) {
    selWeight.value = appState.verseWeight || 'strong';
    selWeight.addEventListener('change', (e) => {
      const weight = e.target.value;
      appState.verseWeight = weight;
      localStorage.setItem('ephphatha_verse_weight', weight);
      applyTypographyAndLanguagePreferences();
      if (appState.userProfile) {
        appState.userProfile.verseWeight = weight;
        localStorage.setItem('ephphatha_biometric_profile_v3', JSON.stringify(appState.userProfile));
        const localMap = getAllRecordsMapSync('progress');
        syncUserDataToGoogleSheet(appState.userProfile, localMap).catch(() => {});
      }
    });
  }

  // Optional Developer Custom URL Override
  document.getElementById('btn-save-sheets-sync-url')?.addEventListener('click', async () => {
    const input = document.getElementById('input-sheets-sync-url');
    const val = (input?.value || '').trim();
    setGoogleSheetsSyncUrl(val);
    alert(val ? `Saved custom backend URL.` : 'Restored default cloud backend.');
  });
  document.getElementById('btn-test-sheets-connection')?.addEventListener('click', async () => {
    const test = await testGoogleSheetsConnection();
    alert(test.ok ? `✅ Cloud Backend Online!` : `Status: ${test.error}`);
  });

  // Failover Simulator Controls inside Telemetry Inspector
  document.getElementById('chk-fail-t1')?.addEventListener('change', (e) => {
    circuitBreakerState.forceTier1Fail = e.target.checked;
    loadActiveReadingSlot(appState.scheduleByDay[appState.selectedDay]);
  });
  document.getElementById('chk-fail-t2')?.addEventListener('change', (e) => {
    circuitBreakerState.forceTier2Fail = e.target.checked;
    loadActiveReadingSlot(appState.scheduleByDay[appState.selectedDay]);
  });
  document.getElementById('chk-fail-t3')?.addEventListener('change', (e) => {
    circuitBreakerState.forceTier3Fail = e.target.checked;
    loadActiveReadingSlot(appState.scheduleByDay[appState.selectedDay]);
  });
  document.getElementById('btn-flush-outbox-now')?.addEventListener('click', () => {
    flushSyncOutboxNow('MANUAL_INSPECTOR_FLUSH');
  });
  document.getElementById('btn-test-xss-shield')?.addEventListener('click', () => {
    sanitizeUserString('<script>alert("XSS")</script><img src=x onerror=evil()>', 'security_self_test');
  });

  // Export User Sharded AppData JSON backup
  document.getElementById('btn-export-appdata')?.addEventListener('click', () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      progress_log: getAllRecordsSync('progress'),
      bookmarks: getAllRecordsSync('bookmarks'),
      journals_encrypted: getAllRecordsSync('journals_encrypted'),
      fellowships: getAllRecordsSync('fellowships')
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ephphatha_appdata_backup_day${appState.selectedDay}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Initialize Guided 4-Step Lectio Divina Contemplative Timer
  initLectioDivinaWidget();

  // Bind Edge Proxy Saver & Tester (`https://ephphatha-edge-proxy.jimmymj.workers.dev`)
  const edgeInput = document.getElementById('input-edge-proxy-url');
  if (edgeInput && audioEngine.edgeProxyBaseUrl) {
    edgeInput.value = audioEngine.edgeProxyBaseUrl;
  }
  document.getElementById('btn-save-edge-proxy')?.addEventListener('click', async () => {
    const urlVal = (document.getElementById('input-edge-proxy-url')?.value || '').trim().replace(/\/+$/, '');
    if (!urlVal) return;
    audioEngine.setEdgeProxyUrl(urlVal);
    setText('edge-proxy-status-badge', 'Testing Edge Worker...');
    try {
      const res = await fetch(`${urlVal}/health`);
      if (res.ok) {
        const data = await res.json();
        setText('edge-proxy-status-badge', `✅ Edge Active (Auth: ${data.authConfigured ? 'Ready' : 'Pending Secret'})`);
        pushTelemetryLog('EDGE_PROXY_VERIFIED', `Connected to ${urlVal} (HTTP 206 Ready)`);
      } else {
        setText('edge-proxy-status-badge', `⚠️ HTTP ${res.status} (URL Saved)`);
      }
    } catch (_) {
      setText('edge-proxy-status-badge', '💾 Saved URL (Offline/CORS)');
    }
  });

  // Zero-Knowledge Recovery Key Card Export
  document.getElementById('btn-export-recovery-card')?.addEventListener('click', () => {
    const recoveryKit = {
      title: 'EPHPHATHA ZERO-KNOWLEDGE ENCRYPTION RECOVERY KIT',
      generatedAt: new Date().toISOString(),
      pilgrimProfile: appState.userProfile || { displayName: 'Ephphatha Pilgrim', note: 'Default Device Vault Key' },
      algorithm: 'AES-256-GCM / PBKDF2-SHA256 (100,000 Iterations)',
      salt: 'Ephphatha_Salvation_History_Salt_v3',
      recoverySeedMaterial: appState.userProfile?.credentialIdHex || 'default-device-credential',
      instructions: 'Keep this recovery file in a safe place. It allows you to decrypt your journals.json shard on a new device.'
    };
    const blob = new Blob([JSON.stringify(recoveryKit, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ephphatha_zero_knowledge_recovery_key.json';
    a.click();
    URL.revokeObjectURL(url);
    pushTelemetryLog('RECOVERY_KEY_EXPORTED', 'Downloaded Zero-Knowledge AES-256-GCM Recovery Key Card');
  });

  // CRDT Multi-Device Merge Verification
  document.getElementById('btn-simulate-crdt-merge')?.addEventListener('click', async () => {
    const localProgress = getAllRecordsMapSync('progress');
    const simulatedMobileShard = {
      '1': { id: '1', dayNumber: 1, completed: true, hlc: nextHlcTimestamp('mobile_iphone'), updatedAt: new Date().toISOString() },
      '298': { id: '298', dayNumber: 298, completed: true, hlc: nextHlcTimestamp('mobile_iphone'), updatedAt: new Date().toISOString() }
    };
    const mergeResult = mergeCrdtShardMaps(localProgress, simulatedMobileShard);
    for (const rec of Object.values(mergeResult.merged)) {
      await putRecord('progress', rec);
    }
    refreshGraceStreakHeader();
    renderCurriculumMapView();
    renderDayHeroCard(appState.scheduleByDay[appState.selectedDay]);
    pushTelemetryLog(
      'CRDT_HLC_MERGED',
      `Merged remote mobile shard via LWW-Element-Set CRDT (${mergeResult.totalRecords} total days, ${mergeResult.conflictsResolved} HLC conflicts resolved)`
    );
  });
}

function initLectioDivinaWidget() {
  const pillsWrap = document.getElementById('lectio-steps-pills');
  const toggleBtn = document.getElementById('btn-lectio-timer-toggle');
  if (!pillsWrap || !toggleBtn) return;

  let activeStepIdx = 0;
  let remainingSec = LECTIO_DIVINA_STEPS[0].durationSec;
  let timerId = null;

  function renderLectioState() {
    const current = LECTIO_DIVINA_STEPS[activeStepIdx];
    pillsWrap.textContent = '';
    LECTIO_DIVINA_STEPS.forEach((s, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `verse-pill ${idx === activeStepIdx ? 'active' : ''}`;
      btn.textContent = s.latin;
      btn.addEventListener('click', () => {
        activeStepIdx = idx;
        remainingSec = LECTIO_DIVINA_STEPS[idx].durationSec;
        renderLectioState();
      });
      pillsWrap.appendChild(btn);
    });

    setText('lectio-step-instruction', `${current.latin} • ${current.malayalam}: ${current.instruction}`);
    setText('lectio-timer-display', formatSecondsAsTime(remainingSec));
    toggleBtn.textContent = timerId ? '⏸ Pause' : '▶ Start Contemplation';
  }

  toggleBtn.addEventListener('click', () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      renderLectioState();
    } else {
      timerId = setInterval(() => {
        remainingSec = Math.max(0, remainingSec - 1);
        setText('lectio-timer-display', formatSecondsAsTime(remainingSec));
        if (remainingSec === 0) {
          activeStepIdx = (activeStepIdx + 1) % LECTIO_DIVINA_STEPS.length;
          remainingSec = LECTIO_DIVINA_STEPS[activeStepIdx].durationSec;
          renderLectioState();
        }
      }, 1000);
      renderLectioState();
    }
  });

  renderLectioState();
}

function switchMainTab(tabName) {
  appState.activeTab = tabName;
  const views = ['sanctuary', 'bible', 'curriculum', 'fellowship', 'vault'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== tabName);
  });
  document.querySelectorAll('[data-nav-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-nav-tab') === tabName);
  });

  if (tabName === 'bible') {
    renderBibleView();
  } else if (tabName === 'fellowship') {
    const activeCode = getActiveCohortCode();
    if (activeCode && navigator.onLine) {
      fetchCohortByInviteCode(activeCode).then(() => renderFellowshipView()).catch(() => {});
    }
  }
}

function restoreUserSettingsFromCloudProfile(user) {
  if (!user) return;
  if (user.preferredBibleVersion) {
    appState.preferredBibleVersion = user.preferredBibleVersion;
    localStorage.setItem('ephphatha_preferred_bible_version', appState.preferredBibleVersion);
    const selVer = document.getElementById('select-primary-bible-version');
    if (selVer) selVer.value = appState.preferredBibleVersion;
  }
  if (user.langPreference) {
    appState.langMode = user.langPreference;
    localStorage.setItem('ephphatha_lang_mode', appState.langMode);
    const selLang = document.getElementById('select-reading-languages');
    if (selLang) selLang.value = appState.langMode;
  }
  if (user.showLatinVulgate !== undefined) {
    appState.showLatinVulgate = Boolean(user.showLatinVulgate);
    localStorage.setItem('ephphatha_show_latin', String(appState.showLatinVulgate));
    const chk = document.getElementById('chk-show-latin-vulgate');
    if (chk) chk.checked = appState.showLatinVulgate;
  }
  if (user.verseWeight) {
    appState.verseWeight = user.verseWeight;
    localStorage.setItem('ephphatha_verse_weight', appState.verseWeight);
    const selW = document.getElementById('select-verse-weight');
    if (selW) selW.value = appState.verseWeight;
  }
  applyTypographyAndLanguagePreferences();
}

async function executeCloudLoginAndRestore(displayNameOrId) {
  const profile = await authenticateWithDeviceBiometrics(displayNameOrId);
  appState.userProfile = profile;
  renderUserProfileBadge();

  // Try retrieving user progress & active cohort from Google Sheets Master DB
  const queryKey = profile.displayName || displayNameOrId;
  setText('user-profile-status-note', `🔄 Querying Google Sheet for "${queryKey}"...`);

  try {
    const cloudRes = await loginAndRetrieveUserData(queryKey, profile.credentialIdHex);

    if (cloudRes.found && cloudRes.progressMap) {
      const localProgress = getAllRecordsMapSync('progress');
      const mergeResult = mergeCrdtShardMaps(localProgress, cloudRes.progressMap);

      for (const rec of Object.values(mergeResult.merged)) {
        await putRecord('progress', rec);
      }

      if (cloudRes.user?.activeCohortCode) {
        setActiveCohortCode(cloudRes.user.activeCohortCode);
        await fetchCohortByInviteCode(cloudRes.user.activeCohortCode).catch(() => {});
      }

      restoreUserSettingsFromCloudProfile(cloudRes.user);
      refreshGraceStreakHeader();
      renderCurriculumMapView();
      renderDayHeroCard(appState.scheduleByDay[appState.selectedDay]);
      pushTelemetryLog('CLOUD_LOGIN_RESTORED', `Restored ${cloudRes.completedCount} completed days & active cohort for ${cloudRes.user.displayName}`);

      const note = document.getElementById('user-profile-status-note');
      if (note) {
        note.textContent = `✓ Cloud Sync Active: ${cloudRes.user.displayName} (${cloudRes.completedCount} days synced)`;
        note.style.color = 'var(--text-accent)';
      }
      alert(`✓ Welcome back, ${cloudRes.user.displayName}!\nRestored ${cloudRes.completedCount} completed reading days and active fellowship cohort from Google Sheet.`);
    } else {
      // New user or no records found yet in cloud -> push local progress to cloud
      const localMap = getAllRecordsMapSync('progress');
      await syncUserDataToGoogleSheet(profile, localMap);
      const note = document.getElementById('user-profile-status-note');
      if (note) {
        note.textContent = `✓ Connected: ${profile.displayName} (Profile registered in Google Sheets)`;
        note.style.color = 'var(--text-accent)';
      }
      pushTelemetryLog('CLOUD_USER_REGISTERED', `Registered profile ${profile.displayName} in Google Sheets`);
    }
  } catch (err) {
    pushTelemetryLog('CLOUD_LOGIN_OFFLINE', `Local login completed: ${err.message}`);
  }

  // Re-load journal with hardware credential key
  await loadDayJournalEntry(appState.selectedDay, appState.scheduleByDay[appState.selectedDay]);
  renderFellowshipView();
  return profile;
}

export function showCloudSyncToast(message = '☁️ Synced') {
  const pill = document.getElementById('header-cloud-sync-pill');
  if (!pill) return;
  pill.textContent = message;
  pill.classList.remove('hidden');
  clearTimeout(pill._timer);
  pill._timer = setTimeout(() => {
    pill.classList.add('hidden');
  }, 2600);
}

function openAuthModal(defaultTab = 'signin') {
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (!backdrop) return;
  backdrop.classList.remove('hidden');
  setAuthModalAlert('');
  switchAuthTab(defaultTab);
  const signinInput = document.getElementById('input-auth-login-name');
  if (defaultTab === 'signin' && signinInput) {
    setTimeout(() => signinInput.focus(), 150);
  }
}

function closeAuthModal() {
  const backdrop = document.getElementById('auth-modal-backdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

function switchAuthTab(tab) {
  const isSignIn = tab === 'signin';
  document.getElementById('btn-tab-signin')?.classList.toggle('active', isSignIn);
  document.getElementById('btn-tab-create')?.classList.toggle('active', !isSignIn);
  document.getElementById('form-auth-signin')?.classList.toggle('hidden', !isSignIn);
  document.getElementById('form-auth-create')?.classList.toggle('hidden', isSignIn);
  setAuthModalAlert('');
}

function setAuthModalAlert(msg, isError = false) {
  const alertEl = document.getElementById('auth-modal-alert');
  if (!alertEl) return;
  if (!msg) {
    alertEl.classList.add('hidden');
    alertEl.textContent = '';
    return;
  }
  alertEl.textContent = msg;
  alertEl.className = `auth-alert-box ${isError ? 'error' : ''}`;
  alertEl.classList.remove('hidden');
}

function renderUserProfileBadge() {
  const headerBtn = document.getElementById('btn-header-auth');
  const signedInCard = document.getElementById('drawer-account-signed-in');
  const guestCard = document.getElementById('drawer-account-guest');

  if (appState.userProfile && appState.userProfile.displayName) {
    const name = appState.userProfile.displayName;
    const firstChar = name.trim().charAt(0).toUpperCase() || 'P';
    const shortName = name.split(' ')[0];

    if (headerBtn) {
      headerBtn.innerHTML = `👤 <span class="user-name-text">${shortName}</span>`;
      headerBtn.title = `Signed in as ${name} (Click to manage account)`;
    }

    if (signedInCard) signedInCard.classList.remove('hidden');
    if (guestCard) guestCard.classList.add('hidden');

    setText('drawer-user-avatar', firstChar);
    setText('drawer-user-name', name);
    setText('drawer-user-contact', appState.userProfile.email || 'Cloud Account Active');

    const progressMap = getAllRecordsMapSync('progress');
    const completedCount = Object.values(progressMap).filter(p => p.completed).length;
    const streak = calculateGraceStreak(progressMap, appState.selectedDay);
    setText('drawer-user-progress', `${completedCount} / 365`);
    setText('drawer-user-streak', `${streak.streakDays} Days`);
  } else {
    if (headerBtn) {
      headerBtn.innerHTML = `👤 <span class="user-name-text">Sign In</span>`;
      headerBtn.title = 'Sign In or Create Account';
    }
    if (signedInCard) signedInCard.classList.add('hidden');
    if (guestCard) guestCard.classList.remove('hidden');
  }
}

function bindFellowshipModuleEvents() {
  // Auto-uppercase Invitation Code input
  const joinCodeInput = document.getElementById('input-join-cohort-code');
  joinCodeInput?.addEventListener('input', (e) => {
    e.target.value = String(e.target.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  // 1. Join Existing Cohort by Code
  document.getElementById('form-join-cohort')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codeVal = document.getElementById('input-join-cohort-code')?.value || '';
    const nameVal = document.getElementById('input-join-member-name')?.value || '';
    const roleVal = document.getElementById('input-join-member-role')?.value || '';

    try {
      showCohortGatewayAlert('Validating invitation code and syncing cohort...', false);
      const res = await joinExistingCohortByCode({
        inviteCode: codeVal,
        memberName: nameVal,
        memberRole: roleVal,
        progressMetrics: getCurrentProgressMetrics(),
        allowCreateIfMissing: Boolean(appState.pendingInviteCohortName),
        fallbackCohortName: appState.pendingInviteCohortName || ''
      });
      appState.forceShowCohortGateway = false;
      appState.pendingInviteCohortName = '';
      showCohortGatewayAlert('');
      if (res?.latencyMs) updateIdbLatencyDisplay(res.latencyMs);
      renderFellowshipView();
      pushTelemetryLog('COHORT_JOINED', `Joined isolated cohort ${res.cohort.inviteCode} (${res.cohort.cohortName})`);
    } catch (err) {
      showCohortGatewayAlert(err.message || 'Could not join cohort.', true);
    }
  });

  // 1b. Roll / Generate New Preview Code inside Gateway
  document.getElementById('btn-roll-preview-code')?.addEventListener('click', () => {
    appState.previewCohortCode = generateUniqueInviteCode(6);
    const previewCodeEl = document.getElementById('preview-generated-code');
    if (previewCodeEl) {
      previewCodeEl.textContent = appState.previewCohortCode;
    }
    showCohortGatewayAlert(`Generated new invitation code: ${appState.previewCohortCode}. Tap "✨ Launch Cohort with Code" to activate it.`, false);
  });

  // 2. Create Brand-New Isolated Cohort
  document.getElementById('form-create-cohort')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cohortNameVal = document.getElementById('input-create-cohort-name')?.value || '';
    const nameVal = document.getElementById('input-create-member-name')?.value || '';
    const roleVal = document.getElementById('input-create-member-role')?.value || '';

    try {
      const res = await createNewCohortInstance({
        cohortName: cohortNameVal,
        memberName: nameVal,
        memberRole: roleVal,
        preferredInviteCode: appState.previewCohortCode,
        progressMetrics: getCurrentProgressMetrics()
      });
      appState.forceShowCohortGateway = false;
      appState.previewCohortCode = generateUniqueInviteCode(6);
      showCohortGatewayAlert('');
      const nameField = document.getElementById('input-create-cohort-name');
      if (nameField) nameField.value = '';
      if (res?.latencyMs) updateIdbLatencyDisplay(res.latencyMs);
      renderFellowshipView();
      pushTelemetryLog('COHORT_CREATED', `Created new isolated cohort ${res.cohort.inviteCode} (${res.cohort.cohortName})`);
    } catch (err) {
      showCohortGatewayAlert(err.message || 'Could not create cohort.', true);
    }
  });

  // 2b. 1-Tap Instant New Cohort Code Generator inside Active Cohort Header
  document.getElementById('btn-instant-new-cohort-code')?.addEventListener('click', async () => {
    const newCode = generateUniqueInviteCode(6);
    const identity = getLocalMemberIdentity();
    try {
      const res = await createNewCohortInstance({
        cohortName: `Fellowship Cohort ${newCode}`,
        memberName: identity.name || 'Pilgrim Founder',
        memberRole: identity.role || '',
        preferredInviteCode: newCode,
        progressMetrics: getCurrentProgressMetrics()
      });
      appState.forceShowCohortGateway = false;
      appState.previewCohortCode = generateUniqueInviteCode(6);
      if (res?.latencyMs) updateIdbLatencyDisplay(res.latencyMs);
      renderFellowshipView();
      const btn = document.getElementById('btn-instant-new-cohort-code');
      if (btn) {
        btn.textContent = `✓ New: ${res.cohort.inviteCode}`;
        setTimeout(() => { btn.textContent = '🎲 New Code'; }, 2200);
      }
      pushTelemetryLog('COHORT_CREATED', `Generated new isolated cohort code ${res.cohort.inviteCode}`);
    } catch (err) {
      alert(err.message || 'Could not generate new cohort code.');
    }
  });

  // 3. Switch / Open Cohort Gateway & Cancel Gateway
  document.getElementById('btn-switch-cohort')?.addEventListener('click', () => {
    appState.forceShowCohortGateway = true;
    showCohortGatewayAlert('');
    renderFellowshipView();
  });
  document.getElementById('btn-cancel-cohort-gateway')?.addEventListener('click', () => {
    appState.forceShowCohortGateway = false;
    showCohortGatewayAlert('');
    renderFellowshipView();
  });

  // 4. Copy Invitation Code & Share Invite Link
  document.getElementById('btn-copy-cohort-code')?.addEventListener('click', async (e) => {
    const code = getActiveCohortCode();
    if (!code) return;
    const btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = `✓ Copied ${code}`;
      setTimeout(() => { btn.textContent = '📋 Copy Code'; }, 2000);
    } catch (_) {
      btn.textContent = `Code: ${code}`;
    }
  });

  document.getElementById('btn-share-cohort-invite')?.addEventListener('click', async () => {
    const code = getActiveCohortCode();
    if (!code) return;
    const cohort = getRecordSync('fellowships', `cohort_${code}`);
    const cName = cohort?.cohortName || `Cohort ${code}`;
    const shareUrl = `${window.location.origin}${window.location.pathname}?cohort=${encodeURIComponent(code)}&cohortName=${encodeURIComponent(cName)}`;
    const shareText = `Join our "${cName}" Bible in a Year Fellowship on Ephphatha using Invitation Code: ${code}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: cName, text: shareText, url: shareUrl });
        return;
      } catch (_) { /* fallback to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      const btn = document.getElementById('btn-share-cohort-invite');
      if (btn) {
        btn.textContent = '✓ Invite Copied';
        setTimeout(() => { btn.textContent = '📤 Share'; }, 2000);
      }
    } catch (_) { /* ignore */ }
  });

  // 5. Manual Sync & Push Progress Now
  const handleManualSync = async () => {
    const code = getActiveCohortCode();
    if (!code) return;
    setText('cohort-sync-status-badge', '🔄 Syncing...');
    await fetchCohortByInviteCode(code);
    await syncMemberProgressToActiveCohort(getCurrentProgressMetrics());
    renderFellowshipView();
    pushTelemetryLog('COHORT_SYNCED', `Synchronized cohort ${code} state & reading progress`);
  };
  document.getElementById('btn-sync-cohort-now')?.addEventListener('click', handleManualSync);
  document.getElementById('btn-push-my-progress')?.addEventListener('click', handleManualSync);

  // 6. Segmented Sub-Navigation Tabs (`members` | `reflections` | `prayers`)
  document.querySelectorAll('[data-cohort-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-cohort-tab') || 'members';
      document.querySelectorAll('[data-cohort-tab]').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-cohort-tab') === targetTab);
      });
      ['members', 'reflections', 'prayers'].forEach(panelKey => {
        const panelEl = document.getElementById(`cohort-panel-${panelKey}`);
        if (panelEl) panelEl.classList.toggle('hidden', panelKey !== targetTab);
      });
    });
  });

  // 7. Publish Spiritual Reflection
  document.getElementById('form-post-reflection')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textarea = document.getElementById('input-cohort-reflection');
    if (!textarea) return;
    const daySchedule = appState.scheduleByDay[appState.selectedDay];
    const passageRef = daySchedule?.readings?.narrative || `Day ${appState.selectedDay}`;
    try {
      const res = await publishCohortReflection({
        dayNumber: appState.selectedDay,
        passageRef: `Day ${appState.selectedDay} • ${passageRef}`,
        reflectionText: textarea.value
      });
      textarea.value = '';
      if (res?.latencyMs) updateIdbLatencyDisplay(res.latencyMs);
      renderFellowshipView();
      pushTelemetryLog('COHORT_REFLECTION_POSTED', `Published reflection on Day ${appState.selectedDay}`);
    } catch (err) {
      alert(err.message || 'Unable to post reflection.');
    }
  });

  // 8. Publish Prayer Request (with Anonymous Option)
  document.getElementById('form-post-prayer')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const catSelect = document.getElementById('select-prayer-category');
    const anonChk = document.getElementById('chk-prayer-anonymous');
    const textarea = document.getElementById('input-cohort-prayer');
    if (!textarea) return;

    try {
      const res = await publishCohortPrayerRequest({
        category: catSelect?.value || 'General Petition',
        requestText: textarea.value,
        isAnonymous: Boolean(anonChk?.checked)
      });
      textarea.value = '';
      if (anonChk) anonChk.checked = false;
      if (res?.latencyMs) updateIdbLatencyDisplay(res.latencyMs);
      renderFellowshipView();
      pushTelemetryLog('COHORT_PRAYER_POSTED', `Published prayer request (Anonymous: ${Boolean(anonChk?.checked)})`);
    } catch (err) {
      alert(err.message || 'Unable to publish prayer request.');
    }
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

