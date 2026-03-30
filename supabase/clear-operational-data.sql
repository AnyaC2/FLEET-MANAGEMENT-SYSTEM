begin;

delete from public.notifications;
delete from public.documents;
delete from public.trips;
delete from public.incidents;
delete from public.maintenance;
delete from public.fuel_logs;
delete from public.assignments;
delete from public.vehicle_odometer_logs;
delete from public.drivers;
delete from public.vehicles;

commit;
