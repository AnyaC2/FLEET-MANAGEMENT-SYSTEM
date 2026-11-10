# API and Data Access Reference

Last updated: 2026-09-16

## 1. Scope

The LFZDC Fleet Management System does not expose a conventional Express REST server. Its API surface consists of:

1. Supabase Auth methods
2. direct PostgreSQL access through Supabase PostgREST
3. Supabase Storage operations
4. three custom Edge Function endpoints

This reference documents the operations used by the current frontend. Database access remains subject to Supabase authentication and Row Level Security (RLS).

## 2. Connection and Authentication

The Supabase project URL is configured with:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Edge Function base URL:

```text
https://your-project-ref.supabase.co/functions/v1
```

Authenticated requests use the access token from the current Supabase session. Direct table and Storage calls receive that session automatically through the Supabase client.

Canonical roles:

- `system_admin`: user management and operational records
- `editor`: operational record management
- `end_user`: read-only operational access

## 3. Authentication Operations

| Operation | Supabase method | Used for |
| --- | --- | --- |
| Sign in | `auth.signInWithPassword` | Email/password authentication |
| Restore session | `auth.getSession` | App startup and authenticated requests |
| Observe session | `auth.onAuthStateChange` | Login, logout, recovery, token refresh, and MFA state |
| Sign out | `auth.signOut` | Session termination |
| Send recovery email | `auth.resetPasswordForEmail` | Password-reset link |
| Update user | `auth.updateUser` | Password or email change |
| Assurance level | `auth.mfa.getAuthenticatorAssuranceLevel` | Determine whether AAL2 is required |
| List factors | `auth.mfa.listFactors` | Load enrolled authenticators |
| Enroll factor | `auth.mfa.enroll` | Begin TOTP setup |
| Verify challenge | `auth.mfa.challengeAndVerify` | Complete TOTP login or enrollment |
| Remove factor | `auth.mfa.unenroll` | Disable a TOTP factor |

### Password Recovery

The reset request uses `/login?type=recovery` as its redirect. On return, the login screen restores the recovery session. If the account has MFA enabled, the user must satisfy AAL2 before `auth.updateUser({ password })` is accepted.

Frontend password validation requires matching values with a minimum length of eight characters.

## 4. Edge Function Endpoints

All custom endpoints accept `POST` and respond to CORS `OPTIONS` requests. JSON responses use the shape appropriate to each operation, with an `error` property on failure.

### 4.1 Common Headers

```http
Content-Type: application/json
apikey: <supabase-anon-key>
Authorization: Bearer <access-token>
x-access-token: <access-token>
```

The functions look for an access token in `x-access-token`, `authorization`, `Authorization`, or `x-forwarded-authorization`.

### 4.2 Create User

```http
POST /functions/v1/create-user
```

Authorization: `system_admin`

Request:

```json
{
  "email": "new.user@example.com",
  "password": "temporary-password",
  "name": "New User",
  "role": "editor",
  "department": "Operations"
}
```

Required fields: `email`, `password`, `name`, and `role`.

Success, `200`:

```json
{
  "id": "user-uuid",
  "email": "new.user@example.com",
  "name": "New User",
  "role": "editor"
}
```

The function creates a confirmed Supabase Auth account and upserts the matching profile. If the profile write fails, the newly created Auth account is removed as compensation.

Expected failures:

- `400`: missing fields or account/profile creation failure
- `401`: missing or unusable access token
- `403`: caller is not a system administrator
- `500`: missing server configuration or unexpected error

### 4.3 Delete User

```http
POST /functions/v1/delete-user
```

Authorization: `system_admin`

Request:

```json
{
  "userId": "target-user-uuid"
}
```

Success, `200`:

```json
{
  "id": "target-user-uuid",
  "email": "target.user@example.com",
  "name": "Target User"
}
```

Safeguards:

- administrators cannot delete their own account
- the last remaining `system_admin` cannot be deleted
- the target profile must exist

Expected failures:

- `400`: missing ID, safeguard violation, or Auth deletion failure
- `401`: missing or unusable access token
- `403`: caller is not a system administrator
- `404`: target profile does not exist
- `500`: missing server configuration or unexpected error

### 4.4 Send Notification Emails

```http
POST /functions/v1/send-notification-emails
```

Authorization: authenticated caller with a profile row

Request:

```json
{
  "notificationId": "notification-id"
}
```

Success, `200`:

```json
{
  "success": true,
  "sent": 3
}
```

`sent` may be `0` when no eligible recipient remains. The function filters inactive users, profiles without email addresses, disabled email preferences, and recipients already recorded in `notification_email_deliveries`.

Expected failures:

- `400`: missing notification ID
- `401`: missing or unusable access token
- `403`: caller has no valid profile
- `404`: notification does not exist
- `500`: missing email/server configuration or unexpected error
- `502`: every attempted delivery failed

## 5. Direct Data Operations

The frontend uses operation-based data modules rather than handwritten REST routes.

### 5.1 Profiles

Table: `public.profiles`

| Operation | Access | Implementation |
| --- | --- | --- |
| Load current profile | Signed-in user | `AuthContext.tsx` |
| List all profiles | `system_admin` | `UserManagement.tsx` |
| Update another user's role | `system_admin` | `UserManagement.tsx` |
| Update own name/email | Profile owner | `Profile.tsx` |
| Load/save settings | Profile owner | `settings-data.ts` |

Settings are stored as JSON in `profiles.settings`. The browser also keeps a local copy so interface preferences survive temporary backend failures.

### 5.2 Vehicles

Table: `public.vehicles`

Supported operations:

- list all or operational vehicles
- get by ID or plate number
- create a vehicle
- update status, current driver, current odometer, and next-service odometer
- derive `Under Maintenance` from active maintenance records

Deletion is disabled. Decommissioning is the supported lifecycle action.

### 5.3 Drivers

Table: `public.drivers`

Supported operations:

- list all or active drivers
- get by ID
- create a driver
- update driver status
- resolve the currently assigned vehicle

Deletion is disabled. Setting a driver to inactive closes active assignments and clears affected vehicle links.

### 5.4 Assignments

Table: `public.assignments`

Supported operations:

- list all assignments or assignments for a driver
- create an assignment
- assign a driver to a vehicle while closing conflicting active assignments

An assignment with no `end_date` is active.

### 5.5 Fuel Logs

Table: `public.fuel_logs`

Supported operations:

- list all logs or logs for one vehicle
- create a fuel entry

Creating a fuel entry also records its odometer value and can advance the vehicle's current odometer.

### 5.6 Maintenance

Table: `public.maintenance`

Supported operations:

- list all records or records for one vehicle
- create a maintenance record
- update status, dates, cost, provider, and description

Maintenance changes synchronize vehicle status and may update odometer/service-due values.

### 5.7 Incidents

Table: `public.incidents`

Supported operations:

- list all incidents or filter by vehicle/driver
- create an incident
- update status and repair information

Incident creation can generate a related in-app notification without making email delivery part of the transaction.

### 5.8 Trips

Table: `public.trips`

Supported operations:

- list all trips or filter by vehicle/driver
- create a trip

Trip distance is used to record a derived odometer reading where applicable.

### 5.9 Notifications

Table: `public.notifications`

Supported operations:

- list notifications
- create or upsert deterministic alerts
- update read state and other supported fields
- delete a notification

Email dispatch is best-effort and does not roll back an in-app notification.

### 5.10 Odometer Logs

Table: `public.vehicle_odometer_logs`

Supported operations:

- list readings for a vehicle
- record a reading with source and optional source record ID
- update `vehicles.current_odometer` when the new reading is higher

### 5.11 Documents and Document Types

Tables: `public.documents`, `public.document_types`

Storage bucket: `documents`

Supported operations:

- list document metadata
- upload a file and create its metadata record
- list default and custom document types
- create a custom document type

File upload sequence:

1. upload the object to the `documents` bucket
2. obtain its public URL
3. insert metadata, including `file_path`, into `public.documents`

Document record deletion is disabled in the application.

### 5.12 Import Batches

Table: `public.import_batches`

Supported operations:

- list recent batches
- record a completed workbook import

Each batch stores filename, importing user, total and valid rows, created/skipped counts, issue details, and per-sheet summaries.

## 6. Workbook Import API

`src/lib/data-import.ts` exposes browser-side functions rather than HTTP endpoints:

| Function | Purpose |
| --- | --- |
| `parseImportWorkbook` | Reads an `.xlsx` file and returns a validated preview |
| `getImportFieldSuggestions` | Suggests mappings for unmatched headers |
| `executeWorkbookImport` | Writes valid rows through fleet data functions |
| `downloadImportTemplate` | Generates the standard workbook template |
| `downloadLegacyImportSampleWorkbook` | Generates a legacy-format demonstration file |

Supported logical sheets:

- vehicles
- drivers
- assignments
- fuel logs
- maintenance
- incidents
- trips

The importer recognizes common legacy sheet and column names, allows explicit mapping, links records by plate/licence identifiers, and skips duplicates where required.

## 7. Storage API

Bucket: `documents`

Operations used:

```ts
supabase.storage.from('documents').upload(path, file)
supabase.storage.from('documents').getPublicUrl(path)
```

The bucket is currently public. RLS policies control authenticated object operations, while generated public URLs can be opened without a signed URL.

## 8. Error Handling

Data modules throw failed Supabase writes to the calling screen so the UI can present a meaningful message. Reads generally report backend failures rather than silently replacing hosted fleet data. Deliberate fallback exists for settings, document-type definitions, and import history.

Edge Function responses should be handled by HTTP status and their JSON `error` field. Authentication failures should not be retried indefinitely. Email dispatch failures are logged and kept separate from the successful creation of the corresponding in-app notification.

## 9. Server-Side Secrets

Edge Functions use these hosted environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_SMTP_USER`
- `GMAIL_SMTP_APP_PASSWORD`
- `NOTIFICATION_FROM_NAME`
- `APP_URL`

The frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. The service-role key and SMTP credentials must never be exposed in browser code or submitted project files.
