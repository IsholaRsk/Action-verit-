# Supabase - Guide Complet EscortHub

## 1. Tables

### profiles
- id uuid PK FK auth.users
- full_name text
- username text unique
- role text ('user','admin') default 'user'
- created_at, updated_at

### products
- id uuid PK
- nom text
- age int >=18
- lieu text
- prix numeric >0
- image text (url public)
- created_at, updated_at

### ads
- id uuid PK
- user_id uuid FK profiles
- title text
- text text
- media_type text ('text','image','video')
- media_url text
- status text ('pending','active','declined')
- created_at, updated_at

### payments
- id uuid PK
- user_id uuid FK profiles
- product_id uuid FK products nullable
- ad_id uuid FK ads nullable
- target text ('product','ad')
- amount numeric
- method text ('transcash')
- status ('pending','accepted','declined')
- validation ('pending','valid','invalid')
- proof_url text (chemin storage, ex: user_id/uuid.jpg)
- created_at, updated_at

### settings
- key text PK
- value text
- created_at, updated_at
- Contient `payment_redirect_url`

## 2. Buckets Storage

- **product-images** : public true
  - Utilisé pour images produits + médias annonces
  - Chemin produits: `products/{uuid}.{ext}`
  - Chemin annonces: `ads/{user_id}/{uuid}.{ext}`

- **payment-proofs** : public false
  - Preuves TransCash
  - Chemin: `{user_id}/{uuid}.{ext}`
  - Accès via signed URL 300s générée par backend admin

## 3. Triggers

- `handle_updated_at()` : met à jour updated_at avant chaque UPDATE
- `handle_new_user()` : après INSERT dans auth.users, crée ligne dans profiles avec role user

## 4. RLS

Activé sur toutes les tables.

- **profiles** : lecture publique, écriture owner ou admin
- **products** : lecture publique, écriture admin seulement
- **ads** : lecture si active OU owner OU admin, création owner, admin tout
- **payments** : owner voit ses paiements, création owner, admin tout
- **settings** : lecture publique, écriture admin

Fonction helper `is_admin()` : check si auth.uid() a role admin dans profiles (security definer).

## 5. Ordre d'exécution SQL

Dans Supabase Dashboard > SQL Editor > New query :

1. `schema.sql` (crée tables + triggers)
2. `policies.sql` (RLS policies)
3. `storage.sql` (buckets + storage policies)
4. `seed.sql` (optionnel)

Si erreur "already exists", c'est normal (idempotent avec IF NOT EXISTS).

## 6. Vérifications

```sql
-- Vérifier tables
select table_name from information_schema.tables where table_schema='public';

-- Vérifier profiles
select * from profiles limit 5;

-- Vérifier buckets
select * from storage.buckets;

-- Vérifier RLS activé
select tablename, rowsecurity from pg_tables where schemaname='public';
```

## 7. Créer admin manuellement (sans script)

Si tu veux le faire en SQL :

```sql
-- 1. Crée user via Dashboard > Authentication > Add user
-- Email: ijlalradji3@email.com
-- Password: Ijlal1234
-- Auto confirm: true

-- 2. Récupère son ID
select id, email from auth.users where email='john@email.com';

-- 3. Passe en admin
update public.profiles set role='admin' where id='UUID_ICI';
```

Ou via script `node scripts/create-admin.js`

## 8. Tester API

```bash
curl https://TON_PROJET.supabase.co/rest/v1/products -H "apikey: PUBLISHABLE_KEY"
```

Mais mieux via backend `/api/products`

## 9. Sécurité production

- Ne JAMAIS exposer SECRET_KEY côté frontend
- PUBLISHABLE_KEY est safe en frontend (avec RLS)
- Active Email confirmation si besoin
- Ajoute rate limiting dans Supabase > Auth > Rate limits
- Pour payment-proofs, garde privé et utilise signed URLs seulement

## 10. Migration depuis ancien code

Ancien code stockait tout en localStorage. Nouveau :

- Supabase est source de vérité
- localStorage garde seulement cache user + notices + redirect url
- HydrateState fetch depuis Supabase à chaque load + onAuthStateChange

Si tu avais des données locales, elles sont perdues (volontaire, pour passer en prod propre).
