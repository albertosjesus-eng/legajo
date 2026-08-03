-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run
-- (además de los anteriores schema.sql, calendar_sync.sql y home_and_assistant.sql)

alter table tasks add column if not exists due_date date;
