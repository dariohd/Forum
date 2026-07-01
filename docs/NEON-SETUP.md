# Neon sur Vercel — Mur libre

L’auth et les forums nécessitent **PostgreSQL (Neon)** en production. Le mode Blob seul (JSON) est réservé au dev local.

## 1. Accepter les termes Neon (une fois)

```bash
cd Sites/Forum
npx vercel integration add neon
```

Si la CLI affiche `integration_terms_acceptance_required`, ouvre l’URL indiquée dans le navigateur, accepte les conditions, puis relance la commande.

## 2. Lier la base au projet

Dans [Vercel → mur-libre → Storage / Integrations](https://vercel.com/dariohprojects/mur-libre) :

1. **Add integration** → **Neon**
2. Crée ou sélectionne une base
3. Vérifie que `DATABASE_URL` apparaît dans **Settings → Environment Variables** (Production + Preview)

`BLOB_READ_WRITE_TOKEN` reste requis pour les uploads d’images.

## 3. Initialiser le schéma

```bash
npx vercel env pull .env.local
npm run db:init
```

## 4. Redéployer

Push sur `main` ou `npx vercel deploy --prod`.

## Vérification

- `GET /api/auth/me` → `{ "user": null }` sans cookie (200)
- Inscription → connexion → `me` renvoie l’utilisateur
- Mur + forums lisibles sans compte
