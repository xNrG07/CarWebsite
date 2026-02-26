-- W&M Autoparadies: minimal schema for a dynamic dealer website
-- Run in Supabase SQL Editor.

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  make text not null,
  model text not null,
  year int,
  km int,
  fuel text,
  gearbox text,
  price int,
  status text not null default 'verkauf',
  image_url text,
  description text,
  willhaben_url text
);

-- Only allow sell inventory states
alter table public.cars
  add constraint cars_status_check
  check (status in ('verkauf','reserviert'));

create index if not exists cars_created_at_idx on public.cars (created_at desc);

create table if not exists public.valuation_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  marke text,
  modell text,
  jahr int,
  km int,
  kraftstoff text,
  zustand text,
  kontakt text,
  anmerkung text,
  submitted_at timestamptz
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  vorname text,
  nachname text,
  email text,
  telefon text,
  nachricht text,
  submitted_at timestamptz
);
