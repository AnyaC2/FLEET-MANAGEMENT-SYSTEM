alter table public.vehicles
add column if not exists next_service_due_odometer integer;

update public.vehicles
set next_service_due_odometer = case id
  when 'veh-1' then 20000
  when 'veh-2' then 50000
  when 'veh-3' then 12000
  when 'veh-4' then 10000
  else next_service_due_odometer
end
where id in ('veh-1', 'veh-2', 'veh-3', 'veh-4');
