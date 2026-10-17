-- Tareas que dependen de otra persona: dos columnas opcionales en tasks.
-- Si waiting_on está vacío, la tarea te toca a ti (comportamiento de siempre).
-- waiting_since lo gestiona un trigger: se rellena al informar waiting_on y se
-- borra al vaciarlo. Marcar la tarea como hecha no lo toca.
-- Solo AÑADE; para deshacerlo, ver waiting_on_rollback.sql.

alter table public.tasks
  add column if not exists waiting_on text,
  add column if not exists waiting_since timestamptz;

create or replace function public.tasks_set_waiting_since()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.waiting_on := nullif(btrim(new.waiting_on), '');
  if new.waiting_on is null then
    new.waiting_since := null;                                  -- se vacía: se borra
  elsif tg_op = 'INSERT' then
    new.waiting_since := now();
  elsif old.waiting_on is null then
    new.waiting_since := now();                                 -- empieza la espera
  else
    new.waiting_since := coalesce(old.waiting_since, now());    -- cambiar de persona no reinicia
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_waiting_since on public.tasks;
create trigger tasks_waiting_since
  before insert or update of waiting_on, waiting_since on public.tasks
  for each row execute function public.tasks_set_waiting_since();
