/**
 * EPHPHATHA ZERO-DEPENDENCY LOCAL HTTP SERVER WITH SECURITY HEADERS & HTTP 206 SUPPORT
 * Run with: `node server.js` -> Opens http://localhost:3000
 */

const http = require('http');
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
  '.m4a': 'audio/mp4'
};

const server = http.createServer((req, res) => {
  const safePath = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
  const relPath = safePath === '/' || safePath === '\\' ? 'index.html' : safePath;
  const filePath = path.join(ROOT, relPath);

  // Hardened Security Headers (Section 6.1 Threat Matrix)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Accept-Ranges', 'bytes');

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

