-- ============================================
-- EscortHub - STORAGE BUCKETS
-- À exécuter dans SQL Editor
-- ============================================

-- 1. Créer les buckets (via SQL, ou Dashboard > Storage)
insert into storage.buckets (id, name, public)
values ('product-images','product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('payment-proofs','payment-proofs', false)
on conflict (id) do nothing;

-- 2. Policies storage

-- product-images: public read, admin write, user write for ads/products
-- Supprimer anciennes policies si existent
drop policy if exists "Public read product-images" on storage.objects;
drop policy if exists "Admin write product-images" on storage.objects;
drop policy if exists "Authenticated upload product-images" on storage.objects;
drop policy if exists "User can upload to product-images" on storage.objects;

create policy "Public read product-images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Authenticated upload product-images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
  );

create policy "Admin write product-images"
  on storage.objects for all
  using (
    bucket_id = 'product-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    bucket_id = 'product-images'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "User can update own product-images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "User can delete own product-images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );

-- payment-proofs: private, user can upload to own folder, admin can read all via service_role + signed url
drop policy if exists "User upload payment-proofs" on storage.objects;
drop policy if exists "User read own payment-proofs" on storage.objects;
drop policy if exists "Admin read payment-proofs" on storage.objects;

create policy "User upload payment-proofs"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-proofs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "User read own payment-proofs"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Admin read payment-proofs"
  on storage.objects for select
  using (
    bucket_id = 'payment-proofs'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Note: Le backend utilise service_role, donc bypass RLS pour créer signed URLs
-- Il faut aussi permettre au service_role de tout faire (par défaut il bypass RLS)
