/**
 * EPHPHATHA UI LAYER: REACTIVE APPLICATION CONTROLLER
 * Connects Domain (12 Periods, Grace Streak, WebAuthn + AES-GCM + HMAC Security)
 * and Adapters (IndexedDB <5ms Vault, 4-Tier Bible Failover, HTTP 206 Audio Engine, BackgroundSync).
 */

import { EphphathaAudioEngine, formatSecondsAsTime, normalizeGoogleDriveAudioId } from '../adapters/audioEngine.js?v=3.0.4';
import {
  circuitBreakerState,
  fetchPassageWithFailover,
  initScriptureVault,
  onFailoverEvent
} from '../adapters/bibleFailoverGateway.js';
import {
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
import { buildFull365Curriculum, calculateGraceStreak } from '../domain/periods.js';
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

const appState = {
  theme: localStorage.getItem('ephphatha_theme') || 'dark', // Default to soothing Warm Dusk (#1E2430)
  fontScale: localStorage.getItem('ephphatha_font_scale') || '100',
  activeTab: 'sanctuary', // 'sanctuary' | 'curriculum' | 'fellowship' | 'vault'
  inspectorOpen: true,
  selectedDay: Number(localStorage.getItem('ephphatha_selected_day')) || 1,
  activeReadingSlot: 'narrative', // 'narrative' | 'supplemental' | 'psalm_wisdom'
  langMode: 'bilingual', // 'bilingual' | 'en' | 'ml'
  showLatinVulgate: true,
  periods: [],
  scheduleByDay: {},
  currentPassageData: null,
  userProfile: null,
  lastIdbLatencyMs: 0.18,
  telemetryFeed: []
};

const audioEngine = new EphphathaAudioEngine();

export async function bootstrapEphphathaApp() {
  // 1. Apply eye-soothing theme (#FAF7F2 Parchment or #1E2430 Warm Dusk — Never #000000) & Font Scale
  applyTheme(appState.theme);
  applyFontScale(appState.fontScale);

  // 2. Initialize Local-First IndexedDB Vault (<5ms) & Tier-3/4 Scripture Vault
  await initLocalVault();
  await initScriptureVault();
  initBackgroundSyncLifecycle();

  // 3. Load saved biometric profile if present
  const savedProfile = localStorage.getItem('ephphatha_biometric_profile_v3');
  if (savedProfile) {
    try { appState.userProfile = JSON.parse(savedProfile); } catch (_) { /* ignore */ }
  }

  // 4. Seed default Fellowship Cohort if none exists yet
  await seedDefaultFellowshipIfEmpty();

  // 5. Hydrate 365-Day Dynamic Online Curriculum (`schedule_manifest_v3.json`)
  await loadDynamicCurriculumManifest();

  // 6. Wire Telemetry & Security Listeners
  wireTelemetryStreams();

  // 7. Bind Top Header, Navigation, Modals, and Inspector Controls
  bindGlobalControls();

  // 8. Select initial Day and render full UI
  await selectDay(appState.selectedDay, { initialBoot: true });
  renderFellowshipView();
  renderCurriculumMapView();
  renderVaultView();
  renderUserProfileBadge();
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

  populateDayDropdown();
  renderPeriodsRibbon();
}

async function seedDefaultFellowshipIfEmpty() {
  const existing = getAllRecordsSync('fellowships');
  if (existing.length === 0) {
    await putRecord('fellowships', {
      id: 'cohort_st_thomas',
      cohortName: 'St. Thomas Syro-Malabar & Parish Fellowship',
      inviteCode: 'EPH734',
      createdBy: 'Parish Coordinator',
      members: [
        { id: 'm1', name: 'Fr. Thomas Kurian', contact: 'thomas.k@parish.org', status: 'Completed Today', day: 298, amens: 14 },
        { id: 'm2', name: 'Mariam Varghese', contact: '+1-555-0192 (WhatsApp)', status: 'Listening Now', day: 27, amens: 9 },
        { id: 'm3', name: 'Joseph Mathew', contact: 'joseph.m@family.org', status: 'Grace Shield Active', day: 5, amens: 6 }
      ]
    });
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
    themeBtn.textContent = appState.theme === 'dark'
      ? '☀️ Parchment Light'
      : '🌙 Warm Dusk (#1E2430)';
  }

  // Re-apply active period soft background for current theme
  const dayObj = appState.scheduleByDay[appState.selectedDay];
  if (dayObj?.period) {
    applyPeriodColorTokens(dayObj.period);
  }
}

function applyPeriodColorTokens(period) {
  if (!period) return;
  document.documentElement.style.setProperty('--period-color', period.accent_hex);
  const softBg = appState.theme === 'dark' ? period.bg_soft_dark : period.bg_soft_light;
  document.documentElement.style.setProperty('--period-bg-soft', softBg);
}

function applyFontScale(scaleStr) {
  const valid = ['100', '112', '125'].includes(String(scaleStr)) ? String(scaleStr) : '100';
  appState.fontScale = valid;
  document.documentElement.setAttribute('data-font-scale', valid);
  localStorage.setItem('ephphatha_font_scale', valid);

  const fontBtn = document.getElementById('btn-font-scaler');
  if (fontBtn) {
    fontBtn.textContent = `AA ${valid}%`;
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
    const streamUrl = `${audioEngine.edgeProxyBaseUrl}/audio/${daySchedule.gdrive_audio_file_id}`;
    folderEl.textContent = `📁 ${daySchedule.period.gdrive_folder} • ID: ${daySchedule.gdrive_audio_file_id} → ${streamUrl}`;
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
    completeBtn.textContent = isDone
      ? `✅ Day ${daySchedule.day_number} Completed`
      : `☐ Mark Day ${daySchedule.day_number} Complete`;
    completeBtn.className = isDone ? 'ergonomic-btn primary-period' : 'ergonomic-btn';
  }

  // Update Reading Slot Tab labels
  const slots = [
    { key: 'narrative', label: '1. Narrative', ref: daySchedule.readings.narrative, refMl: daySchedule.readings.narrative_ml },
    { key: 'supplemental', label: '2. Supplemental', ref: daySchedule.readings.supplemental, refMl: daySchedule.readings.supplemental_ml },
    { key: 'psalm_wisdom', label: '3. Psalm / Wisdom', ref: daySchedule.readings.psalm_wisdom, refMl: daySchedule.readings.psalm_wisdom_ml }
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

async function loadActiveReadingSlot(daySchedule) {
  const slotKey = appState.activeReadingSlot;
  const refEn = daySchedule.readings[slotKey] || daySchedule.readings.narrative;
  const refMl = daySchedule.readings[`${slotKey}_ml`] || '';

  const passageData = await fetchPassageWithFailover(refEn, refMl);
  appState.currentPassageData = passageData;
  renderScriptureVerses(passageData);
}

function renderScriptureVerses(passageData) {
  if (!passageData) return;

  setText('reader-active-ref', `${passageData.reference_en} • ${passageData.reference_ml || ''}`);
  setText('reader-tier-badge', `${passageData.tierBadge} (${passageData.latencyMs.toFixed(1)}ms)`);

  // Render Quick-Jump Verse Pills
  const jumpBar = document.getElementById('verse-jump-bar');
  const versesList = document.getElementById('verses-list');
  if (!jumpBar || !versesList) return;

  jumpBar.textContent = '';
  versesList.textContent = '';

  const bookmarksMap = getAllRecordsMapSync('bookmarks');

  passageData.verses.forEach((v, idx) => {
    const verseDomId = `verse-card-${v.verse}`;
    const bookmarkId = `bm_d${appState.selectedDay}_${passageData.reference_en}_v${v.verse}`;
    const isBookmarked = Boolean(bookmarksMap[bookmarkId]);

    // 1. Quick-Jump Pill
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'verse-pill';
    pill.textContent = `v.${v.verse}`;
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
    numBadge.textContent = `${passageData.reference_en} : ${v.verse}`;

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
    bmBtn.textContent = isBookmarked ? '🔖 Saved' : '🔖 Bookmark';
    bmBtn.addEventListener('click', async () => {
      await toggleVerseBookmark(bookmarkId, passageData.reference_en, passageData.reference_ml, v);
      renderScriptureVerses(appState.currentPassageData);
      renderVaultView();
    });

    // 1-Tap Bilingual Devotional Verse Image Card Generator
    const shareCardBtn = document.createElement('button');
    shareCardBtn.type = 'button';
    shareCardBtn.className = 'verse-icon-btn';
    shareCardBtn.textContent = '🎨 Share Card';
    shareCardBtn.title = 'Download High-DPI Bilingual Verse Image Card';
    shareCardBtn.addEventListener('click', async () => {
      const periodObj = appState.scheduleByDay[appState.selectedDay]?.period;
      await generateAndDownloadVerseCard({
        dayNumber: appState.selectedDay,
        periodName: periodObj?.name || 'Salvation History',
        periodAccentHex: periodObj?.accent_hex || '#2B8CBE',
        referenceEn: passageData.reference_en,
        referenceMl: passageData.reference_ml,
        verseNumber: v.verse,
        textEn: v.en,
        textMl: v.ml
      });
      pushTelemetryLog('VERSE_CARD_GENERATED', `Rendered 1080x1080 bilingual verse card for ${passageData.reference_en}:${v.verse}`);
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
      cipherPreview.textContent = `AES-256-GCM Ciphertext in IndexedDB: ${storedEnvelope.ciphertext.slice(0, 44)}... (IV: ${storedEnvelope.iv})`;
    }
  } else {
    textarea.value = '';
    if (cipherPreview) {
      cipherPreview.textContent = 'No reflection saved for this day yet. Reflections are encrypted with AES-GCM 256-bit before writing to IndexedDB.';
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
    cipherPreview.textContent = `✅ Saved in ${writeRes.latencyMs}ms • AES-256-GCM Ciphertext: ${encryptedEnvelope.ciphertext.slice(0, 44)}...`;
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
 * FELLOWSHIP COMMUNITY & COHORT ENGINE (WITH XSS SANITIZATION)
 * ============================================================================ */
function renderFellowshipView() {
  const cohorts = getAllRecordsSync('fellowships');
  const cohort = cohorts[0];
  if (!cohort) return;

  setText('fellowship-cohort-title', cohort.cohortName);
  setText('fellowship-invite-code', cohort.inviteCode);

  const grid = document.getElementById('fellowship-members-grid');
  if (!grid) return;
  grid.textContent = '';

  (cohort.members || []).forEach(member => {
    const card = document.createElement('div');
    card.className = 'member-card';

    const top = document.createElement('div');
    const nameEl = document.createElement('h4');
    nameEl.textContent = decodeEntitiesForTextContent(member.name);

    const contactEl = document.createElement('div');
    contactEl.style.fontSize = '0.78rem';
    contactEl.style.color = 'var(--text-secondary)';
    contactEl.textContent = decodeEntitiesForTextContent(member.contact);

    const statusBadge = document.createElement('span');
    statusBadge.className = 'crypto-badge';
    statusBadge.style.display = 'inline-block';
    statusBadge.style.marginTop = '0.45rem';
    statusBadge.textContent = `${member.status} • Day ${member.day || 1}`;

    top.appendChild(nameEl);
    top.appendChild(contactEl);
    top.appendChild(statusBadge);

    const bottom = document.createElement('div');
    bottom.style.display = 'flex';
    bottom.style.justifyContent = 'space-between';
    bottom.style.alignItems = 'center';

    const amenBtn = document.createElement('button');
    amenBtn.type = 'button';
    amenBtn.className = 'ergonomic-btn';
    amenBtn.textContent = `🙏 Send Amen (${member.amens || 0})`;
    amenBtn.addEventListener('click', async () => {
      member.amens = (member.amens || 0) + 1;
      const res = await putRecord('fellowships', cohort);
      updateIdbLatencyDisplay(res.latencyMs);
      renderFellowshipView();
      await enqueueCloudSyncMutation('FELLOWSHIP_AMEN', 'Ephphatha_Master_DB/Fellowship_Cohorts', {
        cohortId: cohort.id,
        memberId: member.id,
        amens: member.amens
      });
    });

    bottom.appendChild(amenBtn);
    card.appendChild(top);
    card.appendChild(bottom);
    grid.appendChild(card);
  });
}

async function addFellowshipMemberFromForm(e) {
  e.preventDefault();
  const nameInput = document.getElementById('input-member-name');
  const contactInput = document.getElementById('input-member-contact');
  if (!nameInput || !contactInput) return;

  const sanitizedName = sanitizeUserString(nameInput.value, 'fellowship_member_name');
  const sanitizedContact = sanitizeUserString(contactInput.value, 'fellowship_member_contact');

  if (!sanitizedName) return;

  const cohorts = getAllRecordsSync('fellowships');
  const cohort = cohorts[0];
  if (!cohort) return;

  const newMember = {
    id: `mem_${Date.now()}`,
    name: sanitizedName,
    contact: sanitizedContact || 'Invited via Fellowship Deep-Link',
    status: 'Completed Today',
    day: appState.selectedDay,
    amens: 1
  };

  cohort.members.unshift(newMember);
  const res = await putRecord('fellowships', cohort);
  updateIdbLatencyDisplay(res.latencyMs);

  nameInput.value = '';
  contactInput.value = '';
  renderFellowshipView();

  await enqueueCloudSyncMutation('ADD_FELLOWSHIP_MEMBER', 'Ephphatha_Master_DB/Fellowship_Cohorts', newMember);
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
    desc.textContent = `${period.era_date} • Focus: ${period.theme} (${period.theme_ml}) • Google Drive Node: ${period.gdrive_folder}`;

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

  setText('header-streak-count', `🔥 ${stats.streakDays}d Streak • 🛡️ ${stats.graceShieldsAvailable} Grace Shields • ${stats.percentComplete}%`);
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
    setText('audio-prefetch-badge', `HTTP 206 • Day ${audioState.prefetchedNextDay} Pre-Cached`);

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
function bindGlobalControls() {
  // Theme Switcher
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    applyTheme(appState.theme === 'dark' ? 'light' : 'dark');
  });

  // 1-Tap Senior-First Font Scaler (AA)
  document.getElementById('btn-font-scaler')?.addEventListener('click', () => {
    const order = ['100', '112', '125'];
    const next = order[(order.indexOf(appState.fontScale) + 1) % order.length];
    applyFontScale(next);
  });

  // Inspector Drawer Toggle
  document.getElementById('btn-toggle-inspector')?.addEventListener('click', () => {
    appState.inspectorOpen = !appState.inspectorOpen;
    const shell = document.getElementById('workspace-shell');
    const inspector = document.getElementById('telemetry-inspector');
    if (shell) shell.classList.toggle('inspector-open', appState.inspectorOpen);
    if (inspector) inspector.classList.toggle('hidden', !appState.inspectorOpen);
  });

  // Day Selector Controls
  document.getElementById('btn-set-day-gdrive-id')?.addEventListener('click', () => {
    const val = (document.getElementById('input-day-gdrive-id')?.value || '').trim();
    if (!val) return;
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
  document.getElementById('btn-prev-day')?.addEventListener('click', () => {
    selectDay(Math.max(1, appState.selectedDay - 1));
  });
  document.getElementById('btn-next-day')?.addEventListener('click', () => {
    selectDay(Math.min(365, appState.selectedDay + 1));
  });
  document.getElementById('day-select-dropdown')?.addEventListener('change', (e) => {
    selectDay(Number(e.target.value));
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

  // Fellowship Form & Invite Code Generation
  document.getElementById('form-add-member')?.addEventListener('submit', addFellowshipMemberFromForm);
  document.getElementById('btn-regen-invite')?.addEventListener('click', async () => {
    const cohorts = getAllRecordsSync('fellowships');
    const cohort = cohorts[0];
    if (!cohort) return;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const rand = window.crypto.getRandomValues(new Uint8Array(6));
    for (let i = 0; i < 6; i++) code += chars[rand[i] % chars.length];
    cohort.inviteCode = code;
    await putRecord('fellowships', cohort);
    renderFellowshipView();
  });

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

  // Passwordless Device Biometric Login Modal
  document.getElementById('btn-open-auth-modal')?.addEventListener('click', () => {
    document.getElementById('auth-modal-backdrop')?.classList.remove('hidden');
  });
  document.getElementById('btn-close-auth-modal')?.addEventListener('click', () => {
    document.getElementById('auth-modal-backdrop')?.classList.add('hidden');
  });
  document.getElementById('btn-trigger-biometric-login')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('input-biometric-name');
    const nameVal = nameInput?.value || 'Ephphatha Pilgrim';
    const profile = await authenticateWithDeviceBiometrics(nameVal);
    appState.userProfile = profile;
    renderUserProfileBadge();
    document.getElementById('auth-modal-backdrop')?.classList.add('hidden');
    // Re-load journal with hardware credential key
    await loadDayJournalEntry(appState.selectedDay, appState.scheduleByDay[appState.selectedDay]);
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
  const views = ['sanctuary', 'curriculum', 'fellowship', 'vault'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== tabName);
  });
  document.querySelectorAll('[data-nav-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-nav-tab') === tabName);
  });
}

function renderUserProfileBadge() {
  const btn = document.getElementById('btn-open-auth-modal');
  if (!btn) return;
  if (appState.userProfile) {
    btn.textContent = `🔐 ${appState.userProfile.displayName} (${appState.userProfile.credentialIdHex.slice(0, 6)})`;
    btn.className = 'ergonomic-btn primary-period';
  } else {
    btn.textContent = '🔑 Biometric / Passkey Login';
    btn.className = 'ergonomic-btn';
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

