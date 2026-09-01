# Paddle Billing - Abonnement 5.99€/mois - Installation complète

## Price ID fourni
`pri_01m1e8e2ybr9rjmaq0kz4ezpnk` - 5,99€ / mois - accès premium

## 1. Base de données Supabase
Exécute dans SQL Editor dans l'ordre:
1. `supabase/FULL_SETUP_FIXED_NO_TELEGRAM.sql` (corrige legacy products.name + base)
2. `supabase/DASHBOARD_200_LIGNES.sql` (balance, payment_methods, deposit_requests, RPCs)
3. `supabase/ADD_PADDLE_SUBSCRIPTION.sql` (nouveau - abonnements)

Vérifie:
```sql
select * from paddle_subscriptions limit 5;
select public.has_active_subscription(auth.uid());
```

## 2. Variables d'environnement
Copie `.env.example` vers `.env` et remplis:

```
SUPABASE_URL=...
SUPABASE_SECRET_KEY=sb_secret_... (service role)
PADDLE_API_KEY=pdl_... (serveur only)
PADDLE_WEBHOOK_SECRET=pdl_ntfset_... (serveur only)
PADDLE_CLIENT_TOKEN=test_... ou live_... (public, pour Paddle.js)
PADDLE_ENV=sandbox (ou production)
PADDLE_PRICE_ID=pri_01m1e8e2ybr9rjmaq0kz4ezpnk
```

**IMPORTANT SECURITE:**
- Ne jamais mettre `PADDLE_API_KEY` ou `PADDLE_WEBHOOK_SECRET` dans `app.js` ou frontend
- Uniquement `PADDLE_CLIENT_TOKEN` (public) va frontend via `window.PADDLE_CLIENT_TOKEN` ou `CONFIG.PADDLE_CLIENT_TOKEN`
- Le serveur vérifie toujours statut réel via `/api/subscription/status` + webhook, pas frontend

## 3. Webhook Paddle
### Endpoint demandé
`https://escortepointfr.store/paddle-webhook.php`

**Option A - PHP (pour ton domaine escortepointfr.store):**
- Upload `paddle-webhook.php` à la racine de `escortepointfr.store`
- Configure `.env` sur serveur PHP avec `PADDLE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Dans Paddle Dashboard → Developer Tools → Notifications → Add destination → URL = `https://escortepointfr.store/paddle-webhook.php` → Events: `subscription_created`, `subscription_activated`, `subscription_updated`, `subscription_canceled`, `subscription_paused`, `subscription_resumed`, `transaction_completed`, `transaction_paid` → Secret = ton webhook secret

**Option B - Node (pour dev local / Vercel):**
- Déjà implémenté dans `server.js` : `POST /api/paddle-webhook` et `POST /paddle-webhook.php`
- Même vérif signature HMAC SHA256 `ts:payload`
- Configure Paddle webhook URL = `https://ton-domaine.com/api/paddle-webhook` en plus du PHP si besoin

**Vérification signature:**
```js
signed = ts + ':' + rawBody
computed = HMAC-SHA256(signed, PADDLE_WEBHOOK_SECRET)
compare timingSafeEqual(computed, h1)
```

## 4. Frontend - app.js
- `hydrate()` appelle `/api/subscription/status` (serveur vérifie, pas confiance frontend)
- `state.isPremium` = true si subscription status active/trialing et current_period_end > now()
- Si connecté sans abonnement actif → écran `🔒 Abonnement requis` + bouton `S'abonner maintenant - 5,99€/mois`
- Bouton ouvre `Paddle.Checkout.open({items:[{priceId: PRICE_ID}], customData:{user_id}, customer:{email}})`
- Après `checkout.completed` → poll `/api/subscription/status` toutes les 3s pendant 30s jusqu'à webhook active
- Badge `Abonné` affiché quand actif (header wallet + paiement + orders)
- Premium bloqué: product detail, payment, orders, wallet → subscriptionRequiredScreen() si pas premium
- Public pages (home, products) restent visibles sans abonnement

## 5. Flux utilisateur
```
Visiteur → voit home/products (public)
↓
Clique COMMANDER → si non connecté → /login → retour auto /payment?product=123
↓
Si connecté sans abonnement → 🔒 Abonnement requis → S'abonner maintenant → Paddle Checkout (5,99€)
↓
Paiement confirmé → webhook Paddle → POST /paddle-webhook.php → upsert paddle_subscriptions status=active → trigger sync is_premium dans profiles
↓
Frontend poll /api/subscription/status → isActive=true → badge Abonné → accès premium débloqué
↓
Peut payer produit avec solde → commande → Mes commandes → VOIR → CONTACTER SUR TELEGRAM (compte associé produit)
↓
Si abonnement expire/annulé → webhook subscription_canceled/expired → status=canceled/expired → is_premium=false → accès premium auto désactivé → re-affiche Abonnement requis
```

## 6. Sécurité anti-contournement
- Prix produit récupéré côté serveur via `rpc pay_product`
- Solde modifié uniquement serveur
- Abonnement vérifié serveur via `has_active_subscription(auth.uid())` + `/api/subscription/status` avec Bearer token
- Frontend ne peut pas modifier `is_premium` (RLS + trigger serveur)
- Webhook vérifie signature Paddle, refuse si invalide
- `paddle_subscriptions` insert/update uniquement via service_role (webhook), pas via user normal

## 7. Interface
- Badge `Abonné` vert avec couronne quand actif
- Écran `🔒 Abonnement requis` pro responsive avec avantages + bouton S'abonner
- Bouton `Gérer abonnement` → ouvre Customer Portal Paddle avec customer_id
- Message "Paiement en cours" + "Confirmation après activation"

## 8. Fichiers créés/modifiés
- `supabase/ADD_PADDLE_SUBSCRIPTION.sql` → table paddle_subscriptions + has_active_subscription()
- `paddle-webhook.php` → endpoint PHP https://escortepointfr.store/paddle-webhook.php
- `server.js` → ajout /api/paddle-webhook, /paddle-webhook.php, /api/subscription/status, /api/paddle/create-checkout, /api/paddle/manage
- `paddle-client.js` → initPaddle() + openPaddleCheckout() + checkSubscriptionStatus()
- `config.js` → ajout PADDLE_CLIENT_TOKEN, PADDLE_ENV, PADDLE_PRICE_ID
- `index.html` → ajout <script src="https://cdn.paddle.com/paddle/v2/paddle.js"> + window.PADDLE_*
- `app.js` → ajout state.subscription/isPremium, subscriptionRequiredScreen(), checkPremium(), openCheckout(), badge Abonné, blocage premium si pas abonné
- `.env.example` → variables Paddle

## 9. Test
1. Crée user test, connecte-toi
2. Va sur produit → COMMANDER → doit voir Abonnement requis
3. Clique S'abonner maintenant → Paddle sandbox checkout avec carte test 4242...
4. Paye → attends webhook (check logs serveur + Supabase paddle_subscriptions)
5. Recharge page → badge Abonné → accès premium OK → peut payer produit
6. Annule abonnement dans Paddle Dashboard → webhook canceled → badge disparaît → re-bloqué

## 10. Production
- Passe PADDLE_ENV=production, utilise live client token et live webhook secret
- Configure webhook URL production dans Paddle Dashboard
- Vérifie HTTPS obligatoire pour webhook
