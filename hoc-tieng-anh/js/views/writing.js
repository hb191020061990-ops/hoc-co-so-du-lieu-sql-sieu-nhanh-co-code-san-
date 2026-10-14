// Viết đoạn văn theo đề: soạn bài, đếm từ, tự kiểm tra, xem bài mẫu
import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { DB } from '../data.js';
import { state, saveWriting, addActivity, save } from '../store.js';
import { isItemLocked, lockedModal } from '../skills.js';
import { speak } from '../speech.js';
import { backLink } from './learn.js';

const countWords = s => (s.trim().match(/[A-Za-z0-9'’-]+/g) || []).length;

const CHECKLIST = {
  A1: ['Viết hoa chữ cái đầu câu và tên riêng', 'Mỗi câu kết thúc bằng dấu chấm', 'Dùng đúng am / is / are', 'Có ít nhất 5 câu'],
  A2: ['Dùng đúng thì (hiện tại / quá khứ / tương lai)', 'Có từ nối: and, but, because, then', 'Trả lời đủ các ý của đề', 'Kiểm tra chính tả'],
  B1: ['Có mở bài, thân bài, kết bài', 'Mỗi đoạn có một ý chính', 'Dùng từ nối: however, in addition, therefore', 'Đa dạng cấu trúc câu', 'Đủ số từ yêu cầu'],
  B2: ['Quan điểm rõ ràng, nhất quán', 'Lập luận có ví dụ minh họa', 'Dùng từ vựng học thuật và từ nối nâng cao', 'Văn phong phù hợp (trang trọng / thân mật)', 'Soát lỗi ngữ pháp và chính tả'],
};

export function writingPromptView(id) {
  const p = DB.writing.find(x => x.id === id);
  if (!p) return h('div', { class: 'empty' }, 'Không tìm thấy đề viết.');
  if (isItemLocked(DB.writing, p)) { setTimeout(lockedModal); location.hash = `#/learn/write?lv=${p.level}`; return h('div'); }

  const saved = state.writing[p.id];
  const area = h('textarea', { class: 'input', lang: 'en', spellcheck: true, placeholder: 'Viết bài của bạn bằng tiếng Anh tại đây…', 'aria-label': 'Bài viết' });
  area.value = saved?.text || '';
  const counter = h('div', { class: 'word-count' });
  const update = () => {
    const n = countWords(area.value);
    counter.textContent = `${n} / ${p.minWords} từ`;
    counter.style.color = n >= p.minWords ? 'var(--success)' : '';
  };
  let timer;
  area.addEventListener('input', () => {
    update();
    clearTimeout(timer);
    timer = setTimeout(() => { saveWriting(p.id, area.value); save(); }, 800);
  });
  update();

  const sampleBox = h('div', { hidden: true },
    h('div', { class: 'card', style: { marginTop: '12px' } },
      h('div', { class: 'row' }, h('h3', { style: { margin: 0 } }, 'Bài mẫu'), h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', onclick: () => speak(p.sample.replace(/\n/g, ' '), { rate: 0.85 }) }, icon('volume'), 'Nghe')),
      h('p', { class: 'sample', lang: 'en', style: { marginTop: '10px' } }, p.sample),
      h('details', null, h('summary', { class: 'muted' }, 'Xem bản dịch'), h('p', { class: 'sample muted', style: { marginTop: '8px' } }, p.sampleVi))));

  const checks = (CHECKLIST[p.level] || []).map(c => h('label', null, h('input', { type: 'checkbox' }), h('span', null, c)));

  function finish() {
    const n = countWords(area.value);
    if (n < Math.ceil(p.minWords * 0.6)) { toast(`Bài viết cần khoảng ${p.minWords} từ (hiện có ${n}).`); area.focus(); return; }
    const first = !state.writing[p.id]?.done;
    saveWriting(p.id, area.value, true);
    if (first) addActivity(10);
    save();
    sampleBox.hidden = false;
    sampleBox.scrollIntoView({ behavior: 'smooth' });
    toast('Đã lưu bài viết! So sánh với bài mẫu bên dưới.');
  }

  return h('div', { 'data-sk': 'write', 'data-lv': p.level },
    backLink(`#/learn/write?lv=${p.level}`, 'Bài viết'),
    h('span', { class: 'chip lv' }, p.level), saved?.done && h('span', { class: 'chip', style: { marginLeft: '6px', color: 'var(--success)' } }, '✅ Đã hoàn thành'),
    h('h1', { style: { marginTop: '8px' } }, p.title),
    h('div', { class: 'card' },
      h('p', { lang: 'en', style: { fontWeight: 600, fontSize: '1.05rem' } }, p.task),
      h('ul', { class: 'muted small', style: { margin: 0, paddingLeft: '20px' } }, p.tips.map(t => h('li', null, t)))),
    h('div', { class: 'card' }, area, counter,
      h('div', { class: 'row wrap', style: { marginTop: '12px' } },
        h('button', { class: 'btn primary', onclick: finish }, icon('check'), 'Hoàn thành'),
        h('button', { class: 'btn', onclick: () => { sampleBox.hidden = !sampleBox.hidden; } }, icon('eye'), 'Xem bài mẫu'),
        h('button', { class: 'btn ghost', onclick: () => { if (area.value.trim()) speak(area.value, { rate: 0.85 }); } }, icon('volume'), 'Nghe bài của tôi'))),
    h('div', { class: 'card checklist' }, h('h3', null, 'Tự kiểm tra trước khi nộp'), checks),
    sampleBox);
}
