drop policy if exists "Authenticated users can manage incidents" on public.incidents;
create policy "Authenticated users can manage incidents"
on public.incidents
for all
to authenticated
using (true)
with check (true);
