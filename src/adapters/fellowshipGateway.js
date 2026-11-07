/**
 * EPHPHATHA ADAPTER LAYER: PRODUCTION FELLOWSHIP & COHORT MANAGEMENT GATEWAY
 * Architecture: Strict Cohort Isolation • Invite-Code Access Control • Online Edge Sync + Offline IndexedDB Failover
 *
 * Enforces:
 *  1. Zero Hardcoded Test Data (purges any legacy prototype records on boot)
 *  2. Strict Invite-Code Validation & Input Sanitization (`^[A-Z2-9]{6,10}$`)
 *  3. Cryptographic Cohort Isolation (`X-Cohort-Token` HMAC-SHA256 capability header)
 *  4. Live Reading/Listening Progress Sync, Spiritual Reflection Stream, and Anonymous-Capable Prayer Wall
 *  5. CRDT-style Deterministic State Merging across Online Edge API, Local Server API, and IndexedDB Cache
 */

import { nextHlcTimestamp } from '../domain/crdtEngine.js';
import {
  checkRateLimit,
  decodeEntitiesForTextContent,
  sanitizeUserString,
  signSyncPayload
} from '../domain/securityEngine.js';
import {
  deleteRecord,
  getAllRecordsSync,
  getRecordSync,
  putRecord
} from './indexedDbRepo.js';
import { enqueueCloudSyncMutation } from './syncWorkerClient.js';

const INVITE_CODE_REGEX = /^[A-Z2-9]{6,10}$/;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LEGACY_PROTOTYPE_IDS = new Set(['cohort_st_thomas', 'cohort_primary']);
const LEGACY_PROTOTYPE_CODES = new Set(['EPH734', 'EPH-734', 'GVWJAC']);

const broadcastChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('ephphatha_fellowship_live_v3')
  : null;

const cohortListeners = new Set();

if (broadcastChannel) {
  broadcastChannel.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'COHORT_UPDATED' && data.cohort?.inviteCode) {
      const activeCode = getActiveCohortCode();
      if (activeCode && data.cohort.inviteCode === activeCode) {
        putRecord('fellowships', data.cohort).then(() => {
          notifyCohortListeners(data.cohort, 'REALTIME_BROADCAST');
        });
      }
    }
  });
}

export function onCohortStateChange(listener) {
  cohortListeners.add(listener);
  return () => cohortListeners.delete(listener);
}

function notifyCohortListeners(cohort, source = 'LOCAL') {
  cohortListeners.forEach(fn => {
    try { fn(cohort, source); } catch (_) { /* ignore */ }
  });
}

/**
 * 1. DATA SANITATION: Purge all legacy prototype/mock fellowship cohorts from IndexedDB.
 */
export async function purgeLegacyPrototypeFellowships() {
  const all = getAllRecordsSync('fellowships');
  for (const item of all) {
    const hasMockMembers = Array.isArray(item.members) && item.members.some(
      m => m.name === 'Fr. Thomas Kurian' || m.name === 'Mariam Varghese' || m.name === 'Joseph Mathew'
    );
    if (
      LEGACY_PROTOTYPE_IDS.has(item.id) ||
      LEGACY_PROTOTYPE_CODES.has(String(item.inviteCode || '').toUpperCase()) ||
      hasMockMembers ||
      !item.schemaVersion ||
      item.schemaVersion < 3
    ) {
      await deleteRecord('fellowships', item.id);
    }
  }
}

/**
 * 2. INVITE CODE VALIDATION & CRYPTOGRAPHIC GENERATION
 * Protects against code injection, path traversal, and parameter manipulation.
 */
export function normalizeAndValidateInviteCode(rawInput) {
  const cleaned = String(rawInput || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();

  if (!INVITE_CODE_REGEX.test(cleaned)) {
    return {
      valid: false,
      code: '',
      error: 'Invitation code must be 6–10 characters (A–Z, 2–9).'
    };
  }
  return { valid: true, code: cleaned, error: null };
}

function getRandomBytes(length) {
  const arr = new Uint8Array(length);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    return globalThis.crypto.getRandomValues(arr);
  }
  for (let i = 0; i < length; i++) {
    arr[i] = Math.floor(Math.random() * 256);
  }
  return arr;
}

export function generateUniqueInviteCode(length = 6) {
  const bytes = getRandomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  }
  return code;
}

/**
 * Derives an HMAC-SHA256 Cohort Access Token from the invitation code so that
 * only members possessing the exact code can read/write that cohort partition.
 * Includes a deterministic fallback for non-HTTPS LAN/mobile testing contexts.
 */
export async function deriveCohortAccessToken(inviteCode) {
  try {
    if (globalThis.crypto && globalThis.crypto.subtle) {
      const enc = new TextEncoder();
      const key = await globalThis.crypto.subtle.importKey(
        'raw',
        enc.encode('ephphatha-cohort-isolation-v3.3'),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(`COHORT:${inviteCode}`));
      return Array.from(new Uint8Array(sig))
        .slice(0, 16)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (_) {
    // Fallback below if WebCrypto subtle is restricted
  }
  let h1 = 0xdeadbeef ^ inviteCode.length;
  let h2 = 0x41c6ce57 ^ inviteCode.length;
  const str = `ephphatha-cohort-isolation-v3.3:COHORT:${inviteCode}`;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Gets or creates the current device/pilgrim's unique Member ID & profile.
 */
export function getLocalMemberIdentity(customName = '', customRole = '') {
  let memberId = localStorage.getItem('ephphatha_member_id_v3');
  if (!memberId) {
    const rand = Array.from(getRandomBytes(6))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    memberId = `pilgrim_${rand}`;
    localStorage.setItem('ephphatha_member_id_v3', memberId);
  }

  if (customName) {
    const cleanName = decodeEntitiesForTextContent(sanitizeUserString(customName, 'member_display_name')).slice(0, 48);
    if (cleanName) localStorage.setItem('ephphatha_member_name_v3', cleanName);
  }
  if (customRole !== undefined && customRole !== null) {
    const cleanRole = decodeEntitiesForTextContent(sanitizeUserString(customRole, 'member_role')).slice(0, 60);
    if (cleanRole) localStorage.setItem('ephphatha_member_role_v3', cleanRole);
  }

  let biometricName = '';
  try {
    const bio = JSON.parse(localStorage.getItem('ephphatha_biometric_profile_v3') || 'null');
    if (bio?.displayName && bio.displayName !== 'Pilgrim Thomas') {
      biometricName = bio.displayName;
    }
  } catch (_) { /* ignore */ }

  const name = localStorage.getItem('ephphatha_member_name_v3') || biometricName || '';
  const role = localStorage.getItem('ephphatha_member_role_v3') || '';

  return { memberId, name, role };
}

export function getActiveCohortCode() {
  const raw = localStorage.getItem('ephphatha_active_cohort_code_v3') || '';
  const check = normalizeAndValidateInviteCode(raw);
  return check.valid ? check.code : '';
}

export function setActiveCohortCode(code) {
  if (!code) {
    localStorage.removeItem('ephphatha_active_cohort_code_v3');
    return;
  }
  const check = normalizeAndValidateInviteCode(code);
  if (check.valid) {
    localStorage.setItem('ephphatha_active_cohort_code_v3', check.code);
  }
}

function getEdgeBaseUrl() {
  return (localStorage.getItem('ephphatha_edge_proxy_url') || 'https://ephphatha-edge-proxy.jimmymj.workers.dev').replace(/\/+$/, '');
}

/**
 * Deterministic CRDT Merge of two states of the same Cohort (by `inviteCode`)
 * Ensures zero data loss when merging online API state with local offline cache.
 */
export function mergeCohortSnapshots(localCohort, remoteCohort) {
  if (!localCohort) return remoteCohort;
  if (!remoteCohort) return localCohort;
  if (localCohort.inviteCode !== remoteCohort.inviteCode) return localCohort;

  // 1. Merge Members by `id` (latest `updatedAt` wins)
  const membersMap = new Map();
  for (const m of (localCohort.members || [])) membersMap.set(m.id, m);
  for (const m of (remoteCohort.members || [])) {
    const prev = membersMap.get(m.id);
    if (!prev || (m.updatedAt || '') >= (prev.updatedAt || '')) {
      membersMap.set(m.id, {
        ...prev,
        ...m,
        encouragements: Math.max(Number(prev?.encouragements || 0), Number(m.encouragements || 0))
      });
    }
  }

  // 2. Merge Reflections by `id`
  const reflectionsMap = new Map();
  for (const r of (localCohort.reflections || [])) reflectionsMap.set(r.id, r);
  for (const r of (remoteCohort.reflections || [])) {
    const prev = reflectionsMap.get(r.id);
    if (!prev) {
      reflectionsMap.set(r.id, r);
    } else {
      reflectionsMap.set(r.id, {
        ...prev,
        ...r,
        amenCount: Math.max(Number(prev.amenCount || 0), Number(r.amenCount || 0))
      });
    }
  }

  // 3. Merge Prayer Requests by `id`
  const prayersMap = new Map();
  for (const p of (localCohort.prayers || [])) prayersMap.set(p.id, p);
  for (const p of (remoteCohort.prayers || [])) {
    const prev = prayersMap.get(p.id);
    if (!prev) {
      prayersMap.set(p.id, p);
    } else {
      prayersMap.set(p.id, {
        ...prev,
        ...p,
        prayingCount: Math.max(Number(prev.prayingCount || 0), Number(p.prayingCount || 0)),
        isAnswered: Boolean(prev.isAnswered || p.isAnswered)
      });
    }
  }

  return {
    ...remoteCohort,
    ...localCohort,
    cohortName: remoteCohort.cohortName || localCohort.cohortName,
    updatedAt: new Date().toISOString(),
    members: Array.from(membersMap.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    reflections: Array.from(reflectionsMap.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    prayers: Array.from(prayersMap.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  };
}

/**
 * Fetches a cohort from Online Edge API / Local Server API with strict access token,
 * falling back to Local IndexedDB Cache during network degradation.
 */
export async function fetchCohortByInviteCode(rawCode) {
  const check = normalizeAndValidateInviteCode(rawCode);
  if (!check.valid) throw new Error(check.error);

  const code = check.code;
  const recordId = `cohort_${code}`;
  const localCached = getRecordSync('fellowships', recordId);
  const accessToken = await deriveCohortAccessToken(code);

  if (!navigator.onLine) {
    return { cohort: localCached || null, source: 'OFFLINE_CACHE' };
  }

  const endpoints = [
    `${getEdgeBaseUrl()}/fellowship/${encodeURIComponent(code)}`
  ];
  if (globalThis.location && globalThis.location.protocol?.startsWith('http') && globalThis.location.hostname === 'localhost') {
    endpoints.unshift(`/api/fellowship/${encodeURIComponent(code)}`);
  }

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Cohort-Token': accessToken
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.status === 404) {
        continue;
      }
      if (res.ok) {
        const data = await res.json();
        if (data?.cohort && data.cohort.inviteCode === code) {
          const merged = mergeCohortSnapshots(localCached, data.cohort);
          await putRecord('fellowships', merged);
          return { cohort: merged, source: 'ONLINE_API' };
        }
      }
    } catch (_) {
      // Fall through to next endpoint or local cache
    }
  }

  return { cohort: localCached || null, source: 'LOCAL_CACHE' };
}

/**
 * Persists a cohort snapshot to IndexedDB (<5ms), broadcasts to local tabs,
 * and pushes to Online Edge API / BackgroundSync Outbox.
 */
export async function persistAndSyncCohort(cohort, mutationType = 'COHORT_SYNC') {
  if (!cohort || !cohort.inviteCode) throw new Error('Invalid cohort object');
  const check = normalizeAndValidateInviteCode(cohort.inviteCode);
  if (!check.valid) throw new Error(check.error);

  cohort.id = `cohort_${check.code}`;
  cohort.inviteCode = check.code;
  cohort.schemaVersion = 3;
  cohort.updatedAt = new Date().toISOString();
  cohort.hlc = nextHlcTimestamp();

  const writeRes = await putRecord('fellowships', cohort);
  broadcastChannel?.postMessage({ type: 'COHORT_UPDATED', cohort });
  notifyCohortListeners(cohort, 'LOCAL_WRITE');

  const accessToken = await deriveCohortAccessToken(check.code);
  const signedEnvelope = await signSyncPayload({
    mutationType,
    inviteCode: check.code,
    cohort
  });

  if (navigator.onLine) {
    const endpoints = [
      `${getEdgeBaseUrl()}/fellowship/${encodeURIComponent(check.code)}`
    ];
    if (globalThis.location && globalThis.location.protocol?.startsWith('http') && globalThis.location.hostname === 'localhost') {
      endpoints.unshift(`/api/fellowship/${encodeURIComponent(check.code)}`);
    }

    let syncedOnline = false;
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Cohort-Token': accessToken,
            'X-Ephphatha-Signature': signedEnvelope.signature
          },
          body: JSON.stringify({ cohort, signedEnvelope })
        });
        if (res.ok) {
          const reply = await res.json().catch(() => null);
          if (reply?.cohort) {
            const merged = mergeCohortSnapshots(cohort, reply.cohort);
            await putRecord('fellowships', merged);
            notifyCohortListeners(merged, 'ONLINE_SYNC');
          }
          syncedOnline = true;
        }
      } catch (_) {
        // Offline / Edge unreachable -> enqueue in BackgroundSync outbox below
      }
    }

    if (!syncedOnline) {
      await enqueueCloudSyncMutation(mutationType, `Fellowship_Cohorts/cohort_${check.code}.json`, {
        inviteCode: check.code,
        updatedAt: cohort.updatedAt
      });
    }
  } else {
    await enqueueCloudSyncMutation(mutationType, `Fellowship_Cohorts/cohort_${check.code}.json`, {
      inviteCode: check.code,
      updatedAt: cohort.updatedAt
    });
  }

  return { cohort, latencyMs: writeRes.latencyMs };
}

/**
 * 3. CREATE A BRAND-NEW ISOLATED COHORT INSTANCE
 */
export async function createNewCohortInstance({
  cohortName = '',
  memberName = '',
  memberRole = '',
  preferredInviteCode = '',
  progressMetrics
} = {}) {
  const rate = checkRateLimit('create_cohort');
  if (!rate.allowed) throw new Error('Rate limit reached. Please wait a moment.');

  let inviteCode = '';
  if (preferredInviteCode) {
    const prefCheck = normalizeAndValidateInviteCode(preferredInviteCode);
    if (prefCheck.valid && !getRecordSync('fellowships', `cohort_${prefCheck.code}`)) {
      inviteCode = prefCheck.code;
    }
  }
  if (!inviteCode) {
    inviteCode = generateUniqueInviteCode(6);
    while (getRecordSync('fellowships', `cohort_${inviteCode}`)) {
      inviteCode = generateUniqueInviteCode(6);
    }
  }

  const rawCohortName = String(cohortName || '').trim() || `Fellowship Cohort ${inviteCode}`;
  const existingIdentity = getLocalMemberIdentity();
  const rawMemberName = String(memberName || '').trim() || existingIdentity.name || 'Pilgrim Founder';

  const cleanCohortName = decodeEntitiesForTextContent(sanitizeUserString(rawCohortName, 'cohort_name')).slice(0, 64) || `Fellowship Cohort ${inviteCode}`;
  const cleanMemberName = decodeEntitiesForTextContent(sanitizeUserString(rawMemberName, 'member_name')).slice(0, 48) || 'Pilgrim Founder';
  const cleanRole = decodeEntitiesForTextContent(sanitizeUserString(memberRole, 'member_role')).slice(0, 60);

  const identity = getLocalMemberIdentity(cleanMemberName, cleanRole);

  const nowIso = new Date().toISOString();
  const founderMember = {
    id: identity.memberId,
    name: identity.name || cleanMemberName,
    role: identity.role || 'Cohort Founder',
    currentDay: Number(progressMetrics?.selectedDay || 1),
    completedDaysCount: Number(progressMetrics?.totalCompleted || 0),
    streakDays: Number(progressMetrics?.streakDays || 0),
    activityStatus: progressMetrics?.activityStatus || (progressMetrics?.isPlayingAudio ? 'Listening Now' : 'Active Pilgrim'),
    encouragements: 0,
    joinedAt: nowIso,
    updatedAt: nowIso
  };

  const newCohort = {
    id: `cohort_${inviteCode}`,
    schemaVersion: 3,
    inviteCode,
    cohortName: cleanCohortName,
    createdAt: nowIso,
    updatedAt: nowIso,
    createdByMemberId: identity.memberId,
    members: [founderMember],
    reflections: [],
    prayers: []
  };

  setActiveCohortCode(inviteCode);
  return persistAndSyncCohort(newCohort, 'CREATE_COHORT');
}

/**
 * 4. JOIN AN EXISTING COHORT BY INVITATION CODE
 * Entering an existing active code assigns the user to that specific cohort.
 */
export async function joinExistingCohortByCode({
  inviteCode,
  memberName = '',
  memberRole = '',
  progressMetrics,
  fallbackCohortName = ''
} = {}) {
  const rate = checkRateLimit('join_cohort');
  if (!rate.allowed) throw new Error('Too many join attempts. Please wait a moment.');

  const check = normalizeAndValidateInviteCode(inviteCode);
  if (!check.valid) throw new Error(check.error);

  const existingIdentity = getLocalMemberIdentity();
  const rawMemberName = String(memberName || '').trim() || existingIdentity.name || 'Pilgrim Member';
  const cleanMemberName = decodeEntitiesForTextContent(sanitizeUserString(rawMemberName, 'member_name')).slice(0, 48) || 'Pilgrim Member';
  const cleanRole = decodeEntitiesForTextContent(sanitizeUserString(memberRole, 'member_role')).slice(0, 60);

  const identity = getLocalMemberIdentity(cleanMemberName, cleanRole);
  const lookup = await fetchCohortByInviteCode(check.code);
  let cohort = lookup.cohort;

  const nowIso = new Date().toISOString();
  if (!cohort) {
    cohort = {
      id: `cohort_${check.code}`,
      schemaVersion: 3,
      inviteCode: check.code,
      cohortName: decodeEntitiesForTextContent(sanitizeUserString(fallbackCohortName || `Fellowship Cohort ${check.code}`, 'cohort_name')),
      createdAt: nowIso,
      updatedAt: nowIso,
      createdByMemberId: identity.memberId,
      members: [],
      reflections: [],
      prayers: []
    };
  }

  const existingMemberIdx = (cohort.members || []).findIndex(m => m.id === identity.memberId);
  const memberRecord = {
    id: identity.memberId,
    name: identity.name,
    role: identity.role || 'Pilgrim Member',
    currentDay: Number(progressMetrics?.selectedDay || 1),
    completedDaysCount: Number(progressMetrics?.totalCompleted || 0),
    streakDays: Number(progressMetrics?.streakDays || 0),
    activityStatus: progressMetrics?.isPlayingAudio ? 'Listening Now' : 'Active Pilgrim',
    encouragements: existingMemberIdx >= 0 ? Number(cohort.members[existingMemberIdx].encouragements || 0) : 0,
    joinedAt: existingMemberIdx >= 0 ? cohort.members[existingMemberIdx].joinedAt : nowIso,
    updatedAt: nowIso
  };

  if (existingMemberIdx >= 0) {
    cohort.members[existingMemberIdx] = memberRecord;
  } else {
    cohort.members.unshift(memberRecord);
  }

  setActiveCohortCode(check.code);
  return persistAndSyncCohort(cohort, 'JOIN_COHORT');
}

/**
 * 5. SYNC MEMBER READING / LISTENING PROGRESS INTO ACTIVE COHORT
 */
export async function syncMemberProgressToActiveCohort(progressMetrics) {
  const activeCode = getActiveCohortCode();
  if (!activeCode) return null;

  const identity = getLocalMemberIdentity();
  if (!identity.name) return null;

  const recordId = `cohort_${activeCode}`;
  const cohort = getRecordSync('fellowships', recordId);
  if (!cohort) return null;

  const nowIso = new Date().toISOString();
  const idx = (cohort.members || []).findIndex(m => m.id === identity.memberId);
  if (idx >= 0) {
    cohort.members[idx] = {
      ...cohort.members[idx],
      name: identity.name,
      role: identity.role || cohort.members[idx].role || 'Pilgrim Member',
      currentDay: Number(progressMetrics?.selectedDay || 1),
      completedDaysCount: Number(progressMetrics?.totalCompleted || 0),
      streakDays: Number(progressMetrics?.streakDays || 0),
      activityStatus: progressMetrics?.activityStatus || 'Active Pilgrim',
      updatedAt: nowIso
    };
  } else {
    cohort.members.unshift({
      id: identity.memberId,
      name: identity.name,
      role: identity.role || 'Pilgrim Member',
      currentDay: Number(progressMetrics?.selectedDay || 1),
      completedDaysCount: Number(progressMetrics?.totalCompleted || 0),
      streakDays: Number(progressMetrics?.streakDays || 0),
      activityStatus: progressMetrics?.activityStatus || 'Active Pilgrim',
      encouragements: 0,
      joinedAt: nowIso,
      updatedAt: nowIso
    });
  }

  return persistAndSyncCohort(cohort, 'SYNC_MEMBER_PROGRESS');
}

/**
 * 6. PUBLISH SPIRITUAL REFLECTION TO COHORT STREAM
 */
export async function publishCohortReflection({
  dayNumber,
  passageRef,
  reflectionText
}) {
  const activeCode = getActiveCohortCode();
  if (!activeCode) throw new Error('Join or create a cohort first.');

  const cohort = getRecordSync('fellowships', `cohort_${activeCode}`);
  if (!cohort) throw new Error('Active cohort not found.');

  const cleanText = decodeEntitiesForTextContent(sanitizeUserString(reflectionText, 'cohort_reflection')).trim();
  if (!cleanText) throw new Error('Please write a reflection before posting.');
  if (cleanText.length > 1000) throw new Error('Reflection must be 1,000 characters or fewer.');

  const identity = getLocalMemberIdentity();
  const rand = Array.from(getRandomBytes(4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const entry = {
    id: `refl_${Date.now()}_${rand}`,
    authorId: identity.memberId,
    authorName: identity.name || 'Pilgrim Member',
    dayNumber: Number(dayNumber || 1),
    passageRef: decodeEntitiesForTextContent(sanitizeUserString(String(passageRef || `Day ${dayNumber}`), 'reflection_ref')),
    content: cleanText,
    amenCount: 0,
    createdAt: new Date().toISOString()
  };

  if (!Array.isArray(cohort.reflections)) cohort.reflections = [];
  cohort.reflections.unshift(entry);
  return persistAndSyncCohort(cohort, 'POST_COHORT_REFLECTION');
}

/**
 * 7. PUBLISH PRAYER REQUEST (WITH ANONYMOUS WITHIN COHORT OPTION)
 */
export async function publishCohortPrayerRequest({
  category = 'General Petition',
  requestText,
  isAnonymous = false
}) {
  const activeCode = getActiveCohortCode();
  if (!activeCode) throw new Error('Join or create a cohort first.');

  const cohort = getRecordSync('fellowships', `cohort_${activeCode}`);
  if (!cohort) throw new Error('Active cohort not found.');

  const cleanText = decodeEntitiesForTextContent(sanitizeUserString(requestText, 'cohort_prayer_request')).trim();
  if (!cleanText) throw new Error('Please enter your prayer intention.');
  if (cleanText.length > 800) throw new Error('Prayer request must be 800 characters or fewer.');

  const cleanCategory = decodeEntitiesForTextContent(sanitizeUserString(category, 'prayer_category')).slice(0, 36) || 'General Petition';
  const identity = getLocalMemberIdentity();
  const rand = Array.from(getRandomBytes(4))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Strict Anonymity Protection: when isAnonymous is true, strip authorId and authorName!
  const prayerItem = {
    id: `pray_${Date.now()}_${rand}`,
    authorId: isAnonymous ? 'anon' : identity.memberId,
    authorName: isAnonymous ? 'Anonymous Pilgrim' : (identity.name || 'Pilgrim Member'),
    isAnonymous: Boolean(isAnonymous),
    category: cleanCategory,
    content: cleanText,
    prayingCount: 1,
    isAnswered: false,
    createdAt: new Date().toISOString()
  };

  if (!Array.isArray(cohort.prayers)) cohort.prayers = [];
  cohort.prayers.unshift(prayerItem);
  return persistAndSyncCohort(cohort, 'POST_PRAYER_REQUEST');
}

/**
 * 8. INTERACT WITH COHORT ITEMS (ENCOURAGE MEMBER, AMEN REFLECTION, SUPPORT / ANSWER PRAYER)
 */
export async function supportCohortItem(actionType, targetId) {
  const activeCode = getActiveCohortCode();
  if (!activeCode) return null;

  const cohort = getRecordSync('fellowships', `cohort_${activeCode}`);
  if (!cohort) return null;

  if (actionType === 'ENCOURAGE_MEMBER') {
    const member = (cohort.members || []).find(m => m.id === targetId);
    if (member) {
      member.encouragements = Number(member.encouragements || 0) + 1;
      member.updatedAt = new Date().toISOString();
    }
  } else if (actionType === 'AMEN_REFLECTION') {
    const refl = (cohort.reflections || []).find(r => r.id === targetId);
    if (refl) {
      refl.amenCount = Number(refl.amenCount || 0) + 1;
    }
  } else if (actionType === 'PRAY_FOR_REQUEST') {
    const prayer = (cohort.prayers || []).find(p => p.id === targetId);
    if (prayer) {
      prayer.prayingCount = Number(prayer.prayingCount || 0) + 1;
    }
  } else if (actionType === 'TOGGLE_PRAYER_ANSWERED') {
    const prayer = (cohort.prayers || []).find(p => p.id === targetId);
    if (prayer) {
      prayer.isAnswered = !prayer.isAnswered;
    }
  }

  return persistAndSyncCohort(cohort, actionType);
}
