-- ═══════════════════════════════════════════════════════════════════════
--  STUDY OS — Supabase schema (دراسة OS جدول المزامنة + RLS)  ·  Study OS
-- ═══════════════════════════════════════════════════════════════════════
--  بالله خطوات التنفيذ (مرة واحدة):
--  1) افتح:  Supabase Dashboard → مشروعك → SQL Editor → New query
--  2) الصق الملف ده كله (study-os-schema.sql) → Run
--  3) راح يظهر فيه الجدول study_os_v1 + RLS — خلاصي.
--
--  ⚠️ ملاحظة الأمان (مهمة — اقرأها):
--   الـ anon key اللي اتشارك معايا قيمة عامة بطبيعتها لإنها بتتلسق في
--   كود العميل (CDN سكربت). الأمان الحقيقي مش بييجي من إخفاء المفتاح —
--   بييجي من سياسة RLS في هذا السكربت: كل صف بيحميه `auth.uid() = user_id`
--   وبالتالي **حتى لو حصل أي شخص على anon key، مستحيل يقرأ/يكتب/يحذف
--   غير صفّ نفسه**. بعد ما تتحرك بيّن/تورّد الـ anon key إن كنت داري
--   القلق هديك خطوة.
--
--  الصورة العقلانية:
--   • Supabase عندنا مجرد "مرآة سحابية" لجلسة واحدة لكل مستخدم.
--   • التطبيق نفسه محلي بالكامل (localStorage = أساس، offline-first).
--   • عند كل تغيير → دفع (debounced). عند الدخول → سحب (الأحدث يفوز).
--   • المفتاح هنا: الصف الواحد لكل user_id (unique) + RLS الصارمة.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1) إمكانات لازم تكون مفعّلة ────────────────────────────────────────
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists "uuid-ossp";

-- ── 2) الجدول (صف واحد لكل مستخدم = نسخة السحابة الكاملة) ──────────────
create table if not exists public.study_os_v1 (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  payload     jsonb not null default '{}'::jsonb,
  version     integer not null default 1,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- فهرس فريد على المستخدم — يضمن "صف واحد لكل مستخدم" ويدعم upsert بـ onConflict
create unique index if not exists study_os_v1_user_id_key
  on public.study_os_v1 (user_id);

-- ── 3) تحديث updated_at تلقائيًا (عند كل upsert) ───────────────────────
create or replace function public.set_study_os_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_study_os_set_updated on public.study_os_v1;
create trigger trg_study_os_set_updated
  before insert or update on public.study_os_v1
  for each row execute function public.set_study_os_updated_at();

-- ── 4) RLS — الأمان الفعلي (لا تحذف هذه السطور أبدًا) ──────────────────
alter table public.study_os_v1 enable row level security;

-- سماح: المستخدم يقرأ صفّه اللي المسؤول عنه بـ auth.uid() فقط
drop policy if exists "study_os_select_own" on public.study_os_v1;
create policy "study_os_select_own"
  on public.study_os_v1
  for select
  using (auth.uid() = user_id);

-- إدراج: يسمح فقط للمستخدم بإنشاء صف لنفسه (via auth.uid)
drop policy if exists "study_os_insert_own" on public.study_os_v1;
create policy "study_os_insert_own"
  on public.study_os_v1
  for insert
  with check (auth.uid() = user_id);

-- تحديث: فقط صفّه وبالـ "with check" لمنع تسريب الصف لصاحب آخر
drop policy if exists "study_os_update_own" on public.study_os_v1;
create policy "study_os_update_own"
  on public.study_os_v1
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- حذف: فقط صفّه
drop policy if exists "study_os_delete_own" on public.study_os_v1;
create policy "study_os_delete_own"
  on public.study_os_v1
  for delete
  using (auth.uid() = user_id);

-- ── 5) منح الضروري للـ anon/authenticated (UPDF للسياسات) ──────────────
grant all on public.study_os_v1 to anon, authenticated;

-- ✅ انتهى — الجدول جاهز، والآن ارجع للتطبيق واضغط ‏«دخول بحساب Google».
