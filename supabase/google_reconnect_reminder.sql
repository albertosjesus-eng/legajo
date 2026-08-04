-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run

alter table calendar_connections add column if not exists connected_at timestamptz not null default now();
