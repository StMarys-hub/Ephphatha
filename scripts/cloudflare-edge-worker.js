/**
 * EPHPHATHA EDGE API GATEWAY & HTTP 206 AUDIO PROXY WORKER (Cloudflare Worker)
 * File: scripts/cloudflare-edge-worker.js
 *
 * Implements:
 *  1. Zero Client-Side Secret Exposure (secrets live only in Cloudflare encrypted env variables)
 *  2. HTTP 206 Byte-Range Audio Streaming (`/audio/:fileId`) + 7-Day Edge CDN Caching
 *  3. Automatic Google Drive Folder Audio Discovery (`/discover/:rootFolderId`) — automatically
 *     finds all uploaded Day 001..365 audio files across your Drive folder & 12 Period subfolders!
 *  4. Token-Bucket Rate Limiting (30 req/min per IP)
 */

const ipBuckets = new Map();
const edgeCohortMemoryStore = new Map();
const edgeUserMemoryStore = new Map();
const edgeProgressMemoryStore = new Map();
let cachedOAuthToken = null;
let cachedOAuthExpiry = 0;

function sanitizeEdgeString(str, maxLen = 800) {
  return String(str || '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, maxLen);
}

async function computeEdgeCohortToken(inviteCode) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode('ephphatha-cohort-isolation-v3.3'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`COHORT:${inviteCode}`));
  return Array.from(new Uint8Array(sig))
    .slice(0, 16)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function enforceRateLimit(ip) {
  const now = Date.now();
  const entry = ipBuckets.get(ip) || { tokens: 30, lastRefill: now };
  const elapsedSec = (now - entry.lastRefill) / 1000;
  entry.tokens = Math.min(30, entry.tokens + elapsedSec * (30 / 60));
  entry.lastRefill = now;

  if (entry.tokens < 1) {
    ipBuckets.set(ip, entry);
    return false;
  }
  entry.tokens -= 1;
  ipBuckets.set(ip, entry);
  return true;
}

async function getGoogleDriveAuthHeader(env) {
  if (env.GDRIVE_REFRESH_TOKEN && env.GDRIVE_CLIENT_ID && env.GDRIVE_CLIENT_SECRET) {
    if (cachedOAuthToken && Date.now() < cachedOAuthExpiry) {
      return `Bearer ${cachedOAuthToken}`;
    }
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GDRIVE_CLIENT_ID,
        client_secret: env.GDRIVE_CLIENT_SECRET,
        refresh_token: env.GDRIVE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      cachedOAuthToken = data.access_token;
      cachedOAuthExpiry = Date.now() + ((data.expires_in || 3500) - 60) * 1000;
      return `Bearer ${cachedOAuthToken}`;
    }
  }

  if (env.GDRIVE_ACCESS_TOKEN) {
    return `Bearer ${env.GDRIVE_ACCESS_TOKEN}`;
  }
  return null;
}

/**
 * Extracts Day Number (1..365) from filenames like:
 *  "Day 003.mp3", "Day_003_Genesis.m4a", "Day 3.mp3", "003 - Creation.mp3", "Ephphatha_Day003.m4a"
 */
function extractDayNumberFromFilename(name = '') {
  const dayExplicit = name.match(/day[\s_.-]*0*(\d{1,3})(?!\d)/i);
  if (dayExplicit) {
    const n = Number(dayExplicit[1]);
    if (n >= 1 && n <= 365) return n;
  }
  const leadingNum = name.match(/^0*(\d{1,3})(?:[\s_.-]|\b)/);
  if (leadingNum) {
    const n = Number(leadingNum[1]);
    if (n >= 1 && n <= 365) return n;
  }
  const threeDigit = name.match(/(?:^|[\s_.-])0*(\d{3})(?:[\s_.-]|\.|$)/);
  if (threeDigit) {
    const n = Number(threeDigit[1]);
    if (n >= 1 && n <= 365) return n;
  }
  return null;
}

async function listDriveChildren(folderId, env, authHeader) {
  const apiKeyParam = env.GDRIVE_API_KEY ? `&key=${encodeURIComponent(env.GDRIVE_API_KEY)}` : '';
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=1000&fields=files(id,name,mimeType)${apiKeyParam}`;
  const headers = {};
  if (authHeader) headers.Authorization = authHeader;

  const res = await fetch(listUrl, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return data.files || [];
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range, X-Cohort-Token, X-Ephphatha-Signature, X-Ephphatha-Timestamp'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    if (!enforceRateLimit(clientIp)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded (max 30 req/min)' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
      });
    }

    const url = new URL(request.url);

    // ========================================================================
    // ROUTE 1: Automatic Folder Audio Discovery (`/discover/:folderId`)
    // Scans a shared Google Drive folder (and its 12 Period subfolders) to
    // automatically map "Day 001", "Day 003", etc. to their Google Drive File IDs!
    // ========================================================================
    if (url.pathname.startsWith('/discover/')) {
      const rootFolderId = url.pathname.replace('/discover/', '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!rootFolderId) {
        return new Response(JSON.stringify({ error: 'Missing Google Drive Folder ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const authHeader = await getGoogleDriveAuthHeader(env);
      const topItems = await listDriveChildren(rootFolderId, env, authHeader);

      const subFolders = topItems.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
      const directFiles = topItems.filter(f => f.mimeType !== 'application/vnd.google-apps.folder');

      // Scan all period subfolders in parallel
      const subFolderResults = await Promise.all(
        subFolders.map(sf => listDriveChildren(sf.id, env, authHeader))
      );

      const allFiles = [...directFiles, ...subFolderResults.flat()];
      const dayMap = {};
      const matchedFiles = [];

      for (const file of allFiles) {
        const dayNum = extractDayNumberFromFilename(file.name);
        if (dayNum) {
          dayMap[String(dayNum)] = file.id;
          matchedFiles.push({ day: dayNum, name: file.name, id: file.id });
        }
      }

      return new Response(
        JSON.stringify({
          folderId: rootFolderId,
          discoveredCount: matchedFiles.length,
          dayMap,
          matchedFiles
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // ========================================================================
    // ROUTE 2: HTTP 206 Byte-Range Google Drive Audio Streamer (`/audio/:fileId`)
    // ========================================================================
    if (url.pathname.startsWith('/audio/')) {
      const fileId = url.pathname.replace('/audio/', '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!fileId) {
        return new Response(JSON.stringify({ error: 'Missing Google Drive File ID' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const rangeHeader = request.headers.get('Range') || 'bytes=0-';
      const authHeader = await getGoogleDriveAuthHeader(env);

      const apiKeyParam = env.GDRIVE_API_KEY ? `&key=${encodeURIComponent(env.GDRIVE_API_KEY)}` : '';
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media${apiKeyParam}`;

      const upstreamHeaders = { Range: rangeHeader };
      if (authHeader) {
        upstreamHeaders.Authorization = authHeader;
      }

      const upstreamRes = await fetch(driveUrl, { headers: upstreamHeaders });

      const responseHeaders = new Headers(upstreamRes.headers);
      responseHeaders.delete('access-control-allow-credentials');
      responseHeaders.set('Content-Disposition', 'inline');
      Object.entries(corsHeaders).forEach(([k, v]) => responseHeaders.set(k, v));
      responseHeaders.set('Accept-Ranges', 'bytes');
      responseHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');

      return new Response(upstreamRes.body, {
        status: upstreamRes.status === 206 ? 206 : upstreamRes.status,
        headers: responseHeaders
      });
    }

    // ========================================================================
    // ROUTE 3: Isolated Fellowship Cohort Sync API (`/fellowship/:inviteCode`)
    // Enforces strict invite-code regex validation, HMAC Cohort Token verification,
    // and input sanitization for cohort members, reflections, and prayer requests.
    // ========================================================================
    if (url.pathname.startsWith('/fellowship/')) {
      const rawCode = url.pathname.replace('/fellowship/', '').toUpperCase().trim();
      if (!/^[A-Z2-9]{6,10}$/.test(rawCode)) {
        return new Response(JSON.stringify({ error: 'Invalid invitation code format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const providedToken = request.headers.get('X-Cohort-Token') || '';
      const expectedToken = await computeEdgeCohortToken(rawCode);
      if (!providedToken || providedToken !== expectedToken) {
        return new Response(JSON.stringify({ error: 'Cohort access denied: invalid isolation token' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'GET') {
        let stored = edgeCohortMemoryStore.get(rawCode) || null;

        // Attempt fetch from persistent Google Sheets Master DB if configured
        const sheetsUrl = env.GOOGLE_SHEETS_WEBAPP_URL || request.headers.get('X-Google-Sheet-Url');
        if (sheetsUrl) {
          try {
            const sheetRes = await fetch(sheetsUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'getCohort', payload: { inviteCode: rawCode } })
            });
            if (sheetRes.ok) {
              const sheetData = await sheetRes.json();
              if (sheetData?.data?.cohort) {
                stored = sheetData.data.cohort;
                edgeCohortMemoryStore.set(rawCode, stored);
              }
            }
          } catch (_) { /* fallback to memory store */ }
        }

        if (!stored) {
          return new Response(JSON.stringify({ error: 'Cohort not found', inviteCode: rawCode }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ cohort: stored }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST') {
        const body = await request.json().catch(() => null);
        const incoming = body?.cohort;
        if (!incoming || incoming.inviteCode !== rawCode) {
          return new Response(JSON.stringify({ error: 'Cohort payload mismatch' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const sanitizedCohort = {
          id: `cohort_${rawCode}`,
          schemaVersion: 3,
          inviteCode: rawCode,
          cohortName: sanitizeEdgeString(incoming.cohortName, 64) || `Cohort ${rawCode}`,
          createdAt: sanitizeEdgeString(incoming.createdAt, 40) || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          members: Array.isArray(incoming.members)
            ? incoming.members.slice(0, 100).map(m => ({
                id: sanitizeEdgeString(m.id, 40),
                name: sanitizeEdgeString(m.name, 48),
                role: sanitizeEdgeString(m.role, 60),
                currentDay: Math.max(1, Math.min(365, Number(m.currentDay) || 1)),
                completedDaysCount: Math.max(0, Math.min(365, Number(m.completedDaysCount) || 0)),
                streakDays: Math.max(0, Math.min(365, Number(m.streakDays) || 0)),
                activityStatus: sanitizeEdgeString(m.activityStatus, 40),
                encouragements: Math.max(0, Number(m.encouragements) || 0),
                joinedAt: sanitizeEdgeString(m.joinedAt, 40),
                updatedAt: sanitizeEdgeString(m.updatedAt, 40)
              }))
            : [],
          reflections: Array.isArray(incoming.reflections)
            ? incoming.reflections.slice(0, 150).map(r => ({
                id: sanitizeEdgeString(r.id, 48),
                authorId: sanitizeEdgeString(r.authorId, 40),
                authorName: sanitizeEdgeString(r.authorName, 48),
                dayNumber: Math.max(1, Math.min(365, Number(r.dayNumber) || 1)),
                passageRef: sanitizeEdgeString(r.passageRef, 60),
                content: sanitizeEdgeString(r.content, 1000),
                amenCount: Math.max(0, Number(r.amenCount) || 0),
                createdAt: sanitizeEdgeString(r.createdAt, 40)
              }))
            : [],
          prayers: Array.isArray(incoming.prayers)
            ? incoming.prayers.slice(0, 150).map(p => ({
                id: sanitizeEdgeString(p.id, 48),
                authorId: p.isAnonymous ? 'anon' : sanitizeEdgeString(p.authorId, 40),
                authorName: p.isAnonymous ? 'Anonymous Pilgrim' : sanitizeEdgeString(p.authorName, 48),
                isAnonymous: Boolean(p.isAnonymous),
                category: sanitizeEdgeString(p.category, 36),
                content: sanitizeEdgeString(p.content, 800),
                prayingCount: Math.max(0, Number(p.prayingCount) || 0),
                isAnswered: Boolean(p.isAnswered),
                createdAt: sanitizeEdgeString(p.createdAt, 40)
              }))
            : []
        };

        edgeCohortMemoryStore.set(rawCode, sanitizedCohort);

        // Asynchronously persist to Google Sheets Master DB if configured
        const sheetsUrl = env.GOOGLE_SHEETS_WEBAPP_URL || request.headers.get('X-Google-Sheet-Url');
        if (sheetsUrl) {
          try {
            fetch(sheetsUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'saveCohort', payload: { cohort: sanitizedCohort } })
            }).catch(() => {});
          } catch (_) { /* ignore background persist errors */ }
        }

        return new Response(JSON.stringify({ cohort: sanitizedCohort }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ========================================================================
    // ROUTE 4: Google Sheets Master Database Proxy (`/api/sheet-proxy`)
    // Connects client requests directly to Google Apps Script Web App without CORS
    // ========================================================================
    if (url.pathname === '/api/sheet-proxy') {
      const body = await request.json().catch(() => ({}));
      const sheetsUrl = body.sheetUrl || request.headers.get('X-Google-Sheet-Url') || env.GOOGLE_SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbyNDknOG3kaKl0Fuv94QbM_vd2Z6rh3C4m1ZUYtBURDX6_6ZFwc-BPHUXjyKmI4fsk/exec';

      if (sheetsUrl) {
        try {
          const upstream = await fetch(sheetsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
          });
          const upstreamData = await upstream.json().catch(() => null);
          if (upstreamData) {
            return new Response(JSON.stringify(upstreamData), {
              status: upstream.status || 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (_) {
          // Fall through to resilient built-in Edge Cloud Store below
        }
      }

      // Resilient Built-in Edge Cloud Store (Auto-active without manual configuration!)
      const action = (body.action || '').toLowerCase();
      const payload = body.payload || {};

      if (action === 'ping') {
        return new Response(JSON.stringify({ ok: true, spreadsheetTitle: 'Ephphatha Edge Cloud Store' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (action === 'login' || action === 'getuser') {
        const uKey = (payload.displayName || payload.userId || '').toLowerCase().trim();
        const user = edgeUserMemoryStore.get(uKey) || null;
        const progressMap = {};
        let count = 0;
        for (const [k, v] of edgeProgressMemoryStore.entries()) {
          if (k.startsWith(`${uKey}_`)) {
            progressMap[String(v.dayNumber || v.id)] = v;
            if (v.completed) count++;
          }
        }
        return new Response(JSON.stringify({
          ok: true,
          data: {
            found: Boolean(user),
            user: user || null,
            progressMap,
            completedCount: count,
            cohort: user?.activeCohortCode ? (edgeCohortMemoryStore.get(user.activeCohortCode) || null) : null
          }
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'syncuser' || action === 'saveuser') {
        const user = payload.user || {};
        const uKey = (user.displayName || user.userId || 'pilgrim').toLowerCase().trim();
        edgeUserMemoryStore.set(uKey, user);

        const list = Array.isArray(payload.progress) ? payload.progress : Object.values(payload.progress || {});
        list.forEach(p => {
          const dNum = p.dayNumber || p.id;
          edgeProgressMemoryStore.set(`${uKey}_${dNum}`, p);
        });

        return new Response(JSON.stringify({
          ok: true,
          data: {
            userId: user.userId || uKey,
            displayName: user.displayName,
            savedProgressCount: list.length,
            updatedAt: new Date().toISOString()
          }
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'syncprogress') {
        const uKey = (payload.displayName || payload.userId || 'pilgrim').toLowerCase().trim();
        const dNum = Number(payload.dayNumber || payload.day_number || payload.day || 1);
        const pRecord = {
          id: String(dNum),
          dayNumber: dNum,
          completed: Boolean(payload.completed),
          audioTimestampSec: Number(payload.audioTimestampSec || payload.audio_timestamp_sec || 0),
          updatedAt: new Date().toISOString()
        };
        edgeProgressMemoryStore.set(`${uKey}_${dNum}`, pRecord);

        // If Google Sheets upstream is configured, forward asynchronously
        const sheetsUrl = env.GOOGLE_SHEETS_WEBAPP_URL || request.headers.get('X-Google-Sheet-Url');
        if (sheetsUrl) {
          try {
            fetch(sheetsUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'syncProgress', payload })
            }).catch(() => {});
          } catch (_) {}
        }

        return new Response(JSON.stringify({
          ok: true,
          data: { dayNumber: dNum, completed: payload.completed }
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'getcohort') {
        const code = (payload.inviteCode || '').toUpperCase().trim();
        const cohort = edgeCohortMemoryStore.get(code) || null;
        return new Response(JSON.stringify({
          ok: true,
          data: { found: Boolean(cohort), cohort }
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'savecohort') {
        const cohort = payload.cohort || {};
        const code = (cohort.inviteCode || '').toUpperCase().trim();
        if (code) edgeCohortMemoryStore.set(code, cohort);
        return new Response(JSON.stringify({
          ok: true,
          data: { found: true, cohort }
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ========================================================================
    // ROUTE 4: Health & Security Posture Verification (`/health` or `/`)
    // ========================================================================
    return new Response(
      JSON.stringify({
        status: 'Ephphatha Edge Gateway Active',
        version: '3.0.0-ENTERPRISE',
        http206ByteRange: true,
        autoFolderDiscovery: true,
        rateLimitRpm: 30,
        authConfigured: Boolean(env.GDRIVE_API_KEY || env.GDRIVE_REFRESH_TOKEN || env.GDRIVE_ACCESS_TOKEN)
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};
