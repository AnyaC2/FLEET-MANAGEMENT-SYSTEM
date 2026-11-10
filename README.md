# LFZDC Fleet Management System

An internal fleet operations and records management application developed for Lekki Free Zone Development Company (LFZDC). The system centralizes vehicle, driver, trip, fuel, maintenance, incident, document, reporting, user-access, and historical data-import workflows.

## Core Features

- Fleet dashboard with operational summaries and drill-down links
- Vehicle and driver registration, status management, and assignments
- Trip, fuel, maintenance, incident, and odometer records
- Vehicle and driver document management
- Excel workbook import with preview, mapping, validation, and import history
- Excel report exports and management reporting
- Role-based access for administrators, managers, and viewers
- Supabase authentication, multi-factor authentication, storage, and PostgreSQL data
- In-app and optional email notifications

## Technology

- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4
- Supabase Auth, PostgreSQL, Storage, and Edge Functions
- Recharts for dashboard reporting
- SheetJS for Excel import and export

## Requirements

- Node.js 20 or newer
- npm
- Internet access to the configured Supabase project
- A Supabase user account and corresponding record in the `profiles` table

## Quick Start

1. Open a terminal in the project folder.
2. Install the dependencies:

   ```bash
   npm install
   ```

3. Create `.env.local` from `.env.example` and enter the Supabase project URL and anonymous key:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Start the application:

   ```bash
   npm run dev
   ```

5. Open the local address shown in the terminal, normally `http://localhost:5173`.

## Verification

Run the complete source check before deployment or submission:

```bash
npm run check
```

The command runs the linter, TypeScript compiler, and production build.

## Available Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Check the source code for lint errors |
| `npm run check` | Run linting and the production build |

## Project Structure

```text
public/                 Static images, logo, and notification audio
src/components/         Shared application and interface components
src/context/            Authentication and authorization context
src/lib/                Data access, imports, exports, rules, and utilities
src/pages/              Application screens and operational modules
src/types/              Shared TypeScript data definitions
supabase/               Database scripts, policies, and Edge Functions
database-submission/    Numbered SQL package for academic submission
docs/                   Backend and API documentation
```

## Database

The application uses PostgreSQL through Supabase. The primary development scripts are in `supabase/`. A portable, numbered database package is provided in `database-submission/` and includes the schema, role policies, storage configuration, and fictional demonstration data.

See [database-submission/README.md](database-submission/README.md) for the restoration order and submission notes.

## Additional Documentation

- [Backend documentation](docs/backend-documentation.md)
- [API and data-access documentation](docs/api-documentation.md)

## Submission and Security Notes

- Do not submit `.env.local`, database passwords, service-role keys, SMTP passwords, or personal credentials.
- `.env.example` contains placeholders only and is safe to submit.
- Hosted Supabase users, password hashes, and uploaded files are intentionally excluded from the database submission package.
- The sample SQL records are fictional and intended for demonstration and assessment.
- A lecturer testing the hosted version will need internet access and test credentials supplied separately.
