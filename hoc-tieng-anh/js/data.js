// Nạp và tra cứu dữ liệu bài học (data/words.json, data/skills.json)

export const DB = {
  words: [],          // [{id, w, pos, vi, ex, exVi, lv, t, img?, ipa?, k?}]
  topics: [],         // [{id, level, name, icon}]
  reading: [],
  writing: [],
  byId: new Map(),
  byTopic: new Map(),
  topicById: new Map(),
  lookup: new Map(),  // dạng chữ thường → từ (dùng để tra nghĩa khi đọc)
};

export async function loadData(overrides = []) {
  const [w, s] = await Promise.all([
    fetch('data/words.json').then(r => r.json()),
    fetch('data/skills.json').then(r => r.json()),
  ]);
  DB.topics = w.topics;
  DB.reading = s.reading;
  DB.writing = s.writing;
  applyWords(w.words, overrides);
}

/** Gộp các chỉnh sửa của quản trị viên (bảng word_overrides) vào kho từ */
export function applyWords(words, overrides = []) {
  const map = new Map(words.map(x => [x.id, x]));
  for (const o of overrides) {
    if (o.deleted) map.delete(o.id);
    else map.set(o.id, { ...(map.get(o.id) || {}), ...o.data, id: o.id });
  }
  DB.words = [...map.values()].filter(x => x.w && x.vi && x.t);
  reindex();
}

export function reindex() {
  DB.byId = new Map(DB.words.map(x => [x.id, x]));
  DB.topicById = new Map(DB.topics.map(t => [t.id, t]));
  DB.byTopic = new Map(DB.topics.map(t => [t.id, []]));
  for (const x of DB.words) {
    if (!DB.byTopic.has(x.t)) DB.byTopic.set(x.t, []);
    DB.byTopic.get(x.t).push(x);
  }
  DB.lookup = new Map();
  for (const x of DB.words) {
    const key = x.w.toLowerCase();
    if (!DB.lookup.has(key)) DB.lookup.set(key, x);
  }
}

export const topicsOf = level => DB.topics.filter(t => t.level === level);
export const wordsOf = topicId => DB.byTopic.get(topicId) || [];
export const wordsOfLevel = level => DB.words.filter(x => x.lv === level);

/** Tìm từ trong kho ứng với một chữ gặp trong bài đọc (xử lý số nhiều, quá khứ…) */
export function findWord(token) {
  const t = token.toLowerCase().replace(/[’']s$/, '');
  const tries = [t];
  if (t.endsWith('ies')) tries.push(t.slice(0, -3) + 'y');
  if (t.endsWith('es')) tries.push(t.slice(0, -2));
  if (t.endsWith('s')) tries.push(t.slice(0, -1));
  if (t.endsWith('ied')) tries.push(t.slice(0, -3) + 'y');
  if (t.endsWith('ed')) tries.push(t.slice(0, -2), t.slice(0, -1), t.slice(0, -3));
  if (t.endsWith('ing')) tries.push(t.slice(0, -3), t.slice(0, -3) + 'e', t.slice(0, -4));
  if (t.endsWith('er')) tries.push(t.slice(0, -2), t.slice(0, -1));
  if (t.endsWith('est')) tries.push(t.slice(0, -3), t.slice(0, -2));
  if (t.endsWith('ly')) tries.push(t.slice(0, -2));
  for (const k of tries) if (DB.lookup.has(k)) return DB.lookup.get(k);
  return null;
}

/** Lấy các từ gây nhiễu cùng loại từ, ưu tiên cùng chủ đề/cấp độ */
export function distractors(word, n = 3, field = 'vi') {
  const seen = new Set([word[field].toLowerCase()]);
  const pick = [];
  const pools = [
    wordsOf(word.t).filter(x => x.pos === word.pos),
    wordsOf(word.t),
    DB.words.filter(x => x.lv === word.lv && x.pos === word.pos),
    DB.words,
  ];
  for (const pool of pools) {
    const cand = pool.slice().sort(() => Math.random() - 0.5);
    for (const x of cand) {
      if (pick.length >= n) return pick;
      const key = x[field].toLowerCase();
      if (x.id === word.id || seen.has(key)) continue;
      seen.add(key);
      pick.push(x);
    }
  }
  return pick;
}
