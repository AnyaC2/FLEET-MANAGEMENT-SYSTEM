begin;

-- Reset operational tables while keeping auth/profiles/settings intact.
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

-- Shared document type catalog for the redesigned documents workflow.
insert into public.document_types (name, applies_to)
values
  ('Registration', 'vehicle'),
  ('Insurance', 'vehicle'),
  ('Road Worthiness Certificate', 'vehicle'),
  ('Proof of Ownership Certificate', 'vehicle'),
  ('Central Motor Registry (CMR)', 'vehicle'),
  ('Purchase Invoice', 'vehicle'),
  ('Customs Paper', 'vehicle'),
  ('Tinted Glass Permit', 'vehicle'),
  ('Hackney Permit', 'vehicle'),
  ('LASDRI Card', 'driver'),
  ('License', 'driver'),
  ('Medical Certificate', 'driver'),
  ('Training Certificate', 'driver'),
  ('Service Receipt', 'vehicle'),
  ('Other', 'both')
on conflict (name) do update
set applies_to = excluded.applies_to;

insert into public.vehicles (
  id,
  plate_number,
  vehicle_type,
  brand,
  model,
  year,
  vin,
  engine_number,
  purchase_date,
  purchase_cost,
  vendor,
  warranty_expiry,
  status,
  current_driver_id,
  current_odometer,
  next_service_due_odometer,
  created_at,
  updated_at
)
values
  ('veh-101', 'LSD-401-KT', 'SUV', 'Toyota', 'Prado', 2022, 'JTEBR3FJ90K112401', 'ENG-PRD-2401', '2022-06-12', 68500000, 'Toyota Nigeria', '2027-06-12', 'Active', 'drv-201', 48760, 52000, '2026-01-05T09:10:00Z', '2026-03-29T08:20:00Z'),
  ('veh-102', 'LSD-402-KT', 'Bus', 'Toyota', 'Hiace', 2021, 'JTFSX22P40K112402', 'ENG-HIA-2402', '2021-11-03', 43200000, 'Elizade Motors', '2026-11-03', 'Active', 'drv-202', 96340, 100000, '2026-01-08T10:00:00Z', '2026-03-30T07:30:00Z'),
  ('veh-103', 'LSD-403-KT', 'Pickup', 'Toyota', 'Hilux', 2023, 'AHTBA3CD209112403', 'ENG-HLX-2403', '2023-02-17', 51800000, 'Toyota Nigeria', '2028-02-17', 'Active', 'drv-203', 31880, 35000, '2026-01-12T08:00:00Z', '2026-03-31T06:15:00Z'),
  ('veh-104', 'LSD-404-KT', 'Sedan', 'Honda', 'Accord', 2022, '1HGCV1F34NA112404', 'ENG-ACD-2404', '2022-08-25', 29000000, 'Honda Place', '2026-08-25', 'Idle', null, 22140, 26000, '2026-01-14T11:30:00Z', '2026-03-28T16:25:00Z'),
  ('veh-105', 'LSD-405-KT', 'Van', 'Ford', 'Transit', 2020, 'WF0EXXTTRELS12405', 'ENG-TRN-2405', '2020-09-14', 37400000, 'Coscharis Motors', '2025-09-14', 'Under Maintenance', 'drv-204', 128540, 128000, '2026-01-20T09:45:00Z', '2026-03-30T10:10:00Z'),
  ('veh-106', 'LSD-406-KT', 'Truck', 'Mitsubishi', 'Canter', 2019, 'MMFEC61P0KH12406', 'ENG-CAN-2406', '2019-04-09', 46100000, 'CFAO Mobility', '2024-04-09', 'Active', 'drv-205', 176220, 180000, '2026-01-25T08:20:00Z', '2026-03-31T05:55:00Z'),
  ('veh-107', 'LSD-407-KT', 'SUV', 'Hyundai', 'Santa Fe', 2021, 'KMHS381EMMU12407', 'ENG-SFE-2407', '2021-06-11', 33150000, 'Stallion Hyundai', '2026-06-11', 'Active', 'drv-206', 74420, 78000, '2026-01-28T12:10:00Z', '2026-03-30T14:00:00Z'),
  ('veh-108', 'LSD-408-KT', 'Bus', 'Mercedes-Benz', 'Sprinter', 2020, 'WDB9076331P12408', 'ENG-SPR-2408', '2020-12-21', 58700000, 'Weststar Associates', '2025-12-21', 'Under Maintenance', 'drv-207', 143880, 143500, '2026-02-02T07:50:00Z', '2026-03-29T11:15:00Z'),
  ('veh-109', 'LSD-409-KT', 'Pickup', 'Isuzu', 'D-Max', 2023, 'MPATFS87JPT12409', 'ENG-DMX-2409', '2023-05-06', 40200000, 'Kewalram Chanrai', '2028-05-06', 'Active', 'drv-208', 26890, 30000, '2026-02-05T13:25:00Z', '2026-03-31T09:20:00Z'),
  ('veh-110', 'LSD-410-KT', 'Sedan', 'Toyota', 'Camry', 2021, '4T1BF1FK8MU12410', 'ENG-CAM-2410', '2021-10-02', 24800000, 'Toyota Nigeria', '2026-10-02', 'Active', 'drv-209', 68510, 72000, '2026-02-09T10:40:00Z', '2026-03-30T18:05:00Z'),
  ('veh-111', 'LSD-411-KT', 'Van', 'Peugeot', 'Expert', 2019, 'VF3VFAHKHKZ12411', 'ENG-PEX-2411', '2019-08-16', 28750000, 'Elizade Autoland', '2024-08-16', 'Idle', null, 119630, 123000, '2026-02-12T09:35:00Z', '2026-03-27T13:45:00Z'),
  ('veh-112', 'LSD-412-KT', 'SUV', 'Lexus', 'RX 350', 2018, 'JTJHZKFA6J212412', 'ENG-LRX-2412', '2018-03-12', 35600000, 'Lexus Lagos', '2023-03-12', 'Decommissioned', null, 204420, 204000, '2026-02-15T14:20:00Z', '2026-03-20T12:00:00Z');

insert into public.drivers (
  id,
  full_name,
  phone_number,
  email,
  license_number,
  license_expiry,
  date_of_birth,
  hire_date,
  address,
  status,
  created_at,
  updated_at
)
values
  ('drv-201', 'Tunde Adebayo', '+2348035012401', 'tunde.adebayo@lfzdcfleet.test', 'LAG-DL-230401', '2027-07-14', '1987-04-15', '2021-01-11', 'Lekki Phase 1, Lagos', 'Active', '2026-01-05T09:30:00Z', '2026-03-28T07:10:00Z'),
  ('drv-202', 'Kehinde Bello', '+2348035012402', 'kehinde.bello@lfzdcfleet.test', 'LAG-DL-230402', '2026-12-01', '1985-09-03', '2020-11-05', 'Ajah, Lagos', 'Active', '2026-01-06T08:30:00Z', '2026-03-26T09:20:00Z'),
  ('drv-203', 'Musa Ibrahim', '+2348035012403', 'musa.ibrahim@lfzdcfleet.test', 'KAD-DL-230403', '2027-10-19', '1990-01-18', '2022-03-19', 'Chevron Drive, Lagos', 'Active', '2026-01-08T10:30:00Z', '2026-03-30T06:40:00Z'),
  ('drv-204', 'Emeka Okafor', '+2348035012404', 'emeka.okafor@lfzdcfleet.test', 'ANA-DL-230404', '2026-08-07', '1983-02-12', '2019-08-01', 'Sangotedo, Lagos', 'Active', '2026-01-09T11:15:00Z', '2026-03-29T15:10:00Z'),
  ('drv-205', 'Abdul Kareem Yusuf', '+2348035012405', 'abdul.yusuf@lfzdcfleet.test', 'LAG-DL-230405', '2027-02-28', '1988-11-24', '2020-02-10', 'Lakowe, Lagos', 'Active', '2026-01-12T07:20:00Z', '2026-03-31T05:30:00Z'),
  ('drv-206', 'Chinwe Nnaji', '+2348035012406', 'chinwe.nnaji@lfzdcfleet.test', 'ENU-DL-230406', '2026-11-11', '1992-07-09', '2023-01-09', 'Ikota, Lagos', 'Active', '2026-01-13T08:00:00Z', '2026-03-25T11:50:00Z'),
  ('drv-207', 'Sodiq Lawal', '+2348035012407', 'sodiq.lawal@lfzdcfleet.test', 'LAG-DL-230407', '2027-03-17', '1986-06-22', '2021-09-14', 'Epe, Lagos', 'Active', '2026-01-14T09:45:00Z', '2026-03-30T08:15:00Z'),
  ('drv-208', 'Blessing Ojo', '+2348035012408', 'blessing.ojo@lfzdcfleet.test', 'LAG-DL-230408', '2026-09-23', '1991-12-05', '2023-06-04', 'Abijo GRA, Lagos', 'Active', '2026-01-15T10:15:00Z', '2026-03-30T16:35:00Z'),
  ('drv-209', 'Femi Adewale', '+2348035012409', 'femi.adewale@lfzdcfleet.test', 'LAG-DL-230409', '2027-05-06', '1984-08-18', '2018-07-23', 'Victoria Island, Lagos', 'Active', '2026-01-18T07:45:00Z', '2026-03-30T18:15:00Z'),
  ('drv-210', 'Amina Sule', '+2348035012410', 'amina.sule@lfzdcfleet.test', 'ABJ-DL-230410', '2026-07-02', '1993-10-11', '2024-01-12', 'Awoyaya, Lagos', 'Active', '2026-01-19T12:00:00Z', '2026-03-27T10:25:00Z'),
  ('drv-211', 'Segun Alabi', '+2348035012411', 'segun.alabi@lfzdcfleet.test', 'LAG-DL-230411', '2026-05-15', '1981-03-29', '2017-05-09', 'Ibeju-Lekki, Lagos', 'Active', '2026-01-20T09:00:00Z', '2026-03-22T08:10:00Z'),
  ('drv-212', 'Ngozi Eze', '+2348035012412', 'ngozi.eze@lfzdcfleet.test', 'RIV-DL-230412', '2027-01-09', '1994-01-27', '2022-11-01', 'Jakande, Lagos', 'Active', '2026-01-22T13:15:00Z', '2026-03-28T12:20:00Z'),
  ('drv-213', 'Yusuf Danjuma', '+2348035012413', 'yusuf.danjuma@lfzdcfleet.test', 'KAN-DL-230413', '2026-04-19', '1980-05-14', '2016-06-15', 'Bogije, Lagos', 'Inactive', '2026-01-24T10:45:00Z', '2026-03-10T09:30:00Z'),
  ('drv-214', 'Rachael Peters', '+2348035012414', 'rachael.peters@lfzdcfleet.test', 'LAG-DL-230414', '2026-10-30', '1995-02-08', '2024-04-08', 'Lekki Gardens, Lagos', 'Inactive', '2026-01-25T14:40:00Z', '2026-03-14T14:40:00Z');

insert into public.assignments (
  id,
  vehicle_id,
  driver_id,
  start_date,
  end_date,
  created_at
)
values
  ('asg-301', 'veh-101', 'drv-201', '2026-01-05', null, '2026-01-05T09:40:00Z'),
  ('asg-302', 'veh-102', 'drv-202', '2026-01-06', null, '2026-01-06T08:40:00Z'),
  ('asg-303', 'veh-103', 'drv-203', '2026-01-10', null, '2026-01-10T10:10:00Z'),
  ('asg-304', 'veh-105', 'drv-204', '2026-01-12', null, '2026-01-12T11:25:00Z'),
  ('asg-305', 'veh-106', 'drv-205', '2026-01-13', null, '2026-01-13T07:55:00Z'),
  ('asg-306', 'veh-107', 'drv-206', '2026-01-15', null, '2026-01-15T08:30:00Z'),
  ('asg-307', 'veh-108', 'drv-207', '2026-01-18', null, '2026-01-18T09:55:00Z'),
  ('asg-308', 'veh-109', 'drv-208', '2026-01-20', null, '2026-01-20T10:20:00Z'),
  ('asg-309', 'veh-110', 'drv-209', '2026-01-22', null, '2026-01-22T07:15:00Z'),
  ('asg-310', 'veh-104', 'drv-210', '2026-01-23', '2026-03-05', '2026-01-23T12:40:00Z'),
  ('asg-311', 'veh-111', 'drv-211', '2026-02-02', '2026-03-12', '2026-02-02T09:10:00Z'),
  ('asg-312', 'veh-104', 'drv-212', '2026-03-10', null, '2026-03-10T08:30:00Z');

insert into public.vehicle_odometer_logs (
  id,
  vehicle_id,
  reading,
  source,
  notes,
  recorded_at,
  created_at
)
values
  ('odo-401', 'veh-101', 46210, 'manual', 'Opening Q1 fleet reading', '2026-01-03T08:00:00Z', '2026-01-03T08:00:00Z'),
  ('odo-402', 'veh-101', 48760, 'fuel', 'Updated during end-of-month fuel reconciliation', '2026-03-29T08:10:00Z', '2026-03-29T08:10:00Z'),
  ('odo-403', 'veh-102', 91840, 'manual', 'Opening Q1 fleet reading', '2026-01-04T09:00:00Z', '2026-01-04T09:00:00Z'),
  ('odo-404', 'veh-102', 96340, 'fuel', 'Updated during diesel purchase at Eleko', '2026-03-30T07:20:00Z', '2026-03-30T07:20:00Z'),
  ('odo-405', 'veh-103', 28120, 'manual', 'Opening reading', '2026-01-05T07:30:00Z', '2026-01-05T07:30:00Z'),
  ('odo-406', 'veh-103', 31880, 'trip', 'Procurement shuttle routes logged', '2026-03-31T06:00:00Z', '2026-03-31T06:00:00Z'),
  ('odo-407', 'veh-104', 19880, 'manual', 'Opening reading', '2026-01-07T09:20:00Z', '2026-01-07T09:20:00Z'),
  ('odo-408', 'veh-104', 22140, 'manual', 'Admin pool car reassignment update', '2026-03-28T16:20:00Z', '2026-03-28T16:20:00Z'),
  ('odo-409', 'veh-105', 125110, 'manual', 'Opening reading', '2026-01-10T10:00:00Z', '2026-01-10T10:00:00Z'),
  ('odo-410', 'veh-105', 128540, 'maintenance', 'Brake overhaul intake reading', '2026-03-30T10:00:00Z', '2026-03-30T10:00:00Z'),
  ('odo-411', 'veh-106', 169800, 'manual', 'Opening reading', '2026-01-11T08:15:00Z', '2026-01-11T08:15:00Z'),
  ('odo-412', 'veh-106', 176220, 'fuel', 'Long-haul logistics run fuel update', '2026-03-31T05:45:00Z', '2026-03-31T05:45:00Z'),
  ('odo-413', 'veh-107', 70210, 'manual', 'Opening reading', '2026-01-12T11:00:00Z', '2026-01-12T11:00:00Z'),
  ('odo-414', 'veh-107', 74420, 'trip', 'Operations escort movement update', '2026-03-30T13:55:00Z', '2026-03-30T13:55:00Z'),
  ('odo-415', 'veh-108', 140020, 'manual', 'Opening reading', '2026-01-14T07:10:00Z', '2026-01-14T07:10:00Z'),
  ('odo-416', 'veh-108', 143880, 'maintenance', 'Transmission inspection intake', '2026-03-29T11:05:00Z', '2026-03-29T11:05:00Z'),
  ('odo-417', 'veh-109', 23100, 'manual', 'Opening reading', '2026-01-15T13:00:00Z', '2026-01-15T13:00:00Z'),
  ('odo-418', 'veh-109', 26890, 'fuel', 'Site supervision round fuel update', '2026-03-31T09:10:00Z', '2026-03-31T09:10:00Z'),
  ('odo-419', 'veh-110', 65220, 'manual', 'Opening reading', '2026-01-18T09:00:00Z', '2026-01-18T09:00:00Z'),
  ('odo-420', 'veh-110', 68510, 'trip', 'Executive shuttle mileage update', '2026-03-30T18:00:00Z', '2026-03-30T18:00:00Z'),
  ('odo-421', 'veh-111', 116400, 'manual', 'Opening reading', '2026-01-20T10:10:00Z', '2026-01-20T10:10:00Z'),
  ('odo-422', 'veh-111', 119630, 'manual', 'Workshop pool movement update', '2026-03-27T13:40:00Z', '2026-03-27T13:40:00Z'),
  ('odo-423', 'veh-112', 203200, 'manual', 'Closing reading before decommission review', '2026-01-21T08:20:00Z', '2026-01-21T08:20:00Z'),
  ('odo-424', 'veh-112', 204420, 'maintenance', 'Decommission inspection reading', '2026-03-20T11:50:00Z', '2026-03-20T11:50:00Z');

insert into public.fuel_logs (
  id,
  vehicle_id,
  date,
  liters,
  cost,
  odometer,
  station,
  created_at
)
values
  ('fuel-501', 'veh-101', '2026-03-02', 72.50, 71340, 47210, 'NIPCO Lekki-Epe', '2026-03-02T18:10:00Z'),
  ('fuel-502', 'veh-101', '2026-03-18', 68.20, 67105, 48120, 'Mobil Chevron', '2026-03-18T19:00:00Z'),
  ('fuel-503', 'veh-101', '2026-03-29', 55.10, 54274, 48760, 'TotalEnergies Ajah', '2026-03-29T08:12:00Z'),
  ('fuel-504', 'veh-102', '2026-03-04', 110.00, 101200, 94200, 'Rainoil Eleko', '2026-03-04T17:20:00Z'),
  ('fuel-505', 'veh-102', '2026-03-15', 95.40, 87768, 95110, 'NIPCO Epe', '2026-03-15T16:45:00Z'),
  ('fuel-506', 'veh-102', '2026-03-30', 103.60, 95312, 96340, 'Matrix Sangotedo', '2026-03-30T07:21:00Z'),
  ('fuel-507', 'veh-103', '2026-03-06', 64.00, 61120, 29620, 'Mobil VGC', '2026-03-06T18:30:00Z'),
  ('fuel-508', 'veh-103', '2026-03-21', 58.70, 56059, 30940, 'Conoil Ajah', '2026-03-21T19:20:00Z'),
  ('fuel-509', 'veh-104', '2026-03-09', 42.00, 41160, 21480, 'TotalEnergies Lekki', '2026-03-09T15:40:00Z'),
  ('fuel-510', 'veh-104', '2026-03-26', 37.40, 36652, 22140, 'Mobil Ikota', '2026-03-26T14:50:00Z'),
  ('fuel-511', 'veh-105', '2026-03-01', 82.30, 79008, 126200, 'Rainoil Ibeju', '2026-03-01T16:10:00Z'),
  ('fuel-512', 'veh-105', '2026-03-13', 76.90, 73824, 127430, 'NIPCO Awoyaya', '2026-03-13T17:00:00Z'),
  ('fuel-513', 'veh-106', '2026-03-03', 145.00, 128760, 171920, 'AA Rano Epe', '2026-03-03T20:10:00Z'),
  ('fuel-514', 'veh-106', '2026-03-16', 138.40, 122892, 174330, 'Mobil Eleko', '2026-03-16T21:00:00Z'),
  ('fuel-515', 'veh-106', '2026-03-31', 111.70, 99241, 176220, 'NIPCO Lekki Free Zone', '2026-03-31T05:46:00Z'),
  ('fuel-516', 'veh-107', '2026-03-05', 59.50, 57715, 72380, 'Conoil Ajah', '2026-03-05T15:15:00Z'),
  ('fuel-517', 'veh-107', '2026-03-25', 52.80, 51216, 74420, 'Mobil Lekki Phase 1', '2026-03-25T18:05:00Z'),
  ('fuel-518', 'veh-108', '2026-03-08', 102.60, 94596, 141280, 'Rainoil Sangotedo', '2026-03-08T17:35:00Z'),
  ('fuel-519', 'veh-108', '2026-03-23', 94.90, 87598, 143100, 'NIPCO Ajah', '2026-03-23T16:10:00Z'),
  ('fuel-520', 'veh-109', '2026-03-11', 61.20, 58140, 24820, 'Mobil Abijo', '2026-03-11T14:30:00Z'),
  ('fuel-521', 'veh-109', '2026-03-31', 49.10, 46645, 26890, 'MRS Lekki Free Zone', '2026-03-31T09:12:00Z'),
  ('fuel-522', 'veh-110', '2026-03-10', 47.00, 44885, 66920, 'TotalEnergies VI', '2026-03-10T19:00:00Z'),
  ('fuel-523', 'veh-110', '2026-03-24', 43.60, 41638, 68510, 'Mobil Lekki Phase 1', '2026-03-24T20:20:00Z'),
  ('fuel-524', 'veh-111', '2026-03-12', 65.00, 61750, 118420, 'Conoil Awoyaya', '2026-03-12T13:40:00Z');

insert into public.maintenance (
  id,
  vehicle_id,
  service_type,
  status,
  scheduled_date,
  completed_date,
  cost,
  service_provider,
  description,
  created_at,
  updated_at
)
values
  ('mnt-601', 'veh-101', 'Oil Change', 'Completed', '2026-02-12', '2026-02-12', 68000, 'Toyota Service Center', 'Routine 10,000 km service completed with filter replacement.', '2026-02-05T09:10:00Z', '2026-02-12T16:10:00Z'),
  ('mnt-602', 'veh-102', 'Brake Service', 'Scheduled', '2026-04-05', null, 145000, 'Elizade Motors', 'Front brake pads and disc skimming planned before Easter staff shuttle operations.', '2026-03-28T08:20:00Z', '2026-03-28T08:20:00Z'),
  ('mnt-603', 'veh-103', 'General Service', 'Scheduled', '2026-04-11', null, 92000, 'Toyota Service Center', 'Quarterly preventive service and wheel alignment.', '2026-03-30T07:10:00Z', '2026-03-30T07:10:00Z'),
  ('mnt-604', 'veh-105', 'Brake Service', 'In Progress', '2026-03-30', null, 285000, 'Fixit Auto Hub', 'Rear hub assembly, brake shoe replacement and hydraulic line inspection.', '2026-03-27T10:30:00Z', '2026-03-30T10:05:00Z'),
  ('mnt-605', 'veh-106', 'Tire Replacement', 'Scheduled', '2026-04-14', null, 420000, 'Lanre Shittu Tyres', 'Replace two rear tires before long-distance haul to Free Trade Zone annex.', '2026-03-29T11:15:00Z', '2026-03-29T11:15:00Z'),
  ('mnt-606', 'veh-107', 'Electrical', 'Completed', '2026-03-01', '2026-03-02', 118000, 'Hyundai Service Hub', 'Battery terminal repair and alternator charging test.', '2026-02-25T08:10:00Z', '2026-03-02T14:35:00Z'),
  ('mnt-607', 'veh-108', 'Transmission', 'In Progress', '2026-03-29', null, 540000, 'Weststar Associates', 'Investigating delayed gear engagement and oil seal leak.', '2026-03-26T09:00:00Z', '2026-03-29T11:10:00Z'),
  ('mnt-608', 'veh-109', 'Oil Change', 'Completed', '2026-03-17', '2026-03-17', 59000, 'QuickLane Lekki', 'Routine oil and filter service after site supervision runs.', '2026-03-15T12:15:00Z', '2026-03-17T13:20:00Z'),
  ('mnt-609', 'veh-110', 'General Service', 'Completed', '2026-03-07', '2026-03-07', 83000, 'Toyota Service Center', 'General servicing, AC gas refill and wheel balancing.', '2026-03-03T09:40:00Z', '2026-03-07T15:00:00Z'),
  ('mnt-610', 'veh-111', 'Body Work', 'Scheduled', '2026-04-18', null, 160000, 'Automedics Ltd', 'Minor body touch-up and bumper repaint before redeployment.', '2026-03-31T08:00:00Z', '2026-03-31T08:00:00Z'),
  ('mnt-611', 'veh-112', 'General Service', 'Completed', '2026-03-20', '2026-03-20', 97000, 'Lexus Lagos', 'Final service and inspection before decommissioning paperwork.', '2026-03-18T10:45:00Z', '2026-03-20T12:05:00Z'),
  ('mnt-612', 'veh-104', 'Brake Service', 'Completed', '2026-02-22', '2026-02-22', 71000, 'Honda Place', 'Front brake pad replacement and fluid top-up.', '2026-02-18T08:10:00Z', '2026-02-22T14:20:00Z'),
  ('mnt-613', 'veh-106', 'Engine Repair', 'Overdue', '2026-03-26', null, 315000, 'CFAO Mobility', 'Intermittent check-engine light and injector cleaning pending parts.', '2026-03-21T09:35:00Z', '2026-03-31T06:00:00Z'),
  ('mnt-614', 'veh-101', 'Tire Replacement', 'Scheduled', '2026-04-22', null, 360000, 'Michelin Service Center', 'Replace full set of tires before rainy season.', '2026-03-30T15:10:00Z', '2026-03-30T15:10:00Z');

insert into public.incidents (
  id,
  vehicle_id,
  driver_id,
  title,
  date,
  description,
  severity,
  status,
  location,
  repair_cost,
  final_repair_cost,
  attachments,
  created_at,
  updated_at
)
values
  ('inc-701', 'veh-101', 'drv-201', 'Rear bumper dent', '2026-02-09', 'Vehicle reversed into a short steel bollard while dropping guests at the admin block.', 'Minor', 'Resolved', 'Lekki Free Zone Admin Block', 85000, 92500, '[]'::jsonb, '2026-02-09T17:10:00Z', '2026-02-14T09:30:00Z'),
  ('inc-702', 'veh-102', 'drv-202', 'Broken side mirror', '2026-03-06', 'Passenger side mirror clipped a temporary scaffold during staff shuttle pick-up.', 'Moderate', 'Resolved', 'Dangote Refinery Access Road', 120000, 118500, '[]'::jsonb, '2026-03-06T18:00:00Z', '2026-03-10T11:20:00Z'),
  ('inc-703', 'veh-105', 'drv-204', 'Brake noise complaint', '2026-03-27', 'Driver reported grinding noise and reduced braking response during route inspection.', 'Major', 'In Repair', 'Awoyaya Junction', 260000, null, '[]'::jsonb, '2026-03-27T09:45:00Z', '2026-03-30T10:00:00Z'),
  ('inc-704', 'veh-108', 'drv-207', 'Transmission slip alert', '2026-03-26', 'Vehicle struggled to engage second gear during inbound shuttle operations.', 'Major', 'In Repair', 'Eleko Junction', 490000, null, '[]'::jsonb, '2026-03-26T07:55:00Z', '2026-03-29T11:00:00Z'),
  ('inc-705', 'veh-103', 'drv-203', 'Front fender scratch', '2026-03-12', 'Minor scratch observed after site vendor escort movement.', 'Minor', 'Resolved', 'Free Zone Gate 2', 48000, 45000, '[]'::jsonb, '2026-03-12T14:15:00Z', '2026-03-15T13:10:00Z'),
  ('inc-706', 'veh-110', 'drv-209', 'Windshield crack', '2026-03-19', 'Hairline crack found on lower passenger windshield after highway trip.', 'Moderate', 'Under Review', 'Lekki-Ikoyi Link Bridge', 165000, null, '[]'::jsonb, '2026-03-19T20:30:00Z', '2026-03-19T20:30:00Z'),
  ('inc-707', 'veh-106', 'drv-205', 'Tail lamp damage', '2026-02-28', 'Loading activity caused tail lamp housing to crack at warehouse bay.', 'Minor', 'Resolved', 'LFZ Warehouse Bay 3', 38000, 41000, '[]'::jsonb, '2026-02-28T13:20:00Z', '2026-03-04T10:00:00Z'),
  ('inc-708', 'veh-104', 'drv-212', 'Bumper scuff mark', '2026-03-22', 'Superficial paint scuff during parking at corporate office.', 'Minor', 'Resolved', 'Victoria Island Head Office', 22000, 0, '[]'::jsonb, '2026-03-22T16:00:00Z', '2026-03-24T12:15:00Z'),
  ('inc-709', 'veh-109', 'drv-208', 'Loose underbody shield', '2026-03-30', 'Driver heard dragging noise and discovered loose shield clip after site round.', 'Minor', 'Under Review', 'Abijo Security Post', 18000, null, '[]'::jsonb, '2026-03-30T13:25:00Z', '2026-03-30T13:25:00Z'),
  ('inc-710', 'veh-111', null, 'Paint blister on rear door', '2026-03-18', 'Workshop inspection flagged corrosion blistering during idle vehicle check.', 'Moderate', 'Under Review', 'LFZ Internal Workshop', 76000, null, '[]'::jsonb, '2026-03-18T09:05:00Z', '2026-03-18T09:05:00Z');

insert into public.trips (
  id,
  vehicle_id,
  driver_id,
  date,
  start_location,
  destination,
  distance,
  purpose,
  created_at
)
values
  ('trip-801', 'veh-101', 'drv-201', '2026-03-03', 'Lekki Free Zone HQ', 'Victoria Island Head Office', 48.5, 'Executive movement', '2026-03-03T18:20:00Z'),
  ('trip-802', 'veh-101', 'drv-201', '2026-03-18', 'Victoria Island Head Office', 'Lekki Free Zone HQ', 48.2, 'Return trip', '2026-03-18T20:10:00Z'),
  ('trip-803', 'veh-102', 'drv-202', '2026-03-04', 'Awoyaya Staff Park', 'Lekki Free Zone Gate 1', 31.7, 'Morning staff shuttle', '2026-03-04T08:10:00Z'),
  ('trip-804', 'veh-102', 'drv-202', '2026-03-15', 'Lekki Free Zone Gate 1', 'Dangote Refinery Access Road', 17.4, 'Operations shuttle', '2026-03-15T10:50:00Z'),
  ('trip-805', 'veh-103', 'drv-203', '2026-03-06', 'LFZ Procurement Office', 'Onne Logistics Yard', 22.6, 'Vendor escort', '2026-03-06T16:10:00Z'),
  ('trip-806', 'veh-103', 'drv-203', '2026-03-21', 'LFZ Procurement Office', 'Chevron Drive', 18.1, 'Material pickup', '2026-03-21T18:40:00Z'),
  ('trip-807', 'veh-104', 'drv-212', '2026-03-11', 'Victoria Island Head Office', 'Lekki Phase 1', 12.7, 'Admin errands', '2026-03-11T12:20:00Z'),
  ('trip-808', 'veh-104', 'drv-212', '2026-03-26', 'Victoria Island Head Office', 'Ikota Shopping Complex', 16.3, 'Document submission', '2026-03-26T15:10:00Z'),
  ('trip-809', 'veh-105', 'drv-204', '2026-03-01', 'Awoyaya Depot', 'Lakowe Junction', 14.5, 'Route inspection', '2026-03-01T11:35:00Z'),
  ('trip-810', 'veh-105', 'drv-204', '2026-03-13', 'Awoyaya Depot', 'Eleko Junction', 19.8, 'Support delivery', '2026-03-13T16:35:00Z'),
  ('trip-811', 'veh-106', 'drv-205', '2026-03-03', 'LFZ Warehouse', 'Apapa Port Liaison Office', 64.2, 'Cargo transfer coordination', '2026-03-03T21:30:00Z'),
  ('trip-812', 'veh-106', 'drv-205', '2026-03-16', 'LFZ Warehouse', 'Epe Trailer Park', 41.6, 'Haulage follow-up', '2026-03-16T19:20:00Z'),
  ('trip-813', 'veh-107', 'drv-206', '2026-03-05', 'Ikota Base', 'Lekki Free Zone Clinic', 28.4, 'Medical support movement', '2026-03-05T14:50:00Z'),
  ('trip-814', 'veh-107', 'drv-206', '2026-03-25', 'Ikota Base', 'Lekki Conservation Road', 20.7, 'Official pick-up', '2026-03-25T17:25:00Z'),
  ('trip-815', 'veh-108', 'drv-207', '2026-03-08', 'Epe Motor Pool', 'Lekki Free Zone Gate 2', 34.1, 'Staff transfer', '2026-03-08T15:20:00Z'),
  ('trip-816', 'veh-108', 'drv-207', '2026-03-23', 'Epe Motor Pool', 'Eleko Beach Junction', 16.9, 'Maintenance follow-up', '2026-03-23T13:55:00Z'),
  ('trip-817', 'veh-109', 'drv-208', '2026-03-11', 'Abijo Security Post', 'LFZ Perimeter Road', 24.3, 'Security inspection', '2026-03-11T09:40:00Z'),
  ('trip-818', 'veh-109', 'drv-208', '2026-03-31', 'Abijo Security Post', 'Lakowe Emergency Unit', 15.2, 'Emergency response support', '2026-03-31T09:30:00Z'),
  ('trip-819', 'veh-110', 'drv-209', '2026-03-10', 'Victoria Island', 'Lekki Free Zone HQ', 47.8, 'Executive shuttle', '2026-03-10T18:10:00Z'),
  ('trip-820', 'veh-110', 'drv-209', '2026-03-24', 'Victoria Island', 'Lekki Phase 1', 10.9, 'Board meeting logistics', '2026-03-24T20:35:00Z');

insert into public.documents (
  id,
  title,
  document_type,
  vehicle_id,
  driver_id,
  file_url,
  file_path,
  file_name,
  file_size,
  expiry_date,
  uploaded_at,
  updated_at
)
values
  ('doc-901', 'Toyota Prado Insurance 2026', 'Insurance', 'veh-101', null, 'https://example.com/documents/veh-101-insurance-2026.pdf', 'documents/veh-101-insurance-2026.pdf', 'veh-101-insurance-2026.pdf', 248320, '2026-09-30', '2026-01-05T11:20:00Z', '2026-01-05T11:20:00Z'),
  ('doc-902', 'Hiace Road Worthiness 2026', 'Road Worthiness Certificate', 'veh-102', null, 'https://example.com/documents/veh-102-road-worthiness.pdf', 'documents/veh-102-road-worthiness.pdf', 'veh-102-road-worthiness.pdf', 197540, '2026-06-14', '2026-01-09T10:15:00Z', '2026-01-09T10:15:00Z'),
  ('doc-903', 'Hilux Proof of Ownership', 'Proof of Ownership Certificate', 'veh-103', null, 'https://example.com/documents/veh-103-ownership.pdf', 'documents/veh-103-ownership.pdf', 'veh-103-ownership.pdf', 164210, null, '2026-01-11T12:10:00Z', '2026-01-11T12:10:00Z'),
  ('doc-904', 'Accord Tinted Glass Permit', 'Tinted Glass Permit', 'veh-104', null, 'https://example.com/documents/veh-104-tinted-permit.pdf', 'documents/veh-104-tinted-permit.pdf', 'veh-104-tinted-permit.pdf', 142890, '2026-05-22', '2026-01-18T14:40:00Z', '2026-01-18T14:40:00Z'),
  ('doc-905', 'Transit CMR File', 'Central Motor Registry (CMR)', 'veh-105', null, 'https://example.com/documents/veh-105-cmr.pdf', 'documents/veh-105-cmr.pdf', 'veh-105-cmr.pdf', 211004, null, '2026-01-20T09:55:00Z', '2026-01-20T09:55:00Z'),
  ('doc-906', 'Canter Customs Papers', 'Customs Paper', 'veh-106', null, 'https://example.com/documents/veh-106-customs.pdf', 'documents/veh-106-customs.pdf', 'veh-106-customs.pdf', 286410, null, '2026-01-24T08:15:00Z', '2026-01-24T08:15:00Z'),
  ('doc-907', 'Santa Fe Hackney Permit', 'Hackney Permit', 'veh-107', null, 'https://example.com/documents/veh-107-hackney.pdf', 'documents/veh-107-hackney.pdf', 'veh-107-hackney.pdf', 120450, '2026-07-11', '2026-02-02T16:10:00Z', '2026-02-02T16:10:00Z'),
  ('doc-908', 'Sprinter Registration 2026', 'Registration', 'veh-108', null, 'https://example.com/documents/veh-108-registration.pdf', 'documents/veh-108-registration.pdf', 'veh-108-registration.pdf', 188640, '2026-04-28', '2026-02-04T11:50:00Z', '2026-02-04T11:50:00Z'),
  ('doc-909', 'Tunde Adebayo License Copy', 'License', null, 'drv-201', 'https://example.com/documents/drv-201-license.pdf', 'documents/drv-201-license.pdf', 'drv-201-license.pdf', 135880, '2027-07-14', '2026-01-06T10:00:00Z', '2026-01-06T10:00:00Z'),
  ('doc-910', 'Kehinde Bello LASDRI Card', 'LASDRI Card', null, 'drv-202', 'https://example.com/documents/drv-202-lasdri.pdf', 'documents/drv-202-lasdri.pdf', 'drv-202-lasdri.pdf', 98540, '2026-12-01', '2026-01-08T09:15:00Z', '2026-01-08T09:15:00Z'),
  ('doc-911', 'Chinwe Nnaji Medical Certificate', 'Medical Certificate', null, 'drv-206', 'https://example.com/documents/drv-206-medical.pdf', 'documents/drv-206-medical.pdf', 'drv-206-medical.pdf', 117740, '2026-06-30', '2026-02-12T12:45:00Z', '2026-02-12T12:45:00Z'),
  ('doc-912', 'Segun Alabi Training Certificate', 'Training Certificate', null, 'drv-211', 'https://example.com/documents/drv-211-training.pdf', 'documents/drv-211-training.pdf', 'drv-211-training.pdf', 126990, null, '2026-02-15T13:20:00Z', '2026-02-15T13:20:00Z');

insert into public.notifications (
  id,
  title,
  message,
  type,
  is_read,
  vehicle_id,
  driver_id,
  created_at
)
values
  ('ntf-1001', 'Maintenance Due Soon', 'Toyota Prado (LSD-401-KT) is due for service within the next maintenance cycle.', 'maintenance', false, 'veh-101', null, '2026-03-29T08:25:00Z'),
  ('ntf-1002', 'Maintenance Overdue', 'Mitsubishi Canter (LSD-406-KT) has an overdue engine repair follow-up.', 'maintenance', false, 'veh-106', null, '2026-03-31T06:05:00Z'),
  ('ntf-1003', 'Document Expiring Soon', 'Hiace road worthiness certificate expires on 14 Jun 2026.', 'general', false, 'veh-102', null, '2026-03-30T07:25:00Z'),
  ('ntf-1004', 'New Incident Reported', 'Brake noise complaint was reported for Ford Transit (LSD-405-KT).', 'incident', false, 'veh-105', 'drv-204', '2026-03-27T09:50:00Z'),
  ('ntf-1005', 'License Expiring Soon', 'Segun Alabi''s driver license expires on 15 May 2026.', 'license', false, null, 'drv-211', '2026-03-30T09:10:00Z'),
  ('ntf-1006', 'Fuel Spend Review', 'Toyota Hiace fuel spend crossed ₦280,000 this month.', 'fuel', true, 'veh-102', null, '2026-03-30T08:00:00Z'),
  ('ntf-1007', 'Trip Log Completed', 'Executive shuttle trip for Toyota Camry was logged successfully.', 'general', true, 'veh-110', 'drv-209', '2026-03-24T20:40:00Z'),
  ('ntf-1008', 'Maintenance Mileage Due Soon', 'Hyundai Santa Fe (LSD-407-KT) is due for service in 3,580 km.', 'maintenance', false, 'veh-107', null, '2026-03-30T14:05:00Z'),
  ('ntf-1009', 'Incident Under Review', 'Windshield crack incident for Toyota Camry is still awaiting workshop approval.', 'incident', false, 'veh-110', 'drv-209', '2026-03-30T18:10:00Z'),
  ('ntf-1010', 'Vehicle Decommissioned', 'Lexus RX 350 (LSD-412-KT) has been marked decommissioned and removed from operational lists.', 'general', true, 'veh-112', null, '2026-03-20T12:10:00Z'),
  ('ntf-1011', 'Document Uploaded', 'Customs paper for Mitsubishi Canter was uploaded to the system.', 'general', true, 'veh-106', null, '2026-01-24T08:20:00Z'),
  ('ntf-1012', 'Driver Marked Inactive', 'Yusuf Danjuma has been set to inactive and removed from assignment pools.', 'general', true, null, 'drv-213', '2026-03-10T09:40:00Z');

commit;
