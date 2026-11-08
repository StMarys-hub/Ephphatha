/**
 * EPHPHATHA ADAPTER LAYER: GOOGLE SHEETS MASTER DATABASE SYNC CLIENT
 * Connects the web application to Google Apps Script / Google Sheets backend.
 *
 * Capabilities:
 *  1. User Profile & Passwordless Login: Retrieves past progress, streak, and active cohort when user logs in.
 *  2. Cloud Backup: Syncs progress and reading state to Google Sheets (Users & Progress_Logs tabs).
 *  3. Real-time Multi-User Fellowship Sync: Pulls and pushes cohort reflections, prayers, and member progress.
 *  4. Direct Web App & Edge Proxy Routing: Works directly with Google Apps Script Web App or via Cloudflare Edge Worker.
 */

import { decodeEntitiesForTextContent, sanitizeUserString } from '../domain/securityEngine.js';

const STORAGE_KEY_SHEETS_URL = 'ephphatha_sheets_sync_url';
const listeners = new Set();

export function onGoogleSheetsSyncStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifySync(status, details = {}) {
  const snapshot = {
    status,
    timestamp: new Date().toISOString(),
    isConfigured: isGoogleSheetsConfigured(),
    url: getGoogleSheetsSyncUrl(),
    ...details
  };
  listeners.forEach(fn => {
    try { fn(snapshot); } catch (_) { /* ignore */ }
  });
}

export function getGoogleSheetsSyncUrl() {
  return (localStorage.getItem(STORAGE_KEY_SHEETS_URL) || '').trim();
}

export function setGoogleSheetsSyncUrl(url) {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) {
    localStorage.removeItem(STORAGE_KEY_SHEETS_URL);
    notifySync('CLEARED');
    return;
  }
  localStorage.setItem(STORAGE_KEY_SHEETS_URL, cleanUrl);
  notifySync('CONFIGURED', { url: cleanUrl });
}

export function isGoogleSheetsConfigured() {
  return true; // Central Cloud Backend is pre-wired and automatically active
}

function getCandidateEndpoints() {
  const endpoints = [];
  const directUrl = getGoogleSheetsSyncUrl();
  if (directUrl) {
    endpoints.push({ url: directUrl, isDirect: true });
  }

  // Edge Proxy route
  const edgeProxy = (localStorage.getItem('ephphatha_edge_proxy_url') || 'https://ephphatha-edge-proxy.jimmymj.workers.dev').replace(/\/+$/, '');
  endpoints.push({ url: `${edgeProxy}/api/sheet-proxy`, isDirect: false });

  // Local development route
  if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
    endpoints.push({ url: '/api/sheet-proxy', isDirect: false });
  }

  return endpoints;
}

/**
 * Universal dispatcher for Google Sheets Web App actions.
 * Supports direct Google Apps Script Web App calls (using text/plain to bypass preflight CORS)
 * as well as proxy routing.
 */
async function callSheetsBackend(action, payload = {}) {
  const endpoints = getCandidateEndpoints();
  if (endpoints.length === 0) {
    return { ok: false, error: 'No Google Sheets backend configured' };
  }

  const directUrl = getGoogleSheetsSyncUrl();

  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);

      let targetUrl = ep.url;
      const headers = { 'Accept': 'application/json' };
      let body = null;

      if (ep.isDirect) {
        // Direct call to Google Apps Script Web App:
        // Use POST with text/plain to prevent browser preflight (OPTIONS) failure!
        body = JSON.stringify({ action, payload });
        headers['Content-Type'] = 'text/plain;charset=utf-8';
      } else {
        // Calling Edge Worker or Local Proxy
        if (directUrl) headers['X-Google-Sheet-Url'] = directUrl;
        body = JSON.stringify({ action, payload, sheetUrl: directUrl || undefined });
        headers['Content-Type'] = 'application/json';
      }

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json && (json.ok || json.status === 'ok' || json.data)) {
          return json;
        }
      }
    } catch (_) {
      // try next candidate
    }
  }

  return { ok: false, error: 'Could not connect to Google Sheets backend' };
}

/**
 * 1. PING / TEST GOOGLE SHEETS CONNECTION
 */
export async function testGoogleSheetsConnection(customUrl) {
  const urlToTest = String(customUrl || getGoogleSheetsSyncUrl() || '').trim();
  if (!urlToTest) {
    return { ok: false, error: 'Please enter a Google Apps Script Web App URL.' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(urlToTest, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping' }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.ok) {
        notifySync('CONNECTED', { title: data.spreadsheetTitle, id: data.spreadsheetId });
        return { ok: true, data };
      }
    }
    return { ok: false, error: 'Google Sheet responded, but returned invalid status.' };
  } catch (err) {
    return { ok: false, error: `Connection failed: ${err.message || 'Network timeout'}` };
  }
}

/**
 * 2. USER LOGIN: Retrieve profile and all completed days when user logs back in
 */
export async function loginAndRetrieveUserData(displayNameOrId, credentialId = '') {
  if (!displayNameOrId) return { ok: false, found: false };

  notifySync('LOGGING_IN', { name: displayNameOrId });
  const resp = await callSheetsBackend('login', {
    userId: credentialId || undefined,
    displayName: displayNameOrId
  });

  if (resp && resp.ok && resp.data && resp.data.found) {
    notifySync('USER_RETRIEVED', {
      user: resp.data.user,
      completedCount: resp.data.completedCount
    });
    return {
      ok: true,
      found: true,
      user: resp.data.user,
      progressMap: resp.data.progressMap || {},
      completedCount: resp.data.completedCount || 0,
      cohort: resp.data.cohort || null
    };
  }

  return { ok: Boolean(resp && resp.ok), found: false };
}

/**
 * 3. SAVE / BACKUP USER PROFILE & PROGRESS LOGS TO GOOGLE SHEET
 */
export async function syncUserDataToGoogleSheet(userProfile, progressMap) {
  if (!userProfile) return null;

  const payload = {
    user: {
      userId: userProfile.credentialIdHex || userProfile.userId || localStorage.getItem('ephphatha_member_id_v3'),
      displayName: userProfile.displayName || localStorage.getItem('ephphatha_member_name_v3') || 'Pilgrim',
      email: userProfile.email || '',
      authMethod: userProfile.authMethod || 'WebAuthn / Passkey',
      streakDays: Number(userProfile.streakDays || 0),
      graceShields: Number(userProfile.graceShields !== undefined ? userProfile.graceShields : 2),
      activeCohortCode: userProfile.activeCohortCode || localStorage.getItem('ephphatha_active_cohort_code_v3') || '',
      lastActiveDay: Number(userProfile.selectedDay || localStorage.getItem('ephphatha_selected_day') || 1),
      preferredBibleVersion: userProfile.preferredBibleVersion || localStorage.getItem('ephphatha_preferred_bible_version') || 'POC',
      langPreference: userProfile.langPreference || localStorage.getItem('ephphatha_lang_mode') || 'bilingual',
      verseWeight: userProfile.verseWeight || localStorage.getItem('ephphatha_verse_weight') || 'strong',
      showLatinVulgate: userProfile.showLatinVulgate !== undefined ? userProfile.showLatinVulgate : (localStorage.getItem('ephphatha_show_latin') === 'true')
    },
    progress: progressMap ? Object.values(progressMap) : []
  };

  notifySync('SYNCING_USER', { displayName: payload.user.displayName });
  const resp = await callSheetsBackend('syncUser', payload);
  if (resp && resp.ok) {
    notifySync('USER_SYNCED', { userId: payload.user.userId });
    return resp.data;
  }
  return null;
}

/**
 * 4. PULL COHORT FROM GOOGLE SHEET (With updates from multiple users)
 */
export async function fetchCohortFromGoogleSheet(inviteCode) {
  if (!inviteCode) return null;
  const cleanCode = String(inviteCode).toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

  const resp = await callSheetsBackend('getCohort', { inviteCode: cleanCode });
  if (resp && resp.ok && resp.data && resp.data.cohort) {
    return resp.data.cohort;
  }
  return null;
}

/**
 * 5. PUSH COHORT (Members, Reflections, Prayers) TO GOOGLE SHEET
 */
export async function syncCohortToGoogleSheet(cohort) {
  if (!cohort || !cohort.inviteCode) return null;

  const resp = await callSheetsBackend('saveCohort', { cohort });
  if (resp && resp.ok && resp.data && resp.data.cohort) {
    return resp.data.cohort;
  }
  return null;
}

/**
 * 6. SINGLE-ACTION QUICK PROGRESS SYNC
 */
export async function syncDayProgressToGoogleSheet({
  userId,
  dayNumber,
  completed,
  audioTimestampSec = 0,
  inviteCode = '',
  memberMetrics = null
}) {
  return callSheetsBackend('syncProgress', {
    userId,
    dayNumber,
    completed,
    audioTimestampSec,
    inviteCode,
    memberMetrics
  });
}
