import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const HOST = '0.0.0.0';
const STATIC_DIR = path.join(__dirname, 'travel-map');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

const server = http.createServer((req, res) => {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // If request starts with /travel-map, strip it to match STATIC_DIR
  if (pathname.startsWith('/travel-map/')) {
    pathname = pathname.slice('/travel-map'.length);
  } else if (pathname === '/travel-map') {
    pathname = '/';
  }

  if (pathname === '/health' || pathname === '/_health') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('OK');
    return;
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(STATIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback: check if filePath + '.html' exists, else try index.html
      const fallbackHtml = path.join(STATIC_DIR, 'index.html');
      fs.stat(fallbackHtml, (fallbackErr, fallbackStats) => {
        if (!fallbackErr && fallbackStats.isFile()) {
          serveFile(fallbackHtml, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
        }
      });
      return;
    }

    serveFile(filePath, res);
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error');
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': Buffer.byteLength(content),
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
}

server.listen(PORT, HOST, () => {
  console.log(`LARS / IN TRANSIT dev server running on http://${HOST}:${PORT}`);
});
