-- FULL ADMIN DASHBOARD REDUIT - EscortHub
-- Version compacte (~12KB) - Garde 100% du parcours: produit -> solde -> recharge -> preuve -> admin VOIR/APPROUVER/REFUSER -> credit auto -> achat
-- A executer dans Supabase SQL Editor

create extension if not exists "pgcrypto";

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user','admin')),
  balance numeric not null default 0 check (balance>=0),
  total_credited numeric not null default 0,
  total_spent numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles add column if not exists balance numeric default 0;
alter table public.profiles add column if not exists total_credited numeric default 0;
alter table public.profiles add column if not exists total_spent numeric default 0;
alter table public.profiles add column if not exists email text;

-- 2. PRODUCTS (existant conserve)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  nom text not null, age int check(age>=18), lieu text not null,
  prix numeric not null check(prix>0), image text,
  created_at timestamptz default now()
);

-- 3. PAYMENT_METHODS configurables admin: RECHARGE PAR CARTE + CRYPTO
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check(type in ('crypto','recharge','transcash','mobile_money','virement','other')) default 'recharge',
  instructions text not null,
  wallet_address text, -- adresse publique uniquement, jamais seed
  network text, currency text default 'EUR', enabled boolean default true,
  created_at timestamptz default now()
);

-- 4. DEPOSIT_REQUESTS - coeur recharge
create table if not exists public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check(amount>0 and amount<=100000),
  currency text default 'EUR',
  payment_method text not null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  transaction_reference text not null check(char_length(transaction_reference)>=3),
  crypto_tx_hash text, -- hash TX crypto
  proof_path text, proof_url text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  admin_id uuid references auth.users(id) on delete set null,
  rejection_reason text,
  created_at timestamptz default now(), processed_at timestamptz
);
alter table public.deposit_requests add column if not exists crypto_tx_hash text;
alter table public.deposit_requests add column if not exists proof_path text;
alter table public.deposit_requests add column if not exists proof_url text;

-- 5. TRANSACTIONS audit
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check(type in ('deposit','purchase','refund')) default 'deposit',
  amount numeric not null, currency text default 'EUR',
  balance_before numeric not null default 0, balance_after numeric not null default 0,
  deposit_request_id uuid references public.deposit_requests(id) on delete set null unique,
  product_id uuid references public.products(id) on delete set null,
  reference text, created_at timestamptz default now()
);

-- 6. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, message text not null,
  type text not null check(type in ('deposit_pending','deposit_approved','deposit_rejected','purchase_success','insufficient_balance','info')) default 'info',
  is_read boolean default false, read boolean default false,
  amount numeric, currency text default 'EUR',
  deposit_request_id uuid references public.deposit_requests(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  data jsonb, created_at timestamptz default now()
);

-- 7. ADMIN_LOGS
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null, target_table text not null, target_id uuid, details jsonb, created_at timestamptz default now()
);

-- INDEXES essentiels
create index if not exists dep_user_idx on public.deposit_requests(user_id);
create index if not exists dep_status_idx on public.deposit_requests(status);
create index if not exists trans_user_idx on public.transactions(user_id);
create index if not exists notif_user_idx on public.notifications(user_id);

-- UTILS
create or replace function update_updated_at_column() returns trigger as $$ begin NEW.updated_at=now(); return NEW; end; $$ language plpgsql;
drop trigger if exists upd_prof on public.profiles; create trigger upd_prof before update on public.profiles for each row execute function update_updated_at_column();

create or replace function public.is_admin() returns boolean as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$ language sql security definer stable;

create or replace function handle_new_user_profile() returns trigger as $$
begin insert into public.profiles(id,email,role,balance) values(new.id,new.email,'user',0) on conflict(id) do update set email=excluded.email; return new; end; $$ language plpgsql security definer;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user_profile();

create or replace function prevent_balance_tampering() returns trigger as $$
begin if OLD.balance is distinct from NEW.balance and auth.uid()=OLD.id and not public.is_admin() and OLD.total_credited=NEW.total_credited and OLD.total_spent=NEW.total_spent then raise exception 'Solde modifiable uniquement via RPC securisee'; end if; return NEW; end; $$ language plpgsql security definer;
drop trigger if exists chk_bal on public.profiles; create trigger chk_bal before update on public.profiles for each row execute function prevent_balance_tampering();

-- RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.payment_methods enable row level security;
alter table public.deposit_requests enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_logs enable row level security;

drop policy if exists "p_read_own_or_admin" on public.profiles; create policy "p_read_own_or_admin" on public.profiles for select to authenticated using(auth.uid()=id or public.is_admin());
drop policy if exists "p_update_own" on public.profiles; create policy "p_update_own" on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);

drop policy if exists "prod_read_all" on public.products; create policy "prod_read_all" on public.products for select using(true);
drop policy if exists "prod_admin" on public.products; create policy "prod_admin" on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "pm_read" on public.payment_methods; create policy "pm_read" on public.payment_methods for select using(enabled=true or public.is_admin());
drop policy if exists "pm_admin" on public.payment_methods; create policy "pm_admin" on public.payment_methods for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists "dep_own" on public.deposit_requests; create policy "dep_own" on public.deposit_requests for select to authenticated using(auth.uid()=user_id or public.is_admin());
drop policy if exists "dep_insert" on public.deposit_requests; create policy "dep_insert" on public.deposit_requests for insert to authenticated with check(auth.uid()=user_id and status='pending' and amount>0);

drop policy if exists "trans_own" on public.transactions; create policy "trans_own" on public.transactions for select to authenticated using(auth.uid()=user_id or public.is_admin());
drop policy if exists "notif_own" on public.notifications; create policy "notif_own" on public.notifications for select to authenticated using(auth.uid()=user_id or public.is_admin());
drop policy if exists "notif_upd" on public.notifications; create policy "notif_upd" on public.notifications for update to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);

drop policy if exists "logs_admin" on public.admin_logs; create policy "logs_admin" on public.admin_logs for select to authenticated using(public.is_admin());
drop policy if exists "logs_ins" on public.admin_logs; create policy "logs_ins" on public.admin_logs for insert to authenticated with check(public.is_admin());

-- STORAGE prive deposit-proofs JPG/PNG/PDF 10MB
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('deposit-proofs','deposit-proofs',false,10485760,array['image/jpeg','image/png','image/jpg','application/pdf']) on conflict(id) do nothing;
insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict(id) do nothing;

drop policy if exists "up_own_proof" on storage.objects; create policy "up_own_proof" on storage.objects for insert to authenticated with check(bucket_id='deposit-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "view_own_proof" on storage.objects; create policy "view_own_proof" on storage.objects for select to authenticated using(bucket_id='deposit-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "admin_view_proof" on storage.objects; create policy "admin_view_proof" on storage.objects for select to authenticated using(bucket_id='deposit-proofs' and public.is_admin());

-- RPCs
create or replace function public.create_notification(p_user_id uuid,p_type text,p_title text,p_message text,p_amount numeric default null,p_currency text default 'EUR',p_deposit_request_id uuid default null,p_product_id uuid default null,p_data jsonb default null) returns uuid as $$
declare nid uuid; begin insert into public.notifications(user_id,type,title,message,amount,currency,deposit_request_id,product_id,data,is_read,read) values(p_user_id,p_type,p_title,p_message,p_amount,coalesce(p_currency,'EUR'),p_deposit_request_id,p_product_id,p_data,false,false) returning id into nid; return nid; end; $$ language plpgsql security definer;

create or replace function public.notify_deposit_pending() returns trigger as $$
begin perform public.create_notification(NEW.user_id,'deposit_pending','Recharge en attente',format('Votre paiement de %s %s recu et en cours de validation. Ref: %s. Solde inchange jusqu''approbation.',NEW.amount,NEW.currency,NEW.transaction_reference),NEW.amount,NEW.currency,NEW.id,null,jsonb_build_object('status','pending')); return NEW; end; $$ language plpgsql security definer;
drop trigger if exists trg_pending on public.deposit_requests; create trigger trg_pending after insert on public.deposit_requests for each row execute function public.notify_deposit_pending();

-- APPROUVER: atomique anti double credit
create or replace function public.approve_deposit(request_id uuid) returns json as $$
declare req record; old_bal numeric; new_bal numeric; tid uuid;
begin if not public.is_admin() then raise exception 'Admin requis'; end if;
select * into req from public.deposit_requests where id=request_id for update; if not found then raise exception 'Demande introuvable'; end if;
if req.status!='pending' then raise exception 'Deja traitee: %',req.status; end if;
select balance into old_bal from public.profiles where id=req.user_id for update; if not found then raise exception 'Profil introuvable'; end if;
update public.profiles set balance=balance+req.amount,total_credited=total_credited+req.amount where id=req.user_id returning balance into new_bal;
update public.deposit_requests set status='approved',admin_id=auth.uid(),processed_at=now() where id=request_id and status='pending'; if not found then raise exception 'Deja traitee par autre admin'; end if;
insert into public.transactions(user_id,type,amount,currency,balance_before,balance_after,deposit_request_id,reference) values(req.user_id,'deposit',req.amount,req.currency,old_bal,new_bal,req.id,req.transaction_reference) returning id into tid;
insert into public.admin_logs(admin_id,action,target_table,target_id,details) values(auth.uid(),'approve_deposit','deposit_requests',req.id,jsonb_build_object('amount',req.amount,'old',old_bal,'new',new_bal));
perform public.create_notification(req.user_id,'deposit_approved','Paiement confirme',format('Votre compte a ete credite de %s %s. Nouveau solde %s %s. Ref %s',req.amount,req.currency,new_bal,req.currency,req.transaction_reference),req.amount,req.currency,req.id,null,jsonb_build_object('old_balance',old_bal,'new_balance',new_bal,'tid',tid));
return json_build_object('success',true,'old_balance',old_bal,'new_balance',new_bal,'transaction_id',tid);
end; $$ language plpgsql security definer;

-- REFUSER
create or replace function public.reject_deposit(request_id uuid,reason text) returns json as $$
declare req record; begin if not public.is_admin() then raise exception 'Admin requis'; end if;
if reason is null or char_length(trim(reason))<3 then raise exception 'Motif requis (ex: Preuve invalide)'; end if;
select * into req from public.deposit_requests where id=request_id for update; if not found then raise exception 'Introuvable'; end if;
if req.status!='pending' then raise exception 'Deja traitee: %',req.status; end if;
update public.deposit_requests set status='rejected',rejection_reason=trim(reason),admin_id=auth.uid(),processed_at=now() where id=request_id and status='pending';
insert into public.admin_logs(admin_id,action,target_table,target_id,details) values(auth.uid(),'reject_deposit','deposit_requests',request_id,jsonb_build_object('reason',trim(reason)));
perform public.create_notification(req.user_id,'deposit_rejected','Paiement refuse',format('Refuse. Motif: %s. Ref: %s. Solde inchange.',trim(reason),req.transaction_reference),req.amount,req.currency,req.id,null,jsonb_build_object('reason',trim(reason)));
return json_build_object('success',true,'status','rejected'); end; $$ language plpgsql security definer;

-- PAYER PRODUIT: prix reel DB, verif solde serveur
create or replace function public.pay_product(p_product_id uuid) returns json as $$
declare prod record; old_bal numeric; new_bal numeric; tid uuid;
begin if auth.uid() is null then raise exception 'Non connecte'; end if;
select * into prod from public.products where id=p_product_id; if not found then raise exception 'Produit introuvable'; end if;
select balance into old_bal from public.profiles where id=auth.uid() for update; if old_bal is null then raise exception 'Profil introuvable'; end if;
if old_bal < prod.prix then perform public.create_notification(auth.uid(),'insufficient_balance','Solde insuffisant',format('Solde %s EUR insuffisant pour %s a %s EUR. Manque %s EUR.',old_bal,prod.nom,prod.prix,prod.prix-old_bal),prod.prix,'EUR',null,prod.id,jsonb_build_object('balance',old_bal,'price',prod.prix)); raise exception 'Solde insuffisant: %s EUR < %s EUR',old_bal,prod.prix; end if;
new_bal:=old_bal-prod.prix; update public.profiles set balance=new_bal,total_spent=total_spent+prod.prix where id=auth.uid();
insert into public.transactions(user_id,type,amount,currency,balance_before,balance_after,product_id,reference) values(auth.uid(),'purchase',-prod.prix,'EUR',old_bal,new_bal,prod.id,format('Achat %s',prod.nom)) returning id into tid;
perform public.create_notification(auth.uid(),'purchase_success','Paiement effectue',format('Achat %s pour %s EUR. Nouveau solde %s EUR.',prod.nom,prod.prix,new_bal),prod.prix,'EUR',null,prod.id,jsonb_build_object('new_balance',new_bal,'tid',tid));
return json_build_object('success',true,'price',prod.prix,'old_balance',old_bal,'new_balance',new_bal,'tid',tid);
end; $$ language plpgsql security definer;

create or replace function public.get_my_balance() returns numeric as $$ select coalesce(balance,0) from public.profiles where id=auth.uid(); $$ language sql security definer stable;
create or replace function public.mark_notification_read(nid uuid) returns void as $$ update public.notifications set is_read=true,read=true where id=nid and user_id=auth.uid(); $$ language sql security definer;
create or replace function public.mark_all_notifications_read() returns void as $$ update public.notifications set is_read=true,read=true where user_id=auth.uid() and is_read=false; $$ language sql security definer;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.approve_deposit(uuid) to authenticated;
grant execute on function public.reject_deposit(uuid,text) to authenticated;
grant execute on function public.pay_product(uuid) to authenticated;
grant execute on function public.get_my_balance() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.create_notification(uuid,text,text,text,numeric,text,uuid,uuid,jsonb) to authenticated;

-- REALTIME
alter publication supabase_realtime add table public.deposit_requests;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.profiles;

-- SEED minimal: RECHARGE PAR CARTE + CRYPTO
insert into public.payment_methods(name,type,instructions,wallet_address,network,currency,enabled)
select * from (values
('Recharge par carte','recharge','Achetez recharge PCS/Transcash. Photo claire ticket avec solde visible. Code + preuve obligatoire JPG/PNG/PDF. Admin verifie avant credit.',null,null,'EUR',true),
('Crypto USDT TRC20','crypto','Envoyez USDT TRC20 a l''adresse. Montant exact. Jamais partager seed. Preuve: hash TX + capture. Copiez adresse via bouton.', 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE','TRC20','USDT',true)
) as v(name,type,instructions,wallet_address,network,currency,enabled)
where not exists(select 1 from public.payment_methods limit 1);
