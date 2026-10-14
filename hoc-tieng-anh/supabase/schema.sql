-- =============================================================
-- EngStep – cấu trúc cơ sở dữ liệu Supabase
-- Mở Supabase → SQL Editor → New query → dán toàn bộ tệp này → Run
-- =============================================================

-- 1) Tiến độ học của từng người (mỗi người một dòng, dữ liệu dạng JSON)
create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.progress enable row level security;

drop policy if exists "progress: xem của mình" on public.progress;
create policy "progress: xem của mình" on public.progress
  for select using (auth.uid() = user_id);
drop policy if exists "progress: thêm của mình" on public.progress;
create policy "progress: thêm của mình" on public.progress
  for insert with check (auth.uid() = user_id);
drop policy if exists "progress: sửa của mình" on public.progress;
create policy "progress: sửa của mình" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Danh sách quản trị viên (thêm email của bạn ở cuối tệp)
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;
-- Không tạo policy nào: chỉ hàm nội bộ đọc được bảng này.

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 3) Chỉnh sửa kho từ vựng của quản trị viên (mọi người đọc được, chỉ admin được ghi)
create table if not exists public.word_overrides (
  id         integer primary key,
  data       jsonb not null default '{}'::jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.word_overrides enable row level security;

drop policy if exists "overrides: ai cũng đọc" on public.word_overrides;
create policy "overrides: ai cũng đọc" on public.word_overrides
  for select using (true);
drop policy if exists "overrides: admin thêm" on public.word_overrides;
create policy "overrides: admin thêm" on public.word_overrides
  for insert with check (public.is_admin());
drop policy if exists "overrides: admin sửa" on public.word_overrides;
create policy "overrides: admin sửa" on public.word_overrides
  for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "overrides: admin xóa" on public.word_overrides;
create policy "overrides: admin xóa" on public.word_overrides
  for delete using (public.is_admin());

-- 4) Thống kê cho trang quản trị (chỉ admin gọi được)
create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  today text := to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD');
  result json;
begin
  if not public.is_admin() then
    raise exception 'Bạn không có quyền quản trị';
  end if;
  select json_build_object(
    'users',         (select count(*) from auth.users),
    'new_7d',        (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_today',  (select count(*) from public.progress where data -> 'days' ? today),
    'active_7d',     (select count(*) from public.progress where updated_at > now() - interval '7 days'),
    'active_30d',    (select count(*) from public.progress where updated_at > now() - interval '30 days'),
    'words_learned', (select coalesce(sum((select count(*) from jsonb_object_keys(data -> 'words'))), 0) from public.progress)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- 5) THAY email dưới đây bằng email quản trị của bạn (có thể thêm nhiều dòng)
insert into public.admins (email) values ('email-cua-ban@gmail.com')
on conflict do nothing;
