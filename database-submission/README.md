# LFZDC Fleet Management Database Submission

## Database engine

This project uses PostgreSQL through Supabase. Supabase is the hosting and application platform; PostgreSQL is the actual relational database engine.

The files in this package are a portable, assessment-safe representation of the project database. They can be stored on a flash drive, submitted with the source code, and used to recreate the database structure and demonstration records.

## Package contents

- `01-schema.sql`: Core tables, relationships, triggers, and base read policies.
- `02-vehicle-odometer.sql`: Vehicle odometer history table.
- `03-vehicle-service-mileage.sql`: Current odometer and next-service mileage fields.
- `04-document-types.sql`: Shared vehicle and driver document categories.
- `05-document-file-path.sql`: Stored document path support.
- `06-profile-settings.sql`: Per-user application settings.
- `07-notification-email-deliveries.sql`: Notification email delivery tracking.
- `08-role-access-policies.sql`: Role-based access functions and policies.
- `09-storage-documents.sql`: Supabase document-storage bucket and policies.
- `10-sample-data.sql`: Realistic demonstration records for the operational tables.

## Recommended restoration order

Run the numbered SQL files from `01` through `10` in a new Supabase project's SQL Editor.

The storage script uses Supabase's built-in `storage` schema. The profiles table uses Supabase's built-in `auth.users` table. These are intentional parts of the production design.

## Important submission notes

- No database password, API secret, `.env` file, or private authentication token is included.
- Hosted user accounts and password hashes are intentionally excluded.
- The sample data contains fictional demonstration records and can safely be used for assessment.
- This is a schema-and-sample-data package, not a live connection to the hosted Supabase project.
- The final policies give authenticated users read access, editors and system administrators record-management access, and system administrators destructive Storage access.
- A profile trigger prevents non-administrators from changing their own role or account status.

## About MySQL

A MySQL copy is not needed unless the school specifically requires MySQL. Converting the project would remove or rewrite PostgreSQL and Supabase features such as row-level security, the `auth` schema, JSONB fields, storage policies, and PostgreSQL functions. The application should remain connected to Supabase/PostgreSQL so the submitted database matches the implemented system.
