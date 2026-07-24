-- Ejecuta esto en Supabase: SQL Editor > New query > pegar y Run
-- (además de los anteriores: schema.sql, calendar_sync.sql, home_and_assistant.sql,
-- tasks_due_date.sql, archive_projects.sql)

-- Marca si una nota tiene un dibujo guardado (la imagen en sí vive en Storage, no aquí)
alter table notes add column if not exists has_drawing boolean not null default false;

-- Bucket privado para los dibujos. Cada archivo se guarda como "{user_id}/{note_id}.png",
-- así que las políticas de abajo bastan para que cada usuario solo vea los suyos.
insert into storage.buckets (id, name, public)
values ('note-drawings', 'note-drawings', false)
on conflict (id) do nothing;

drop policy if exists "own drawings select" on storage.objects;
create policy "own drawings select" on storage.objects for select
  using (bucket_id = 'note-drawings' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "own drawings insert" on storage.objects;
create policy "own drawings insert" on storage.objects for insert
  with check (bucket_id = 'note-drawings' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "own drawings update" on storage.objects;
create policy "own drawings update" on storage.objects for update
  using (bucket_id = 'note-drawings' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "own drawings delete" on storage.objects;
create policy "own drawings delete" on storage.objects for delete
  using (bucket_id = 'note-drawings' and auth.uid()::text = (storage.foldername(name))[1]);
