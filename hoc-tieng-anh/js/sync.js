// Tài khoản và đồng bộ tiến độ qua Supabase (chỉ chạy khi đã cấu hình trong config.js)
import { CONFIG, hasBackend } from './config.js';
import { state, merge, replaceState, onChange, applySettings } from './store.js';

const SUPABASE_ESM = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const auth = { user: null, ready: false, syncing: false, lastSync: 0, error: null };
const authListeners = new Set();
export const onAuth = fn => { authListeners.add(fn); return () => authListeners.delete(fn); };
const emit = () => authListeners.forEach(fn => fn(auth));

let client = null;
async function sb() {
  if (!hasBackend()) return null;
  if (client) return client;
  const { createClient } = await import(SUPABASE_ESM);
  client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export const isAdmin = () => Boolean(auth.user && CONFIG.adminEmails.map(e => e.toLowerCase()).includes((auth.user.email || '').toLowerCase()));
export const needsLogin = () => hasBackend() && !auth.user;

export async function initAuth() {
  if (!hasBackend()) { auth.ready = true; return; }
  try {
    const c = await sb();
    const { data } = await c.auth.getSession();
    auth.user = data.session?.user || null;
    c.auth.onAuthStateChange((event, session) => {
      const before = auth.user?.id;
      auth.user = session?.user || null;
      if (auth.user && auth.user.id !== before) pull();
      emit();
    });
    if (auth.user) await pull();
  } catch (e) {
    auth.error = 'offline';
    console.warn('Không kết nối được máy chủ, đang dùng dữ liệu trên máy.', e);
  }
  auth.ready = true;
  emit();
  let timer;
  onChange(() => { clearTimeout(timer); timer = setTimeout(push, 2500); });
  window.addEventListener('online', () => auth.user && pull());
}

/** Tải tiến độ trên máy chủ về, gộp với tiến độ trên máy rồi gửi lại */
export async function pull() {
  const c = await sb();
  if (!c || !auth.user) return;
  auth.syncing = true; emit();
  try {
    const { data, error } = await c.from('progress').select('data').eq('user_id', auth.user.id).maybeSingle();
    if (error) throw error;
    if (data?.data) {
      replaceState(merge(state, data.data));
      applySettings();
    }
    await push(true);
    auth.error = null;
  } catch (e) {
    auth.error = e.message || 'sync';
  } finally {
    auth.syncing = false; emit();
    window.dispatchEvent(new Event('engstep:synced'));
  }
}

export async function push(force = false) {
  const c = await sb();
  if (!c || !auth.user || (!force && !navigator.onLine)) return;
  const { error } = await c.from('progress').upsert({
    user_id: auth.user.id, data: state, updated_at: new Date().toISOString(),
  });
  if (error) { auth.error = error.message; return; }
  auth.lastSync = Date.now();
  auth.error = null;
}

export async function signUp(email, password, name) {
  const c = await sb();
  const { data, error } = await c.auth.signUp({
    email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const c = await sb();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signInGoogle() {
  const c = await sb();
  const { error } = await c.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function resetPassword(email) {
  const c = await sb();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/account?reset=1' });
  if (error) throw error;
}

export async function updatePassword(password) {
  const c = await sb();
  const { error } = await c.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const c = await sb();
  await push(true);
  await c.auth.signOut();
  auth.user = null;
  emit();
}

/* ---------- Dữ liệu dùng chung & quản trị ---------- */

/** Các chỉnh sửa từ vựng do quản trị viên tạo (ai cũng đọc được) */
const LOCAL_OVR = 'engstep.localOverrides';
const localOverrides = () => { try { return JSON.parse(localStorage.getItem(LOCAL_OVR)) || []; } catch (e) { return []; } };
function setLocalOverride(row) {
  const list = localOverrides().filter(o => o.id !== row.id);
  list.push(row);
  localStorage.setItem(LOCAL_OVR, JSON.stringify(list));
}

export async function fetchOverrides() {
  // Chế độ chỉ trên máy: chỉnh sửa của trang quản trị lưu trong trình duyệt
  if (!hasBackend()) return localOverrides();
  try {
    const c = await sb();
    const { data, error } = await c.from('word_overrides').select('id, data, deleted');
    if (error) throw error;
    localStorage.setItem('engstep.overrides', JSON.stringify(data || []));
    return data || [];
  } catch (e) {
    try { return JSON.parse(localStorage.getItem('engstep.overrides')) || []; } catch (_) { return []; }
  }
}

export async function adminStats() {
  const c = await sb();
  const { data, error } = await c.rpc('admin_stats');
  if (error) throw error;
  return data;
}

export async function adminSaveWord(id, data) {
  if (!hasBackend()) return setLocalOverride({ id, data, deleted: false });
  const c = await sb();
  const { error } = await c.from('word_overrides').upsert({ id, data, deleted: false, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function adminDeleteWord(id) {
  if (!hasBackend()) return setLocalOverride({ id, data: {}, deleted: true });
  const c = await sb();
  const { error } = await c.from('word_overrides').upsert({ id, data: {}, deleted: true, updated_at: new Date().toISOString() });
  if (error) throw error;
}
