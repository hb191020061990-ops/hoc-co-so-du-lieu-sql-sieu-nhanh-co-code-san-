// Thông tin các kỹ năng và quy tắc học thử
import { CONFIG, hasBackend } from './config.js';
import { auth } from './sync.js';
import { DB, topicsOf } from './data.js';
import { h, modal } from './ui.js';
import { icon } from './icons.js';
import { canRecognize } from './speech.js';

export const SKILLS = {
  vocab: {
    name: 'Từ vựng', icon: 'cards', desc: 'Thẻ từ, trắc nghiệm, gõ từ, nghe chọn từ', perWord: 3,
    steps: ['Xem thẻ từ mới (nghĩa, phiên âm, ví dụ)', 'Trắc nghiệm Anh → Việt', 'Gõ từ tiếng Anh', 'Nghe và chọn từ đúng'],
  },
  listen: {
    name: 'Nghe', icon: 'headphones', desc: 'Nghe chọn từ, nghe hiểu câu, chép chính tả', perWord: 3,
    steps: ['Nghe và chọn từ đúng', 'Nghe và chép lại từ', 'Nghe câu và chọn câu đúng / chép chính tả câu'],
  },
  speak: {
    name: 'Nói', icon: 'mic', desc: 'Đọc to từ và câu, máy chấm phát âm', perWord: 2,
    steps: ['Nghe mẫu rồi đọc to từ', 'Đọc to câu ví dụ', 'Xem máy nghe được gì và sửa lại'],
  },
  read: {
    name: 'Đọc', icon: 'reading', desc: 'Đoạn văn theo cấp độ, chạm vào từ để tra nghĩa',
    steps: [],
  },
  write: {
    name: 'Viết', icon: 'pen', desc: 'Điền từ vào câu, sắp xếp câu, viết đoạn văn', perWord: 3,
    steps: ['Dịch nghĩa tiếng Việt sang từ tiếng Anh', 'Điền từ còn thiếu vào câu', 'Sắp xếp các từ thành câu đúng'],
  },
  review: {
    name: 'Ôn tập', icon: 'repeat', desc: 'Ôn lại các từ đến hạn theo lịch ngắt quãng', perWord: 2,
    steps: ['Các từ bạn sắp quên được đưa ra trước', 'Câu hỏi trộn nhiều dạng', 'Từ nhớ tốt sẽ giãn lịch ôn ra xa hơn'],
  },
};

export const COUNTS = [15, 25, 50];

/** Khách chưa đăng nhập chỉ học thử vài chủ đề đầu của mỗi cấp (khi web có tài khoản) */
export function isTopicLocked(topicId) {
  if (!hasBackend() || auth.user) return false;
  const t = DB.topicById.get(topicId);
  if (!t) return false;
  const idx = topicsOf(t.level).findIndex(x => x.id === topicId);
  return idx >= CONFIG.guestFreeTopics;
}

export function isItemLocked(list, item) {
  if (!hasBackend() || auth.user) return false;
  const sameLevel = list.filter(x => x.level === item.level);
  return sameLevel.indexOf(item) >= CONFIG.guestFreeTopics;
}

export function lockedModal() {
  const close = modal([
    h('div', { class: 'center' }, h('div', { style: { fontSize: '3rem' } }, '🔐')),
    h('h2', { class: 'center' }, 'Đăng ký miễn phí để học tiếp'),
    h('p', { class: 'muted center' }, `Bạn đang học thử ${CONFIG.guestFreeTopics} chủ đề đầu tiên của mỗi cấp độ. Tạo tài khoản để mở toàn bộ 3.000 từ, các bài Nghe – Nói – Đọc – Viết và đồng bộ tiến độ trên mọi thiết bị.`),
    h('a', { class: 'btn primary block lg', href: '#/account', onclick: () => close() }, 'Đăng ký / Đăng nhập'),
    h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: () => close() }, 'Để sau'),
  ]);
}

export function skillIcon(skill) {
  return h('div', { class: 'skill-ico', 'data-sk': skill }, icon(SKILLS[skill].icon));
}

export const speakingNote = () => !canRecognize() && h('div', { class: 'notice' }, icon('alert'),
  h('div', null, 'Trình duyệt này chưa hỗ trợ nhận diện giọng nói. Bạn vẫn luyện được: nghe mẫu, đọc theo rồi tự đánh giá. Để máy chấm phát âm, hãy dùng Google Chrome hoặc Microsoft Edge.'));
