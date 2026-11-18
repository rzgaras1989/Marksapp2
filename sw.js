/* تۆماری نمرە — Service Worker
   هەموو فایلەکان لە یەکەم کردنەوەدا هەڵدەگیرێن، دواتر ئەپەکە بێ ئینتەرنێت کار دەکات.
   کاتێک وەشانی ئەپ دەگۆڕیت، تەنها VERSION بگۆڕە.                                     */
const VERSION = 'marks-v2.3.0';
const CORE = [
  './', 'index.html', 'config.js', 'manifest.json',
  'marks.png', 'marks-192.png', 'marks-maskable.png', 'apple-touch-icon.png',
  'fonts/Vazirmatn.woff2',
  'libs/xlsx.full.min.js', 'libs/html2canvas.min.js', 'libs/jspdf.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => { }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('marks-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

/* لاپەڕەکان: یەکەم ئینتەرنێت (بۆ وەشانی نوێ)، ئەگەر نەبوو کاش */
async function pageHandler(req) {
  const url = new URL(req.url), key = url.origin + url.pathname, cache = await caches.open(VERSION);
  try {
    const res = await fetchTimeout(req, 4000);
    if (res && res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(key)) ||
      (await cache.match(new URL('index.html', self.registration.scope).href)) ||
      new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

/* فایلەکانی تر: یەکەم کاش، لە پشتەوە نوێکردنەوە */
async function assetHandler(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) {
    if (!/\/(libs|fonts)\//.test(req.url)) fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); }).catch(() => { });
    return hit;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return new Response('', { status: 504 });
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;          // تێلیگرام و هتد: دەستکاری ناکرێن
  if (url.pathname.startsWith(new URL(self.registration.scope).pathname + 's/')) return;   // لاپەڕەی قوتابی (s/) هیچ پەیوەندییەکی بە ئەپی مامۆستاوە نییە
  e.respondWith(req.mode === 'navigate' ? pageHandler(req) : assetHandler(req));
});
