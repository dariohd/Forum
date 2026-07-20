# Notes techniques

Monorepo léger : front React dans `src/`, API dans `api/` (handlers Vercel) et `server/` (Express pour le dev).

## Flux

Le client React appelle `/api/*`. En local avec `vercel dev`, les fonctions serverless tournent comme en prod. Avec `dev:local`, Express sur un port proxy les mêmes routes pendant que Vite sert le front.

## Données

**Neon PostgreSQL** en production (obligatoire sur Vercel) : schéma via `scripts/init-db.mjs` ou `ensureSchema()` au premier appel. **Vercel Blob** pour les pièces jointes (URL stockée en base).

Mode Blob seul (sans `DATABASE_URL`) : dev local uniquement — voir [NEON-SETUP.md](NEON-SETUP.md).

## Build

`vite build` pour le static, `tsc` pour typer l'API. `vercel.json` route les requêtes `/api` vers les fonctions et le reste vers le SPA.

## Modération et pagination

Le plan Vercel Hobby limite le nombre de fonctions serverless (12) : la modération et la pagination réutilisent donc les routes existantes plutôt que d'en créer de nouvelles.

- `GET /api/forums/:slug?page=&pageSize=` et `GET /api/threads/:id?page=&pageSize=` paginent respectivement les sujets et les réponses (20 par page par défaut, 50 max).
- `PATCH /api/threads/:id` (body `{ hidden, reason?, replyId? }`) masque/affiche un sujet, ou une réponse si `replyId` est fourni. Réservé aux rôles `moderator`/`admin` (`requireModerator`).
- `DELETE /api/threads/:id` (query `?replyId=` optionnel) supprime définitivement un sujet (cascade sur ses réponses) ou une réponse précise. Même restriction de rôle.
- Un utilisateur non modérateur ne reçoit jamais les sujets/réponses masqués (filtrés côté requête SQL), y compris via un lien direct.
- Le premier compte créé devient `admin` automatiquement ; `npm run role:set -- <pseudo> <rôle>` permet de changer le rôle d'un compte existant.
