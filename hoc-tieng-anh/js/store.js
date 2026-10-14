// Tiến độ học: lưu trong trình duyệt và (nếu đăng nhập) đồng bộ lên máy chủ.
import { dayKey } from './ui.js';

const KEY = 'engstep.progress';
const DAY = 86400000;
// Khoảng cách ôn tập theo "hộp" Leitner: hộp càng cao, càng lâu mới phải ôn lại.
const INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60].map(d => d * DAY);
export const MAX_BOX = INTERVALS.length - 1;

const DEFAULT_SETTINGS = {
  theme: 'auto', fontSize: 'normal', accent: 'en-US', rate: 0.9, autoplay: true, defaultCount: 25,
};

function blank() {
  return { v: 1, words: {}, days: {}, reading: {}, writing: {}, topics: {}, settings: { ...DEFAULT_SETTINGS }, updatedAt: 0 };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return { ...blank(), ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings } };
  } catch (e) { /* bỏ qua dữ liệu hỏng */ }
  return blank();
}

export let state = load();
const listeners = new Set();
export const onChange = fn => listeners.add(fn);

export function save({ silent = false } = {}) {
  state.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* hết dung lượng / chế độ riêng tư */ }
  if (!silent) listeners.forEach(fn => fn(state));
}

export function replaceState(next) {
  state = { ...blank(), ...next, settings: { ...DEFAULT_SETTINGS, ...next.settings } };
  save({ silent: true });
}

export function resetProgress() {
  const settings = state.settings;
  state = blank();
  state.settings = settings;
  save();
}

/* ---------- Từ vựng & ôn tập ngắt quãng ---------- */
export const wordState = id => state.words[id];
export const boxOf = id => state.words[id]?.b || 0;
export const isLearned = id => boxOf(id) > 0;
export const isDue = (id, now = Date.now()) => {
  const w = state.words[id];
  return Boolean(w && w.b > 0 && w.d <= now);
};

/** Ghi nhận kết quả một từ sau phiên học. perfect = không sai lần nào trong phiên */
export function recordWord(id, perfect, mistakes) {
  const now = Date.now();
  const w = state.words[id] || { b: 0, d: 0, r: 0, x: 0, s: 0 };
  if (perfect) w.b = Math.min(MAX_BOX, w.b + 1);
  else w.b = w.b > 2 ? w.b - 2 : 1;
  w.d = now + INTERVALS[w.b];
  w.r += perfect ? 1 : 0;
  w.x += mistakes;
  w.s = now;
  state.words[id] = w;
}

export function markKnown(id) {
  const now = Date.now();
  const w = state.words[id] || { b: 0, d: 0, r: 0, x: 0, s: 0 };
  w.b = Math.max(w.b, 4);
  w.d = now + INTERVALS[w.b];
  w.s = now;
  state.words[id] = w;
}

/**
 * Chọn từ cho một phiên học trong danh sách: từ đến hạn ôn → từ mới → từ đã lâu chưa gặp.
 */
export function pickWords(words, n) {
  const now = Date.now();
  const due = [], fresh = [], rest = [];
  for (const x of words) {
    const w = state.words[x.id];
    if (!w || !w.b) fresh.push(x);
    else if (w.d <= now) due.push(x);
    else rest.push(x);
  }
  due.sort((a, b) => state.words[a.id].d - state.words[b.id].d);
  rest.sort((a, b) => state.words[a.id].s - state.words[b.id].s);
  return [...due, ...fresh, ...rest].slice(0, n);
}

export function topicStats(words) {
  let learned = 0, mastered = 0, due = 0;
  const now = Date.now();
  for (const x of words) {
    const w = state.words[x.id];
    if (!w || !w.b) continue;
    learned++;
    if (w.b >= 5) mastered++;
    if (w.d <= now) due++;
  }
  return { total: words.length, learned, mastered, due };
}

export function markTopicDone(skill, topicId) {
  const k = `${skill}:${topicId}`;
  const t = state.topics[k] || { n: 0 };
  t.n++;
  t.t = Date.now();
  state.topics[k] = t;
}
export const topicSessions = (skill, topicId) => state.topics[`${skill}:${topicId}`]?.n || 0;

/* ---------- Chuỗi ngày học ---------- */
export function addActivity(questions) {
  const k = dayKey();
  state.days[k] = (state.days[k] || 0) + Math.max(1, questions);
}

export function streak() {
  let n = 0;
  const d = new Date();
  // Hôm nay chưa học thì vẫn giữ chuỗi tính đến hôm qua
  if (!state.days[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (state.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function bestStreak() {
  const keys = Object.keys(state.days).sort();
  let best = 0, cur = 0, prev = null;
  for (const k of keys) {
    const t = new Date(k + 'T00:00:00').getTime();
    cur = prev !== null && Math.round((t - prev) / DAY) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}

export const todayCount = () => state.days[dayKey()] || 0;

/* ---------- Đọc & viết ---------- */
export function recordReading(id, score, total) {
  const prev = state.reading[id];
  if (!prev || score >= prev.score) state.reading[id] = { score, total, t: Date.now() };
  else prev.t = Date.now();
}

export function saveWriting(id, text, done = false) {
  const prev = state.writing[id] || {};
  state.writing[id] = { text, done: done || prev.done || false, t: Date.now() };
}

/* ---------- Cài đặt ---------- */
export function setSetting(k, v) {
  state.settings[k] = v;
  applySettings();
  save();
}

export function applySettings() {
  const root = document.documentElement;
  const { theme, fontSize } = state.settings;
  if (theme === 'auto') delete root.dataset.theme; else root.dataset.theme = theme;
  if (fontSize === 'normal') delete root.dataset.font; else root.dataset.font = fontSize;
}

/* ---------- Gộp dữ liệu từ hai thiết bị ---------- */
export function merge(a, b) {
  const out = blank();
  out.settings = (a.updatedAt || 0) >= (b.updatedAt || 0) ? { ...b.settings, ...a.settings } : { ...a.settings, ...b.settings };
  const pickNewer = (x, y, f) => (!x ? y : !y ? x : (x[f] || 0) >= (y[f] || 0) ? x : y);
  for (const id of new Set([...Object.keys(a.words || {}), ...Object.keys(b.words || {})])) {
    out.words[id] = pickNewer(a.words?.[id], b.words?.[id], 's');
  }
  for (const k of new Set([...Object.keys(a.days || {}), ...Object.keys(b.days || {})])) {
    out.days[k] = Math.max(a.days?.[k] || 0, b.days?.[k] || 0);
  }
  for (const id of new Set([...Object.keys(a.reading || {}), ...Object.keys(b.reading || {})])) {
    const x = a.reading?.[id], y = b.reading?.[id];
    out.reading[id] = !x ? y : !y ? x : x.score >= y.score ? x : y;
  }
  for (const id of new Set([...Object.keys(a.writing || {}), ...Object.keys(b.writing || {})])) {
    out.writing[id] = pickNewer(a.writing?.[id], b.writing?.[id], 't');
  }
  for (const k of new Set([...Object.keys(a.topics || {}), ...Object.keys(b.topics || {})])) {
    const x = a.topics?.[k], y = b.topics?.[k];
    out.topics[k] = !x ? y : !y ? x : { n: Math.max(x.n, y.n), t: Math.max(x.t || 0, y.t || 0) };
  }
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return out;
}

export function exportJSON() {
  return JSON.stringify({ app: 'engstep', exportedAt: new Date().toISOString(), progress: state }, null, 1);
}

export function importJSON(text) {
  const obj = JSON.parse(text);
  const p = obj.progress || obj;
  if (!p || p.v !== 1 || typeof p.words !== 'object') throw new Error('Tệp không đúng định dạng sao lưu của EngStep');
  replaceState(merge(state, p));
  applySettings();
  save();
}
