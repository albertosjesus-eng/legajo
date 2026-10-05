-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run
-- Es solo AÑADIR una tabla nueva: no toca nada de lo existente.

create table if not exists rutinas_resultados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,            -- 'semanal' | 'mensual' | 'cita'
  clave text not null,           -- '2026-W41', '2026-09' o el id de la cita
  titulo text not null,
  contenido text not null,
  created_at timestamptz not null default now(),
  leido boolean not null default false,
  unique (user_id, tipo, clave)
);

alter table rutinas_resultados enable row level security;

drop policy if exists "rutinas propias" on rutinas_resultados;
create policy "rutinas propias" on rutinas_resultados
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists rutinas_recientes_idx
  on rutinas_resultados (user_id, created_at desc);
