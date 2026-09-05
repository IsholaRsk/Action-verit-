# Déployer nouvelle version sur escortepointfr.store

## Option 1: Via Vercel Dashboard (2 clics) - RECOMMANDÉ
1. https://vercel.com/dashboard -> trouve projet avec domaine escortepointfr.store
2. Deployments -> Redeploy -> Uncheck "Use Build Cache" -> Redeploy
3. OU si projet pas connecté: https://vercel.com/new/clone?repository-url=https://github.com/IsholaRsk/Action-verit- -> Deploy -> Settings -> Domains -> Add escortepointfr.store

## Option 2: Via Vercel CLI avec token
```bash
npm i -g vercel
vercel --prod --token YOUR_VERCEL_TOKEN
```

## Option 3: Via GitHub Action auto
Ajoute ces secrets dans GitHub repo Settings -> Secrets:
- VERCEL_TOKEN (from https://vercel.com/account/tokens)
- VERCEL_ORG_ID (from Vercel project Settings)
- VERCEL_PROJECT_ID (from Vercel project Settings)

Puis push sur main déclenche deploy auto.

## Current status
- GitHub: https://github.com/IsholaRsk/Action-verit- -> NEW VERSION (paiement direct apres inscription) ✅
- Vercel live: https://www.escortepointfr.store/ -> OLD VERSION from Sep 3 ❌ (cache HIT age 205k)
- Preview with new version: https://8000-isu0h3om9w31vxenkvqzl.e2b.app ✅
