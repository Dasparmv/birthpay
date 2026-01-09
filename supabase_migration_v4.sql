-- OllitaComun v4 migration
-- Ejecuta esto si ya tenías el esquema anterior (v3) y solo quieres actualizar.

alter table public.events
  add column if not exists letter_url text;

-- Storage bucket for event letters
insert into storage.buckets (id, name, public)
values ('event-letters', 'event-letters', true)
on conflict (id) do nothing;

do $$ begin
  create policy "Public read event letters"
  on storage.objects for select
  using (bucket_id = 'event-letters');
exception when duplicate_object then null; end $$;
