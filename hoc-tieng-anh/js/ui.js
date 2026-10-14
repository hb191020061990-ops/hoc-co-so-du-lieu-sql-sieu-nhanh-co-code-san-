// Hàm tiện ích dựng giao diện (không dùng thư viện)

/** Tạo phần tử: h('div', {class: 'card', onclick: fn}, 'text', child, [children]) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Thay toàn bộ nội dung phần tử, bỏ qua giá trị null/false */
export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

export function mount(el) {
  const main = document.getElementById('main');
  main.replaceChildren(el);
  window.scrollTo(0, 0);
}

let toastTimer;
export function toast(msg, ms = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/** Hộp thoại xác nhận, trả về Promise<boolean> */
export function confirmBox(title, text, okLabel = 'Đồng ý', cancelLabel = 'Hủy') {
  return new Promise(resolve => {
    const close = v => { bd.remove(); resolve(v); };
    const bd = h('div', { class: 'modal-backdrop', onclick: e => { if (e.target === bd) close(false); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        h('h2', null, title),
        text && h('p', { class: 'muted' }, text),
        h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '16px' } },
          cancelLabel && h('button', { class: 'btn ghost', onclick: () => close(false) }, cancelLabel),
          h('button', { class: 'btn primary', onclick: () => close(true) }, okLabel))));
    document.body.append(bd);
    bd.querySelector('.btn.primary').focus();
  });
}

export function modal(content) {
  const bd = h('div', { class: 'modal-backdrop', onclick: e => { if (e.target === bd) bd.remove(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, content));
  document.body.append(bd);
  return () => bd.remove();
}

export function progressBar(value, max, color) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('span', { style: { width: pct + '%', ...(color ? { background: color } : {}) } }));
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const sample = (arr, n) => shuffle(arr).slice(0, n);

/** Chuẩn hóa câu trả lời để so sánh: bỏ hoa/thường, dấu câu, khoảng trắng thừa */
export function norm(s) {
  return String(s).toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Khoảng cách Levenshtein – dùng để chấp nhận lỗi gõ nhỏ */
export function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export const POS_VI = {
  n: 'danh từ', v: 'động từ', adj: 'tính từ', adv: 'trạng từ', prep: 'giới từ', pron: 'đại từ',
  conj: 'liên từ', det: 'hạn định từ', num: 'số từ', int: 'thán từ', phr: 'cụm từ', modal: 'động từ khuyết thiếu',
};

export const LEVELS = [
  { id: 'A1', name: 'Người mới bắt đầu', desc: 'Từ vựng nền tảng cho giao tiếp hằng ngày' },
  { id: 'A2', name: 'Sơ cấp', desc: 'Du lịch, mua sắm, sức khỏe, công việc' },
  { id: 'B1', name: 'Trung cấp', desc: 'Giáo dục, xã hội, truyền thông, kinh doanh' },
  { id: 'B2', name: 'Trung cao cấp', desc: 'Từ học thuật, tranh luận, chuyên ngành' },
];

export function dayKey(d = new Date()) {
  const z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
