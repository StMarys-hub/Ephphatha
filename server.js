/**
 * EPHPHATHA ZERO-DEPENDENCY LOCAL HTTP SERVER WITH SECURITY HEADERS & HTTP 206 AUDIO PROXY
 * Run with: `node server.js` -> Opens http://localhost:3080
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3080;
const ROOT = __dirname;
const localCohortStore = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg'
};

function computeCohortAccessToken(inviteCode) {
  return crypto
    .createHmac('sha256', 'ephphatha-cohort-isolation-v3.3')
    .update(`COHORT:${inviteCode}`)
    .digest('hex')
    .slice(0, 32);
}

function sanitizeServerText(str, maxLen = 800) {
  return String(str || '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Streams a Google Drive audio file with HTTP 206 Byte-Range support via the Cloudflare Edge Worker
 * or directly from Google Drive's media stream endpoint.
 */
function proxyGoogleDriveAudio(req, res, fileId) {
  const cleanId = fileId.replace(/[^a-zA-Z0-9_-]/g, '');
  const rangeHeader = req.headers.range || 'bytes=0-';
  const targetUrl = `https://ephphatha-edge-proxy.jimmymj.workers.dev/audio/${cleanId}`;

  const options = {
    headers: {
      Range: rangeHeader,
      'User-Agent': 'Ephphatha-Sanctuary-Proxy/3.0'
    }
  };

  https.get(targetUrl, options, (upstream) => {
    const headers = {
      'Content-Type': upstream.headers['content-type'] || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline',
      'Access-Control-Allow-Origin': '*'
    };
    if (upstream.headers['content-length']) {
      headers['Content-Length'] = upstream.headers['content-length'];
    }
    if (upstream.headers['content-range']) {
      headers['Content-Range'] = upstream.headers['content-range'];
    }

    res.writeHead(upstream.statusCode || 200, headers);
    upstream.pipe(res);
  }).on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upstream audio stream error', details: err.message }));
  });
}

const server = http.createServer((req, res) => {
  const rawPathname = decodeURIComponent(req.url.split('?')[0]);

  // Built-in HTTP 206 Audio Proxy Route (`/audio/<GOOGLE_DRIVE_FILE_ID>`)
  if (rawPathname.startsWith('/audio/')) {
    const fileId = rawPathname.replace('/audio/', '');
    proxyGoogleDriveAudio(req, res, fileId);
    return;
  }

  // Google Sheets Master Database Proxy Route (`/api/sheet-proxy`)
  if (rawPathname === '/api/sheet-proxy') {
    let bodyStr = '';
    req.on('data', chunk => {
      if (bodyStr.length < 500000) bodyStr += chunk;
    });
    req.on('end', () => {
      try {
        const body = JSON.parse(bodyStr || '{}');
        const targetUrl = body.sheetUrl || req.headers['x-google-sheet-url'] || process.env.GOOGLE_SHEETS_WEBAPP_URL;

        if (targetUrl) {
          // Proxy directly to external Google Apps Script
          const parsedUrl = new URL(targetUrl);
          const postData = JSON.stringify(body);
          const client = parsedUrl.protocol === 'https:' ? https : http;

          const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain;charset=utf-8',
              'Content-Length': Buffer.byteLength(postData)
            }
          };

          const pReq = client.request(options, (pRes) => {
            let replyData = '';
            pRes.on('data', d => replyData += d);
            pRes.on('end', () => {
              res.writeHead(pRes.statusCode || 200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(replyData);
            });
          });
          pReq.on('error', err => {
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ ok: false, error: err.message }));
          });
          pReq.write(postData);
          pReq.end();
          return;
        }

        // Local Server Mock DB Fallback if no external Google Sheet URL
        const action = (body.action || '').toLowerCase();
        const payload = body.payload || {};

        if (action === 'ping') {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, spreadsheetTitle: 'Ephphatha Local Server Mock DB' }));
          return;
        }

        if (action === 'login' || action === 'getuser') {
          const userKey = (payload.displayName || payload.userId || '').toLowerCase();
          const saved = global.__LOCAL_USER_DB__?.[userKey] || null;
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, data: { found: Boolean(saved), user: saved?.user, progressMap: saved?.progressMap || {}, completedCount: Object.keys(saved?.progressMap || {}).length } }));
          return;
        }

        if (action === 'syncuser' || action === 'saveuser') {
          if (!global.__LOCAL_USER_DB__) global.__LOCAL_USER_DB__ = {};
          const user = payload.user || {};
          const userKey = (user.displayName || user.userId || 'default').toLowerCase();
          const progMap = {};
          (payload.progress || []).forEach(p => { progMap[String(p.dayNumber || p.id)] = p; });
          global.__LOCAL_USER_DB__[userKey] = { user, progressMap: progMap };

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, data: { userId: user.userId, savedProgressCount: Object.keys(progMap).length } }));
          return;
        }

        if (action === 'syncprogress') {
          if (!global.__LOCAL_USER_DB__) global.__LOCAL_USER_DB__ = {};
          const userKey = (payload.displayName || payload.userId || 'default').toLowerCase();
          if (!global.__LOCAL_USER_DB__[userKey]) {
            global.__LOCAL_USER_DB__[userKey] = { user: { userId: payload.userId }, progressMap: {} };
          }
          const dNum = Number(payload.dayNumber || 1);
          global.__LOCAL_USER_DB__[userKey].progressMap[String(dNum)] = {
            id: String(dNum),
            dayNumber: dNum,
            completed: Boolean(payload.completed),
            audioTimestampSec: Number(payload.audioTimestampSec || 0),
            updatedAt: new Date().toISOString()
          };
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, data: { dayNumber: dNum, completed: payload.completed } }));
          return;
        }

        if (action === 'getcohort') {
          const code = (payload.inviteCode || '').toUpperCase().trim();
          const cohort = localCohortStore.get(code) || null;
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, data: { found: Boolean(cohort), cohort } }));
          return;
        }

        if (action === 'savecohort') {
          const cohort = payload.cohort || {};
          const code = (cohort.inviteCode || '').toUpperCase().trim();
          if (code) localCohortStore.set(code, cohort);
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, data: { found: true, cohort } }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }
  if (rawPathname.startsWith('/api/fellowship/')) {
    const rawCode = rawPathname.replace('/api/fellowship/', '').toUpperCase().trim();
    if (!/^[A-Z2-9]{6,10}$/.test(rawCode)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid invitation code format' }));
      return;
    }

    const tokenHeader = req.headers['x-cohort-token'] || '';
    const expectedToken = computeCohortAccessToken(rawCode);
    if (!tokenHeader || tokenHeader !== expectedToken) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Cohort isolation violation: invalid access token' }));
      return;
    }

    if (req.method === 'GET') {
      const cohort = localCohortStore.get(rawCode) || null;
      if (!cohort) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Cohort not found', inviteCode: rawCode }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cohort }));
      return;
    }

    if (req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => {
        if (bodyStr.length < 250000) bodyStr += chunk;
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(bodyStr || '{}');
          const inc = parsed.cohort;
          if (!inc || inc.inviteCode !== rawCode) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid cohort payload' }));
            return;
          }
          const sanitized = {
            id: `cohort_${rawCode}`,
            schemaVersion: 3,
            inviteCode: rawCode,
            cohortName: sanitizeServerText(inc.cohortName, 64) || `Cohort ${rawCode}`,
            createdAt: sanitizeServerText(inc.createdAt, 40) || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            members: Array.isArray(inc.members) ? inc.members.slice(0, 100) : [],
            reflections: Array.isArray(inc.reflections) ? inc.reflections.slice(0, 150) : [],
            prayers: Array.isArray(inc.prayers) ? inc.prayers.slice(0, 150) : []
          };
          localCohortStore.set(rawCode, sanitized);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ cohort: sanitized }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed JSON' }));
        }
      });
      return;
    }
  }

  const safePath = path.normalize(rawPathname).replace(/^(\.\.[\/\\])+/, '');
  const relPath = safePath === '/' || safePath === '\\' ? 'index.html' : safePath;
  const filePath = path.join(ROOT, relPath);

  // Hardened Security Headers (Section 6.1 Threat Matrix)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n✨ Ephphatha v3.0 Sanctuary Server running at: http://localhost:${PORT}`);
  console.log(`📘 Operations & Google Drive Setup Guide:     http://localhost:${PORT}/setup-guide.html\n`);
});
