# Supabase Setup

This project is being migrated from browser `localStorage` to a real Supabase backend.

## 1. Create the Supabase project

1. Go to the Supabase dashboard and create a new project.
2. Wait for the database to finish provisioning.
3. Open `Project Settings -> API`.
4. Copy:
   - `Project URL`
   - `anon public key`

## 2. Add your environment variables

1. Copy [.env.example](/Users/milaxs/Desktop/my-react-app%20codex/.env.example) to `.env.local`.
2. Fill in:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Restart the Vite dev server after saving the file.

## 3. Create the database schema

1. Open the Supabase SQL Editor.
2. Paste the contents of [schema.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/schema.sql).
3. Run it.

What this creates:
- `profiles` table for app users and roles
- fleet tables for vehicles, drivers, incidents, trips, documents, fuel logs, maintenance, assignments, notifications
- `updated_at` triggers
- baseline Row Level Security policies

## 4. Create your first user

1. In Supabase, open `Authentication -> Users`.
2. Create a user with email and password.
3. Copy the user UUID.
4. Insert a matching row into `public.profiles`, for example:

```sql
insert into public.profiles (id, email, name, role, department)
values (
  'PASTE_AUTH_USER_UUID_HERE',
  'you@example.com',
  'Your Name',
  'system_admin',
  'Administration'
);
```

## 5. What the app is doing right now

- If Supabase is configured, auth will use Supabase.
- If Supabase is not configured yet, auth will not work.
- App data should now be created through the real UI or your own SQL, not seeded with prototype records.

## 5a. Enable vehicle and driver writes

If listing works but adding a vehicle or driver says it worked and nothing appears after refresh, you are missing write policies.

Run [policies-vehicles-drivers.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/policies-vehicles-drivers.sql) in the Supabase SQL Editor.

This grants authenticated users permission to:
- insert vehicles
- update vehicles
- insert drivers
- update drivers

## 5b. Enable assignment writes

If the "Change Driver" flow should persist to Supabase, run:

[policies-assignments.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/policies-assignments.sql)

That allows authenticated users to insert and update assignment records.

## 5c. Enable incident writes

To let authenticated users create and update incidents from the app, run:

[policies-incidents.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/policies-incidents.sql)

## 5d. Enable document uploads

Documents need both:
- a database policy update
- a Supabase Storage bucket

Run these two files in `SQL Editor`:

1. [documents-file-path-column.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/documents-file-path-column.sql)
2. [storage-documents.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/storage-documents.sql)

What they do:
- add a `file_path` column to `public.documents`
- allow authenticated users to manage document rows
- create a public `documents` storage bucket
- allow authenticated users to upload, view, and update files in that bucket

## 5e. Enable trip writes

To let authenticated users log trips from the app, run:

[policies-trips.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/policies-trips.sql)

## 5f. Enable maintenance writes

To let authenticated users schedule maintenance and update maintenance status from the app, run:

[policies-maintenance.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/policies-maintenance.sql)

## 5g. Enable fuel log writes

To let authenticated users log fuel purchases from the app, run:

[policies-fuel-logs.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/policies-fuel-logs.sql)

## 5h. Enable notification writes

To let authenticated users mark notifications as read from the app, run:

[policies-notifications.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/policies-notifications.sql)

## 5i. Enable profile settings persistence

To let user settings save to Supabase profiles, run:

[profile-settings-column.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/profile-settings-column.sql)

## 5j. Enable odometer tracking

To add current odometer values and odometer history tracking, run:

1. [vehicle-odometer-schema.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/vehicle-odometer-schema.sql)
2. [policies-vehicle-odometer.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/policies-vehicle-odometer.sql)

## 5k. Enable maintenance-by-mileage

To track the next service due mileage for vehicles, run:

[vehicle-service-mileage.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/vehicle-service-mileage.sql)

## 6. Recommended migration order

1. Auth and profiles
2. Vehicles and drivers
3. Incidents
4. Documents
5. Trips and maintenance
6. Fuel logs
7. Notifications
8. Remove local storage data layer completely

## 7. Important note about RBAC

Frontend hiding is not enough.

You will eventually want:
- route guards in React
- role checks in the UI
- stricter Supabase RLS policies per role

The current SQL sets a safe starting point for authenticated access, not the final RBAC policy set.
