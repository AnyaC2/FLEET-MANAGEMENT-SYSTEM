drop policy if exists "Authenticated users can manage fuel logs" on public.fuel_logs;
create policy "Authenticated users can manage fuel logs"
on public.fuel_logs
for all
to authenticated
using (true)
with check (true);
