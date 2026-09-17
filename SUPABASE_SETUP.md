# Supabase setup

1. Create a Supabase project and copy `.env.example` to `.env`. Set
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, and a strong
   `ADMIN_PASSWORD`. The service-role key is used only by `server.js`; never
   put it in browser code or commit `.env`.
2. In the Supabase SQL editor, run:

```sql
create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text not null,
  age integer not null check (age between 18 and 100),
  location text not null,
  interest text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  plan_type text not null,
  utr text not null,
  screenshot_data text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  rejection_reason text
);

create index if not exists payment_submissions_status_idx
  on public.payment_submissions(status, submitted_at desc);
create index if not exists users_last_seen_idx
  on public.users(last_seen_at desc);

alter table public.users enable row level security;
alter table public.payment_submissions enable row level security;
```

The server uses the Supabase REST API with the service-role key, so the
browser never receives database credentials. Start with `npm start`, then
open `/admin` and sign in with the configured admin credentials. Without the
required environment variables, the app returns an explicit configuration
error instead of pretending that data was saved.
