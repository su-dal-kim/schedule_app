-- Supabase SQL 편집기(SQL Editor)에서 이 내용을 그대로 실행하세요.

create table if not exists schedules (
  key text primary key,
  label text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

-- 개인용 앱이라 인증 없이 anon key로 읽고 쓸 수 있게 허용합니다.
-- (참고: 이 설정은 anon key를 아는 사람은 누구나 이 표에 접근할 수 있다는 뜻이에요.
--  가족 등 여러 명이 같은 URL을 쓰지 않는 이상 실제 위험은 낮지만, 참고해두세요.)
alter table schedules enable row level security;

create policy "public read" on schedules
  for select using (true);

create policy "public write" on schedules
  for insert with check (true);

create policy "public update" on schedules
  for update using (true);

create policy "public delete" on schedules
  for delete using (true);
