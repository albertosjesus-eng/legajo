-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run
-- (además de schema.sql y calendar_sync.sql, que deben estar ya ejecutados)

alter table projects add column if not exists updated_at timestamptz not null default now();

-- Cada vez que se crea, edita o borra una nota/tarea/cita, actualizamos
-- automáticamente el "updated_at" del proyecto al que pertenece.
create or replace function touch_project_updated_at() returns trigger as $$
begin
  if (tg_op = 'DELETE') then
    update projects set updated_at = now() where id = old.project_id;
    return old;
  else
    update projects set updated_at = now() where id = new.project_id;
    return new;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notes_touch_project on notes;
create trigger trg_notes_touch_project
after insert or update or delete on notes
for each row execute function touch_project_updated_at();

drop trigger if exists trg_tasks_touch_project on tasks;
create trigger trg_tasks_touch_project
after insert or update or delete on tasks
for each row execute function touch_project_updated_at();

drop trigger if exists trg_events_touch_project on events;
create trigger trg_events_touch_project
after insert or update or delete on events
for each row execute function touch_project_updated_at();
