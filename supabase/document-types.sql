create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  applies_to text not null check (applies_to in ('vehicle', 'driver', 'both')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.document_types enable row level security;

drop policy if exists "Authenticated users can read document types" on public.document_types;
create policy "Authenticated users can read document types"
on public.document_types
for select
to authenticated
using (true);

drop policy if exists "Editors and system admins can insert document types" on public.document_types;
create policy "Editors and system admins can insert document types"
on public.document_types
for insert
to authenticated
with check (public.can_manage_records());
