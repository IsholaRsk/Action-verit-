# EscortHub v2 - Code Complet + Supabase

Projet refait de zéro : **frontend modulaire + backend Express + Supabase complet**.

## 📁 Structure

```
/
├── index.html          # HTML clean (import ES module)
├── app.js              # Logique frontend complète (supabase-js v2)
├── config.js           # Config frontend
├── style.css           # Design modern dark + responsive
├── server.js           # Backend Express + API sécurisée
├── package.json
├── .env.example
├── supabase/
│   ├── schema.sql      # Tables + triggers + fonctions
│   ├── policies.sql    # RLS policies
│   ├── storage.sql     # Buckets + policies storage
│   └── seed.sql        # Données exemple
└── scripts/
    └── create-admin.js # Créer un admin via service_role
```

## 🚀 Installation locale

```bash
npm install
cp .env.example .env
# Remplis .env avec tes clés Supabase
npm start
# http://localhost:3000
```

## 🔑 Variables .env

```
SUPABASE_URL=https://desgfxqfmuqkslzntefg.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxx (service_role, JAMAIS exposée frontend)
SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx (publishable)
PORT=3000
DEFAULT_REDIRECT_URL=https://t.me/Polarish87
FIXED_AD_PRICE=5000
```

## 🗄️ Setup Supabase (IMPORTANT - ordre)

1. **Dashboard Supabase > SQL Editor**

Exécute dans l'ordre :

```sql
-- 1. Schema
-- Copie/colle supabase/schema.sql

-- 2. Policies
-- Copie/colle supabase/policies.sql

-- 3. Storage
-- Copie/colle supabase/storage.sql

-- 4. Seed (optionnel)
-- Copie/colle supabase/seed.sql
```

2. **Storage > Vérifie buckets**

- `product-images` doit être **public**
- `payment-proofs` doit être **private**

Si buckets non créés par SQL, crée-les manuellement dans Dashboard > Storage > New bucket.

3. **Auth > Providers**

- Active Email provider
- Désactive Confirm email si tu veux (ou laisse activé)

## 👑 Créer Admin

```bash
# Avec les valeurs par défaut du code original
node scripts/create-admin.js ijlalradji3@email.com Ijlal1234 admin

# Ou custom
node scripts/create-admin.js ton@email.com TonPass123 tonpseudo
```

Puis :

- Va sur `/#/login`
- Connecte-toi
- Va sur `/#/admin`

## 🔐 Sécurité corrigée

Ancien code :
- Secret key exposée ? Non, mais admin créé à chaque démarrage (faille)
- RLS manquant / bypass
- Upload sans vérification

Nouveau code :
- Backend Express avec `requireUser` + `requireAdmin` vérifiant JWT + role dans `profiles`
- RLS activé sur toutes les tables
- Policies : user voit seulement ses paiements/ads, admin voit tout
- Storage : `payment-proofs` privé, accès via signed URL 5min générée par backend (service_role)
- `product-images` public mais upload seulement si authenticated
- Plus de création admin auto au démarrage (script dédié)
- Validation stricte prix, age >=18, etc.

## 💳 Flux paiement

1. User choisit produit → modal → upload preuve TransCash → `payment-proofs/{user_id}/{uuid}.jpg`
2. `POST /api/payments` → insert `pending`
3. Admin voit dans `/#/admin` → Accepter/Décliner → `PATCH /api/payments/:id`
4. Si `accepted` + `target=product` → frontend redirige vers `payment_redirect_url` (Telegram)
5. Si `accepted` + `target=ad` → ad passe `active` → visible dans bannière

## 📢 Annonces

- User poste annonce → `pending` → doit payer 5000 (FIXED_AD_PRICE)
- Après paiement validé par admin → `active`
- Bannière affiche 2 dernières actives

## 🌐 Déploiement

### Vercel / Render / Railway

- Build command: `npm install`
- Start command: `npm start`
- Ajoute env vars dans dashboard

### Supabase Edge ?

Non besoin, backend Node suffit.

## 🛠️ API Endpoints

```
GET  /api/health
GET  /api/products (public)
POST /api/products (admin)
DELETE /api/products/:id (admin)

POST /api/payments (auth)
GET  /api/payments (admin)
PATCH /api/payments/:id (admin)
GET  /api/payments/:id/proof (admin) -> redirect signed url

GET  /api/ads (public active)
POST /api/ads (auth)
DELETE /api/ads/:id (admin)

GET  /api/settings (public)
PATCH /api/settings (admin)
```

## 🎨 Frontend

- `app.js` ES Module, pas de bundle nécessaire
- Hash router `#/`, `#/products`, `#/login`, `#/signup`, `#/admin`, `#/discussion`
- Supabase client ESM via importmap CDN
- État global `state`
- Modales paiement/annonce
- Hero slideshow avec `CONFIG.HERO_IMAGES`

## 🐛 Debug

```js
// Console navigateur
window._escorthub.state
window._escorthub.supabase
```

## 📝 TODO améliorations

- Ajouter pagination produits
- Ajouter recherche / filtres lieu/prix
- Ajouter Stripe / Paystack vrai provider carte
- Ajouter notifications realtime Supabase
- Ajouter rate limiting backend

---

Créé par refacto complète du code fourni.
