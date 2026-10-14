// Trang quản trị: thống kê người học, thêm/sửa/xóa từ vựng, xuất dữ liệu
import { h, toast, confirmBox, modal, POS_VI, LEVELS, dayKey } from '../ui.js';
import { icon } from '../icons.js';
import { DB, topicsOf, reindex } from '../data.js';
import { hasBackend } from '../config.js';
import { auth, isAdmin, adminStats, adminSaveWord, adminDeleteWord } from '../sync.js';
import { speak } from '../speech.js';

const PAGE = 30;

export function adminView() {
  if (hasBackend() && !isAdmin()) {
    return h('div', { class: 'empty' }, h('div', { class: 'em' }, '🔒'),
      h('h2', null, 'Chỉ dành cho quản trị viên'),
      h('p', null, auth.user ? `Tài khoản ${auth.user.email} chưa có quyền quản trị.` : 'Hãy đăng nhập bằng tài khoản quản trị.'),
      h('a', { class: 'btn primary', href: '#/account' }, 'Đến trang tài khoản'));
  }

  const statsBox = h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Đang tải thống kê…'));
  if (hasBackend()) {
    adminStats().then(s => {
      const item = (v, l) => h('div', { class: 'stat' }, h('b', null, v ?? '–'), h('span', null, l));
      statsBox.replaceChildren(h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' } },
        item(s.users, 'người dùng'),
        item(s.active_today, 'học hôm nay'),
        item(s.active_7d, 'học trong 7 ngày'),
        item(s.active_30d, 'học trong 30 ngày'),
        item(s.new_7d, 'đăng ký mới (7 ngày)'),
        item(s.words_learned, 'lượt từ đã học')));
    }).catch(err => statsBox.replaceChildren(h('div', { class: 'notice' }, icon('alert'),
      h('div', null, 'Không tải được thống kê: ', err.message, '. Hãy kiểm tra đã chạy tệp supabase/schema.sql và thêm email của bạn vào bảng admins.'))));
  } else {
    statsBox.replaceChildren(h('div', { class: 'notice info' }, icon('info'),
      h('div', null, 'Web đang ở chế độ chỉ trên máy nên chưa có thống kê người học. Chỉnh sửa từ vựng bên dưới chỉ lưu trong trình duyệt này – hãy bấm "Xuất words.json" rồi thay tệp data/words.json để áp dụng cho mọi người.')));
  }

  // ----- Biên tập từ vựng -----
  let query = '', level = '', topic = '', page = 0;
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Tìm từ hoặc nghĩa…', oninput: e => { query = e.target.value.trim().toLowerCase(); page = 0; renderTable(); } });
  const lvSel = h('select', { class: 'input', onchange: e => { level = e.target.value; topic = ''; page = 0; fillTopics(); renderTable(); } },
    h('option', { value: '' }, 'Tất cả cấp độ'), LEVELS.map(l => h('option', { value: l.id }, l.id)));
  const tpSel = h('select', { class: 'input', onchange: e => { topic = e.target.value; page = 0; renderTable(); } });
  function fillTopics() {
    tpSel.replaceChildren(h('option', { value: '' }, 'Tất cả chủ đề'),
      ...(level ? topicsOf(level) : DB.topics).map(t => h('option', { value: t.id }, `${t.level} · ${t.name}`)));
  }
  fillTopics();

  const tbody = h('tbody');
  const pager = h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '10px' } });
  const countEl = h('span', { class: 'muted small' });

  function filtered() {
    return DB.words.filter(w => (!level || w.lv === level) && (!topic || w.t === topic) &&
      (!query || w.w.toLowerCase().includes(query) || w.vi.toLowerCase().includes(query)));
  }

  function renderTable() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    page = Math.min(page, pages - 1);
    countEl.textContent = `${list.length} từ`;
    tbody.replaceChildren(...list.slice(page * PAGE, page * PAGE + PAGE).map(w => h('tr', null,
      h('td', null, w.img || ''),
      h('td', null, h('b', null, w.w), h('div', { class: 'muted small' }, w.ipa || '', ' ', POS_VI[w.pos] || w.pos)),
      h('td', null, w.vi, h('div', { class: 'muted small' }, w.ex)),
      h('td', null, w.lv, h('div', { class: 'muted small' }, DB.topicById.get(w.t)?.name || w.t)),
      h('td', { style: { whiteSpace: 'nowrap' } },
        h('button', { class: 'icon-btn', 'aria-label': 'Nghe', onclick: () => speak(w.w) }, icon('volume')), ' ',
        h('button', { class: 'icon-btn', 'aria-label': 'Sửa', onclick: () => editWord(w) }, icon('edit'))))));
    pager.replaceChildren(
      h('button', { class: 'btn sm', disabled: page === 0, onclick: () => { page--; renderTable(); } }, 'Trước'),
      h('span', { class: 'small muted' }, `Trang ${page + 1}/${pages}`),
      h('button', { class: 'btn sm', disabled: page >= pages - 1, onclick: () => { page++; renderTable(); } }, 'Sau'));
  }

  function editWord(w) {
    const isNew = !w;
    const data = w ? { ...w } : { w: '', pos: 'n', vi: '', ex: '', exVi: '', ipa: '', img: '', lv: level || 'A1', t: topic || topicsOf(level || 'A1')[0].id };
    const f = {};
    const field = (key, label, el) => { f[key] = el; el.value = data[key] ?? ''; return h('label', { class: 'field' }, h('span', null, label), el); };
    const topicSel = h('select', { class: 'input' }, DB.topics.map(t => h('option', { value: t.id }, `${t.level} · ${t.name}`)));
    const close = modal(h('form', { onsubmit: async e => {
      e.preventDefault();
      const out = {};
      for (const k of Object.keys(f)) out[k] = f[k].value.trim();
      if (!out.w || !out.vi || !out.ex) { toast('Cần nhập từ, nghĩa và câu ví dụ'); return; }
      out.lv = DB.topicById.get(out.t).level;
      if (!out.img) delete out.img;
      if (!out.ipa) delete out.ipa;
      const re = new RegExp(`(?<![A-Za-z'])${out.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*`, 'i');
      const m = out.ex.match(re);
      if (m) out.k = m[0]; else delete out.k;
      const id = isNew ? Math.max(...DB.words.map(x => x.id)) + 1 : w.id;
      try {
        await adminSaveWord(id, out);
        const existing = DB.byId.get(id);
        if (existing) { for (const k of ['img', 'ipa', 'k']) delete existing[k]; Object.assign(existing, out); } else DB.words.push({ id, ...out });
        reindex();
        toast(isNew ? 'Đã thêm từ mới' : 'Đã lưu thay đổi');
        close(); renderTable();
      } catch (err) { toast('Lỗi: ' + err.message); }
    } },
      h('h2', null, isNew ? 'Thêm từ mới' : `Sửa "${w.w}"`),
      field('w', 'Từ tiếng Anh', h('input', { class: 'input', required: true })),
      h('div', { class: 'row' },
        h('div', { style: { flex: 1 } }, field('pos', 'Loại từ', h('select', { class: 'input' }, Object.entries(POS_VI).map(([k, v]) => h('option', { value: k }, v))))),
        h('div', { style: { flex: 1 } }, field('ipa', 'Phiên âm', h('input', { class: 'input', placeholder: '/ˈeksəmpəl/' })))),
      field('vi', 'Nghĩa tiếng Việt', h('input', { class: 'input', required: true })),
      field('ex', 'Câu ví dụ (chứa từ cần học)', h('input', { class: 'input', required: true })),
      field('exVi', 'Dịch câu ví dụ', h('input', { class: 'input' })),
      h('div', { class: 'row' },
        h('div', { style: { width: '110px' } }, field('img', 'Emoji', h('input', { class: 'input', maxLength: 8 }))),
        h('div', { style: { flex: 1 } }, field('t', 'Chủ đề', topicSel))),
      h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '8px' } },
        !isNew ? h('button', { type: 'button', class: 'btn ghost danger', onclick: async () => {
          if (!await confirmBox(`Xóa "${w.w}"?`, 'Từ này sẽ bị ẩn khỏi bài học của mọi người.', 'Xóa')) return;
          try {
            await adminDeleteWord(w.id);
            DB.words = DB.words.filter(x => x.id !== w.id); reindex();
            toast('Đã xóa'); close(); renderTable();
          } catch (err) { toast('Lỗi: ' + err.message); }
        } }, icon('trash'), 'Xóa') : h('span'),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn ghost', onclick: () => close() }, 'Hủy'),
          h('button', { type: 'submit', class: 'btn primary' }, 'Lưu')))));
  }

  function exportWords() {
    const json = JSON.stringify({ version: 1, topics: DB.topics, words: DB.words.slice().sort((a, b) => a.id - b.id) });
    const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'words.json' });
    document.body.append(a); a.click(); a.remove();
  }

  function exportCSV() {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['id', 'word', 'pos', 'ipa', 'meaning', 'example', 'example_vi', 'level', 'topic', 'emoji']]
      .concat(DB.words.map(w => [w.id, w.w, w.pos, w.ipa, w.vi, w.ex, w.exVi, w.lv, DB.topicById.get(w.t)?.name, w.img]));
    const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `tu-vung-${dayKey()}.csv` });
    document.body.append(a); a.click(); a.remove();
  }

  renderTable();

  return h('div', null,
    h('div', { class: 'row', style: { marginBottom: '8px' } }, h('div', { class: 'skill-ico', 'data-sk': 'review' }, icon('shield')),
      h('div', null, h('h1', { style: { margin: 0 } }, 'Quản trị'), h('p', { class: 'muted', style: { margin: 0 } }, auth.user?.email || 'Chế độ chỉ trên máy'))),
    h('div', { class: 'section-title' }, h('h2', null, 'Thống kê người học')),
    statsBox,
    h('div', { class: 'section-title' }, h('h2', null, 'Kho từ vựng'), countEl),
    h('div', { class: 'card' },
      h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' } }, search, lvSel, tpSel),
      h('div', { class: 'row wrap', style: { margin: '12px 0' } },
        h('button', { class: 'btn primary', onclick: () => editWord(null) }, icon('plus'), 'Thêm từ'),
        h('button', { class: 'btn', onclick: exportWords }, icon('download'), 'Xuất words.json'),
        h('button', { class: 'btn', onclick: exportCSV }, icon('download'), 'Xuất Excel (CSV)')),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Từ'), h('th', null, 'Nghĩa / ví dụ'), h('th', null, 'Cấp / chủ đề'), h('th', null, ''))),
        tbody)),
      pager));
}
