-- Envío de correos (y cualquier texto) a la Bandeja de Legajo desde un Atajo de iOS.
-- Solo AÑADE una tabla. Ejecuta TODO el archivo: al final te muestra tu clave UNA vez.
--
-- La tabla guarda únicamente el HASH de la clave (nunca la clave en claro), y no
-- tiene políticas: solo la función 'capture' (con permisos de servidor) puede usarla.

create table if not exists public.capture_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked boolean not null default false
);

alter table public.capture_tokens enable row level security;

-- Genera una clave nueva, guarda su hash y la muestra una sola vez.
-- (Para crear otra más adelante, vuelve a ejecutar SOLO este bloque.)
with nuevo as (
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') as token
), alta as (
  insert into public.capture_tokens (user_id, token_hash, label)
  select 'e1a72c26-68e6-4ba5-a546-83f87f2d46e4'::uuid,
         encode(sha256(convert_to(token, 'utf8')), 'hex'),
         'Atajo iPhone/iPad'
  from nuevo
  returning 1
)
select token as "COPIA ESTA CLAVE (no se vuelve a mostrar)"
from nuevo, alta;

-- Para ANULAR una clave (por ejemplo, si pierdes el móvil):
--   update public.capture_tokens set revoked = true;
