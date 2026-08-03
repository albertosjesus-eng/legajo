-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run

alter table calendar_connections add column if not exists task_list_id text;
alter table tasks add column if not exists google_task_id text;
