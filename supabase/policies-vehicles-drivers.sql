drop policy if exists "Authenticated users can manage vehicles" on public.vehicles;
create policy "Authenticated users can manage vehicles"
on public.vehicles
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage drivers" on public.drivers;
create policy "Authenticated users can manage drivers"
on public.drivers
for all
to authenticated
using (true)
with check (true);
