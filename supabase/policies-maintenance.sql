drop policy if exists "Authenticated users can manage maintenance" on public.maintenance;
create policy "Authenticated users can manage maintenance"
on public.maintenance
for all
to authenticated
using (true)
with check (true);