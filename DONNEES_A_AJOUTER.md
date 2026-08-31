# ✅ LISTE COMPLÈTE DES DONNÉES À AJOUTER - EscortHub v2

Tu as le code, mais sans ces données Supabase + .env, rien ne marchera.

---

## 1. FICHIER `.env` À CRÉER À LA RACINE

Crée un fichier `.env` (copie `.env.example`) avec :

```env
SUPABASE_URL=https://desgfxqfmuqkslzntefg.supabase.co
SUPABASE_SECRET_KEY=sb_secret_..._A_RECUPERER
SUPABASE_PUBLISHABLE_KEY=sb_publishable_6s1OkSl3F5eKvTyFu7BBhA_VbxaXEOM
PORT=3000
DEFAULT_REDIRECT_URL=https://t.me/Polarish87
FIXED_AD_PRICE=5000
```

**Où trouver SECRET_KEY ?**
Supabase Dashboard > Ton projet eecjjupfdujvludxtloj > Settings > API Keys > `service_role` > Secret key (clique Reveal)

⚠️ Ne mets JAMAIS cette clé dans le frontend, uniquement dans `.env` backend.

---

## 2. SUPABASE SQL - 1 SEUL FICHIER À EXÉCUTER

Va dans : Supabase Dashboard > SQL Editor > New Query

Colle **TOUT** le contenu de `supabase/FULL_SETUP.sql` et clique RUN.

Ça va créer :

### Tables :

**a) `profiles`**
- id (uuid, FK auth.users)
- full_name (text)
- username (text unique)
- role (text: 'user' ou 'admin')
- created_at, updated_at

**b) `products`** - Catalogue
- id (uuid auto)
- nom (text) EX: "Sophia"
- age (int >=18) EX: 23
- lieu (text) EX: "Cotonou"
- prix (numeric >0) EX: 150
- image (text url) EX: "https://...jpg" ou url storage public
- created_at, updated_at

**c) `ads`** - Annonces sponsorisées
- id (uuid)
- user_id (uuid FK profiles)
- title (text) EX: "Promo week-end"
- text (text) EX: "Description annonce"
- media_type (text: 'text','image','video')
- media_url (text url)
- status (text: 'pending','active','declined') -> 'pending' à la création, 'active' après paiement accepté admin
- created_at, updated_at

**d) `payments`** - Paiements TransCash
- id (uuid)
- user_id (FK profiles)
- product_id (FK products, nullable si c'est une annonce)
- ad_id (FK ads, nullable si c'est un produit)
- target (text: 'product' ou 'ad')
- amount (numeric) EX: 150 ou 5000
- method (text: 'transcash')
- status (text: 'pending','accepted','declined')
- validation (text: 'pending','valid','invalid')
- proof_url (text) EX: "user_id/uuid.jpg" -> chemin dans bucket payment-proofs
- created_at, updated_at

**e) `settings`**
- key (text PK) -> DOIT contenir au moins `payment_redirect_url`
- value (text) -> EX: "https://t.me/Polarish87"
- created_at, updated_at

### Fonctions créées :
- `handle_updated_at()` -> met à jour updated_at auto
- `handle_new_user()` -> crée profil auto quand un user s'inscrit
- `is_admin()` -> vérifie si auth.uid() est admin

### RLS :
Activé sur toutes les tables. Si tu ne l'exécutes pas, tout le monde peut tout modifier.

---

## 3. STORAGE - 2 BUCKETS À VÉRIFIER

Va dans : Supabase Dashboard > Storage

Le SQL crée déjà, mais vérifie :

**Bucket 1 : `product-images`**
- Public : ✅ OUI (coché)
- Usage : images produits + médias annonces
- Chemins :
  - Produits : `products/{uuid}.jpg`
  - Annonces : `ads/{user_id}/{uuid}.jpg`

**Bucket 2 : `payment-proofs`**
- Public : ❌ NON (privé)
- Usage : preuves TransCash
- Chemins : `{user_id}/{uuid}.jpg`
- Accès admin via signed URL 5min générée par backend

Si buckets pas créés par SQL, crée-les manuellement : New bucket > nom exact > public/private comme ci-dessus.

**Policies Storage** (créées par SQL) :
- product-images : lecture publique, upload si authenticated
- payment-proofs : upload seulement dans son propre dossier user_id, lecture owner ou admin

---

## 4. AUTH - CRÉER TON COMPTE ADMIN

### Option A - Script (recommandé)
```bash
npm install
node scripts/create-admin.js ijlalradji3@email.com Ijlal1234 admin
```

### Option B - Manuel Dashboard
1. Authentication > Users > Add user
   - Email: `ijlalradji3@email.com`
   - Password: `Ijlal1234`
   - Auto Confirm User: ✅ OUI
2. SQL Editor :
```sql
-- Trouve l'ID
SELECT id, email FROM auth.users WHERE email='ijlalradji3@email.com';
-- Passe admin
UPDATE public.profiles SET role='admin' WHERE id='UUID_TROUVE';
```

**Données admin nécessaires :**
- Email : ijlalradji3@email.com (ou ton email)
- Password : Ijlal1234 (min 6 caractères)
- Username : admin
- Role : admin (dans profiles, pas dans auth.users)

---

## 5. DONNÉES DE BASE À INSÉRER (SEED)

### a) Settings (obligatoire)
```sql
INSERT INTO public.settings (key, value) VALUES 
('payment_redirect_url','https://t.me/Polarish87')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```
Tu peux changer le lien Telegram/WhatsApp après dans /#/admin

### b) Produits exemples (optionnel mais vide sinon)
```sql
INSERT INTO public.products (nom, age, lieu, prix, image) VALUES
('Sophia', 23, 'Cotonou', 150, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'),
('Maya', 25, 'Abomey-Calavi', 200, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'),
('Chloé', 22, 'Porto-Novo', 120, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400');
```
Ou ajoute-les via /#/admin > Ajouter produit (avec upload image)

**Champs obligatoires pour un produit :**
- nom : texte non vide
- age : nombre >=18
- lieu : texte non vide
- prix : nombre >0
- image : URL https ou chemin storage public (obligatoire)

---

## 6. FRONTEND - IMAGES HERO (optionnel)

Ton ancien code utilisait `1.jpg` à `10.jpg` pour le slideshow hero.

Dans `config.js` :
```js
HERO_IMAGES: Array.from({ length: 10 }, (_, i) => `${i + 1}.jpg`)
```

Si tu n'as pas ces images à la racine, le hero aura juste un fond noir. Ajoute :
- `1.jpg`, `2.jpg`, ... `10.jpg` à la racine du projet (même dossier que index.html)
- Ou modifie `config.js` pour mettre des URLs Unsplash

Exemple si tu veux Unsplash :
```js
HERO_IMAGES: [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200"
]
```

---

## 7. CHECKLIST FINALE AVANT LANCEMENT

- [ ] `.env` créé avec SECRET_KEY
- [ ] SQL `FULL_SETUP.sql` exécuté sans erreur
- [ ] Buckets vérifiés (product-images public, payment-proofs privé)
- [ ] Compte admin créé + role admin dans profiles
- [ ] Au moins 1 produit ajouté (via SQL ou admin panel)
- [ ] Setting `payment_redirect_url` existe
- [ ] `npm install` fait
- [ ] `npm start` -> http://localhost:3000/api/health doit retourner `{"ok":true}`

---

## 8. DONNÉES QUE L'UTILISATEUR VA CRÉER ENSUITE (automatique)

Tu n'as pas à les ajouter, c'est le fonctionnement normal :

- **Inscription user** -> crée auth.users + profiles auto (trigger)
- **Achat produit** -> crée payment avec proof_url dans payment-proofs
- **Post annonce** -> crée ad en pending + payment de 5000
- **Admin accepte paiement** -> payment status accepted + ad active OU redirection vers Telegram

---

## RÉSUMÉ EN 3 LIGNES

1. **À ajouter à la main :** `.env` avec SECRET_KEY + exécuter `FULL_SETUP.sql` + créer admin
2. **À ajouter pour tester :** 2-3 produits + setting redirect
3. **Le reste :** se crée tout seul quand les users utilisent le site

Besoin que je te génère le `.env` final avec ta clé secrète si tu me la donnes (en privé) ?
