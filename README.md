# Forum libre

Application forum full-stack : threads, réponses, pièces jointes — React + API serverless Vercel.

| | |
|---|---|
| **URL production** | https://mur-libre.vercel.app |
| **Notes techniques** | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **Stack** | React 19, Vite 6, TypeScript, Neon PostgreSQL, Vercel Blob |

## Stack

- **Frontend** : React 19 + Vite 6 + TypeScript
- **API** : fonctions serverless Vercel (`api/`)
- **Base de données** : **Neon** PostgreSQL (serverless)
- **Fichiers** : **Vercel Blob** (upload pièces jointes)
- **Dev local** : Express (`server/`) + Vite en parallèle

## Fonctionnalités

- Création de **threads** et **réponses**
- **Upload de fichiers** (stockage Blob)
- Interface React responsive
- API REST serverless compatible production Vercel
- Schéma SQL initialisable (`scripts/init-db.mjs`)

## Structure

```
Forum/
├── src/                # Application React
├── api/                # Handlers Vercel serverless
├── server/             # Serveur Express (dev local)
├── scripts/init-db.mjs
├── index.html
├── vite.config.ts
├── vercel.json
├── package.json
└── .env.example
```

## Prérequis

- Node.js 20+
- Compte **Neon** (PostgreSQL)
- Compte **Vercel** + store **Blob**
- Vercel CLI : `npm i -g vercel`

## Variables d'environnement

Copier `.env.example` → `.env` :

```env
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

## Développement local

**Option A — Vercel dev (proche prod)**

```bash
npm install
cp .env.example .env
npm run db:init
npm run dev
```

**Option B — Client + Express séparés**

```bash
npm run dev:local
```

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | `vercel dev` (API + frontend) |
| `npm run dev:local` | Express + Vite en parallèle |
| `npm run build` | `tsc` + `vite build` |
| `npm run preview` | Preview build Vite |
| `npm run db:init` | Crée les tables Neon |

## Déploiement Vercel

1. `vercel link` puis `vercel env pull`
2. Configurer `DATABASE_URL` et `BLOB_READ_WRITE_TOKEN` sur Vercel
3. `vercel deploy` ou push GitHub si projet lié
4. Exécuter `db:init` une fois contre la base de production

## Sécurité

- Ne jamais committer `.env`
- Token Blob en variable d'environnement uniquement
- Valider taille / type des uploads côté API

## Pistes d'évolution

- Authentification utilisateurs
- Modération admin
- Pagination threads
- Notifications email

## Contact

- **Développement** : Hugo Davion — [bulletonsite.com](https://bulletonsite.com)
