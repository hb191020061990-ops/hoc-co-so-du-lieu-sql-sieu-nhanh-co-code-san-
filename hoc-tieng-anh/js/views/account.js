// Đăng nhập / đăng ký / tài khoản
import { h, toast } from '../ui.js';
import { icon } from '../icons.js';
import { hasBackend, CONFIG } from '../config.js';
import { auth, onAuth, signIn, signUp, signInGoogle, signOut, resetPassword, updatePassword, pull, isAdmin } from '../sync.js';
import { state } from '../store.js';

const ERR = {
  'Invalid login credentials': 'Email hoặc mật khẩu không đúng.',
  'Email not confirmed': 'Email chưa được xác nhận. Hãy mở hộp thư và bấm vào liên kết xác nhận.',
  'User already registered': 'Email này đã được đăng ký. Hãy đăng nhập.',
  'Password should be at least 6 characters': 'Mật khẩu cần ít nhất 6 ký tự.',
};
const viErr = e => ERR[e?.message] || e?.message || 'Có lỗi xảy ra, hãy thử lại.';

export function accountView(q) {
  const root = h('div', { style: { maxWidth: '480px', margin: '0 auto' } });
  let mode = 'login';
  const unsub = onAuth(() => render());

  function render() {
    if (!hasBackend()) return root.replaceChildren(localMode());
    if (!auth.ready) return root.replaceChildren(h('div', { class: 'boot' }, h('div', { class: 'spinner' })));
    if (auth.user && q.get('reset') === '1') return root.replaceChildren(newPassword());
    root.replaceChildren(auth.user ? profile() : loginForm());
  }

  function localMode() {
    return h('div', null,
      h('h1', null, 'Tài khoản'),
      h('div', { class: 'notice info' }, icon('info'), h('div', null,
        'Trang web đang chạy ở chế độ ', h('b', null, 'lưu trên máy'), ': mọi bài học đều mở, tiến độ được lưu trong trình duyệt này. ',
        'Để bật đăng nhập bằng email/Google và đồng bộ nhiều thiết bị, quản trị viên cần điền cấu hình Supabase trong tệp js/config.js (xem HUONG-DAN-TRIEN-KHAI.md).')),
      h('div', { class: 'card', style: { marginTop: '12px' } },
        h('h3', null, 'Chuyển tiến độ sang thiết bị khác'),
        h('p', { class: 'muted small' }, 'Dùng chức năng sao lưu ở trang Tiến độ để tải tệp về rồi khôi phục trên máy khác.'),
        h('a', { class: 'btn', href: '#/stats' }, icon('download'), 'Đến phần sao lưu')));
  }

  function loginForm() {
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', required: true, placeholder: 'ban@vidu.com' });
    const pass = h('input', { class: 'input', type: 'password', autocomplete: mode === 'login' ? 'current-password' : 'new-password', required: true, minLength: 6, placeholder: 'Ít nhất 6 ký tự' });
    const name = h('input', { class: 'input', type: 'text', autocomplete: 'name', placeholder: 'Tên hiển thị' });
    const msg = h('div', { class: 'small', style: { minHeight: '20px', color: 'var(--danger)', marginBottom: '8px' } });
    const btn = h('button', { class: 'btn primary block lg', type: 'submit' }, mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản');

    const submit = async e => {
      e.preventDefault();
      btn.disabled = true; msg.textContent = '';
      try {
        if (mode === 'login') {
          await signIn(email.value.trim(), pass.value);
          toast('Đăng nhập thành công!');
          location.hash = '#/';
        } else {
          const data = await signUp(email.value.trim(), pass.value, name.value.trim());
          if (data.session) { toast('Tạo tài khoản thành công!'); location.hash = '#/'; }
          else { msg.style.color = 'var(--success)'; msg.textContent = 'Đã gửi email xác nhận. Hãy mở hộp thư và bấm vào liên kết để kích hoạt tài khoản.'; }
        }
      } catch (err) { msg.style.color = 'var(--danger)'; msg.textContent = viErr(err); }
      btn.disabled = false;
    };

    return h('div', null,
      h('div', { class: 'center', style: { marginBottom: '16px' } },
        h('img', { src: 'icons/icon.svg', alt: '', width: 64, height: 64, style: { margin: '0 auto 8px' } }),
        h('h1', null, mode === 'login' ? 'Đăng nhập' : 'Đăng ký miễn phí'),
        h('p', { class: 'muted' }, 'Lưu tiến độ và học trên mọi thiết bị')),
      h('div', { class: 'card' },
        h('button', { class: 'btn block lg', onclick: async () => { try { await signInGoogle(); } catch (err) { msg.textContent = viErr(err); } } }, icon('google'), 'Tiếp tục với Google'),
        h('div', { class: 'row muted small', style: { margin: '14px 0' } }, h('hr', { style: { flex: 1, border: 0, borderTop: '1px solid var(--border)' } }), 'hoặc dùng email', h('hr', { style: { flex: 1, border: 0, borderTop: '1px solid var(--border)' } })),
        h('form', { onsubmit: submit },
          mode === 'register' && h('label', { class: 'field' }, h('span', null, 'Tên của bạn'), name),
          h('label', { class: 'field' }, h('span', null, 'Email'), email),
          h('label', { class: 'field' }, h('span', null, 'Mật khẩu'), pass),
          msg, btn),
        mode === 'login' && h('button', { class: 'btn ghost block sm', style: { marginTop: '8px' }, onclick: async () => {
          if (!email.value.trim()) { msg.textContent = 'Nhập email trước rồi bấm "Quên mật khẩu".'; email.focus(); return; }
          try { await resetPassword(email.value.trim()); msg.style.color = 'var(--success)'; msg.textContent = 'Đã gửi email đặt lại mật khẩu.'; } catch (err) { msg.textContent = viErr(err); }
        } }, 'Quên mật khẩu?')),
      h('p', { class: 'center', style: { marginTop: '16px' } },
        mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? ',
        h('a', { href: 'javascript:void 0', onclick: () => { mode = mode === 'login' ? 'register' : 'login'; render(); } }, mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập')),
      h('p', { class: 'center muted small' }, `Chưa muốn đăng ký? Bạn vẫn có thể học thử ${CONFIG.guestFreeTopics} chủ đề đầu của mỗi cấp độ.`));
  }

  function newPassword() {
    const pass = h('input', { class: 'input', type: 'password', minLength: 6, required: true, autocomplete: 'new-password' });
    return h('div', null, h('h1', null, 'Đặt mật khẩu mới'),
      h('form', { class: 'card', onsubmit: async e => {
        e.preventDefault();
        try { await updatePassword(pass.value); toast('Đã đổi mật khẩu'); location.hash = '#/account'; } catch (err) { toast(viErr(err)); }
      } }, h('label', { class: 'field' }, h('span', null, 'Mật khẩu mới'), pass), h('button', { class: 'btn primary block', type: 'submit' }, 'Lưu mật khẩu')));
  }

  function profile() {
    const u = auth.user;
    const name = u.user_metadata?.name || u.user_metadata?.full_name || u.email.split('@')[0];
    const learned = Object.values(state.words).filter(w => w.b > 0).length;
    return h('div', null,
      h('div', { class: 'card center' },
        u.user_metadata?.avatar_url
          ? h('img', { src: u.user_metadata.avatar_url, alt: '', width: 72, height: 72, style: { borderRadius: '50%', margin: '0 auto 8px' }, referrerpolicy: 'no-referrer' })
          : h('div', { style: { width: '72px', height: '72px', borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary-strong)', display: 'grid', placeItems: 'center', fontSize: '1.8rem', fontWeight: 800, margin: '0 auto 8px' } }, name[0].toUpperCase()),
        h('h2', { style: { marginBottom: 0 } }, name),
        h('p', { class: 'muted' }, u.email),
        h('p', { class: 'small' }, `${learned} từ đã học`),
        h('div', { class: 'small muted' }, auth.syncing ? 'Đang đồng bộ…' : auth.error ? `⚠️ Chưa đồng bộ được (${auth.error}). Tiến độ vẫn lưu trên máy.` : auth.lastSync ? `✅ Đã đồng bộ lúc ${new Date(auth.lastSync).toLocaleTimeString('vi-VN')}` : '')),
      h('div', { class: 'stack', style: { marginTop: '12px' } },
        h('button', { class: 'btn block', onclick: async () => { await pull(); toast(auth.error ? 'Không đồng bộ được' : 'Đã đồng bộ tiến độ'); render(); } }, icon('cloud'), 'Đồng bộ ngay'),
        h('a', { class: 'btn block', href: '#/stats' }, icon('settings'), 'Cài đặt & sao lưu'),
        isAdmin() && h('a', { class: 'btn block', href: '#/admin' }, icon('shield'), 'Trang quản trị'),
        h('button', { class: 'btn ghost danger block', onclick: async () => { await signOut(); toast('Đã đăng xuất'); location.hash = '#/'; } }, icon('logout'), 'Đăng xuất')));
  }

  render();
  return { el: root, cleanup: unsub };
}
