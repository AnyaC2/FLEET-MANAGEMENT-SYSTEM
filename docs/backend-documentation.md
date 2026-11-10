# Backend Technical Documentation

Last updated: 2026-09-16

## 1. Purpose and Scope

The LFZDC Fleet Management System uses Supabase as its backend platform. There is no separate Express or Node.js API server. The React application communicates with Supabase Auth, PostgreSQL, Storage, and Edge Functions through the Supabase JavaScript client.

The backend is responsible for:

- user authentication and multi-factor authentication (MFA)
- role-based authorization
- operational fleet data
- document metadata and file storage
- import history
- in-app notifications and optional email delivery
- privileged user-administration operations

## 2. Architecture

```text
React application
  |-- Supabase Auth          sessions, password recovery, MFA
  |-- PostgREST              database reads and writes
  |-- Supabase Storage       uploaded fleet documents
  `-- Edge Functions         privileged user and email operations
          |
          `-- PostgreSQL     profiles, fleet records, audit data
```

Primary integration files:

| Area | Main implementation |
| --- | --- |
| Backend client | `src/lib/supabase.ts` |
| Authentication state | `src/context/AuthContext.tsx` |
| Fleet data access | `src/lib/fleet-data.ts` |
| Documents and Storage | `src/lib/documents-data.ts` |
| Import processing | `src/lib/data-import.ts` |
| Import audit history | `src/lib/import-history.ts` |
| User preferences | `src/lib/settings-data.ts` |
| Notification email invocation | `src/lib/email-notifications.ts` |
| Database definition | `supabase/schema.sql` and supporting SQL files |
| Privileged operations | `supabase/functions/` |

## 3. Runtime Configuration

The frontend reads two variables from `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The anonymous key is intended for browser use. Access is still controlled by authenticated sessions and PostgreSQL Row Level Security (RLS).

During local development, Vite proxies Supabase traffic through `/supabase-proxy`. This avoids local browser-origin problems while preserving the same Supabase API behavior. Production uses the configured Supabase URL directly.

The application includes a browser `localStorage` fallback for demonstrations without Supabase. When Supabase is configured, hosted PostgreSQL is the authoritative data source and old local fleet records are cleared at startup. Settings, document types, and import history retain limited local fallback behavior when a backend request is unavailable.

## 4. Authentication

Supabase Auth provides:

- email and password sign-in
- persistent and automatically refreshed sessions
- password-recovery links
- password and email updates
- TOTP authenticator enrollment and verification
- MFA unenrollment

`AuthContext` listens for Supabase authentication changes, loads the matching `public.profiles` row, and checks the session's authenticator assurance level. A user whose account requires AAL2 cannot enter protected application routes until the MFA challenge succeeds.

The profile row is the application's identity and authorization record. A valid Auth account without a corresponding profile cannot operate as a normal application user.

## 5. Roles and Authorization

The application uses three canonical roles:

| Role | Access |
| --- | --- |
| `system_admin` | All records plus user-account administration |
| `editor` | Read and create/update operational fleet records |
| `end_user` | Read operational data without record-management access |

Legacy roles are migrated and normalized by `supabase/rbac-policies.sql` and `src/lib/rbac.ts`.

Authorization is applied in three layers:

1. React route and control visibility for a clear user experience.
2. PostgreSQL RLS policies for enforceable data access.
3. Edge Function checks for service-role operations.

Frontend permission checks are not treated as a security boundary. Database policies and function authorization remain responsible for preventing unauthorized writes.

The `profiles_protect_authorization_fields` trigger prevents a signed-in user from changing their own role or account status. Only a system administrator may change those authorization fields. Import audit batches are also restricted to editors and system administrators.

## 6. Database Model

### 6.1 Core Tables

| Table | Purpose |
| --- | --- |
| `profiles` | Application identity, role, department, status, and settings |
| `vehicles` | Vehicle master data, status, driver, and service mileage |
| `drivers` | Driver identity, contact, licence, employment, and status data |
| `assignments` | Vehicle-to-driver assignment history |
| `fuel_logs` | Fuel volume, cost, station, date, and odometer readings |
| `maintenance` | Planned and completed maintenance activity |
| `incidents` | Incident details, severity, status, and repair costs |
| `trips` | Vehicle and driver journey records |
| `documents` | Uploaded file metadata and entity relationships |
| `document_types` | Configurable vehicle and driver document categories |
| `notifications` | In-app fleet alerts |
| `notification_email_deliveries` | Per-recipient email deduplication records |
| `vehicle_odometer_logs` | Vehicle mileage history and source records |
| `import_batches` | Workbook import audit summaries and row issues |

### 6.2 Main Relationships

- `profiles.id` references Supabase `auth.users.id` with cascade deletion.
- Vehicles can have many assignments, fuel logs, maintenance records, incidents, trips, documents, and odometer logs.
- Drivers can have many assignments, incidents, trips, and documents.
- Incident driver references are nullable and use `ON DELETE SET NULL`.
- Notification email deliveries link one notification to one recipient profile.
- Import batches optionally identify the profile that performed the import.

### 6.3 Timestamp Management

`public.set_updated_at()` updates modification timestamps for records that expose an `updated_at` column. The function is attached through PostgreSQL triggers defined in `supabase/schema.sql`.

## 7. Data Access and Business Rules

### 7.1 Fleet Records

`src/lib/fleet-data.ts` maps TypeScript models to PostgreSQL rows and centralizes operational queries. It supports:

- list and detail queries for vehicles and drivers
- assignment history and active assignments
- fuel, trip, maintenance, incident, notification, and odometer records
- record creation and supported status updates
- automatic vehicle maintenance-state synchronization
- vehicle odometer updates from trips, fuel entries, maintenance, and direct readings

Vehicle and driver deletion are intentionally disabled in the application. Lifecycle changes use status updates so historical records remain available.

### 7.2 Driver Assignments

Assigning a driver updates both sides of the operational relationship:

1. any active assignment for the vehicle or driver is closed
2. a new assignment row is created
3. `vehicles.current_driver_id` is updated
4. driver status is synchronized where required

Decommissioning a vehicle or making a driver inactive closes active relationships rather than deleting history.

### 7.3 Maintenance and Odometer State

Active maintenance records can place a vehicle in `Under Maintenance`. Completing or closing the relevant maintenance returns it to an operational state when no other active maintenance remains.

Odometer values are recorded in `vehicle_odometer_logs` and reflected in `vehicles.current_odometer`. Lower readings do not replace a higher current reading.

### 7.4 Documents

Document handling stores:

- binary files in the `documents` Storage bucket
- searchable metadata in `public.documents`
- configurable categories in `public.document_types`

The current bucket is public and document URLs are generated with `getPublicUrl`. Storage API policies allow authenticated reads, editor or system-administrator uploads and updates, and system-administrator deletion. The application does not expose document deletion in its normal workflow.

### 7.5 Workbook Imports

The import subsystem accepts `.xlsx` workbooks for vehicles, drivers, assignments, fuel logs, maintenance, incidents, and trips. It:

- recognizes expected and common legacy sheet names
- suggests mappings for alternative column headings
- validates rows before insertion
- links records through plate and licence numbers
- skips duplicate records where appropriate
- records created/skipped counts and row issues
- writes batch summaries to `import_batches`

Import processing uses the same fleet data functions as normal application forms, so the same mapping and business rules apply.

## 8. Notifications

In-app notifications are stored in `public.notifications`. Automatic rules in `src/lib/notification-rules.ts` generate deterministic notification identifiers so repeated checks update existing alerts instead of creating uncontrolled duplicates.

When email delivery is enabled, the frontend invokes `send-notification-emails` with a notification ID. The Edge Function:

1. validates the caller and profile
2. loads the notification and active profiles
3. keeps only recipients with email notifications enabled
4. skips already recorded deliveries
5. sends through Gmail SMTP
6. records successful deliveries

Email delivery failures are logged but do not prevent the original in-app notification from being saved.

## 9. Edge Functions

| Function | Purpose | Authorization |
| --- | --- | --- |
| `create-user` | Creates an Auth account and profile | `system_admin` |
| `delete-user` | Removes an Auth account with safety checks | `system_admin` |
| `send-notification-emails` | Sends an existing alert to eligible users | Any authenticated profile |

The functions use `SUPABASE_SERVICE_ROLE_KEY` only in the hosted function environment. It must never be included in frontend variables or committed files.

`verify_jwt = false` is configured because the functions accept the access token through multiple forwarded header names. Each function validates that token with `auth.getUser`, then confirms the verified user against `public.profiles` before privileged work. The service-role client is not exposed to the browser.

## 10. Database Scripts

The working SQL source is under `supabase/`. The academic restoration package is under `database-submission/` and should be applied in numeric order.

Important SQL responsibilities:

| File or group | Responsibility |
| --- | --- |
| `schema.sql` | Core tables, relationships, triggers, and read policies |
| `rbac-policies.sql` | Canonical roles, helper functions, and write policies |
| `vehicle-odometer-schema.sql` | Odometer fields and history table |
| `vehicle-service-mileage.sql` | Next-service mileage |
| `document-types.sql` | Configurable document categories |
| `documents-file-path-column.sql` | Storage object path metadata |
| `profile-settings-column.sql` | JSON settings on profiles |
| `notification-email-deliveries.sql` | Email deduplication |
| `storage-documents.sql` | Storage bucket and object policies |
| `policies-*.sql` | Operational table policy updates |

## 11. Security and Operational Notes

- `.env.local`, service-role keys, SMTP passwords, and database credentials are excluded from submission.
- RLS must remain enabled on all application tables.
- The Storage bucket is currently public; sensitive-document requirements would justify converting it to private signed URLs.
- Profile role and account-status changes are protected by a database trigger, not only by frontend controls.
- Broad destructive operations are deliberately limited in the UI and data layer.
- Imported files are processed in the browser; only structured records and batch summaries are stored.
- The submitted SQL contains fictional demonstration data and excludes Auth passwords and hosted files.

## 12. Verification

Before deployment or assessment, run:

```bash
npm run check
```

This runs linting, TypeScript compilation, and a production build. Backend behavior should also be verified with one account from each canonical role and with RLS enabled.
