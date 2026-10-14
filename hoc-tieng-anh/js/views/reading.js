// Bài đọc: đoạn văn, chạm vào từ để tra nghĩa, câu hỏi đọc hiểu
import { h, POS_VI } from '../ui.js';
import { icon } from '../icons.js';
import { DB, findWord } from '../data.js';
import { state, recordReading, addActivity, save } from '../store.js';
import { speak, stopSpeaking } from '../speech.js';
import { isItemLocked, lockedModal } from '../skills.js';
import { backLink } from './learn.js';

export function readingView(id) {
  const p = DB.reading.find(x => x.id === id);
  if (!p) return h('div', { class: 'empty' }, 'Không tìm thấy bài đọc.');
  if (isItemLocked(DB.reading, p)) { setTimeout(lockedModal); location.hash = `#/learn/read?lv=${p.level}`; return h('div'); }

  let pop = null;
  const closePop = () => { pop?.remove(); pop = null; };

  function showWord(e, token) {
    closePop();
    const w = findWord(token);
    speak(w ? w.w : token);
    const rect = e.target.getBoundingClientRect();
    pop = h('div', { class: 'popover', role: 'dialog' },
      w
        ? [h('div', { class: 'row' }, h('b', null, w.w), h('span', { class: 'muted small' }, w.ipa || ''), h('span', { class: 'spacer' }),
            h('button', { class: 'icon-btn', style: { width: '36px', height: '36px' }, 'aria-label': 'Nghe', onclick: () => speak(w.w) }, icon('volume'))),
          h('div', { class: 'small muted' }, POS_VI[w.pos] || w.pos, ' · cấp ', w.lv),
          h('div', { style: { marginTop: '4px' } }, w.vi)]
        : [h('b', null, token), h('div', { class: 'small muted' }, 'Từ này chưa có trong kho 3.000 từ.')]);
    document.body.append(pop);
    const pw = Math.min(280, window.innerWidth - 24);
    pop.style.left = `${Math.max(12, Math.min(window.innerWidth - pw - 12, rect.left + rect.width / 2 - pw / 2))}px`;
    pop.style.top = `${rect.bottom + 8 + (rect.bottom + 140 > window.innerHeight ? -(rect.height + 150) : 0)}px`;
  }
  const outside = e => { if (pop && !pop.contains(e.target) && !e.target.classList.contains('wd')) closePop(); };
  document.addEventListener('click', outside);
  window.addEventListener('scroll', closePop, { passive: true });

  // Tách đoạn văn thành từng từ có thể chạm
  const paragraph = h('div', { class: 'passage', lang: 'en' });
  for (const part of p.text.split(/(\s+)/)) {
    if (/^\s+$/.test(part)) { paragraph.append(part); continue; }
    const m = part.match(/^([^A-Za-z]*)([A-Za-z][A-Za-z'’-]*[A-Za-z]|[A-Za-z])([^A-Za-z]*)$/);
    if (!m) { paragraph.append(part); continue; }
    const [, pre, word, post] = m;
    paragraph.append(pre, h('span', { class: 'wd', onclick: e => showWord(e, word) }, word), post);
  }

  const vi = h('div', { class: 'passage-vi', hidden: true }, p.vi);
  let playing = false;
  const playBtn = h('button', { class: 'btn', onclick: async () => {
    if (playing) { stopSpeaking(); playing = false; playBtn.lastChild.textContent = 'Nghe cả bài'; return; }
    playing = true; playBtn.lastChild.textContent = 'Dừng';
    for (const s of p.text.match(/[^.!?]+[.!?]+["”]?/g) || [p.text]) {
      if (!playing) break;
      await speak(s.trim(), { rate: 0.85 });
    }
    playing = false; playBtn.lastChild.textContent = 'Nghe cả bài';
  } }, icon('volume'), h('span', null, 'Nghe cả bài'));

  // Câu hỏi
  const answers = new Array(p.questions.length).fill(null);
  const qBox = h('div');
  const result = h('div');
  const submit = h('button', { class: 'btn primary block lg', disabled: true, onclick: grade }, 'Nộp bài');
  let graded = false;

  function renderQuestions() {
    qBox.replaceChildren(...p.questions.map((q, qi) => h('div', { class: 'rq' },
      h('h3', null, `${qi + 1}. ${q.q}`),
      h('div', { class: 'options', style: { marginTop: '8px' } }, q.options.map((o, oi) => {
        const cls = ['opt'];
        if (graded && oi === q.answer) cls.push('correct');
        else if (graded && answers[qi] === oi) cls.push('wrong');
        else if (!graded && answers[qi] === oi) cls.push('correct');
        return h('button', {
          class: cls.join(' '), disabled: graded, style: !graded && answers[qi] === oi ? { background: 'var(--sk-read-soft)', borderColor: 'var(--sk-read)' } : null,
          onclick: () => { answers[qi] = oi; submit.disabled = answers.includes(null); renderQuestions(); },
        }, h('span', { class: 'key' }, 'ABCD'[oi]), o);
      })),
      graded && h('div', { class: 'explain' }, answers[qi] === q.answer ? '✅ ' : '❌ ', q.explain))));
  }

  function grade() {
    graded = true;
    const score = answers.filter((a, i) => a === p.questions[i].answer).length;
    recordReading(p.id, score, p.questions.length);
    addActivity(p.questions.length);
    save();
    renderQuestions();
    submit.hidden = true;
    const next = DB.reading.filter(x => x.level === p.level);
    const after = next[next.indexOf(p) + 1];
    result.replaceChildren(h('div', { class: 'card center', style: { marginTop: '16px' } },
      h('div', { style: { fontSize: '2.6rem' } }, score === p.questions.length ? '🏆' : score >= p.questions.length / 2 ? '👍' : '📚'),
      h('h2', null, `Bạn đúng ${score}/${p.questions.length} câu`),
      h('p', { class: 'muted' }, 'Xem giải thích dưới mỗi câu. Chạm vào từ trong bài để ôn nghĩa.'),
      h('div', { class: 'row wrap', style: { justifyContent: 'center' } },
        h('button', { class: 'btn', onclick: () => { graded = false; answers.fill(null); submit.hidden = false; submit.disabled = true; result.replaceChildren(); renderQuestions(); } }, 'Làm lại'),
        after && h('a', { class: 'btn primary', href: `#/read/${after.id}` }, 'Bài tiếp theo'),
        h('a', { class: 'btn ghost', href: `#/learn/read?lv=${p.level}` }, 'Danh sách bài đọc'))));
  }
  renderQuestions();

  const best = state.reading[p.id];
  const el = h('div', { 'data-sk': 'read', 'data-lv': p.level },
    backLink(`#/learn/read?lv=${p.level}`, 'Bài đọc'),
    h('span', { class: 'chip lv' }, p.level), best && h('span', { class: 'chip', style: { marginLeft: '6px' } }, `Điểm cao nhất ${best.score}/${best.total}`),
    h('h1', { style: { marginTop: '8px', marginBottom: '2px' } }, p.title),
    h('p', { class: 'muted' }, p.titleVi),
    h('div', { class: 'card' },
      h('div', { class: 'row wrap', style: { marginBottom: '12px' } },
        playBtn,
        h('button', { class: 'btn', onclick: e => { vi.hidden = !vi.hidden; e.currentTarget.lastChild.textContent = vi.hidden ? 'Xem bản dịch' : 'Ẩn bản dịch'; } }, icon('eye'), h('span', null, 'Xem bản dịch'))),
      h('p', { class: 'muted small' }, 'Mẹo: chạm vào một từ để nghe và xem nghĩa.'),
      paragraph, vi),
    h('div', { class: 'section-title' }, h('h2', null, 'Câu hỏi đọc hiểu')),
    h('div', { class: 'card' }, qBox, h('div', { style: { marginTop: '16px' } }, submit)),
    result);

  return { el, cleanup: () => { closePop(); stopSpeaking(); document.removeEventListener('click', outside); window.removeEventListener('scroll', closePop); } };
}
