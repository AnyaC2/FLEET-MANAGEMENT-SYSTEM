create table if not exists public.notification_email_deliveries (
  notification_id text not null references public.notifications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emailed_at timestamptz not null default timezone('utc', now()),
  primary key (notification_id, profile_id)
);

alter table public.notification_email_deliveries enable row level security;
