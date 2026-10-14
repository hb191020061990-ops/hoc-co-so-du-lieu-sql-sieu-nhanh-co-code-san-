// Service worker: lưu sẵn trang web và dữ liệu để học được khi không có mạng.
// Khi sửa mã nguồn hoặc dữ liệu, tăng VERSION để người dùng nhận bản mới.
const VERSION = 'engstep-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/config.js', 'js/ui.js', 'js/icons.js', 'js/data.js', 'js/store.js', 'js/speech.js',
  'js/sync.js', 'js/skills.js',
  'js/views/home.js', 'js/views/learn.js', 'js/views/session.js', 'js/views/reading.js',
  'js/views/writing.js', 'js/views/stats.js', 'js/views/account.js', 'js/views/admin.js',
  'data/words.json', 'data/skills.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Không can thiệp vào máy chủ tài khoản/đồng bộ
  if (url.hostname.endsWith('supabase.co')) return;

  const sameOrigin = url.origin === self.location.origin;
  const cacheable = sameOrigin || /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.hostname);
  if (!cacheable) return;

  // Lấy từ bộ nhớ đệm ngay, đồng thời cập nhật ngầm từ mạng
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    const network = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    }).catch(() => cached || (req.mode === 'navigate' ? cache.match('index.html') : Response.error()));
    return cached || network;
  }));
});
