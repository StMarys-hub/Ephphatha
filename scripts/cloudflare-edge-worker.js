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
let cachedOAuthToken = null;
let cachedOAuthExpiry = 0;

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
      'Access-Control-Allow-Headers': 'Content-Type, Range, X-Ephphatha-Signature, X-Ephphatha-Timestamp'
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
    // ROUTE 3: Health & Security Posture Verification (`/health` or `/`)
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
