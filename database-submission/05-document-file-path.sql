alter table public.documents
add column if not exists file_path text;

drop policy if exists "Authenticated users can manage documents" on public.documents;
create policy "Authenticated users can manage documents"
on public.documents
for all
to authenticated
using (true)
with check (true);
