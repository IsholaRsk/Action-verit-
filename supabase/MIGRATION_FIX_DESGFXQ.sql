-- ============================================
-- MIGRATION FIX pour https://desgfxqfmuqkslzntefg.supabase.co
-- Cette base a déjà profiles et products avec vieux schéma
-- Exécute ce fichier dans SQL Editor
-- ============================================

-- 1. FIX PROFILES TABLE (ajoute colonnes manquantes)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Supprime ancienne contrainte role si elle existe (qui bloquait admin)
DO $$
BEGIN
  -- Cherche et supprime les contraintes check sur role
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname LIKE '%profiles_role%' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ajoute nouvelle contrainte role qui accepte user/admin/client (pour compatibilité)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user','admin','client'));

-- Index username si pas existe
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 2. FIX PRODUCTS TABLE (corrige legacy name NOT NULL -> nom)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='name') THEN
    ALTER TABLE public.products ALTER COLUMN name DROP NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='nom') THEN
      ALTER TABLE public.products RENAME COLUMN name TO nom;
    ELSE
      UPDATE public.products SET nom = COALESCE(nom, name) WHERE nom IS NULL AND name IS NOT NULL;
      ALTER TABLE public.products DROP COLUMN name;
    END IF;
  END IF;
END $$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS nom text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS age int;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lieu text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS prix numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill NULL avant de remettre NOT NULL
UPDATE public.products SET nom = COALESCE(nom, 'Profil sans nom') WHERE nom IS NULL;
UPDATE public.products SET lieu = COALESCE(lieu, 'Cotonou') WHERE lieu IS NULL;
UPDATE public.products SET image = COALESCE(image, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400') WHERE image IS NULL;
UPDATE public.products SET age = COALESCE(age, 23) WHERE age IS NULL;
UPDATE public.products SET prix = COALESCE(prix, 100) WHERE prix IS NULL;

-- 3. CREATE ADS TABLE (n'existe pas)
CREATE TABLE IF NOT EXISTS public.ads (
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
CREATE INDEX IF NOT EXISTS idx_ads_status ON public.ads(status);
CREATE INDEX IF NOT EXISTS idx_ads_user ON public.ads(user_id);

-- 4. CREATE PAYMENTS TABLE (n'existe pas)
CREATE TABLE IF NOT EXISTS public.payments (
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
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- 5. CREATE SETTINGS TABLE (n'existe pas)
CREATE TABLE IF NOT EXISTS public.settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
INSERT INTO public.settings (key, value) VALUES ('payment_redirect_url','https://t.me/Polarish87')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 6. FUNCTIONS
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)), 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Triggers updated_at
DROP TRIGGER IF EXISTS set_updated_at_profiles ON public.profiles; CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_products ON public.products; CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_ads ON public.ads; CREATE TRIGGER set_updated_at_ads BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_payments ON public.payments; CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_settings ON public.settings; CREATE TRIGGER set_updated_at_settings BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- POLICIES (supprime et recrée)
DROP POLICY IF EXISTS "Profiles public readable" ON public.profiles; CREATE POLICY "Profiles public readable" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles; CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles; CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Admin can do all profiles" ON public.profiles; CREATE POLICY "Admin can do all profiles" ON public.profiles FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Products public readable" ON public.products; CREATE POLICY "Products public readable" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can manage products" ON public.products; CREATE POLICY "Admin can manage products" ON public.products FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Active ads public readable" ON public.ads; CREATE POLICY "Active ads public readable" ON public.ads FOR SELECT USING (status = 'active' OR auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "Users can create ads" ON public.ads; CREATE POLICY "Users can create ads" ON public.ads FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin can manage ads" ON public.ads; CREATE POLICY "Admin can manage ads" ON public.ads FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own payments" ON public.payments; CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create payments" ON public.payments; CREATE POLICY "Users can create payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin can view all payments" ON public.payments; CREATE POLICY "Admin can view all payments" ON public.payments FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admin can manage payments" ON public.payments; CREATE POLICY "Admin can manage payments" ON public.payments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Settings public readable" ON public.settings; CREATE POLICY "Settings public readable" ON public.settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can manage settings" ON public.settings; CREATE POLICY "Admin can manage settings" ON public.settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- STORAGE POLICIES (au cas où)
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects; CREATE POLICY "Public read product-images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
DROP POLICY IF EXISTS "Authenticated upload product-images" ON storage.objects; CREATE POLICY "Authenticated upload product-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admin write product-images" ON storage.objects; CREATE POLICY "Admin write product-images" ON storage.objects FOR ALL USING (bucket_id = 'product-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')) WITH CHECK (bucket_id = 'product-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "User upload payment-proofs" ON storage.objects; CREATE POLICY "User upload payment-proofs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "User read own payment-proofs" ON storage.objects; CREATE POLICY "User read own payment-proofs" ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Admin read payment-proofs" ON storage.objects; CREATE POLICY "Admin read payment-proofs" ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 7. FIX TON ADMIN (passe en admin + ajoute username)
UPDATE public.profiles SET role = 'admin', username = 'admin', full_name = 'Admin', updated_at = now() WHERE id = '0fe75f44-2eca-4fef-b77b-c778ddcf5788';
-- Ou par email si tu connais l'ID
-- UPDATE public.profiles SET role='admin' WHERE id IN (SELECT id FROM auth.users WHERE email='ijlalradji3@gmail.com');

-- Vérification finale
SELECT 'profiles' as table_name, count(*) FROM public.profiles
UNION ALL SELECT 'products', count(*) FROM public.products
UNION ALL SELECT 'ads', count(*) FROM public.ads
UNION ALL SELECT 'payments', count(*) FROM public.payments
UNION ALL SELECT 'settings', count(*) FROM public.settings;
