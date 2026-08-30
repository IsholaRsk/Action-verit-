# LUNACORE — Boutique e-commerce (Next.js 14 + TypeScript + Tailwind)

Site full-stack fonctionnelle du site fourni : catalogue, fiches produit,
panier persistant, tunnel de commande et API de commandes. Architecture prête
à scaler (App Router, API routes, schéma Prisma/Postgres fourni).

## Stack
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (thème sombre / accent orange, fidèle à la maquette)
- Zustand (état du panier, persistant en localStorage)
- API routes Next.js (`/api/orders`) — prêtes à brancher Stripe + Postgres
- Schéma Prisma inclus (`prisma/schema.prisma`) pour passer en base réelle

## Lancer en local
```bash
npm install
npm run dev
```
Ouvrez http://localhost:3000

## Déployer sur Vercel (votre compte)
Je n'ai pas la permission de déployer directement sur votre compte Vercel
depuis cette conversation (le connecteur Vercel disponible ici est en lecture
seule : listing de projets/déploiements, pas de création). Voici comment le
faire vous-même en 2 minutes :

### Option A — via GitHub (recommandé)
1. Poussez ce dossier vers un nouveau repo GitHub.
2. Sur vercel.com → **Add New Project** → importez le repo.
3. Vercel détecte Next.js automatiquement (aucune config nécessaire).
4. Cliquez **Deploy**.

### Option B — via CLI, sans GitHub
```bash
npm install -g vercel
cd lunacore-store
vercel        # suit les prompts, lie à votre compte
vercel --prod # déploiement de production
```

## Passer en production réelle (checklist scaling)
- [ ] **Base de données** : créez un Postgres (Vercel Postgres, Neon ou Supabase),
      ajoutez `DATABASE_URL` dans les variables d'environnement Vercel, puis
      `npx prisma migrate deploy` et migrez `lib/products.ts` vers des requêtes Prisma.
- [ ] **Paiement** : ajoutez `STRIPE_SECRET_KEY` et branchez Stripe Checkout
      dans `app/api/orders/route.ts` (l'emplacement est indiqué en commentaire).
- [ ] **Images** : remplacez les URLs Unsplash par vos vraies photos produit
      (uploadez sur Vercel Blob, Cloudinary ou S3).
- [ ] **Emails de confirmation** : branchez Resend ou Postmark après création de commande.
- [ ] **Auth compte client** : ajoutez NextAuth si vous voulez des comptes utilisateurs.
- [ ] **Stock** : décrémentez le stock réel à la confirmation du paiement (webhook Stripe).

## Structure
```
app/
  page.tsx                  → accueil
  category/[category]/      → pages catégorie (men, women, accessories, new, all)
  product/[slug]/           → fiche produit
  checkout/                 → tunnel de commande + page succès
  api/orders/route.ts       → création de commande (POST) / liste (GET)
components/                 → Header, Footer, CartDrawer, ProductCard, ProductActions
lib/products.ts             → catalogue (à remplacer par Prisma en prod)
lib/cart-store.ts           → état global du panier (Zustand + persist)
prisma/schema.prisma        → schéma DB prêt à l'emploi
```
