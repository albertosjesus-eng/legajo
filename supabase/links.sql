-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run

create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  url text not null,
  created_at timestamptz not null default now()
);

alter table links enable row level security;

drop policy if exists "own links" on links;
create policy "own links" on links
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists links_project_idx on links (project_id);
