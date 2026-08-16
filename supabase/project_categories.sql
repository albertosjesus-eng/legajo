-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run
-- Los proyectos ya existentes quedan automáticamente como "operativo".

alter table projects add column if not exists category text not null default 'operativo';
