-- ═══════════════════════════════════════════════════════════════════════
--  STUDY OS — Supabase schema (جدول المزامنة + RLS)  —  نُفّذ في:
--  Supabase Dashboard ← SQL Editor ← New Query ← الصق كل السطر ← Run
--  (يمكن إعادة التنفيذ بأمان: كل تعليماتها ان وجدت بالفعل تتخطى)
-- ═══════════════════════════════════════════════════════════════════════

-- 1) تمكين الامتداد للطابع الزمني التلقائي (إن لم يكن مفعّلًا)
create extension if not exists moddatetime schema extensions;

-- 2) الجدول: صف واحد لكل مستخدم = نسخة المرآة السحابية الكاملة لحالة التطبيق
create table if not exists public.study_os_v1 (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade unique,
  payload     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- 3) تحديث updated_at تلقائيًا عند كل upsert
drop trigger if exists study_os_v1_set_updated_at on public.study_os_v1;
create trigger study_os_v1_set_updated_at
  before update on public.study_os_v1
  for each row execute function extensions.moddatetime (updated_at);

-- 4) فهرس المزامنة على المستخدم (للسحب السريع بالاستعلام تقريبًا)
create index if not exists study_os_v1_user_idx on public.study_os_v1 (user_id);

-- ════════════════ RLS — الأمان الفعلي (مهم جدًا) ════════════════
-- anon/authenticated كلهن مش يقرأوا ولا يكتبوا إلا صفّهم فقط.
-- بدون RLS صحيحة: أي شخص معاه anon key يقرأ/يمسح بياناتك. فلا تشيلها.
alter table public.study_os_v1 enable row level security;

drop policy if exists "study_os_select_own" on public.study_os_v1;
create policy "study_os_select_own"
  on public.study_os_v1
  for select
  using (auth.uid() = user_id);

drop policy if exists "study_os_insert_own" on public.study_os_v1;
create policy "study_os_insert_own"
  on public.study_os_v1
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "study_os_update_own" on public.study_os_v1;
create policy "study_os_update_own"
  on public.study_os_v1
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "study_os_delete_own" on public.study_os_v1;
create policy "study_os_delete_own"
  on public.study_os_v1
  for delete
  using (auth.uid() = user_id);

-- ════════════════ (اختياري) منح للاتصالات عبر anon — مفعّلة يدويًا ════════════════
-- عادةً المنح الافتراضي متاح لأدوار anon+authenticated عبر الجداول الجديدة،
-- لكن لو ظهر "permission denied for table" نفّذي سطر المنح ده مرة واحدة:
grant all on table public.study_os_v1 to anon, authenticated;
