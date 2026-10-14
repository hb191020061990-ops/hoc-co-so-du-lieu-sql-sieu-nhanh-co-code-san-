// Danh sách chủ đề theo kỹ năng, trang chủ đề, trang chọn số câu, trang ôn tập
import { h, LEVELS, POS_VI, progressBar, toast, fill } from '../ui.js';
import { icon } from '../icons.js';
import { DB, topicsOf, wordsOf } from '../data.js';
import { state, topicStats, topicSessions, isDue, boxOf, setSetting, markKnown, save } from '../store.js';
import { SKILLS, COUNTS, isTopicLocked, isItemLocked, lockedModal, speakingNote } from '../skills.js';
import { speak } from '../speech.js';

const LV_KEY = 'engstep.level';
const lastLevel = () => { try { return localStorage.getItem(LV_KEY) || 'A1'; } catch (e) { return 'A1'; } };
const rememberLevel = lv => { try { localStorage.setItem(LV_KEY, lv); } catch (e) { /* bỏ qua */ } };

export function backLink(href, label = 'Quay lại') {
  return h('a', { class: 'back', href }, icon('back'), label);
}

function levelTabs(current, onPick) {
  return h('div', { class: 'tabs even', role: 'tablist', 'aria-label': 'Cấp độ' }, LEVELS.map(l =>
    h('button', { class: 'tab' + (l.id === current ? ' active' : ''), 'data-lv': l.id, role: 'tab', 'aria-selected': String(l.id === current), title: l.name, onclick: () => onPick(l.id) }, l.id)));
}

/* ---------- Trang kỹ năng: chọn cấp độ → chủ đề ---------- */
export function skillView(skill, lvParam) {
  if (!SKILLS[skill] || skill === 'review') { location.hash = '#/review'; return h('div'); }
  let lv = LEVELS.some(l => l.id === lvParam) ? lvParam : lastLevel();
  const root = h('div');
  const meta = SKILLS[skill];

  const otherSkills = h('div', { class: 'tabs even skills', style: { marginBottom: '8px' } },
    ['vocab', 'listen', 'speak', 'read', 'write'].map(k =>
      h('a', { class: 'tab' + (k === skill ? ' active' : ''), href: `#/learn/${k}?lv=${lv}`, style: { textDecoration: 'none' } }, SKILLS[k].name)));

  function render() {
    rememberLevel(lv);
    const level = LEVELS.find(l => l.id === lv);
    fill(root,
      h('div', { class: 'row', style: { marginBottom: '12px' }, 'data-sk': skill },
        h('div', { class: 'skill-ico' }, icon(meta.icon)),
        h('div', null, h('h1', { style: { margin: 0 } }, meta.name), h('p', { class: 'muted', style: { margin: 0 } }, meta.desc))),
      otherSkills,
      levelTabs(lv, x => { lv = x; history.replaceState(null, '', `#/learn/${skill}?lv=${x}`); otherSkills.querySelectorAll('a').forEach((a, i) => { a.href = `#/learn/${['vocab', 'listen', 'speak', 'read', 'write'][i]}?lv=${x}`; }); render(); }),
      h('div', { class: 'level-head', 'data-lv': lv },
        h('div', { class: 'level-badge' }, lv),
        h('div', null, h('h2', null, level.name), h('p', null, level.desc))),
      skill === 'speak' ? speakingNote() : null,
      skill === 'read' ? readingList(lv) : null,
      skill === 'write' ? writingPrompts(lv) : null,
      skill === 'write' ? h('div', { class: 'section-title' }, h('h2', null, 'Bài tập viết theo chủ đề')) : null,
      skill !== 'read' ? topicGrid(skill, lv) : null,
    );
  }
  render();
  return root;
}

function topicGrid(skill, lv) {
  return h('div', { class: 'grid grid-2' }, topicsOf(lv).map(t => {
    const words = wordsOf(t.id);
    const st = topicStats(words);
    const locked = isTopicLocked(t.id);
    const sessions = topicSessions(skill, t.id);
    const href = skill === 'vocab' ? `#/topic/${t.id}` : `#/setup/${skill}/${t.id}`;
    return h('a', {
      class: 'topic' + (locked ? ' locked' : ''), href, 'data-lv': lv,
      onclick: e => { if (locked) { e.preventDefault(); lockedModal(); } },
    },
      h('div', { class: 'topic-ico' }, t.icon),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('h3', null, t.name),
        progressBar(st.learned, st.total, `var(--lv-${lv})`),
        h('div', { class: 'meta' },
          skill === 'vocab'
            ? `${st.learned}/${st.total} từ đã học` + (st.due ? ` · ${st.due} từ cần ôn` : '')
            : `${st.total} từ · đã luyện ${sessions} lần`)),
      locked && h('span', { class: 'lock' }, icon('lock')));
  }));
}

function readingList(lv) {
  const list = DB.reading.filter(p => p.level === lv);
  return h('div', { class: 'grid grid-2' }, list.map((p, i) => {
    const locked = isItemLocked(DB.reading, p);
    const r = state.reading[p.id];
    return h('a', { class: 'topic' + (locked ? ' locked' : ''), href: `#/read/${p.id}`, 'data-lv': lv, onclick: e => { if (locked) { e.preventDefault(); lockedModal(); } } },
      h('div', { class: 'topic-ico' }, ['📖', '📰', '📝', '📚', '🗞️'][i % 5]),
      h('div', { style: { flex: 1 } },
        h('h3', null, p.title),
        h('div', { class: 'meta' }, p.titleVi, ' · ', `${p.text.split(/\s+/).length} từ · ${p.questions.length} câu hỏi`),
        r && h('div', { class: 'meta', style: { color: 'var(--success)', fontWeight: 700 } }, `Điểm cao nhất: ${r.score}/${r.total}`)),
      locked && h('span', { class: 'lock' }, icon('lock')));
  }));
}

function writingPrompts(lv) {
  const list = DB.writing.filter(p => p.level === lv);
  return h('div', null,
    h('div', { class: 'section-title' }, h('h2', null, 'Viết đoạn văn')),
    h('div', { class: 'grid grid-2' }, list.map(p => {
      const locked = isItemLocked(DB.writing, p);
      const w = state.writing[p.id];
      return h('a', { class: 'topic' + (locked ? ' locked' : ''), href: `#/write-prompt/${p.id}`, 'data-lv': lv, onclick: e => { if (locked) { e.preventDefault(); lockedModal(); } } },
        h('div', { class: 'topic-ico' }, '✍️'),
        h('div', { style: { flex: 1 } },
          h('h3', null, p.title),
          h('div', { class: 'meta' }, `Tối thiểu ${p.minWords} từ`, w?.done ? ' · ✅ Đã hoàn thành' : w?.text ? ' · Đang viết dở' : '')),
        locked && h('span', { class: 'lock' }, icon('lock')));
    })));
}

/* ---------- Trang chủ đề (xem danh sách từ) ---------- */
export function topicView(topicId) {
  const t = DB.topicById.get(topicId);
  if (!t) return h('div', { class: 'empty' }, 'Không tìm thấy chủ đề.');
  if (isTopicLocked(topicId)) { setTimeout(lockedModal); }
  const words = wordsOf(topicId);
  const st = topicStats(words);
  const list = h('ul', { class: 'word-list' });

  function renderList() {
    list.replaceChildren(...words.map(x => h('li', { class: 'word-item' },
      h('span', { class: 'dot b' + boxOf(x.id), title: boxOf(x.id) ? `Mức nhớ ${boxOf(x.id)}/7` : 'Chưa học' }),
      h('span', { class: 'em' }, x.img || '·'),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div', null, h('span', { class: 'w' }, x.w), h('span', { class: 'pos' }, POS_VI[x.pos] || x.pos), ' ', h('span', { class: 'ipa small' }, x.ipa || '')),
        h('div', { class: 'vi' }, x.vi)),
      !boxOf(x.id) && h('button', { class: 'btn sm ghost', title: 'Đánh dấu đã biết', onclick: () => { markKnown(x.id); save(); toast(`Đã đánh dấu "${x.w}" là đã biết`); renderList(); } }, 'Đã biết'),
      h('button', { class: 'icon-btn', 'aria-label': `Nghe ${x.w}`, onclick: () => speak(x.w) }, icon('volume')))));
  }
  renderList();

  return h('div', { 'data-lv': t.level },
    backLink(`#/learn/vocab?lv=${t.level}`, `Cấp ${t.level}`),
    h('div', { class: 'row', style: { gap: '14px', marginBottom: '12px' } },
      h('div', { class: 'topic-ico', style: { width: '64px', height: '64px', fontSize: '2rem' } }, t.icon),
      h('div', null, h('span', { class: 'chip lv' }, t.level), h('h1', { style: { margin: '4px 0 0' } }, t.name))),
    h('div', { class: 'card' },
      progressBar(st.learned, st.total, `var(--lv-${t.level})`),
      h('p', { class: 'muted small', style: { marginTop: '8px' } }, `${st.learned}/${st.total} từ đã học · ${st.mastered} từ đã thuộc · ${st.due} từ cần ôn`),
      h('a', { class: 'btn primary block lg', href: `#/setup/vocab/${topicId}` }, icon('cards'), 'Học từ vựng chủ đề này'),
      h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '10px' } },
        ['listen', 'speak', 'write'].map(k => h('a', { class: 'btn sm', href: `#/setup/${k}/${topicId}`, 'data-sk': k, style: { color: 'var(--sk-c)' } }, icon(SKILLS[k].icon), SKILLS[k].name)))),
    h('div', { class: 'section-title' }, h('h2', null, `${words.length} từ trong chủ đề`)),
    h('div', { class: 'card' }, list),
  );
}

/* ---------- Trang chọn số câu (15 / 25 / 50) ---------- */
export function sourceFor(topicId) {
  if (topicId === 'due') return { title: 'Ôn tập tất cả từ đến hạn', icon: '🔁', words: DB.words.filter(x => isDue(x.id)), back: '#/review' };
  if (topicId === 'hard') {
    const hard = DB.words.filter(x => (state.words[x.id]?.x || 0) > 0).sort((a, b) => state.words[b.id].x - state.words[a.id].x).slice(0, 100);
    return { title: 'Ôn các từ hay sai', icon: '🎯', words: hard, back: '#/review' };
  }
  const m = topicId.match(/^due-(A1|A2|B1|B2)$/);
  if (m) return { title: `Ôn tập từ đến hạn – cấp ${m[1]}`, icon: '🔁', level: m[1], words: DB.words.filter(x => x.lv === m[1] && isDue(x.id)), back: '#/review' };
  const t = DB.topicById.get(topicId);
  if (!t) return null;
  return { title: t.name, icon: t.icon, level: t.level, words: wordsOf(topicId), topic: t };
}

export function setupView(skill, topicId) {
  const src = sourceFor(topicId);
  const meta = SKILLS[skill];
  if (!src || !meta) return h('div', { class: 'empty' }, 'Không tìm thấy bài học.');
  if (src.topic && isTopicLocked(topicId)) { setTimeout(lockedModal); location.hash = `#/learn/${skill}?lv=${src.level}`; return h('div'); }
  let count = COUNTS.includes(state.settings.defaultCount) ? state.settings.defaultCount : 25;
  const maxQ = src.words.length * (meta.perWord || 2);
  const back = src.back || (skill === 'vocab' ? `#/topic/${topicId}` : `#/learn/${skill}?lv=${src.level}`);

  if (!src.words.length) {
    return h('div', { class: 'setup' }, backLink(back),
      h('div', { class: 'empty' }, h('div', { class: 'em' }, '🎉'), h('h2', null, 'Không có từ nào cần ôn lúc này'),
        h('p', null, 'Hãy học thêm từ mới, hệ thống sẽ nhắc bạn ôn đúng lúc sắp quên.'),
        h('a', { class: 'btn primary', href: '#/learn/vocab' }, 'Học từ mới')));
  }

  const opts = h('div', { class: 'count-grid', role: 'radiogroup', 'aria-label': 'Số câu hỏi' });
  const startBtn = h('a', { class: 'btn primary block lg' });
  function render() {
    opts.replaceChildren(...COUNTS.map(n => h('button', {
      class: 'count-opt' + (n === count ? ' active' : ''), role: 'radio', 'aria-checked': String(n === count),
      onclick: () => { count = n; render(); },
    }, h('b', null, n), h('span', null, n === 15 ? '≈ 5 phút' : n === 25 ? '≈ 8 phút' : '≈ 15 phút'))));
    startBtn.href = `#/play/${skill}/${topicId}/${count}`;
    startBtn.replaceChildren(icon('sparkle'), `Bắt đầu ${Math.min(count, maxQ)} câu`);
  }
  render();
  startBtn.addEventListener('click', () => { if (state.settings.defaultCount !== count) setSetting('defaultCount', count); });

  return h('div', { class: 'setup', 'data-sk': skill, 'data-lv': src.level || 'A1' },
    backLink(back),
    h('div', { class: 'setup-head' },
      h('div', { class: 'topic-ico' }, src.icon),
      h('span', { class: 'chip', style: { background: 'var(--sk-s)', color: 'var(--sk-c)' } }, icon(meta.icon), meta.name),
      src.level && h('span', { class: 'chip lv', style: { marginLeft: '6px' } }, src.level),
      h('h1', { style: { marginTop: '8px' } }, src.title),
      h('p', { class: 'muted' }, `${src.words.length} từ`)),
    h('div', { class: 'card' },
      h('h3', null, 'Bạn muốn học bao nhiêu câu?'),
      opts,
      maxQ < 50 && h('p', { class: 'muted small' }, `Chủ đề này có tối đa ${maxQ} câu cho kỹ năng ${meta.name.toLowerCase()}.`),
      startBtn),
    skill === 'speak' ? h('div', { style: { marginTop: '12px' } }, speakingNote()) : null,
    h('div', { class: 'card' },
      h('h3', null, 'Bài học gồm'),
      h('ol', { class: 'steps' }, meta.steps.map((s, i) => h('li', null, h('span', { class: 'n' }, i + 1), s))),
      h('p', { class: 'muted small', style: { marginTop: '10px', marginBottom: 0 } }, 'Câu trả lời sai sẽ được đưa xuống cuối để làm lại cho đến khi đúng hết.')),
  );
}

/* ---------- Trang ôn tập ---------- */
export function reviewView() {
  const now = Date.now();
  const dueAll = DB.words.filter(x => isDue(x.id, now));
  const learnedIds = Object.entries(state.words).filter(([, w]) => w.b > 0);
  const nextDue = learnedIds.map(([, w]) => w.d).filter(d => d > now).sort((a, b) => a - b)[0];
  const hardCount = DB.words.filter(x => (state.words[x.id]?.x || 0) > 0).length;

  return h('div', { 'data-sk': 'review' },
    h('div', { class: 'row', style: { marginBottom: '12px' } },
      h('div', { class: 'skill-ico' }, icon('repeat')),
      h('div', null, h('h1', { style: { margin: 0 } }, 'Ôn tập ngắt quãng'), h('p', { class: 'muted', style: { margin: 0 } }, 'Ôn đúng lúc sắp quên để nhớ lâu'))),
    h('div', { class: 'card center' },
      h('div', { style: { fontSize: '3rem', fontWeight: 800, color: 'var(--sk-c)' } }, dueAll.length),
      h('p', { class: 'muted' }, 'từ đến hạn ôn hôm nay'),
      dueAll.length
        ? h('a', { class: 'btn primary lg block', href: '#/setup/review/due' }, icon('repeat'), 'Ôn tập ngay')
        : h('p', null, learnedIds.length
          ? `Tuyệt vời! Lần ôn tiếp theo: ${nextDue ? new Date(nextDue).toLocaleString('vi-VN', { weekday: 'long', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' }) : 'chưa có'}.`
          : 'Bạn chưa học từ nào. Hãy bắt đầu với chủ đề đầu tiên!'),
      !learnedIds.length && h('a', { class: 'btn primary', href: '#/learn/vocab?lv=A1' }, 'Học từ mới')),
    h('div', { class: 'section-title' }, h('h2', null, 'Theo cấp độ')),
    h('div', { class: 'grid grid-2' }, LEVELS.map(l => {
      const n = dueAll.filter(x => x.lv === l.id).length;
      return h('a', { class: 'topic', href: n ? `#/setup/review/due-${l.id}` : `#/learn/vocab?lv=${l.id}`, 'data-lv': l.id },
        h('div', { class: 'level-badge' }, l.id),
        h('div', { style: { flex: 1 } }, h('h3', null, l.name), h('div', { class: 'meta' }, n ? `${n} từ cần ôn` : 'Không có từ đến hạn')));
    })),
    hardCount > 0 && h('a', { class: 'topic', href: '#/setup/review/hard', style: { marginTop: '12px' } },
      h('div', { class: 'topic-ico' }, '🎯'),
      h('div', null, h('h3', null, 'Ôn các từ hay sai'), h('div', { class: 'meta' }, `${hardCount} từ bạn từng trả lời sai`))),
    h('div', { class: 'card', style: { marginTop: '16px' } },
      h('h3', null, 'Ôn tập ngắt quãng hoạt động thế nào?'),
      h('p', { class: 'muted small' }, 'Mỗi từ có một "mức nhớ" từ 1 đến 7. Trả lời đúng hết trong một buổi học thì từ lên mức và lịch ôn giãn ra: 1 ngày → 2 ngày → 4 ngày → 1 tuần → 2 tuần → 1 tháng → 2 tháng. Trả lời sai thì từ bị hạ mức để ôn lại sớm hơn.')),
  );
}
