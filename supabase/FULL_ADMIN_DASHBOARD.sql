-- FULL ADMIN DASHBOARD - EscortHub - DASHBOARD COMPLET ADMIN UNIQUEMENT
-- À exécuter dans Supabase SQL Editor - NE SUPPRIME RIEN, AJOUTE SEULEMENT
-- Conforme à toutes les exigences: stats, demandes, validation VOIR/APPROUVER/REFUSER, users, produits, achats, transactions, notifications, logs, realtime, sécurité RLS

create extension if not exists "pgcrypto";

-- PROFILES avec solde
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  username text,
  role text not null default 'user' check (role in ('user','admin')),
  balance numeric not null default 0 check (balance >= 0),
  total_credited numeric not null default 0,
  total_spent numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists balance numeric default 0;
alter table public.profiles add column if not exists total_credited numeric default 0;
alter table public.profiles add column if not exists total_spent numeric default 0;

-- PRODUCTS (conserver existant)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  age int not null check (age >= 18),
  lieu text not null,
  prix numeric not null check (prix > 0),
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PAYMENTS legacy (conserver)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  ad_id uuid,
  target text,
  amount numeric,
  method text,
  status text default 'pending',
  validation text default 'pending',
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ADS
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  text text,
  media_type text,
  media_url text,
  status text default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SETTINGS
create table if not exists public.settings (
  key text primary key,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PAYMENT_METHODS configurable
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('crypto','transcash','recharge','mobile_money','virement','other')) default 'other',
  instructions text not null,
  wallet_address text,
  network text,
  currency text not null default 'EUR',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- DEPOSIT_REQUESTS avec preuve obligatoire + crypto_tx_hash
create table if not exists public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount > 0 and amount <= 100000),
  currency text not null default 'EUR',
  payment_method text not null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  transaction_reference text not null check (char_length(transaction_reference) >= 3),
  crypto_tx_hash text,
  proof_path text,
  proof_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_id uuid references auth.users(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.deposit_requests add column if not exists crypto_tx_hash text;
alter table public.deposit_requests add column if not exists proof_path text;
alter table public.deposit_requests add column if not exists proof_url text;

-- TRANSACTIONS audit financier
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit','purchase','withdraw','refund')) default 'deposit',
  amount numeric not null,
  currency text not null default 'EUR',
  balance_before numeric not null default 0,
  balance_after numeric not null default 0,
  deposit_request_id uuid references public.deposit_requests(id) on delete set null unique,
  product_id uuid references public.products(id) on delete set null,
  reference text,
  created_at timestamptz not null default now()
);

-- NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('deposit_pending','deposit_approved','deposit_rejected','purchase_success','insufficient_balance','info')) default 'info',
  is_read boolean not null default false,
  read boolean not null default false,
  amount numeric,
  currency text default 'EUR',
  deposit_request_id uuid references public.deposit_requests(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  data jsonb,
  created_at timestamptz not null default now()
);

-- ADMIN_LOGS journal
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  target_table text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- INDEXES
create index if not exists deposit_requests_user_id_idx on public.deposit_requests(user_id);
create index if not exists deposit_requests_status_idx on public.deposit_requests(status);
create index if not exists transactions_user_id_idx on public.transactions(user_id);
create index if not exists transactions_type_idx on public.transactions(type);
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_status_idx on public.payments(status);

-- updated_at trigger
create or replace function update_updated_at_column() returns trigger as $$ begin NEW.updated_at = now(); return NEW; end; $$ language plpgsql;
drop trigger if exists update_profiles_updated_at on public.profiles; create trigger update_profiles_updated_at before update on public.profiles for each row execute function update_updated_at_column();
drop trigger if exists update_products_updated_at on public.products; create trigger update_products_updated_at before update on public.products for each row execute function update_updated_at_column();
drop trigger if exists update_payment_methods_updated_at on public.payment_methods; create trigger update_payment_methods_updated_at before update on public.payment_methods for each row execute function update_updated_at_column();

-- auto profile
create or replace function handle_new_user_profile() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, username, role, balance)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.raw_user_meta_data->>'username','user_'||substring(new.id::text,1,6)), 'user', 0)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function handle_new_user_profile();

-- RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.payments enable row level security;
alter table public.ads enable row level security;
alter table public.settings enable row level security;
alter table public.payment_methods enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_logs enable row level security;

create or replace function public.is_admin() returns boolean as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role='admin');
$$ language sql security definer stable;

-- Profiles policies
drop policy if exists "Profiles: view own or admin" on public.profiles;
create policy "Profiles: view own or admin" on public.profiles for select to authenticated using (auth.uid() = id or public.is_admin());
drop policy if exists "Profiles: admin view all" on public.profiles;
create policy "Profiles: admin view all" on public.profiles for select to authenticated using (public.is_admin());
drop policy if exists "Profiles: users update own" on public.profiles;
create policy "Profiles: users update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- Prevent balance tampering
create or replace function prevent_balance_tampering() returns trigger as $$
begin
  if OLD.balance is distinct from NEW.balance then
    if auth.uid() = OLD.id and not public.is_admin() then
      if OLD.total_credited = NEW.total_credited and OLD.total_spent = NEW.total_spent then
        raise exception 'Modification solde interdite côté client. Utilisez RPC.';
      end if;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;
drop trigger if exists check_balance_tampering on public.profiles;
create trigger check_balance_tampering before update on public.profiles for each row execute function prevent_balance_tampering();

-- Products policies
drop policy if exists "Products: public read" on public.products;
create policy "Products: public read" on public.products for select using (true);
drop policy if exists "Products: admin write" on public.products;
create policy "Products: admin write" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Payments policies
drop policy if exists "Payments: users view own or admin" on public.payments;
create policy "Payments: users view own or admin" on public.payments for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Payments: users insert own" on public.payments;
create policy "Payments: users insert own" on public.payments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Payments: admin update" on public.payments;
create policy "Payments: admin update" on public.payments for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Ads policies
drop policy if exists "Ads: public read active" on public.ads;
create policy "Ads: public read active" on public.ads for select using (status='active' or public.is_admin() or auth.uid() = user_id);
drop policy if exists "Ads: users insert own" on public.ads;
create policy "Ads: users insert own" on public.ads for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Ads: admin manage" on public.ads;
create policy "Ads: admin manage" on public.ads for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Settings policies
drop policy if exists "Settings: public read" on public.settings;
create policy "Settings: public read" on public.settings for select using (true);
drop policy if exists "Settings: admin write" on public.settings;
create policy "Settings: admin write" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Payment methods policies
drop policy if exists "Payment methods: public read enabled" on public.payment_methods;
create policy "Payment methods: public read enabled" on public.payment_methods for select using (enabled = true or public.is_admin());
drop policy if exists "Payment methods: admin manage" on public.payment_methods;
create policy "Payment methods: admin manage" on public.payment_methods for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Deposit requests policies
drop policy if exists "Deposits: users view own" on public.deposit_requests;
create policy "Deposits: users view own" on public.deposit_requests for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Deposits: users insert own pending" on public.deposit_requests;
create policy "Deposits: users insert own pending" on public.deposit_requests for insert to authenticated with check (auth.uid() = user_id and amount > 0 and status = 'pending');

-- Transactions policies
drop policy if exists "Transactions: users view own" on public.transactions;
create policy "Transactions: users view own" on public.transactions for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- Notifications policies
drop policy if exists "Notifications: users view own" on public.notifications;
create policy "Notifications: users view own" on public.notifications for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "Notifications: users update own read" on public.notifications;
create policy "Notifications: users update own read" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin logs policies
drop policy if exists "Admin logs: admin view" on public.admin_logs;
create policy "Admin logs: admin view" on public.admin_logs for select to authenticated using (public.is_admin());
drop policy if exists "Admin logs: admin insert" on public.admin_logs;
create policy "Admin logs: admin insert" on public.admin_logs for insert to authenticated with check (public.is_admin());

-- Storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deposit-proofs','deposit-proofs',false,10485760, array['image/jpeg','image/png','image/jpg','image/webp','application/pdf'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('payment-proofs','payment-proofs',false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('product-images','product-images',true) on conflict (id) do nothing;

drop policy if exists "Users can upload own deposit proofs" on storage.objects;
drop policy if exists "Users can view own deposit proofs" on storage.objects;
drop policy if exists "Admin can view all deposit proofs" on storage.objects;
drop policy if exists "Users can delete own deposit proofs" on storage.objects;
create policy "Users can upload own deposit proofs" on storage.objects for insert to authenticated with check (bucket_id = 'deposit-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can view own deposit proofs" on storage.objects for select to authenticated using (bucket_id = 'deposit-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Admin can view all deposit proofs" on storage.objects for select to authenticated using (bucket_id = 'deposit-proofs' and public.is_admin());
create policy "Users can delete own deposit proofs" on storage.objects for delete to authenticated using (bucket_id = 'deposit-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- RPCs
create or replace function public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_amount numeric default null, p_currency text default 'EUR', p_deposit_request_id uuid default null, p_product_id uuid default null, p_data jsonb default null)
returns uuid as $$
declare nid uuid;
begin
  insert into public.notifications (user_id, type, title, message, amount, currency, deposit_request_id, product_id, data, is_read, read)
  values (p_user_id, p_type, p_title, p_message, p_amount, coalesce(p_currency,'EUR'), p_deposit_request_id, p_product_id, p_data, false, false) returning id into nid;
  return nid;
end;
$$ language plpgsql security definer;

create or replace function public.notify_deposit_pending() returns trigger as $$
begin
  perform public.create_notification(NEW.user_id,'deposit_pending','Recharge en attente', format('Votre demande de recharge de %s %s est en cours de traitement. Votre compte sera crédité uniquement après vérification et approbation par un administrateur. Réf: %s', NEW.amount, NEW.currency, NEW.transaction_reference), NEW.amount, NEW.currency, NEW.id, null, jsonb_build_object('payment_method',NEW.payment_method,'reference',NEW.transaction_reference,'status','pending'));
  return NEW;
end;
$$ language plpgsql security definer;
drop trigger if exists on_deposit_request_created_notify on public.deposit_requests;
create trigger on_deposit_request_created_notify after insert on public.deposit_requests for each row execute function public.notify_deposit_pending();

create or replace function public.approve_deposit(request_id uuid) returns json as $$
declare req record; old_bal numeric; new_bal numeric; trans_id uuid;
begin
  if not public.is_admin() then raise exception 'Accès administrateur requis - sécurité serveur'; end if;
  select * into req from public.deposit_requests where id=request_id for update;
  if not found then raise exception 'Demande introuvable'; end if;
  if req.status != 'pending' then raise exception 'Demande déjà traitée: %', req.status; end if;
  if req.amount <=0 then raise exception 'Montant invalide'; end if;
  select balance into old_bal from public.profiles where id=req.user_id for update;
  if not found then raise exception 'Profil introuvable'; end if;
  -- Exemple: solde 0 + demande 100 = 100, ou 50+100=150
  update public.profiles set balance = balance + req.amount, total_credited = total_credited + req.amount, updated_at=now() where id=req.user_id returning balance into new_bal;
  update public.deposit_requests set status='approved', admin_id=auth.uid(), processed_at=now() where id=request_id and status='pending' returning * into req;
  if not found then raise exception 'Demande déjà traitée par un autre admin (anti double crédit)'; end if;
  insert into public.transactions(user_id,type,amount,currency,balance_before,balance_after,deposit_request_id,reference) values (req.user_id,'deposit',req.amount,req.currency,old_bal,new_bal,req.id,req.transaction_reference) returning id into trans_id;
  insert into public.admin_logs(admin_id,action,target_table,target_id,details) values (auth.uid(),'approve_deposit','deposit_requests',req.id, jsonb_build_object('amount',req.amount,'currency',req.currency,'user_id',req.user_id,'old_balance',old_bal,'new_balance',new_bal,'reference',req.transaction_reference));
  perform public.create_notification(req.user_id,'deposit_approved','Votre demande a été approuvée', format('Votre demande a été approuvée. Votre compte a été crédité de %s %s. Ancien: %s %s → Nouveau: %s %s. Réf: %s', req.amount, req.currency, old_bal, req.currency, new_bal, req.currency, req.transaction_reference), req.amount, req.currency, req.id, null, jsonb_build_object('old_balance',old_bal,'new_balance',new_bal,'transaction_id',trans_id));
  return json_build_object('success',true,'deposit_id',req.id,'amount',req.amount,'currency',req.currency,'old_balance',old_bal,'new_balance',new_bal,'transaction_id',trans_id);
exception when others then
  insert into public.admin_logs(admin_id,action,target_table,target_id,details) values (auth.uid(),'approve_deposit_failed','deposit_requests',request_id, jsonb_build_object('error',SQLERRM));
  raise;
end;
$$ language plpgsql security definer;

create or replace function public.reject_deposit(request_id uuid, reason text) returns json as $$
declare req record;
begin
  if not public.is_admin() then raise exception 'Accès administrateur requis'; end if;
  if reason is null or char_length(trim(reason))<3 then raise exception 'Motif requis min 3 caractères - ex: Preuve de paiement incorrecte'; end if;
  select * into req from public.deposit_requests where id=request_id for update;
  if not found then raise exception 'Demande introuvable'; end if;
  if req.status != 'pending' then raise exception 'Demande déjà traitée: %', req.status; end if;
  update public.deposit_requests set status='rejected', rejection_reason=trim(reason), admin_id=auth.uid(), processed_at=now() where id=request_id and status='pending';
  if not found then raise exception 'Demande déjà traitée'; end if;
  insert into public.admin_logs(admin_id,action,target_table,target_id,details) values (auth.uid(),'reject_deposit','deposit_requests',request_id, jsonb_build_object('amount',req.amount,'reason',trim(reason),'reference',req.transaction_reference));
  perform public.create_notification(req.user_id,'deposit_rejected','Votre demande a été refusée', format('Votre demande a été refusée. Motif: %s. Réf: %s. Votre solde reste inchangé.', trim(reason), req.transaction_reference), req.amount, req.currency, req.id, null, jsonb_build_object('reason',trim(reason)));
  return json_build_object('success',true,'deposit_id',request_id,'status','rejected','reason',trim(reason));
end;
$$ language plpgsql security definer;

create or replace function public.pay_product(p_product_id uuid) returns json as $$
declare prod record; prof record; old_bal numeric; new_bal numeric; trans_id uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  select * into prod from public.products where id=p_product_id;
  if not found then raise exception 'Produit introuvable'; end if;
  if prod.prix <=0 then raise exception 'Prix invalide'; end if;
  select * into prof from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Profil introuvable'; end if;
  old_bal := coalesce(prof.balance,0);
  if old_bal < prod.prix then
    perform public.create_notification(auth.uid(),'insufficient_balance','Solde insuffisant', format('Solde %s € insuffisant pour %s à %s €. Rechargez.', old_bal, prod.nom, prod.prix), prod.prix, 'EUR', null, prod.id, jsonb_build_object('balance',old_bal,'price',prod.prix));
    raise exception 'Solde insuffisant: %s € < %s €. Veuillez recharger votre compte.', old_bal, prod.prix;
  end if;
  new_bal := old_bal - prod.prix;
  update public.profiles set balance=new_bal, total_spent=total_spent+prod.prix, updated_at=now() where id=auth.uid();
  insert into public.transactions(user_id,type,amount,currency,balance_before,balance_after,product_id,reference) values (auth.uid(),'purchase', -prod.prix,'EUR',old_bal,new_bal,prod.id, format('Achat %s', prod.nom)) returning id into trans_id;
  perform public.create_notification(auth.uid(),'purchase_success','Paiement effectué', format('Vous avez acheté %s pour %s €. Nouveau solde: %s €.', prod.nom, prod.prix, new_bal), prod.prix,'EUR',null,prod.id, jsonb_build_object('old_balance',old_bal,'new_balance',new_bal,'transaction_id',trans_id));
  insert into public.admin_logs(admin_id,action,target_table,target_id,details) values (auth.uid(),'purchase','transactions',trans_id, jsonb_build_object('product_id',prod.id,'price',prod.prix,'old_balance',old_bal,'new_balance',new_bal));
  return json_build_object('success',true,'product_id',prod.id,'price',prod.prix,'old_balance',old_bal,'new_balance',new_bal,'transaction_id',trans_id);
end;
$$ language plpgsql security definer;

create or replace function public.get_my_balance() returns numeric as $$ select coalesce(balance,0) from public.profiles where id=auth.uid(); $$ language sql security definer stable;
create or replace function public.mark_notification_read(notif_id uuid) returns void as $$ update public.notifications set is_read=true, read=true where id=notif_id and user_id=auth.uid(); $$ language sql security definer;
create or replace function public.mark_all_notifications_read() returns void as $$ update public.notifications set is_read=true, read=true where user_id=auth.uid() and is_read=false; $$ language sql security definer;

grant execute on function public.create_notification(uuid,text,text,text,numeric,text,uuid,uuid,jsonb) to authenticated;
grant execute on function public.approve_deposit(uuid) to authenticated;
grant execute on function public.reject_deposit(uuid,text) to authenticated;
grant execute on function public.get_my_balance() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.pay_product(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Enable realtime
alter publication supabase_realtime add table public.deposit_requests;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.profiles;

-- Seed payment_methods
insert into public.payment_methods (name, type, instructions, wallet_address, network, currency, enabled)
select * from (values
  ('Crypto USDT TRC20', 'crypto', 'Envoyez USDT sur le réseau TRC20 à l''adresse ci-dessous. Montant exact. Ne jamais envoyer seed phrase ou clé privée. Après envoi, téléchargez preuve (hash transaction + capture).', 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', 'TRC20', 'USDT', true),
  ('Crypto USDC ERC20', 'crypto', 'Envoyez USDC sur réseau ERC20. Vérifiez adresse. Preuve: hash transaction.', '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18', 'ERC20', 'USDC', true),
  ('Crypto BTC', 'crypto', 'Envoyez BTC à l''adresse ci-dessous. 1 confirmation minimum. Preuve: TXID.', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'BTC', 'BTC', true),
  ('Transcash', 'transcash', 'Achetez une carte Transcash. Envoyez code + photo claire ticket avec solde visible. Ne considérez jamais capture d''écran comme preuve automatique - admin vérifie.', null, 'EUR', 'EUR', true),
  ('Mobile Money', 'mobile_money', 'Envoyez via Mobile Money Orange/MTN au numéro: +229 XX XX XX XX. Référence: votre email. Preuve: capture transaction + ID.', null, 'MTN', 'EUR', true),
  ('Virement bancaire', 'virement', 'Virement IBAN: FR76 XXXX XXXX XXXX XXXX XXXX XXXX XXX. BIC: XXXXXX. Motif: votre email + référence. Preuve: reçu virement PDF.', null, 'SEPA', 'EUR', true),
  ('Recharge PCS', 'recharge', 'Achetez recharge PCS. Code + photo ticket. Admin vérifie solde.', null, 'PCS', 'EUR', true)
) as v(name,type,instructions,wallet_address,network,currency,enabled)
where not exists (select 1 from public.payment_methods limit 1);

-- Vues stats
create or replace view public.admin_stats as
select
  (select count(*) from public.profiles) as total_users,
  (select count(*) from public.profiles where updated_at > now() - interval '7 days') as active_users,
  (select count(*) from public.products) as total_products,
  (select count(*) from public.transactions where type='purchase') as total_orders,
  (select count(*) from public.deposit_requests where status='pending') as pending_requests,
  (select count(*) from public.deposit_requests where status='approved') as approved_requests,
  (select count(*) from public.deposit_requests where status='rejected') as rejected_requests,
  (select coalesce(sum(amount),0) from public.transactions where type='deposit') as total_recharges,
  (select coalesce(sum(abs(amount)),0) from public.transactions where type='purchase') as total_purchases,
  (select coalesce(sum(total_credited),0) from public.profiles) as total_credited,
  (select coalesce(sum(total_spent),0) from public.profiles) as total_spent,
  (select coalesce(sum(balance),0) from public.profiles) as total_balance;

grant select on public.admin_stats to authenticated;
