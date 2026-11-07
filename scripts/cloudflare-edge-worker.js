/**
 * EPHPHATHA EDGE API GATEWAY & HTTP 206 AUDIO PROXY WORKER (Cloudflare Worker)
 * File: scripts/cloudflare-edge-worker.js
 *
 * Implements:
 *  1. Zero Client-Side Secret Exposure (secrets live only in Cloudflare encrypted env variables)
 *  2. HTTP 206 Byte-Range Audio Streaming (`Accept-Ranges: bytes`) + 7-Day Edge CDN Caching
 *  3. Token-Bucket Rate Limiting (30 req/min per IP)
 *  4. Supports BOTH:
 *     - Option A (Easiest): `GDRIVE_API_KEY` (Never expires, streams from shared Drive folder)
 *     - Option B (OAuth Refresh): `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN`
 *       or static `GDRIVE_ACCESS_TOKEN`
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

/**
 * Automatically obtains a fresh Google Drive Bearer token if OAuth Refresh credentials are configured
 */
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
    // ROUTE 1: HTTP 206 Byte-Range Google Drive Audio Streamer (`/audio/:fileId`)
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

      // Build Google Drive V3 media URL (uses API key if present, or Bearer token)
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
    // ROUTE 2: Health & Security Posture Verification (`/health` or `/`)
    // ========================================================================
    return new Response(
      JSON.stringify({
        status: 'Ephphatha Edge Gateway Active',
        version: '3.0.0-ENTERPRISE',
        http206ByteRange: true,
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
