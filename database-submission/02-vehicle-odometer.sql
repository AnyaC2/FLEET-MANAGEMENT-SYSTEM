alter table public.vehicles
add column if not exists current_odometer integer;

create table if not exists public.vehicle_odometer_logs (
  id text primary key,
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  reading integer not null,
  source text not null,
  notes text,
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.vehicle_odometer_logs enable row level security;

drop policy if exists "Authenticated users can read vehicle odometer logs" on public.vehicle_odometer_logs;
create policy "Authenticated users can read vehicle odometer logs"
on public.vehicle_odometer_logs
for select
to authenticated
using (true);
