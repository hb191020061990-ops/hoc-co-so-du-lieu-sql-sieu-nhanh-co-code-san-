// Tiến độ, chuỗi ngày học, cài đặt, sao lưu
import { h, LEVELS, dayKey, progressBar, toast, confirmBox } from '../ui.js';
import { icon } from '../icons.js';
import { DB, wordsOfLevel } from '../data.js';
import { state, streak, bestStreak, topicStats, setSetting, exportJSON, importJSON, resetProgress, isDue } from '../store.js';
import { speak } from '../speech.js';
import { route } from '../main.js';

const parseValue = v => (v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v));

export function statsView() {
  const s = streak();
  const days = Object.keys(state.days).length;
  const learned = Object.values(state.words).filter(w => w.b > 0).length;
  const mastered = Object.values(state.words).filter(w => w.b >= 5).length;
  const due = DB.words.filter(x => isDue(x.id)).length;

  // Lịch 12 tuần gần nhất
  const heat = h('div', { class: 'heat' });
  const start = new Date(); start.setDate(start.getDate() - 83 - start.getDay());
  for (let i = 0; i < 84 + new Date().getDay() + 1; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    if (d > new Date()) break;
    const n = state.days[dayKey(d)] || 0;
    heat.append(h('span', { class: n ? (n >= 50 ? 'l3' : n >= 20 ? 'l2' : 'l1') : '', title: `${d.toLocaleDateString('vi-VN')}: ${n} câu` }));
  }

  const select = (label, key, opts) => h('label', { class: 'field' }, h('span', null, label),
    h('select', { class: 'input', onchange: e => { setSetting(key, parseValue(e.target.value)); toast('Đã lưu cài đặt'); } },
      opts.map(([v, t]) => h('option', { value: v, selected: String(state.settings[key]) === String(v) }, t))));

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async e => {
    const f = e.target.files[0]; if (!f) return;
    try { importJSON(await f.text()); toast('Đã khôi phục tiến độ'); route(); } catch (err) { toast(err.message); }
  } });

  return h('div', null,
    h('h1', null, 'Tiến độ học tập'),
    h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' } },
      h('div', { class: 'stat' }, h('b', { style: { color: '#f26b1d' } }, '🔥 ', s), h('span', null, 'chuỗi hiện tại')),
      h('div', { class: 'stat' }, h('b', null, bestStreak()), h('span', null, 'chuỗi dài nhất')),
      h('div', { class: 'stat' }, h('b', null, days), h('span', null, 'ngày đã học')),
      h('div', { class: 'stat' }, h('b', null, learned), h('span', null, 'từ đã học')),
      h('div', { class: 'stat' }, h('b', null, mastered), h('span', null, 'từ đã thuộc')),
      h('div', { class: 'stat' }, h('b', null, due), h('span', null, 'từ cần ôn'))),

    h('div', { class: 'section-title' }, h('h2', null, '12 tuần gần đây')),
    h('div', { class: 'card' }, heat, h('p', { class: 'muted small', style: { marginTop: '8px', marginBottom: 0 } }, 'Mỗi ô là một ngày; màu càng đậm là càng làm nhiều câu.')),

    h('div', { class: 'section-title' }, h('h2', null, 'Theo cấp độ')),
    h('div', { class: 'card level-bars' }, LEVELS.map(l => {
      const st = topicStats(wordsOfLevel(l.id));
      return h('div', { 'data-lv': l.id },
        h('div', { class: 'row' }, h('span', { class: 'lbl' }, l.id), progressBar(st.learned, st.total), h('span', { class: 'small muted', style: { minWidth: '76px', textAlign: 'right' } }, `${st.learned}/${st.total}`)),
        h('div', { class: 'small muted', style: { marginLeft: '48px', marginTop: '-6px' } }, `${st.mastered} từ đã thuộc`));
    })),

    h('div', { class: 'section-title' }, h('h2', null, 'Đọc & Viết')),
    h('div', { class: 'card' },
      h('p', null, `Bài đọc đã làm: ${Object.keys(state.reading).length}/${DB.reading.length}`),
      h('p', { style: { margin: 0 } }, `Bài viết đã hoàn thành: ${Object.values(state.writing).filter(w => w.done).length}/${DB.writing.length}`)),

    h('div', { class: 'section-title', id: 'settings' }, h('h2', null, 'Cài đặt')),
    h('div', { class: 'card' },
      select('Giao diện', 'theme', [['auto', 'Theo thiết bị'], ['light', 'Sáng'], ['dark', 'Tối']]),
      select('Cỡ chữ', 'fontSize', [['normal', 'Bình thường'], ['large', 'Lớn'], ['xlarge', 'Rất lớn']]),
      select('Giọng đọc', 'accent', [['en-US', 'Anh – Mỹ'], ['en-GB', 'Anh – Anh']]),
      select('Tốc độ đọc', 'rate', [[0.7, 'Chậm'], [0.9, 'Vừa'], [1, 'Bình thường']]),
      select('Tự phát âm khi hiện từ', 'autoplay', [[true, 'Bật'], [false, 'Tắt']]),
      h('button', { class: 'btn', onclick: () => speak('Hello! Welcome to EngStep. Let us learn English together.') }, icon('volume'), 'Thử giọng đọc')),

    h('div', { class: 'section-title' }, h('h2', null, 'Sao lưu tiến độ')),
    h('div', { class: 'card' },
      h('p', { class: 'muted small' }, 'Tải tệp sao lưu về máy để chuyển tiến độ sang thiết bị khác hoặc phòng khi xóa dữ liệu trình duyệt.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' })), download: `engstep-tien-do-${dayKey()}.json` });
          document.body.append(a); a.click(); a.remove();
        } }, icon('download'), 'Tải bản sao lưu'),
        h('button', { class: 'btn', onclick: () => fileInput.click() }, icon('upload'), 'Khôi phục từ tệp'),
        fileInput,
        h('button', { class: 'btn ghost danger', onclick: async () => {
          if (await confirmBox('Xóa toàn bộ tiến độ?', 'Mọi từ đã học, chuỗi ngày và bài làm sẽ bị xóa trên thiết bị này. Không thể hoàn tác.', 'Xóa hết')) { resetProgress(); toast('Đã xóa tiến độ'); route(); }
        } }, icon('trash'), 'Xóa tiến độ'))),
  );
}
