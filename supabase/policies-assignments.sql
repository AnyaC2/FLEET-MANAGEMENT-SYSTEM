drop policy if exists "Authenticated users can manage assignments" on public.assignments;
create policy "Authenticated users can manage assignments"
on public.assignments
for all
to authenticated
using (true)
with check (true);
