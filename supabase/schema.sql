-- 粤语能力定位测验 · Supabase 云同步建表脚本
-- 在 Supabase 项目的 SQL Editor 中执行一次即可

create table if not exists app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_state enable row level security;

create policy "users_manage_own_state"
  on app_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);