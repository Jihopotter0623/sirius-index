-- Play Well 팀 노트 데이터베이스 설정
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여 넣고 Run 을 누르세요. (한 번만)

-- 1) 영상 링크와 설계도를 담는 표
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  col text not null check (col in ('videos', 'plans')),   -- videos = 유튜브 링크, plans = 설계도
  data jsonb not null,                                     -- 제목, 주소, 메모, 포트 구성 등
  author uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text,
  created_at timestamptz not null default now()
);
create index if not exists items_col_created on public.items (col, created_at desc);

-- 2) 권한: 로그인한 팀원은 모두 보고 추가할 수 있고, 지우기는 올린 사람만
alter table public.items enable row level security;

drop policy if exists "team members read" on public.items;
create policy "team members read" on public.items
  for select to authenticated using (true);

drop policy if exists "team members add" on public.items;
create policy "team members add" on public.items
  for insert to authenticated with check (author = auth.uid());

drop policy if exists "authors delete" on public.items;
create policy "authors delete" on public.items
  for delete to authenticated using (author = auth.uid());

-- 3) 누가 추가하면 다른 팀원 화면에도 바로 나타나도록 실시간 알림 켜기
do $$
begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null;
end $$;

-- 4) 설계도 파일(이미지·PDF) 보관함: 비공개, 파일당 20MB까지
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plans', 'plans', false, 20971520,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "team members read plan files" on storage.objects;
create policy "team members read plan files" on storage.objects
  for select to authenticated using (bucket_id = 'plans');

drop policy if exists "team members upload plan files" on storage.objects;
create policy "team members upload plan files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plans' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "uploaders delete plan files" on storage.objects;
create policy "uploaders delete plan files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'plans' and (storage.foldername(name))[1] = auth.uid()::text);
