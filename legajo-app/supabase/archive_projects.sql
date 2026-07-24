-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run
-- (además de los anteriores: schema.sql, calendar_sync.sql, home_and_assistant.sql, tasks_due_date.sql)

alter table projects add column if not exists archived boolean not null default false;
