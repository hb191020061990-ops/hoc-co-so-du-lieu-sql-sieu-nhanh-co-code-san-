// Phiên học: tạo danh sách câu hỏi, hiển thị từng câu, chấm điểm, câu sai đưa xuống cuối
import { h, shuffle, norm, editDistance, POS_VI, confirmBox, escapeRe } from '../ui.js';
import { icon } from '../icons.js';
import { DB, distractors, wordsOf } from '../data.js';
import { state, pickWords, recordWord, addActivity, markTopicDone, save } from '../store.js';
import { SKILLS, isTopicLocked, lockedModal } from '../skills.js';
import { speak, stopSpeaking, listen, canRecognize, canSpeak } from '../speech.js';
import { sourceFor } from './learn.js';

const COUNTED = t => t !== 'card';
const MAX_SENTENCE_WORDS = 12;

/* ===================== Tạo câu hỏi ===================== */

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const tokens = s => s.trim().split(/\s+/);
const shortSentence = (w, max = MAX_SENTENCE_WORDS) => tokens(w.ex).length <= max;

function typesFor(skill, w, i) {
  switch (skill) {
    case 'vocab': return ['mcq-en-vi', 'type-en', 'listen-pick'];
    case 'listen': return ['listen-pick', 'dictation-word', shortSentence(w, 9) && i % 2 === 0 ? 'dictation-sentence' : 'listen-sentence'];
    case 'speak': return ['speak-word', 'speak-sentence'];
    case 'write': return ['type-en', w.k ? 'fill-blank' : 'mcq-vi-en', shortSentence(w) ? 'order' : 'mcq-vi-en'];
    case 'review': {
      const pool = ['mcq-en-vi', 'mcq-vi-en', 'type-en', 'listen-pick'];
      if (w.k) pool.push('fill-blank');
      return shuffle(pool).slice(0, 2);
    }
    default: return ['mcq-en-vi'];
  }
}

export function buildQueue(skill, words, n) {
  const qs = [];
  // Chia thành nhóm 5 từ: xem thẻ → dạng 1 cho cả nhóm → dạng 2 → dạng 3 (không bị quá tải)
  chunk(words, 5).forEach((group, gi) => {
    if (skill === 'vocab') {
      for (const w of group) if (!state.words[w.id]?.b) qs.push({ type: 'card', w });
    }
    const perWord = group.map((w, i) => typesFor(skill, w, gi * 5 + i));
    const rounds = Math.max(...perWord.map(t => t.length));
    for (let r = 0; r < rounds; r++) {
      group.forEach((w, i) => { if (perWord[i][r]) qs.push({ type: perWord[i][r], w }); });
    }
  });
  // Cắt cho đúng số câu đã chọn
  let counted = 0;
  const kept = [];
  for (const q of qs) {
    if (!COUNTED(q.type)) { kept.push(q); continue; }
    if (counted >= n) continue;
    kept.push(q); counted++;
  }
  const usedWords = new Set(kept.filter(q => COUNTED(q.type)).map(q => q.w.id));
  return kept.filter(q => COUNTED(q.type) || usedWords.has(q.w.id));
}

/* ===================== Chấm điểm ===================== */

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const speechNorm = s => norm(s.replace(/\b(\d{1,2})\b/g, (m, d) => NUM[Number(d)] || d).replace(/%/g, ' percent'))
  .replace(/\bok\b/g, 'okay').replace(/\bmister\b/g, 'mr').replace(/\bmissus\b/g, 'mrs');

export function checkTyped(input, target) {
  const a = norm(input), b = norm(target);
  if (!a) return { ok: false, empty: true };
  if (a === b) return { ok: true };
  if (b.length >= 5 && editDistance(a, b) <= 1) return { ok: true, near: true };
  return { ok: false };
}

/** So khớp từng từ của câu; cho phép lỗi gõ nhỏ ở từ dài */
export function compareWords(input, target, normFn = norm) {
  const tw = normFn(target).split(' ').filter(Boolean);
  const iw = normFn(input).split(' ').filter(Boolean);
  const used = new Array(iw.length).fill(false);
  const marks = tw.map(t => {
    let k = iw.findIndex((x, j) => !used[j] && x === t);
    if (k < 0 && t.length >= 5) k = iw.findIndex((x, j) => !used[j] && editDistance(x, t) <= 1);
    if (k >= 0) { used[k] = true; return true; }
    return false;
  });
  const hit = marks.filter(Boolean).length;
  return { ratio: tw.length ? hit / tw.length : 0, marks, words: tokens(target), extra: used.filter(u => !u).length };
}

function speechScore(alts, target) {
  let best = { ratio: 0, marks: [], words: tokens(target), heard: alts[0] || '' };
  for (const a of alts) {
    const r = compareWords(a, target, speechNorm);
    if (r.ratio > best.ratio) best = { ...r, heard: a };
  }
  return best;
}

/* ===================== Phiên học ===================== */

export function sessionView(skill, topicId, n) {
  const src = sourceFor(topicId);
  if (!src || !SKILLS[skill]) return h('div', { class: 'empty' }, 'Không tìm thấy bài học.');
  if (src.topic && isTopicLocked(topicId)) { setTimeout(lockedModal); location.hash = '#/'; return h('div'); }

  const perWord = SKILLS[skill].perWord || 2;
  const words = skill === 'review' || topicId.startsWith('due') || topicId === 'hard'
    ? shuffle(src.words).slice(0, Math.ceil(n / perWord))
    : pickWords(src.words, Math.ceil(n / perWord));
  if (!words.length) { location.hash = '#/review'; return h('div'); }

  const queue = buildQueue(skill, words, n);
  const total = queue.filter(q => COUNTED(q.type)).length;
  const mistakes = new Map(words.map(w => [w.id, 0]));
  let correct = 0;
  let firstTry = 0;
  let pos = 0;
  const startedAt = Date.now();
  let finished = false;

  document.body.classList.add('in-session');
  const bar = h('span', { style: { width: '0%' } });
  const countEl = h('span', { class: 'count' }, `0/${total}`);
  const body = h('div', { class: 'q-body' });
  const fb = h('div');
  const root = h('div', { class: 'session', 'data-sk': skill },
    h('div', { class: 'session-top' },
      h('button', { class: 'icon-btn', 'aria-label': 'Thoát bài học', onclick: quit }, icon('x')),
      h('div', { class: 'progress', style: { '--bar': 'var(--sk-c)' } }, bar),
      countEl),
    body, fb);

  let keyHandler = null;
  const onKey = e => keyHandler && keyHandler(e);
  document.addEventListener('keydown', onKey);

  function updateProgress() {
    bar.style.width = `${Math.round((correct / total) * 100)}%`;
    countEl.textContent = `${correct}/${total}`;
  }

  async function quit() {
    if (finished) { location.hash = src.back || '#/'; return; }
    const ok = await confirmBox('Thoát bài học?', 'Kết quả của bài học dở dang sẽ không được tính vào lịch ôn tập.', 'Thoát', 'Học tiếp');
    if (!ok) return;
    if (correct > 0) { addActivity(correct); save(); }
    finished = true;
    location.hash = src.back || (skill === 'vocab' ? `#/topic/${topicId}` : `#/learn/${skill}?lv=${src.level}`);
  }

  function next() {
    stopSpeaking();
    fb.replaceChildren();
    if (pos >= queue.length) return finish();
    const q = queue[pos];
    keyHandler = null;
    body.replaceChildren(renderQuestion(q));
  }

  /** Gọi khi người học trả lời xong một câu */
  function answer(q, ok, { correctText, note, skip } = {}) {
    if (COUNTED(q.type)) {
      if (ok || skip) {
        correct++;
        if (ok && !q.retry) firstTry++;
      } else {
        mistakes.set(q.w.id, (mistakes.get(q.w.id) || 0) + 1);
        queue.push({ ...q, retry: true }); // làm lại ở cuối
      }
      if (skip) mistakes.set(q.w.id, (mistakes.get(q.w.id) || 0) + 1);
      updateProgress();
    }
    pos++;
    showFeedback(q, ok, correctText, note, skip);
  }

  function showFeedback(q, ok, correctText, note, skip) {
    const w = q.w;
    const cont = h('button', { class: 'btn primary block lg', onclick: next }, 'Tiếp tục');
    fb.replaceChildren(h('div', { class: 'feedback ' + (ok ? 'ok' : 'bad') },
      h('div', { class: 'fb-title' }, icon(ok ? 'check' : 'x'),
        ok ? (note || ['Chính xác!', 'Tuyệt vời!', 'Giỏi lắm!', 'Đúng rồi!'][Math.floor(Math.random() * 4)])
          : skip ? 'Đã bỏ qua' : 'Chưa đúng'),
      h('div', { class: 'fb-detail' },
        !ok && correctText && h('div', null, 'Đáp án: ', h('b', null, correctText)),
        h('div', { class: 'row', style: { marginTop: '4px' } },
          h('button', { class: 'icon-btn', 'aria-label': 'Nghe lại', onclick: () => speak(w.w) }, icon('volume')),
          h('div', null, h('b', null, w.w), ' ', h('span', { class: 'muted' }, w.ipa || ''), h('div', null, w.vi))),
        !ok && !skip && h('div', { class: 'muted small', style: { marginTop: '6px' } }, 'Câu này sẽ quay lại ở cuối bài.')),
      cont));
    cont.focus({ preventScroll: true });
    fb.scrollIntoView({ behavior: 'smooth', block: 'end' });
    keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); next(); } };
  }

  function finish() {
    finished = true;
    keyHandler = null;
    for (const w of words) recordWord(w.id, mistakes.get(w.id) === 0, mistakes.get(w.id));
    if (src.topic) markTopicDone(skill, topicId);
    addActivity(total);
    save();
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const acc = Math.round((firstTry / total) * 100);
    const hard = words.filter(w => mistakes.get(w.id) > 0);
    fb.replaceChildren();
    root.querySelector('.session-top').replaceChildren(h('div', { class: 'progress', style: { flex: 1, '--bar': 'var(--sk-c)' } }, h('span', { style: { width: '100%' } })));
    body.replaceChildren(h('div', { class: 'result' },
      h('div', { class: 'big' }, acc >= 90 ? '🏆' : acc >= 70 ? '🎉' : '💪'),
      h('h1', null, acc >= 90 ? 'Xuất sắc!' : acc >= 70 ? 'Làm tốt lắm!' : 'Hoàn thành bài học!'),
      h('p', { class: 'muted' }, 'Mọi câu sai đều đã được làm lại cho đến khi đúng.'),
      h('div', { class: 'result-stats' },
        h('div', { class: 'stat' }, h('b', null, `${acc}%`), h('span', null, 'đúng ngay lần đầu')),
        h('div', { class: 'stat' }, h('b', null, words.length), h('span', null, 'từ đã luyện')),
        h('div', { class: 'stat' }, h('b', null, `${mins}′`), h('span', null, 'thời gian'))),
      hard.length > 0 && h('div', { class: 'card word-review' },
        h('h3', null, 'Từ cần chú ý'),
        h('ul', { style: { listStyle: 'none', padding: 0, margin: 0 } }, hard.map(w => h('li', null,
          h('span', null, h('b', null, w.w), ' – ', w.vi), h('button', { class: 'icon-btn', onclick: () => speak(w.w), 'aria-label': `Nghe ${w.w}` }, icon('volume')))))),
      h('div', { class: 'stack', style: { marginTop: '16px' } },
        h('a', { class: 'btn primary block lg', href: `#/setup/${skill}/${topicId}` }, 'Học tiếp chủ đề này'),
        h('a', { class: 'btn block', href: src.back || (skill === 'vocab' ? `#/learn/vocab?lv=${src.level}` : `#/learn/${skill}?lv=${src.level}`) }, 'Chọn chủ đề khác'),
        h('a', { class: 'btn ghost block', href: '#/' }, 'Về trang chủ'))));
  }

  /* ---------- Hiển thị từng dạng câu hỏi ---------- */
  function renderQuestion(q) {
    const r = RENDER[q.type] || RENDER['mcq-en-vi'];
    return r(q);
  }

  const audioBtn = (text, opts = {}) => h('button', { class: 'icon-btn' + (opts.big ? ' lg primary' : ''), 'aria-label': 'Nghe', onclick: () => speak(text) }, icon('volume'));
  const slowBtn = text => h('button', { class: 'icon-btn', 'aria-label': 'Nghe chậm', title: 'Nghe chậm', onclick: () => speak(text, { rate: 0.6 }) }, icon('turtle'));
  const autoplay = text => { if (state.settings.autoplay && canSpeak()) setTimeout(() => speak(text), 250); };

  function options(q, items, getText, isRight, correctText, { sentence = false } = {}) {
    const box = h('div', { class: 'options' });
    let done = false;
    const buttons = items.map((it, i) => h('button', {
      class: 'opt', style: sentence ? { fontWeight: 500 } : null,
      onclick: () => {
        if (done) return;
        done = true;
        const ok = isRight(it);
        buttons.forEach((b, j) => { b.disabled = true; if (isRight(items[j])) b.classList.add('correct'); });
        if (!ok) buttons[i].classList.add('wrong');
        answer(q, ok, { correctText });
      },
    }, h('span', { class: 'key' }, i + 1), getText(it)));
    box.append(...buttons);
    keyHandler = e => { const k = Number(e.key); if (k >= 1 && k <= buttons.length) buttons[k - 1].click(); };
    return box;
  }

  function typeBox(q, target, { placeholder = 'Gõ câu trả lời…', hint = true, sentence = false, check } = {}) {
    const input = h('input', {
      class: 'input answer-input', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': 'Câu trả lời',
      placeholder,
    });
    let revealed = 1;
    const hintEl = h('div', { class: 'hint' });
    const showHint = () => {
      const letters = target.split('').map((c, i) => (i < revealed || c === ' ' || c === '-' || c === "'" ? c : '_')).join(' ');
      hintEl.textContent = `Gợi ý: ${letters}`;
    };
    if (hint && !sentence) showHint();
    let done = false;
    const submit = e => {
      e?.preventDefault();
      if (done) return;
      const res = check ? check(input.value) : checkTyped(input.value, target);
      if (res.empty) { input.focus(); return; }
      done = true;
      input.disabled = true;
      input.classList.add(res.ok ? 'correct' : 'wrong');
      answer(q, res.ok, { correctText: target, note: res.near ? `Gần đúng! Viết chuẩn: ${target}` : res.note });
    };
    const form = h('form', { onsubmit: submit, style: { marginTop: '18px' } },
      input, hintEl,
      h('div', { class: 'row', style: { marginTop: '12px' } },
        hint && !sentence && h('button', { type: 'button', class: 'btn', onclick: () => { revealed = Math.min(target.length, revealed + 1); showHint(); input.focus(); } }, icon('lightbulb'), 'Gợi ý'),
        h('button', { type: 'submit', class: 'btn primary', style: { flex: 1 } }, 'Kiểm tra')));
    setTimeout(() => input.focus({ preventScroll: true }), 50);
    return form;
  }

  const wordHeader = (w, { showVi = false, showWord = true } = {}) => h('div', null,
    w.img && h('div', { style: { fontSize: '2.6rem' } }, w.img),
    showWord && h('div', { class: 'row' }, h('div', { class: 'prompt' }, w.w), audioBtn(w.w)),
    showWord && h('div', { class: 'ipa' }, w.ipa || '', ' · ', POS_VI[w.pos] || w.pos),
    showVi && h('div', { class: 'prompt vi' }, w.vi));

  const RENDER = {
    card(q) {
      const w = q.w;
      autoplay(w.w);
      const fc = h('div', { class: 'flashcard', role: 'button', tabindex: 0, 'aria-label': 'Lật thẻ', onclick: () => fc.classList.toggle('flipped') },
        h('div', { class: 'flashcard-inner' },
          h('div', { class: 'fc-face' },
            h('div', { class: 'fc-emoji' }, w.img || '📘'),
            h('div', { class: 'fc-word' }, w.w),
            h('div', { class: 'ipa' }, w.ipa || '', ' · ', POS_VI[w.pos] || w.pos),
            h('div', { class: 'tap-hint' }, 'Chạm để xem nghĩa')),
          h('div', { class: 'fc-face fc-back' },
            h('div', { class: 'fc-mean' }, w.vi),
            h('div', { class: 'muted small' }, w.w, ' · ', POS_VI[w.pos] || w.pos),
            h('div', { class: 'fc-ex' }, '“', w.ex, '”'),
            h('div', { class: 'fc-ex-vi' }, w.exVi))));
      const cont = h('button', { class: 'btn primary block lg', onclick: () => { pos++; next(); } }, 'Đã hiểu, tiếp tục');
      keyHandler = e => {
        if (e.key === ' ') { e.preventDefault(); fc.classList.toggle('flipped'); }
        if (e.key === 'Enter') { e.preventDefault(); cont.click(); }
      };
      return h('div', null,
        h('div', { class: 'q-label' }, icon('cards'), 'Từ mới'),
        fc,
        h('div', { class: 'row', style: { justifyContent: 'center', margin: '14px 0' } },
          audioBtn(w.w), slowBtn(w.w),
          h('button', { class: 'btn sm', onclick: () => speak(w.ex) }, icon('volume'), 'Nghe câu ví dụ')),
        cont);
    },

    'mcq-en-vi'(q) {
      const w = q.w;
      autoplay(w.w);
      const items = shuffle([w, ...distractors(w, 3, 'vi')]);
      return h('div', null, h('div', { class: 'q-label' }, icon('cards'), 'Chọn nghĩa đúng'),
        wordHeader(w), options(q, items, x => x.vi, x => x.id === w.id, w.vi));
    },

    'mcq-vi-en'(q) {
      const w = q.w;
      const items = shuffle([w, ...distractors(w, 3, 'w')]);
      return h('div', null, h('div', { class: 'q-label' }, icon('cards'), 'Chọn từ tiếng Anh đúng'),
        wordHeader(w, { showVi: true, showWord: false }), h('div', { class: 'muted' }, POS_VI[w.pos] || w.pos),
        options(q, items, x => x.w, x => x.id === w.id, w.w));
    },

    'type-en'(q) {
      const w = q.w;
      return h('div', null, h('div', { class: 'q-label' }, icon('pen'), 'Gõ từ tiếng Anh'),
        wordHeader(w, { showVi: true, showWord: false }), h('div', { class: 'muted' }, POS_VI[w.pos] || w.pos),
        typeBox(q, w.w));
    },

    'listen-pick'(q) {
      const w = q.w;
      autoplay(w.w);
      const items = shuffle([w, ...distractors(w, 3, 'w')]);
      return h('div', null, h('div', { class: 'q-label' }, icon('headphones'), 'Nghe và chọn từ bạn nghe được'),
        h('div', { class: 'big-audio' }, audioBtn(w.w, { big: true }), slowBtn(w.w)),
        options(q, items, x => x.w, x => x.id === w.id, w.w));
    },

    'dictation-word'(q) {
      const w = q.w;
      autoplay(w.w);
      return h('div', null, h('div', { class: 'q-label' }, icon('headphones'), 'Nghe và viết lại từ'),
        h('div', { class: 'big-audio' }, audioBtn(w.w, { big: true }), slowBtn(w.w)),
        typeBox(q, w.w, { placeholder: 'Gõ từ bạn nghe được…' }));
    },

    'listen-sentence'(q) {
      const w = q.w;
      autoplay(w.ex);
      const pool = [...wordsOf(w.t), ...DB.words.filter(x => x.lv === w.lv)].filter(x => x.id !== w.id && x.ex !== w.ex);
      const len = tokens(w.ex).length;
      const near = shuffle(pool).sort((a, b) => Math.abs(tokens(a.ex).length - len) - Math.abs(tokens(b.ex).length - len));
      const others = [];
      for (const x of near) { if (!others.some(o => o.ex === x.ex)) others.push(x); if (others.length === 3) break; }
      const items = shuffle([w, ...others]);
      return h('div', null, h('div', { class: 'q-label' }, icon('headphones'), 'Nghe và chọn câu đúng'),
        h('div', { class: 'big-audio' }, audioBtn(w.ex, { big: true }), slowBtn(w.ex)),
        options(q, items, x => x.ex, x => x.id === w.id, w.ex, { sentence: true }));
    },

    'dictation-sentence'(q) {
      const w = q.w;
      autoplay(w.ex);
      const tip = h('div', { class: 'hint', hidden: true }, w.exVi);
      return h('div', null, h('div', { class: 'q-label' }, icon('headphones'), 'Nghe và chép lại cả câu'),
        h('div', { class: 'big-audio' }, audioBtn(w.ex, { big: true }), slowBtn(w.ex)),
        h('div', { class: 'center' }, h('button', { class: 'btn sm ghost', onclick: () => { tip.hidden = false; } }, icon('eye'), 'Xem nghĩa tiếng Việt'), tip),
        typeBox(q, w.ex, {
          placeholder: 'Gõ câu bạn nghe được…', sentence: true, hint: false,
          check: v => {
            if (!norm(v)) return { empty: true };
            const r = compareWords(v, w.ex);
            return r.ratio === 1 && r.extra === 0 ? { ok: true } : r.ratio >= 0.85 && r.extra <= 1 ? { ok: true, note: 'Gần đúng! Xem lại câu chuẩn bên dưới.' } : { ok: false };
          },
        }));
    },

    'fill-blank'(q) {
      const w = q.w;
      const re = new RegExp(`(?<![A-Za-z'])${escapeRe(w.k)}(?![A-Za-z])`, 'i');
      const [before, after] = w.ex.split(re);
      return h('div', null, h('div', { class: 'q-label' }, icon('pen'), 'Điền từ còn thiếu'),
        h('p', { class: 'sentence-prompt' }, before, h('span', { style: { borderBottom: '3px solid var(--sk-c)', padding: '0 24px' } }, ' '), after),
        h('p', { class: 'muted' }, w.exVi),
        h('div', { class: 'muted small' }, `Nghĩa của từ cần điền: ${w.vi}`),
        typeBox(q, w.k, { placeholder: 'Từ còn thiếu…' }));
    },

    order(q) {
      const w = q.w;
      const words = tokens(w.ex);
      let order = shuffle(words.map((t, i) => i));
      for (let k = 0; k < 5 && order.every((v, i) => v === i) && words.length > 1; k++) order = shuffle(order);
      const picked = [];
      const area = h('div', { class: 'chips-area', 'aria-label': 'Câu của bạn' });
      const bank = h('div', { class: 'chips-bank' });
      const check = h('button', { class: 'btn primary block lg', disabled: true, style: { marginTop: '18px' } }, 'Kiểm tra');
      let done = false;
      const chips = order.map(i => h('button', { class: 'wchip', onclick: () => { if (done) return; picked.push(i); render(); } }, words[i]));
      function render() {
        chips.forEach((c, j) => c.classList.toggle('used', picked.includes(order[j])));
        area.replaceChildren(...picked.map((i, k) => h('button', { class: 'wchip', onclick: () => { if (done) return; picked.splice(k, 1); render(); } }, words[i])));
        check.disabled = picked.length !== words.length;
      }
      bank.append(...chips);
      check.addEventListener('click', () => {
        if (done) return;
        done = true;
        const ok = picked.map(i => words[i]).join(' ') === w.ex.trim().split(/\s+/).join(' ');
        area.style.borderColor = ok ? 'var(--success)' : 'var(--danger)';
        answer(q, ok, { correctText: w.ex });
      });
      keyHandler = e => { if (e.key === 'Backspace' && picked.length && !done) { picked.pop(); render(); } if (e.key === 'Enter' && !check.disabled) check.click(); };
      return h('div', null, h('div', { class: 'q-label' }, icon('pen'), 'Sắp xếp thành câu đúng'),
        h('p', { class: 'muted' }, w.exVi), area, bank, check);
    },

    'speak-word'(q) { return speakQuestion(q, q.w.w, 'Đọc to từ này'); },
    'speak-sentence'(q) { return speakQuestion(q, q.w.ex, 'Đọc to câu này', true); },
  };

  function speakQuestion(q, target, title, sentence = false) {
    const w = q.w;
    let attempts = 0;
    const stateEl = h('div', { class: 'mic-state' }, canRecognize() ? 'Nhấn micro rồi đọc to' : '');
    const heard = h('div');
    const actions = h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '12px' } });
    const mic = h('button', { class: 'icon-btn lg primary', 'aria-label': 'Bắt đầu nói' }, icon('mic'));

    if (canRecognize()) {
      mic.addEventListener('click', async () => {
        if (mic.classList.contains('recording')) { listen.stop?.(); return; }
        heard.replaceChildren(); actions.replaceChildren();
        try {
          mic.classList.add('recording');
          const alts = await listen({ onState: s => { stateEl.textContent = s === 'listening' ? 'Đang nghe… hãy đọc to' : ''; } });
          mic.classList.remove('recording');
          if (!alts.length) { stateEl.textContent = 'Không nghe thấy gì. Hãy nói to, rõ hơn rồi thử lại.'; return; }
          attempts++;
          const sc = speechScore(alts, target);
          const pass = sentence ? sc.ratio >= 0.7 : sc.ratio === 1;
          heard.replaceChildren(h('div', { class: 'heard' },
            h('div', { class: 'small muted' }, 'Máy nghe được: “', sc.heard, '”'),
            h('div', { style: { marginTop: '6px', fontSize: '1.1rem' } }, sc.words.map((t, i) => [h('span', { class: sc.marks[i] ? 'w-ok' : 'w-miss' }, t), ' '])),
            h('div', { class: 'small', style: { marginTop: '4px' } }, `Khớp ${Math.round(sc.ratio * 100)}%`)));
          if (pass) { stateEl.textContent = ''; answer(q, true, { note: sc.ratio === 1 ? 'Phát âm rất tốt!' : 'Khá tốt! Chú ý các từ gạch chân.' }); return; }
          stateEl.textContent = attempts >= 3 ? 'Chưa khớp. Hãy nghe mẫu thêm vài lần.' : 'Chưa khớp lắm, nghe mẫu rồi thử lại nhé.';
          if (attempts >= 3) answer(q, false, { correctText: target });
          else actions.replaceChildren(h('button', { class: 'btn ghost', onclick: () => answer(q, false, { skip: true }) }, 'Bỏ qua câu này'));
        } catch (err) {
          mic.classList.remove('recording');
          const msg = String(err.message);
          stateEl.textContent = msg === 'not-allowed' || msg === 'service-not-allowed'
            ? 'Trình duyệt chưa được phép dùng micro. Hãy cho phép micro trong cài đặt trang rồi thử lại.'
            : msg === 'network' ? 'Nhận diện giọng nói cần kết nối mạng.' : 'Không nhận được giọng nói, hãy thử lại.';
          actions.replaceChildren(h('button', { class: 'btn ghost', onclick: () => answer(q, false, { skip: true }) }, 'Bỏ qua câu này'));
        }
      });
    } else {
      // Không có nhận diện giọng nói: ghi âm để tự nghe lại và tự đánh giá
      selfCheck();
    }

    function selfCheck() {
      const canRecord = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
      let rec = null, chunks = [];
      const player = h('audio', { controls: true, hidden: true, style: { width: '100%', marginTop: '10px' } });
      mic.addEventListener('click', async () => {
        if (!canRecord) return;
        if (rec && rec.state === 'recording') { rec.stop(); return; }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          rec = new MediaRecorder(stream); chunks = [];
          rec.ondataavailable = e => chunks.push(e.data);
          rec.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            mic.classList.remove('recording');
            player.src = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }));
            player.hidden = false;
            stateEl.textContent = 'Nghe lại giọng của bạn và so với mẫu.';
          };
          rec.start(); mic.classList.add('recording'); stateEl.textContent = 'Đang ghi âm… nhấn lần nữa để dừng';
        } catch (e) { stateEl.textContent = 'Không dùng được micro. Bạn có thể đọc to theo mẫu rồi tự đánh giá.'; }
      });
      if (!canRecord) mic.hidden = true;
      stateEl.textContent = canRecord ? 'Nhấn micro để ghi âm giọng đọc của bạn' : 'Nghe mẫu, đọc to theo rồi tự đánh giá';
      heard.append(player);
      actions.replaceChildren(
        h('button', { class: 'btn', onclick: () => answer(q, false, { correctText: target }) }, 'Cần luyện thêm'),
        h('button', { class: 'btn primary', onclick: () => answer(q, true, { note: 'Tốt lắm!' }) }, 'Mình đọc tốt rồi'));
    }

    autoplay(target);
    return h('div', null, h('div', { class: 'q-label' }, icon('mic'), title),
      sentence
        ? h('div', null, h('p', { class: 'sentence-prompt' }, target), h('p', { class: 'muted' }, w.exVi))
        : h('div', null, w.img && h('div', { style: { fontSize: '2.6rem' } }, w.img), h('div', { class: 'prompt' }, target), h('div', { class: 'ipa' }, w.ipa || '', ' · ', w.vi)),
      h('div', { class: 'big-audio' }, audioBtn(target), slowBtn(target), mic),
      stateEl, heard, actions);
  }

  updateProgress();
  next();
  return {
    el: root,
    cleanup: () => { document.removeEventListener('keydown', onKey); stopSpeaking(); listen.stop?.(); },
  };
}
