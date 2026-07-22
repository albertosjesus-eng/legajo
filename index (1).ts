-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run
-- (además de supabase/schema.sql, que debe estar ya ejecutado)

create table if not exists calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft')),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  calendar_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Seguridad: esta tabla NO es accesible desde el navegador, ni siquiera por su propio
-- dueño. Solo las Edge Functions (que usan la service role key) pueden leerla o
-- escribirla. Activamos RLS y no añadimos ninguna política para el rol normal,
-- lo que la deja bloqueada por defecto para cualquier petición autenticada normal.
alter table calendar_connections enable row level security;

-- Vincula cada evento de Legajo con su equivalente en Google Calendar, para
-- poder actualizarlo o borrarlo más adelante.
alter table events add column if not exists google_event_id text;
