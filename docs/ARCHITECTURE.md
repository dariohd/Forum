# Notes techniques

Monorepo léger : front React dans `src/`, API dans `api/` (handlers Vercel) et `server/` (Express pour le dev).

## Flux

Le client React appelle `/api/*`. En local avec `vercel dev`, les fonctions serverless tournent comme en prod. Avec `dev:local`, Express sur un port proxy les mêmes routes pendant que Vite sert le front.

## Données

Neon PostgreSQL : schéma créé par `scripts/init-db.mjs` (tables threads, posts, etc.). Les pièces jointes vont sur Vercel Blob ; l'API stocke l'URL en base.

## Build

`vite build` pour le static, `tsc` pour typer l'API. `vercel.json` route les requêtes `/api` vers les fonctions et le reste vers le SPA.
