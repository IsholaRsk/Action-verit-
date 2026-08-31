-- ============================================
-- EscortHub - SCHEMA COMPLET SUPABASE v2
-- Exécuter dans Supabase SQL Editor
-- ============================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- 1. TABLE PROFILES (lié à auth.users)
-- ============================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_username on public.profiles(username);

-- ============================================
-- 2. TABLE PRODUCTS
-- ============================================
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  age int not null check (age >= 18),
  lieu text not null,
  prix numeric not null check (prix > 0),
  image text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_created on public.products(created_at desc);

-- ============================================
-- 3. TABLE ADS
-- ============================================
create table if not exists public.ads (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  text text,
  media_type text not null default 'text' check (media_type in ('text','image','video')),
  media_url text,
  status text not null default 'pending' check (status in ('pending','active','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ads_status on public.ads(status);
create index if not exists idx_ads_user on public.ads(user_id);

-- ============================================
-- 4. TABLE PAYMENTS
-- ============================================
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  ad_id uuid references public.ads(id) on delete set null,
  target text not null default 'product' check (target in ('product','ad')),
  amount numeric not null check (amount > 0),
  method text not null default 'transcash' check (method in ('transcash')),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  validation text not null default 'pending' check (validation in ('pending','valid','invalid')),
  proof_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payments_user on public.payments(user_id);
create index if not exists idx_payments_status on public.payments(status);
create index if not exists idx_payments_created on public.payments(created_at desc);

-- ============================================
-- 5. TABLE SETTINGS
-- ============================================
create table if not exists public.settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Default setting
insert into public.settings (key, value) values ('payment_redirect_url','https://t.me/Polarish87')
on conflict (key) do nothing;

-- ============================================
-- 6. FUNCTIONS & TRIGGERS
-- ============================================

-- Updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
drop trigger if exists set_updated_at_profiles on public.profiles;
create trigger set_updated_at_profiles before update on public.profiles for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at_products on public.products;
create trigger set_updated_at_products before update on public.products for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at_ads on public.ads;
create trigger set_updated_at_ads before update on public.ads for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at_payments on public.payments;
create trigger set_updated_at_payments before update on public.payments for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at_settings on public.settings;
create trigger set_updated_at_settings before update on public.settings for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 7. ENABLE RLS
-- ============================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.ads enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;

-- ============================================
-- 8. RLS POLICIES - Voir policies.sql
-- ============================================
