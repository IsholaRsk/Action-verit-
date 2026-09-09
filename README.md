# Action ou Vérité — Édition Premium

Jeu d'ambiance adulte connecté à Supabase, avec **10000 défis (Brûlant + Hardcore)**.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Application complète (thème sombre/clair/auto, 5 palettes, glassmorphism, icônes SVG, navigation basse) |
| `supabase.sql` | Backend complet **pour une base neuve** (10000 cartes, tables, RLS, fonctions RPC) |
| `migration_cards.sql` | **Migration** : remplace les cartes existantes par les 10000 (à exécuter si un ancien script a déjà tourné) |
| `cards.json` | Les 10000 cartes au format JSON (données brutes) |
| `generate_extra.py` | Générateur des 9564 cartes supplémentaires (1064 brûlant + 2000 hardcore + 6500 hardcore++, relançable) |

## Les 10000 cartes

- **Niveau unique** : `brulant` (Brûlant) — aucune sélection de mode dans l'app.
- **Types** : `truth` = 5000 vérités · `dare` = 5000 actions.
- Composition : **436 cartes du fichier « Json a ou v »** + **1064 brûlant** + **2000 hardcore** + **6500 hardcore++**.
- Les **actions** visent toujours une personne **du sexe opposé**.
- Format : `{ "id", "type", "level", "text" }` — `verite → truth`, `action → dare`.

## Mise en route

### 1) Base de données (une seule fois)
Dans Supabase → **SQL Editor → New query** :
- **Base neuve** → colle tout `supabase.sql` → Run.
- **Base existante** → colle tout `migration_cards.sql` → Run.

### 2) Frontend
La connexion est déjà configurée dans `index.html` :
```js
const SUPABASE = {
  url: "https://ljdzkuielhiytrzwhave.supabase.co",
  key: "sb_publishable_vitVztwFe95ZWC9eR_s_mw_kTHd7wjK"
};
```
Déployez `index.html` (Netlify, Vercel, GitHub Pages…) ou ouvrez-le localement.

## Comptes & défis personnels

- **Créer un compte** : nom d'utilisateur + **mot de passe OU code PIN (4 chiffres)**.
- **Se connecter** : même chose — mot de passe ou PIN, au choix.
- Une fois connecté, on peut **ajouter un défi** (Action / Vérité) ou **importer un fichier** (`.json` ou `.txt`, un défi par ligne, préfixe `action:` / `verite:` optionnel).
- Ces défis sont **sauvegardés uniquement sur le compte** (table `user_cards`, accès par token de session).
- Option « **Inclure mes défis dans la partie** » : le jeu pioche alors aussi parmi les défis personnels du compte connecté.

## RPC disponibles (appels depuis l'app)

| Fonction | Méthode | Corps |
|---|---|---|
| `draw_card` | `POST /rest/v1/rpc/draw_card` | `{ "p_type": "truth", "p_level": "brulant" }` |
| `stats` | `POST /rest/v1/rpc/stats` | `{}` |
| `reset_game` | `POST /rest/v1/rpc/reset_game` | `{}` |
| `clear_history` | `POST /rest/v1/rpc/clear_history` | `{}` |
| `sign_up` | `POST /rest/v1/rpc/sign_up` | `{ "p_username", "p_password", "p_pin" }` |
| `sign_in` | `POST /rest/v1/rpc/sign_in` | `{ "p_username", "p_password", "p_pin" }` |
| `sign_out` | `POST /rest/v1/rpc/sign_out` | `{ "p_token" }` |
| `me` | `POST /rest/v1/rpc/me` | `{ "p_token" }` |
| `add_card` | `POST /rest/v1/rpc/add_card` | `{ "p_token", "p_type", "p_text" }` |
| `import_cards` | `POST /rest/v1/rpc/import_cards` | `{ "p_token", "p_cards": [{ "type", "text" }] }` |
| `my_cards` | `POST /rest/v1/rpc/my_cards` | `{ "p_token" }` |
| `delete_card` | `POST /rest/v1/rpc/delete_card` | `{ "p_token", "p_card_id" }` |

Tables REST : `GET/POST/PATCH/DELETE /rest/v1/players`, `GET /rest/v1/history?select=*&order=id.desc&limit=200`.
Les mots de passe / PIN sont **hachés** (bcrypt via pgcrypto) ; les tables `accounts` / `sessions` / `user_cards` sont en RLS sans politique (accès uniquement via les RPC).

## Thème & palettes

- **Palette par défaut** : **Hot** 🔥 (rouge / or / violet sur fond quasi noir, titre en serif, scanlines + particules, portail 18+).
- **Autres palettes** : Aurora, Émeraude, Océan, Coucher de soleil — Réglages → Palette de couleurs.
- **Thème** : sombre, clair ou automatique (suit l'appareil) — bouton lune/soleil en haut, ou Réglages.
- **Portail adulte** : à l'ouverture, un écran « Adultes uniquement » s'affiche (accepté = mémorisé pour la session).
- Choix mémorisés dans `localStorage`.
