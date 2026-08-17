-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run

create table if not exists capturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  texto text not null,
  created_at timestamptz not null default now(),
  estado text not null default 'pendiente',
  project_id uuid references projects(id) on delete set null,
  sugerencia_json jsonb,
  procesada_at timestamptz,
  escalada_a text
);

alter table capturas enable row level security;

drop policy if exists "capturas propias" on capturas;
create policy "capturas propias" on capturas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists capturas_pendientes_idx
  on capturas (user_id, estado, created_at desc);
