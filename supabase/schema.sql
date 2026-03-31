create extension if not exists "pgcrypto";

create type public.app_role as enum (
  'admin',
  'system_admin',
  'admin_officer',
  'fleet_manager',
  'operations_officer',
  'maintenance_officer',
  'viewer'
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role public.app_role not null default 'viewer',
  department text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.vehicles (
  id text primary key,
  plate_number text not null unique,
  vehicle_type text not null,
  brand text not null,
  model text not null,
  year integer not null,
  vin text,
  engine_number text,
  purchase_date date,
  purchase_cost numeric(12, 2),
  vendor text,
  warranty_expiry date,
  status text not null,
  current_driver_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.drivers (
  id text primary key,
  full_name text not null,
  phone_number text not null,
  email text,
  license_number text not null,
  license_expiry date not null,
  date_of_birth date,
  hire_date date,
  address text,
  status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assignments (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  driver_id text not null references public.drivers(id) on delete cascade,
  start_date date not null,
  end_date date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.fuel_logs (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  date date not null,
  liters numeric(10, 2) not null,
  cost numeric(12, 2) not null,
  odometer integer not null,
  station text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.maintenance (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  service_type text not null,
  status text not null,
  scheduled_date date not null,
  completed_date date,
  cost numeric(12, 2) not null,
  service_provider text,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.incidents (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  driver_id text references public.drivers(id) on delete set null,
  title text not null,
  date date not null,
  description text not null,
  severity text not null,
  status text not null,
  location text,
  repair_cost numeric(12, 2) not null default 0,
  final_repair_cost numeric(12, 2),
  attachments jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trips (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  driver_id text not null references public.drivers(id) on delete cascade,
  date date not null,
  start_location text not null,
  destination text not null,
  distance numeric(10, 2) not null,
  purpose text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.documents (
  id text primary key,
  title text not null,
  document_type text not null,
  vehicle_id text references public.vehicles(id) on delete cascade,
  driver_id text references public.drivers(id) on delete cascade,
  file_url text not null,
  file_name text not null,
  file_size bigint not null,
  expiry_date date,
  uploaded_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id text primary key,
  title text not null,
  message text not null,
  type text not null,
  is_read boolean not null default false,
  vehicle_id text references public.vehicles(id) on delete cascade,
  driver_id text references public.drivers(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row
execute function public.set_updated_at();

drop trigger if exists drivers_set_updated_at on public.drivers;
create trigger drivers_set_updated_at
before update on public.drivers
for each row
execute function public.set_updated_at();

drop trigger if exists maintenance_set_updated_at on public.maintenance;
create trigger maintenance_set_updated_at
before update on public.maintenance
for each row
execute function public.set_updated_at();

drop trigger if exists incidents_set_updated_at on public.incidents;
create trigger incidents_set_updated_at
before update on public.incidents
for each row
execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.assignments enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.maintenance enable row level security;
alter table public.incidents enable row level security;
alter table public.trips enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Authenticated users can read fleet data" on public.vehicles;
create policy "Authenticated users can read fleet data"
on public.vehicles
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read drivers" on public.drivers;
create policy "Authenticated users can read drivers"
on public.drivers
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read assignments" on public.assignments;
create policy "Authenticated users can read assignments"
on public.assignments
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read fuel logs" on public.fuel_logs;
create policy "Authenticated users can read fuel logs"
on public.fuel_logs
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read maintenance" on public.maintenance;
create policy "Authenticated users can read maintenance"
on public.maintenance
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read incidents" on public.incidents;
create policy "Authenticated users can read incidents"
on public.incidents
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read trips" on public.trips;
create policy "Authenticated users can read trips"
on public.trips
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read documents" on public.documents;
create policy "Authenticated users can read documents"
on public.documents
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read notifications" on public.notifications;
create policy "Authenticated users can read notifications"
on public.notifications
for select
to authenticated
using (true);
