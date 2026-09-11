# Action ou Vérité — Édition Premium

Jeu d'ambiance adulte connecté à Supabase, avec **10000 défis (Brûlant + Hardcore)**.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Application complète (thème sombre/clair/auto, 10 palettes, glassmorphism, icônes SVG, navigation basse) |
| `supabase.sql` | Backend complet **pour une base neuve** (10000 cartes, tables, RLS, fonctions RPC) |
| `migration_cards.sql` | **Migration (1/2)** : schéma + fonctions + comptes + cartes 1 à 5000 (~700 Ko) |
| `migration_cards_2.sql` | **Migration (2/2)** : cartes 5001 à 10000 (~690 Ko) |
| `cards.json` | Les 10000 cartes au format JSON (données brutes) |
| `generate_extra.py` | Générateur déterministe (`seed=7`) du paquet : 5000 actions + 5000 vérités, registre courant, 3 variantes de cible, relançable |

## Les 10000 cartes

- **Niveau unique** : `brulant` (Brûlant) — aucune sélection de mode dans l'app.
- **Types** : `truth` = 5000 vérités · `dare` = 5000 actions.
- Composition : **436 cartes du fichier « Json a ou v »** + cartes générées (brûlant / hardcore / hardcore++), relançables via `generate_extra.py`.
- **Français courant** : tous les termes techniques ou anglicismes sont traduits (`lap dance → danse collée`, `strip-tease → effeuillage`, `clavicule → haut de la poitrine`, `reins → bas du dos`, `sexy → sensuel`, …).
- **Cible des actions** (au lieu de « du sexe opposé ») — trois variantes :
  - **rien** : l'action ne désigne personne (« Embrasse le cou de la personne à ta gauche… »),
  - **`la personne de ton choix`**,
  - **`{nom}`** : à l'affichage, remplacé par le prénom d'un joueur dont le **sexe est opposé** à celui du joueur courant.
- Chaque joueur **choisit son sexe (H / F)** au départ de la partie (pastille H/F dans la liste des joueurs) ; il sert au tirage des défis nominatifs.
- **Pioche sans répétition** : dans une même partie, une carte piochée ne ressort pas (marquée `is_used`). Au lancement d'une **nouvelle partie**, tout le paquet est **remélangé** (RPC `new_game`) : les 10000 cartes redeviennent disponibles.
- Format : `{ "id", "type", "level", "text" }` — `verite → truth`, `action → dare`.

## Mise en route

### 1) Base de données (une seule fois)
Dans Supabase → **SQL Editor → New query** :
- **Base neuve** → colle tout `supabase.sql` → Run.
- **Base existante** → exécute dans l'ordre :
  1. `migration_cards.sql` (schéma + fonctions + comptes + cartes 1 à 5000) → Run
  2. `migration_cards_2.sql` (cartes 5001 à 10000) → Run

> Les deux fichiers de migration sont volontairement légers (~700 Ko chacun) pour passer sans souci dans l'éditeur SQL de Supabase.

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

- **Créer un compte** : nom d'utilisateur + **code PIN (4 chiffres)**.
- **Se connecter** : nom d'utilisateur + **code PIN** (le même que celui choisi à la création).
- Une fois connecté, on peut **ajouter un défi** (Action / Vérité) ou **importer un fichier** (`.json` ou `.txt`, un défi par ligne, préfixe `action:` / `verite:` optionnel).
- Ces défis sont **sauvegardés uniquement sur le compte** (table `user_cards`, accès par token de session).
- Bouton **globe** sur chaque défi : **publie** le défi pour qu'il rejoigne le paquet commun et soit **accessible à tous les joueurs** (table `cards`, source `community`). Re-cliquer pour le retirer.
- Bouton **« Tout publier »** : publie **tous** les défis personnels d'un seul coup.
- Bouton **crayon** sur chaque défi : **modifie** le texte (répercuté dans le paquet commun si le défi est publié).
- Option « **Inclure mes défis dans la partie** » : le jeu pioche alors aussi parmi les défis personnels du compte connecté (sans répéter un défi récemment montré).

## RPC disponibles (appels depuis l'app)

| Fonction | Méthode | Corps |
|---|---|---|
| `draw_card` | `POST /rest/v1/rpc/draw_card` | `{ "p_type": "truth", "p_level": "brulant" }` — pioche sans répéter (carte marquée `is_used`) |
| `new_game` | `POST /rest/v1/rpc/new_game` | `{}` — **remélange tout le paquet** au début de chaque partie |
| `stats` | `POST /rest/v1/rpc/stats` | `{}` |
| `reset_game` | `POST /rest/v1/rpc/reset_game` | `{}` |
| `clear_history` | `POST /rest/v1/rpc/clear_history` | `{}` |
| `sign_up` | `POST /rest/v1/rpc/sign_up` | `{ "p_username", "p_pin" }` |
| `sign_in` | `POST /rest/v1/rpc/sign_in` | `{ "p_username", "p_pin" }` |
| `sign_out` | `POST /rest/v1/rpc/sign_out` | `{ "p_token" }` |
| `me` | `POST /rest/v1/rpc/me` | `{ "p_token" }` |
| `add_card` | `POST /rest/v1/rpc/add_card` | `{ "p_token", "p_type", "p_text" }` |
| `import_cards` | `POST /rest/v1/rpc/import_cards` | `{ "p_token", "p_cards": [{ "type", "text" }] }` |
| `my_cards` | `POST /rest/v1/rpc/my_cards` | `{ "p_token" }` |
| `delete_card` | `POST /rest/v1/rpc/delete_card` | `{ "p_token", "p_card_id" }` |
| `publish_card` | `POST /rest/v1/rpc/publish_card` | `{ "p_token", "p_card_id" }` — rend le défi **accessible à tous** |
| `unpublish_card` | `POST /rest/v1/rpc/unpublish_card` | `{ "p_token", "p_card_id" }` — retire le défi du paquet commun |
| `publish_all_cards` | `POST /rest/v1/rpc/publish_all_cards` | `{ "p_token" }` — **publie tous** les défis personnels d'un coup (retourne le nombre publié) |
| `update_card` | `POST /rest/v1/rpc/update_card` | `{ "p_token", "p_card_id", "p_text" }` — **modifie** un défi personnel (répercuté dans le paquet commun s'il est publié) |

Tables REST : `GET/POST/PATCH/DELETE /rest/v1/players`, `GET /rest/v1/history?select=*&order=id.desc&limit=200`.
Les codes PIN sont **hachés** (bcrypt via pgcrypto) ; les tables `accounts` / `sessions` / `user_cards` sont en RLS sans politique (accès uniquement via les RPC).

## Thème & palettes

- **Palette par défaut** : **Hot** 🔥 (rouge / or / violet sur fond quasi noir, titre en serif, scanlines + particules, portail 18+).
- **10 palettes** : Hot, Aurora, Émeraude, Océan, Coucher, **Or**, **Rouge**, **Gris**, **Rose**, **Liquid Glass** — Réglages → Palette de couleurs.
- **Thème** : sombre, clair ou automatique (suit l'appareil) — bouton lune/soleil en haut, ou Réglages.
- **Portail adulte** : à l'ouverture, un écran « Adultes uniquement » s'affiche (accepté = mémorisé pour la session).
- Choix mémorisés dans `localStorage`.
