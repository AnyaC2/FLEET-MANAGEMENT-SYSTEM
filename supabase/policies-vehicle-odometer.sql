drop policy if exists "Authenticated users can manage vehicle odometer logs" on public.vehicle_odometer_logs;
create policy "Authenticated users can manage vehicle odometer logs"
on public.vehicle_odometer_logs
for all
to authenticated
using (true)
with check (true);
