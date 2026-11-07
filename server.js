/**
 * EPHPHATHA ZERO-DEPENDENCY LOCAL HTTP SERVER WITH SECURITY HEADERS & HTTP 206 AUDIO PROXY
 * Run with: `node server.js` -> Opens http://localhost:3080
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3080;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg'
};

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
