# Notes techniques

Monorepo léger : front React dans `src/`, API dans `api/` (handlers Vercel) et `server/` (Express pour le dev).

## Flux

Le client React appelle `/api/*`. En local avec `vercel dev`, les fonctions serverless tournent comme en prod. Avec `dev:local`, Express sur un port proxy les mêmes routes pendant que Vite sert le front.

## Données

**Neon PostgreSQL** en production (obligatoire sur Vercel) : schéma via `scripts/init-db.mjs` ou `ensureSchema()` au premier appel. **Vercel Blob** pour les pièces jointes (URL stockée en base).

Mode Blob seul (sans `DATABASE_URL`) : dev local uniquement — voir [NEON-SETUP.md](NEON-SETUP.md).

## Build

`vite build` pour le static, `tsc` pour typer l'API. `vercel.json` route les requêtes `/api` vers les fonctions et le reste vers le SPA.
