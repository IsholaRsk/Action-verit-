-- ============================================
-- EscortHub - FULL SETUP FIXED - v2.1 NO TELEGRAM
-- Version nettoyée: suppression totale Telegram
-- Copie-colle TOUT ce fichier dans Supabase SQL Editor et RUN
-- ============================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- 0. FIX LEGACY PRODUCTS TABLE qui a une colonne `name` NOT NULL
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='products' AND column_name='name'
  ) THEN
    RAISE NOTICE 'Legacy column products.name found -> fixing...';
    ALTER TABLE public.products ALTER COLUMN name DROP NOT NULL;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='products' AND column_name='nom'
    ) THEN
      ALTER TABLE public.products RENAME COLUMN name TO nom;
      RAISE NOTICE 'Renamed products.name -> nom';
    ELSE
      UPDATE public.products SET nom = COALESCE(nom, name) WHERE nom IS NULL AND name IS NOT NULL;
      ALTER TABLE public.products DROP COLUMN name;
      RAISE NOTICE 'Dropped legacy products.name, kept nom';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='title') THEN
    ALTER TABLE public.products DROP COLUMN IF EXISTS title;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='price') THEN
    ALTER TABLE public.products DROP COLUMN IF EXISTS price;
  END IF;
END $$;

-- ============================================
-- 1. TABLES
-- ============================================

-- PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;
create index if not exists idx_profiles_role on public.profiles(role);

-- PRODUCTS - SCHEMA CORRECT FINAL
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
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS nom text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS age int;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lieu text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS prix numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  UPDATE public.products SET nom = COALESCE(nom, 'Profil sans nom') WHERE nom IS NULL;
  UPDATE public.products SET lieu = COALESCE(lieu, 'Cotonou') WHERE lieu IS NULL;
  UPDATE public.products SET image = COALESCE(image, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400') WHERE image IS NULL;
  UPDATE public.products SET age = COALESCE(age, 23) WHERE age IS NULL;
  UPDATE public.products SET prix = COALESCE(prix, 100) WHERE prix IS NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS telegram_link text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS telegram_username text;
ALTER TABLE public.products ALTER COLUMN nom SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN age SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN lieu SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN prix SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN image SET NOT NULL;

-- ADS
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

-- PAYMENTS
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

-- SETTINGS - SANS TELEGRAM
create table if not exists public.settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- SUPPRIME TELEGRAM: lien neutre vers site, pas t.me
insert into public.settings (key, value) values ('payment_redirect_url','/') on conflict (key) do nothing;
insert into public.settings (key, value) values ('site_url','/') on conflict (key) do nothing;

-- PAYMENT_METHODS (si pas déjà créé par dashboard)
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('crypto','recharge','transcash','mobile_money','virement','other')) default 'recharge',
  instructions text not null,
  wallet_address text,
  network text,
  payment_link text,
  currency text default 'EUR',
  enabled boolean default true,
  created_at timestamptz default now()
);

-- DEPOSIT_REQUESTS + TRANSACTIONS + NOTIFICATIONS + ADMIN_LOGS (import depuis dashboard réduit si besoin)
create table if not exists public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount>0),
  currency text default 'EUR',
  payment_method text not null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  transaction_reference text not null,
  crypto_tx_hash text,
  proof_path text,
  proof_url text,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  admin_id uuid references auth.users(id) on delete set null,
  rejection_reason text,
  created_at timestamptz default now(),
  processed_at timestamptz
);
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text check (type in ('deposit','purchase','refund')) default 'deposit',
  amount numeric not null,
  currency text default 'EUR',
  balance_before numeric default 0,
  balance_after numeric default 0,
  deposit_request_id uuid references public.deposit_requests(id) on delete set null unique,
  product_id uuid references public.products(id) on delete set null,
  reference text,
  created_at timestamptz default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'info',
  is_read boolean default false,
  read boolean default false,
  amount numeric,
  currency text default 'EUR',
  deposit_request_id uuid references public.deposit_requests(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  data jsonb,
  created_at timestamptz default now()
);
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_table text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- ============================================
-- 2. FUNCTIONS - SANS TELEGRAM
-- ============================================
create or replace function public.handle_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
create or replace function public.handle_new_user() returns trigger as $$ begin insert into public.profiles (id, full_name, username, role) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), 'user') on conflict (id) do nothing; return new; end; $$ language plpgsql security definer;
create or replace function public.is_admin() returns boolean as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$ language sql security definer stable;

-- TRIGGERS
drop trigger if exists set_updated_at_profiles on public.profiles; create trigger set_updated_at_profiles before update on public.profiles for each row execute function public.handle_updated_at();
drop trigger if exists set_updated_at_products on public.products; create trigger set_updated_at_products before update on public.products for each row execute function public.handle_updated_at();
drop trigger if exists set_updated_at_ads on public.ads; create trigger set_updated_at_ads before update on public.ads for each row execute function public.handle_updated_at();
drop trigger if exists set_updated_at_payments on public.payments; create trigger set_updated_at_payments before update on public.payments for each row execute function public.handle_updated_at();
drop trigger if exists set_updated_at_settings on public.settings; create trigger set_updated_at_settings before update on public.settings for each row execute function public.handle_updated_at();
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============================================
-- 3. RLS
-- ============================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.ads enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;
alter table public.payment_methods enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_logs enable row level security;

drop policy if exists "Profiles public readable" on public.profiles; create policy "Profiles public readable" on public.profiles for select using (true);
drop policy if exists "Users can update own profile" on public.profiles; create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles; create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Admin can do all profiles" on public.profiles; create policy "Admin can do all profiles" on public.profiles for all using (public.is_admin());

drop policy if exists "Products public readable" on public.products; create policy "Products public readable" on public.products for select using (true);
drop policy if exists "Admin can manage products" on public.products; create policy "Admin can manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Active ads public readable" on public.ads; create policy "Active ads public readable" on public.ads for select using (status = 'active' or auth.uid() = user_id or public.is_admin());
drop policy if exists "Users can create ads" on public.ads; create policy "Users can create ads" on public.ads for insert with check (auth.uid() = user_id);
drop policy if exists "Admin can manage ads" on public.ads; create policy "Admin can manage ads" on public.ads for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Users can view own payments" on public.payments; create policy "Users can view own payments" on public.payments for select using (auth.uid() = user_id);
drop policy if exists "Users can create payments" on public.payments; create policy "Users can create payments" on public.payments for insert with check (auth.uid() = user_id);
drop policy if exists "Admin can view all payments" on public.payments; create policy "Admin can view all payments" on public.payments for select using (public.is_admin());
drop policy if exists "Admin can manage payments" on public.payments; create policy "Admin can manage payments" on public.payments for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Settings public readable" on public.settings; create policy "Settings public readable" on public.settings for select using (true);
drop policy if exists "Admin can manage settings" on public.settings; create policy "Admin can manage settings" on public.settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pm_read" on public.payment_methods; create policy "pm_read" on public.payment_methods for select using (enabled=true or public.is_admin());
drop policy if exists "pm_admin" on public.payment_methods; create policy "pm_admin" on public.payment_methods for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "dep_own" on public.deposit_requests; create policy "dep_own" on public.deposit_requests for select using (auth.uid()=user_id or public.is_admin());
drop policy if exists "dep_insert" on public.deposit_requests; create policy "dep_insert" on public.deposit_requests for insert with check (auth.uid()=user_id and status='pending');

drop policy if exists "trans_own" on public.transactions; create policy "trans_own" on public.transactions for select using (auth.uid()=user_id or public.is_admin());
drop policy if exists "notif_own" on public.notifications; create policy "notif_own" on public.notifications for select using (auth.uid()=user_id or public.is_admin());
drop policy if exists "notif_upd" on public.notifications; create policy "notif_upd" on public.notifications for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "logs_admin" on public.admin_logs; create policy "logs_admin" on public.admin_logs for select using (public.is_admin());

-- ============================================
-- 4. STORAGE BUCKETS - SANS TELEGRAM
-- ============================================
insert into storage.buckets (id, name, public) values ('product-images','product-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('payment-proofs','payment-proofs', false, 10485760, array['image/jpeg','image/png','image/jpg','application/pdf']) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('deposit-proofs','deposit-proofs', false, 10485760, array['image/jpeg','image/png','image/jpg','application/pdf']) on conflict (id) do nothing;

drop policy if exists "Public read product-images" on storage.objects; create policy "Public read product-images" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "Authenticated upload product-images" on storage.objects; create policy "Authenticated upload product-images" on storage.objects for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');
drop policy if exists "Admin write product-images" on storage.objects; create policy "Admin write product-images" on storage.objects for all using (bucket_id = 'product-images' and public.is_admin()) with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "User upload payment-proofs" on storage.objects; create policy "User upload payment-proofs" on storage.objects for insert with check (bucket_id = 'payment-proofs' and auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "User read own payment-proofs" on storage.objects; create policy "User read own payment-proofs" on storage.objects for select using (bucket_id = 'payment-proofs' and auth.role() = 'authenticated' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Admin read payment-proofs" on storage.objects; create policy "Admin read payment-proofs" on storage.objects for select using (bucket_id = 'payment-proofs' and public.is_admin());

drop policy if exists "up_own_proof" on storage.objects; create policy "up_own_proof" on storage.objects for insert with check (bucket_id='deposit-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "view_own_proof" on storage.objects; create policy "view_own_proof" on storage.objects for select using (bucket_id='deposit-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "admin_view_proof" on storage.objects; create policy "admin_view_proof" on storage.objects for select using (bucket_id='deposit-proofs' and public.is_admin());

-- ============================================
-- 5. CLEAN TELEGRAM - Supprime toute référence t.me
-- ============================================
DELETE FROM public.settings WHERE value ILIKE '%t.me%' OR value ILIKE '%telegram%';
UPDATE public.settings SET value='/' WHERE key='payment_redirect_url' AND (value ILIKE '%t.me%' OR value ILIKE '%telegram%');

-- ============================================
-- 6. VERIFICATION
-- ============================================
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='products' ORDER BY ordinal_position;
SELECT * FROM public.settings WHERE key='payment_redirect_url';

-- SEED PRODUITS - SANS TELEGRAM
insert into public.products (nom, age, lieu, prix, image) values
('Sophia', 23, 'Cotonou', 150, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'),
('Maya', 25, 'Abomey-Calavi', 200, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400')
on conflict do nothing;

-- SEED PAYMENT_METHODS - SANS TELEGRAM, lien DB neutre
insert into public.payment_methods (name, type, instructions, wallet_address, network, payment_link, currency, enabled)
select * from (values
  ('Recharge par carte','recharge','Photo ticket solde visible + code. Preuve JPG/PNG/PDF obligatoire. Admin vérifie avant crédit.','Recharge','-','/wallet','EUR',true),
  ('Crypto USDT TRC20','crypto','Envoyez USDT TRC20 adresse ci-dessous. Copiez adresse. Preuve hash TX + capture.','TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE','TRC20',null,'USDT',true)
) as v(name,type,instructions,wallet_address,network,payment_link,currency,enabled)
where not exists (select 1 from public.payment_methods limit 1);
