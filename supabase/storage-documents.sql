insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can view document files" on storage.objects;
create policy "Authenticated users can view document files"
on storage.objects
for select
to authenticated
using (bucket_id = 'documents');

drop policy if exists "Authenticated users can upload document files" on storage.objects;
create policy "Authenticated users can upload document files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'documents');

drop policy if exists "Authenticated users can update document files" on storage.objects;
create policy "Authenticated users can update document files"
on storage.objects
for update
to authenticated
using (bucket_id = 'documents')
with check (bucket_id = 'documents');

drop policy if exists "Authenticated users can delete document files" on storage.objects;
create policy "Authenticated users can delete document files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'documents');

