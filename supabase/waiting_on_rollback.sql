-- Deshace waiting_on.sql. OJO: borra las dos columnas, y con ellas lo anotado.
drop trigger if exists tasks_waiting_since on public.tasks;
drop function if exists public.tasks_set_waiting_since();
alter table public.tasks
  drop column if exists waiting_on,
  drop column if exists waiting_since;
