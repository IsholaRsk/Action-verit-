-- PADDLE BILLING - Abonnement 5.99€/mois - pri_01m1e8e2ybr9rjmaq0kz4ezpnk
-- À exécuter dans Supabase SQL Editor APRÈS DASHBOARD_200_LIGNES.sql

-- 1. TABLE ABONNEMENTS
create table if not exists public.paddle_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  paddle_customer_id text,
  paddle_subscription_id text unique,
  price_id text not null default 'pri_01m1e8e2ybr9rjmaq0kz4ezpnk',
  status text not null default 'inactive' check (status in ('active','trialing','past_due','paused','canceled','expired','inactive','unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  data jsonb
);

alter table public.paddle_subscriptions add column if not exists paddle_customer_id text;
alter table public.paddle_subscriptions add column if not exists paddle_subscription_id text;
alter table public.paddle_subscriptions add column if not exists price_id text;
alter table public.paddle_subscriptions add column if not exists status text;
alter table public.paddle_subscriptions add column if not exists current_period_start timestamptz;
alter table public.paddle_subscriptions add column if not exists current_period_end timestamptz;
alter table public.paddle_subscriptions add column if not exists next_billed_at timestamptz;
alter table public.paddle_subscriptions add column if not exists data jsonb;

create index if not exists paddle_sub_user_idx on public.paddle_subscriptions(user_id);
create index if not exists paddle_sub_status_idx on public.paddle_subscriptions(status);
create index if not exists paddle_sub_paddle_id_idx on public.paddle_subscriptions(paddle_subscription_id);

-- 2. AJOUT COLONNE IS_PREMIUM DANS PROFILES (cache)
alter table public.profiles add column if not exists is_premium boolean default false;
alter table public.profiles add column if not exists premium_until timestamptz;

-- 3. FUNCTION VERIF ABONNEMENT ACTIF (serveur only)
create or replace function public.has_active_subscription(p_user_id uuid) returns boolean as $$
  select exists(
    select 1 from public.paddle_subscriptions 
    where user_id=p_user_id 
    and status in ('active','trialing') 
    and (current_period_end is null or current_period_end > now())
  );
$$ language sql security definer stable;

create or replace function public.is_premium() returns boolean as $$
  select public.has_active_subscription(auth.uid());
$$ language sql security definer stable;

-- 4. TRIGGER UPDATE is_premium dans profiles après changement subscription
create or replace function public.sync_premium_status() returns trigger as $$
begin
  update public.profiles 
  set is_premium = public.has_active_subscription(NEW.user_id),
      premium_until = NEW.current_period_end,
      updated_at = now()
  where id=NEW.user_id;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_premium_insert on public.paddle_subscriptions;
create trigger trg_sync_premium_insert after insert on public.paddle_subscriptions for each row execute function public.sync_premium_status();
drop trigger if exists trg_sync_premium_update on public.paddle_subscriptions;
create trigger trg_sync_premium_update after update on public.paddle_subscriptions for each row execute function public.sync_premium_status();

-- 5. RLS
alter table public.paddle_subscriptions enable row level security;

drop policy if exists "paddle_own" on public.paddle_subscriptions;
create policy "paddle_own" on public.paddle_subscriptions for select to authenticated using (auth.uid()=user_id or public.is_admin());

drop policy if exists "paddle_admin" on public.paddle_subscriptions;
create policy "paddle_admin" on public.paddle_subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Service role peut tout faire (webhook)
-- Pas de policy insert/update pour user normal - uniquement via webhook serveur avec service_role

-- 6. REALTIME
do $$ begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='paddle_subscriptions') then alter publication supabase_realtime add table public.paddle_subscriptions; end if; end $$;

-- 7. VERIFICATION
select * from public.paddle_subscriptions limit 5;
select public.has_active_subscription(auth.uid()) as is_premium;
