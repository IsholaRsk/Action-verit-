-- ============================================
-- EscortHub - RLS POLICIES
-- À exécuter APRÈS schema.sql
-- ============================================

-- Helper: is_admin
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- ============================================
-- PROFILES POLICIES
-- ============================================
drop policy if exists "Profiles public readable" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Admin can do all profiles" on public.profiles;

create policy "Profiles public readable"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Admin can do all profiles"
  on public.profiles for all
  using (public.is_admin());

-- ============================================
-- PRODUCTS POLICIES
-- ============================================
drop policy if exists "Products public readable" on public.products;
drop policy if exists "Admin can manage products" on public.products;

create policy "Products public readable"
  on public.products for select
  using (true);

create policy "Admin can manage products"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================
-- ADS POLICIES
-- ============================================
drop policy if exists "Active ads public readable" on public.ads;
drop policy if exists "Users can create ads" on public.ads;
drop policy if exists "Users can view own ads" on public.ads;
drop policy if exists "Admin can manage ads" on public.ads;

create policy "Active ads public readable"
  on public.ads for select
  using (status = 'active' or auth.uid() = user_id or public.is_admin());

create policy "Users can create ads"
  on public.ads for insert
  with check (auth.uid() = user_id);

create policy "Users can view own ads"
  on public.ads for select
  using (auth.uid() = user_id);

create policy "Admin can manage ads"
  on public.ads for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================
-- PAYMENTS POLICIES
-- ============================================
drop policy if exists "Users can view own payments" on public.payments;
drop policy if exists "Users can create payments" on public.payments;
drop policy if exists "Admin can view all payments" on public.payments;
drop policy if exists "Admin can manage payments" on public.payments;

create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Users can create payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

create policy "Admin can view all payments"
  on public.payments for select
  using (public.is_admin());

create policy "Admin can manage payments"
  on public.payments for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================
-- SETTINGS POLICIES
-- ============================================
drop policy if exists "Settings public readable" on public.settings;
drop policy if exists "Admin can manage settings" on public.settings;

create policy "Settings public readable"
  on public.settings for select
  using (true);

create policy "Admin can manage settings"
  on public.settings for all
  using (public.is_admin())
  with check (public.is_admin());
