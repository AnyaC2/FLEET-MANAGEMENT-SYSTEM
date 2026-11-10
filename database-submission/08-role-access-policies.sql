alter type public.app_role add value if not exists 'editor';
alter type public.app_role add value if not exists 'end_user';

update public.profiles
set role = 'system_admin'
where role = 'admin';

update public.profiles
set role = 'editor'
where role in ('admin_officer', 'fleet_manager', 'operations_officer', 'maintenance_officer');

update public.profiles
set role = 'end_user'
where role = 'viewer';

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'system_admin'::public.app_role;
$$;

revoke all on function public.is_system_admin() from public;
grant execute on function public.is_system_admin() to authenticated;

create or replace function public.can_manage_records()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('system_admin'::public.app_role, 'editor'::public.app_role);
$$;

revoke all on function public.can_manage_records() from public;
grant execute on function public.can_manage_records() to authenticated;

create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_system_admin()
     and (
       new.role is distinct from old.role
       or new.status is distinct from old.status
     ) then
    raise exception 'Only system administrators can change profile roles or account status';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_authorization_fields on public.profiles;
create trigger profiles_protect_authorization_fields
before update on public.profiles
for each row
execute function public.protect_profile_authorization_fields();

drop policy if exists "System admins can view all profiles" on public.profiles;
create policy "System admins can view all profiles"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.is_system_admin()
);

drop policy if exists "System admins can update all profiles" on public.profiles;
create policy "System admins can update all profiles"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.is_system_admin()
)
with check (
  auth.uid() = id
  or public.is_system_admin()
);

drop policy if exists "Authenticated users can manage vehicles" on public.vehicles;
create policy "Editors and system admins can insert vehicles"
on public.vehicles
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage vehicles" on public.vehicles;
drop policy if exists "Editors and system admins can update vehicles" on public.vehicles;
create policy "Editors and system admins can update vehicles"
on public.vehicles
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Authenticated users can manage drivers" on public.drivers;
create policy "Editors and system admins can insert drivers"
on public.drivers
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage drivers" on public.drivers;
drop policy if exists "Editors and system admins can update drivers" on public.drivers;
create policy "Editors and system admins can update drivers"
on public.drivers
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Authenticated users can manage assignments" on public.assignments;
create policy "Editors and system admins can insert assignments"
on public.assignments
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage assignments" on public.assignments;
drop policy if exists "Editors and system admins can update assignments" on public.assignments;
create policy "Editors and system admins can update assignments"
on public.assignments
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Authenticated users can manage fuel logs" on public.fuel_logs;
create policy "Editors and system admins can insert fuel logs"
on public.fuel_logs
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage fuel logs" on public.fuel_logs;
drop policy if exists "Editors and system admins can update fuel logs" on public.fuel_logs;
create policy "Editors and system admins can update fuel logs"
on public.fuel_logs
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Authenticated users can manage maintenance" on public.maintenance;
create policy "Editors and system admins can insert maintenance"
on public.maintenance
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage maintenance" on public.maintenance;
drop policy if exists "Editors and system admins can update maintenance" on public.maintenance;
create policy "Editors and system admins can update maintenance"
on public.maintenance
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Authenticated users can manage incidents" on public.incidents;
create policy "Editors and system admins can insert incidents"
on public.incidents
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage incidents" on public.incidents;
drop policy if exists "Editors and system admins can update incidents" on public.incidents;
create policy "Editors and system admins can update incidents"
on public.incidents
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Authenticated users can manage trips" on public.trips;
create policy "Editors and system admins can insert trips"
on public.trips
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage trips" on public.trips;
drop policy if exists "Editors and system admins can update trips" on public.trips;
create policy "Editors and system admins can update trips"
on public.trips
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Authenticated users can manage documents" on public.documents;
create policy "Editors and system admins can insert documents"
on public.documents
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage documents" on public.documents;
drop policy if exists "Editors and system admins can update documents" on public.documents;
create policy "Editors and system admins can update documents"
on public.documents
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Authenticated users can manage notifications" on public.notifications;
create policy "Editors and system admins can insert notifications"
on public.notifications
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage notifications" on public.notifications;
drop policy if exists "Editors and system admins can update notifications" on public.notifications;
create policy "Editors and system admins can update notifications"
on public.notifications
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Authenticated users can manage vehicle odometer logs" on public.vehicle_odometer_logs;
create policy "Editors and system admins can insert vehicle odometer logs"
on public.vehicle_odometer_logs
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can manage vehicle odometer logs" on public.vehicle_odometer_logs;
drop policy if exists "Editors and system admins can update vehicle odometer logs" on public.vehicle_odometer_logs;
create policy "Editors and system admins can update vehicle odometer logs"
on public.vehicle_odometer_logs
for update
to authenticated
using (public.can_manage_records())
with check (public.can_manage_records());

drop policy if exists "Editors and system admins can insert document types" on public.document_types;
create policy "Editors and system admins can insert document types"
on public.document_types
for insert
to authenticated
with check (public.can_manage_records());

drop policy if exists "Authenticated users can insert import batches" on public.import_batches;
drop policy if exists "Editors and system admins can insert import batches" on public.import_batches;
create policy "Editors and system admins can insert import batches"
on public.import_batches
for insert
to authenticated
with check (public.can_manage_records());
