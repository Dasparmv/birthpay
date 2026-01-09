-- BirthPay schema (Supabase / Postgres)
-- Pega todo este script en: Supabase > SQL Editor > New query > Run

-- Extensions (UUID generation)
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type event_status as enum ('DRAFT','ACTIVE','CLOSED','FINISHED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_condition as enum ('NA','CUMPLEANERO','PRACTICANTE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('YAPE','PLIN','EFECTIVO');
exception when duplicate_object then null; end $$;

-- Tables
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  restaurant text not null,
  event_date date not null,
  order_deadline timestamptz null,
  status event_status not null default 'DRAFT',
  shared_tip numeric(12,2) not null default 0,
  shared_cake numeric(12,2) not null default 0,
  shared_other numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  phone text not null,
  food_desc text not null,
  food_amount numeric(12,2) null,
  drink_desc text null,
  drink_amount numeric(12,2) null,
  pay_method payment_method not null,
  notes text null,
  condition order_condition not null default 'NA',
  paid boolean not null default false,
  paid_at timestamptz null,
  is_void boolean not null default false,
  void_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single ACTIVE event at a time
create unique index if not exists ux_one_active_event
on public.events ((status))
where status = 'ACTIVE';

-- Updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Helpful view: totals are calculated in the app (quota depends on current data),
-- but this view gives you per-order "own total" and birthday totals.
create or replace view public.v_orders_own_total as
select
  o.*,
  coalesce(o.food_amount,0) + coalesce(o.drink_amount,0) as own_total
from public.orders o
where o.is_void = false;

-- RLS
alter table public.events enable row level security;
alter table public.orders enable row level security;

-- EVENTS: public can read only the ACTIVE event (and optionally CLOSED if you want)
drop policy if exists "public can read active event" on public.events;
create policy "public can read active event"
on public.events for select
to anon, authenticated
using (status in ('ACTIVE','CLOSED'));

-- ORDERS: public can read orders of ACTIVE/CLOSED events (internal use scenario).
-- If quieres ocultar celulares/notes, luego creamos una tabla/view pública sin esas columnas.
drop policy if exists "public can read orders for active/closed events" on public.orders;
create policy "public can read orders for active/closed events"
on public.orders for select
to anon, authenticated
using (
  is_void = false
  and exists (
    select 1 from public.events e
    where e.id = orders.event_id
      and e.status in ('ACTIVE','CLOSED')
  )
);

-- Public can insert orders ONLY when event is ACTIVE
drop policy if exists "public can insert order when event active" on public.orders;
create policy "public can insert order when event active"
on public.orders for insert
to anon, authenticated
with check (
  is_void = false
  and condition = 'NA'
  and exists (
    select 1 from public.events e
    where e.id = orders.event_id
      and e.status = 'ACTIVE'
  )
);

-- Block public updates/deletes (admin updates go through Service Role via Netlify Functions)
drop policy if exists "no public update" on public.orders;
create policy "no public update"
on public.orders for update
to anon, authenticated
using (false);

drop policy if exists "no public delete" on public.orders;
create policy "no public delete"
on public.orders for delete
to anon, authenticated
using (false);


-- Storage bucket for event letters (public read)
-- Nota: si ya existe, no hace nada.
insert into storage.buckets (id, name, public)
values ('event-letters', 'event-letters', true)
on conflict (id) do nothing;

-- Policies for public download (bucket public should be enough, but dejamos política por si tu proyecto la requiere)
do $$ begin
  create policy "Public read event letters"
  on storage.objects for select
  using (bucket_id = 'event-letters');
exception when duplicate_object then null; end $$;
