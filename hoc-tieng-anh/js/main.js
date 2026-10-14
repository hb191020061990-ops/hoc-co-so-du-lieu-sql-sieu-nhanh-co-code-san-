// Điểm khởi động: nạp dữ liệu, điều hướng giữa các trang
import { loadData } from './data.js';
import { h, mount, toast, fill } from './ui.js';
import { icon } from './icons.js';
import { applySettings, streak } from './store.js';
import { initAuth, onAuth, auth, fetchOverrides, isAdmin } from './sync.js';
import { hasBackend } from './config.js';

import { homeView } from './views/home.js';
import { skillView, topicView, setupView, reviewView } from './views/learn.js';
import { sessionView } from './views/session.js';
import { readingView } from './views/reading.js';
import { writingPromptView } from './views/writing.js';
import { statsView } from './views/stats.js';
import { accountView } from './views/account.js';
import { adminView } from './views/admin.js';

const NAV = [
  { href: '#/', label: 'Trang chủ', icon: 'home', match: /^#?\/?$/ },
  { href: '#/learn/vocab', label: 'Học', icon: 'book', match: /^#\/(learn|topic|setup|read|write-prompt)/ },
  { href: '#/review', label: 'Ôn tập', icon: 'repeat', match: /^#\/review/ },
  { href: '#/stats', label: 'Tiến độ', icon: 'chart', match: /^#\/stats/ },
  { href: '#/account', label: 'Tài khoản', icon: 'user', match: /^#\/(account|admin)/ },
];

const ROUTES = [
  [/^\/?$/, () => homeView()],
  [/^\/learn\/(\w+)$/, (m, q) => skillView(m[1], q.get('lv'))],
  [/^\/topic\/([\w-]+)$/, m => topicView(m[1])],
  [/^\/setup\/(\w+)\/([\w-]+)$/, m => setupView(m[1], m[2])],
  [/^\/play\/(\w+)\/([\w-]+)\/(\d+)$/, m => sessionView(m[1], m[2], Number(m[3]))],
  [/^\/review$/, () => reviewView()],
  [/^\/read\/([\w-]+)$/, m => readingView(m[1])],
  [/^\/write-prompt\/([\w-]+)$/, m => writingPromptView(m[1])],
  [/^\/stats$/, () => statsView()],
  [/^\/account$/, (m, q) => accountView(q)],
  [/^\/admin$/, () => adminView()],
];

function renderNav() {
  const hash = location.hash || '#/';
  const top = document.getElementById('topnav');
  const bottom = document.getElementById('bottomnav');
  top.replaceChildren(...NAV.map(n => h('a', { href: n.href, class: n.match.test(hash) ? 'active' : '' }, n.label)));
  bottom.replaceChildren(...NAV.map(n => h('a', { href: n.href, class: n.match.test(hash) ? 'active' : '' }, icon(n.icon), n.label)));
  const s = streak();
  const right = document.getElementById('topbar-right');
  fill(right,
    h('a', { class: 'chip', href: '#/stats', title: 'Chuỗi ngày học', style: { textDecoration: 'none', background: s ? 'var(--warn-soft)' : '', color: s ? '#f26b1d' : '' } }, icon('flame'), String(s)),
    hasBackend() && (auth.user
      ? h('a', { class: 'icon-btn', href: isAdmin() ? '#/admin' : '#/account', title: auth.user.email, 'aria-label': 'Tài khoản' }, icon(isAdmin() ? 'shield' : 'user'))
      : h('a', { class: 'btn sm primary', href: '#/account' }, 'Đăng nhập')),
  );
}

let cleanup = null;
export function route() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const q = new URLSearchParams(qs || '');
  if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { /* bỏ qua */ } }
  cleanup = null;
  document.body.classList.remove('in-session');
  document.querySelectorAll('.modal-backdrop, .popover').forEach(el => el.remove());
  renderNav();
  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (m) {
      const view = fn(m, q);
      if (view && view.el) { mount(view.el); cleanup = view.cleanup; } else if (view) mount(view);
      document.getElementById('main').focus({ preventScroll: true });
      return;
    }
  }
  mount(h('div', { class: 'empty' }, h('div', { class: 'em' }, '🧭'), h('p', null, 'Không tìm thấy trang.'), h('a', { class: 'btn primary', href: '#/' }, 'Về trang chủ')));
}

async function boot() {
  applySettings();
  try {
    await initAuth();
    const overrides = await fetchOverrides();
    await loadData(overrides);
  } catch (e) {
    console.error(e);
    mount(h('div', { class: 'empty' }, h('div', { class: 'em' }, '⚠️'),
      h('p', null, 'Không tải được dữ liệu bài học. Hãy kiểm tra kết nối mạng rồi tải lại trang.'),
      h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Tải lại')));
    return;
  }
  window.addEventListener('hashchange', route);
  onAuth(() => renderNav());
  window.addEventListener('engstep:synced', () => { if (!document.body.classList.contains('in-session')) route(); });
  route();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('offline', () => toast('Bạn đang ngoại tuyến – vẫn học được, tiến độ sẽ đồng bộ sau.'));
}

boot();
