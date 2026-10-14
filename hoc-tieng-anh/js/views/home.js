import { h, LEVELS, dayKey, progressBar } from '../ui.js';
import { icon } from '../icons.js';
import { DB, wordsOfLevel } from '../data.js';
import { state, streak, todayCount, topicStats, isDue } from '../store.js';
import { SKILLS } from '../skills.js';
import { CONFIG, hasBackend } from '../config.js';
import { auth } from '../sync.js';

export function homeView() {
  const s = streak();
  const name = auth.user?.user_metadata?.name || auth.user?.user_metadata?.full_name;
  const learned = Object.values(state.words).filter(w => w.b > 0).length;
  const due = DB.words.filter(x => isDue(x.id)).length;

  // 7 ngày gần nhất
  const week = [];
  const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    week.push(h('span', { class: (state.days[dayKey(d)] ? 'on ' : '') + (i === 0 ? 'today' : ''), title: dayKey(d) }, labels[d.getDay()]));
  }

  const nextLevel = LEVELS.find(l => { const st = topicStats(wordsOfLevel(l.id)); return st.learned < st.total; }) || LEVELS[3];
  const lvStats = topicStats(wordsOfLevel(nextLevel.id));

  return h('div', null,
    h('section', { class: 'hero' },
      h('div', null,
        h('h1', null, name ? `Chào ${name}! 👋` : 'Chào bạn! 👋'),
        h('p', { class: 'muted' }, todayCount()
          ? `Hôm nay bạn đã làm ${todayCount()} câu. Tiếp tục giữ chuỗi nhé!`
          : 'Học vài phút mỗi ngày để giữ chuỗi ngày học.'),
        h('div', { class: 'row wrap', style: { marginTop: '12px' } },
          h('a', { class: 'btn primary lg', href: `#/learn/vocab?lv=${nextLevel.id}` }, icon('cards'), 'Học từ mới'),
          due > 0 && h('a', { class: 'btn lg', href: '#/review' }, icon('repeat'), `Ôn ${due} từ`)),
      ),
      h('div', { class: 'card' },
        h('div', { class: 'streak-box' },
          h('div', { class: 'flame' + (s ? '' : ' off') }, icon('flame')),
          h('div', null, h('div', { class: 'streak-num' }, s), h('div', { class: 'muted small' }, 'ngày học liên tiếp'))),
        h('div', { class: 'week' }, week)),
    ),

    hasBackend() && !auth.user && h('div', { class: 'notice info', style: { marginTop: '12px' } }, icon('info'),
      h('div', null, `Bạn đang học thử (${CONFIG.guestFreeTopics} chủ đề đầu mỗi cấp). `,
        h('a', { href: '#/account' }, 'Đăng ký miễn phí'), ' để mở toàn bộ bài học và lưu tiến độ trên mọi thiết bị.')),

    h('div', { class: 'section-title' }, h('h2', null, 'Luyện kỹ năng')),
    h('div', { class: 'grid grid-2' },
      ['vocab', 'listen', 'speak', 'read', 'write', 'review'].map(k =>
        h('a', { class: 'skill-card', href: k === 'review' ? '#/review' : `#/learn/${k}`, 'data-sk': k },
          h('div', { class: 'skill-ico' }, icon(SKILLS[k].icon)),
          h('div', null, h('h3', null, SKILLS[k].name), h('p', null, SKILLS[k].desc)),
          k === 'review' && due > 0 && h('span', { class: 'chip', style: { marginLeft: 'auto', background: 'var(--sk-review-soft)', color: 'var(--sk-review)' } }, due)))),

    h('div', { class: 'section-title' }, h('h2', null, 'Lộ trình của bạn')),
    h('div', { class: 'stat-row' },
      h('div', { class: 'stat' }, h('b', null, learned), h('span', null, 'từ đã học')),
      h('div', { class: 'stat' }, h('b', null, Object.keys(state.reading).length), h('span', null, 'bài đọc')),
      h('div', { class: 'stat' }, h('b', null, Object.values(state.writing).filter(w => w.done).length), h('span', null, 'bài viết'))),
    h('div', { class: 'grid grid-2', style: { marginTop: '12px' } },
      LEVELS.map(l => {
        const st = topicStats(wordsOfLevel(l.id));
        return h('a', { class: 'topic', href: `#/learn/vocab?lv=${l.id}`, 'data-lv': l.id },
          h('div', { class: 'level-badge' }, l.id),
          h('div', { style: { flex: 1 } },
            h('h3', null, l.name, l.id === nextLevel.id && lvStats.learned < lvStats.total ? h('span', { class: 'chip lv', style: { marginLeft: '6px' } }, 'Đang học') : null),
            progressBar(st.learned, st.total, `var(--lv-${l.id})`),
            h('div', { class: 'meta' }, `${st.learned}/${st.total} từ · ${l.desc}`)));
      })),
    h('p', { class: 'footer-note' }, 'EngStep · 3.000 từ thông dụng A1–B2 · Dùng được cả khi không có mạng'),
  );
}
