drop policy if exists "Authenticated users can manage trips" on public.trips;
create policy "Authenticated users can manage trips"
on public.trips
for all
to authenticated
using (true)
with check (true);
