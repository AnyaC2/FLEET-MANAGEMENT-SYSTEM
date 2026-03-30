drop policy if exists "Authenticated users can manage notifications" on public.notifications;
create policy "Authenticated users can manage notifications"
on public.notifications
for all
to authenticated
using (true)
with check (true);
