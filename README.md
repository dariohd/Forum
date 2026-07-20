# Forum libre

Application forum full-stack : threads, réponses, pièces jointes — React + API serverless Vercel.

| | |
|---|---|
| **URL production** | https://forum-libre.vercel.app |
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
- **Pagination** des sujets et des réponses (20 par page)
- **Modération** : masquage ou suppression des sujets/réponses par un admin ou modérateur
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
| `npm run role:set -- <pseudo> <user\|moderator\|admin>` | Change le rôle d'un compte |

## Déploiement Vercel

1. Installer l’intégration **Neon** → [docs/NEON-SETUP.md](docs/NEON-SETUP.md)
2. Variables : `DATABASE_URL` + `BLOB_READ_WRITE_TOKEN`
3. `npm run db:init` une fois contre la base de prod
4. Push GitHub ou `npx vercel deploy --prod`

## Modération

Le premier compte créé sur une base vierge devient automatiquement **admin**. Pour promouvoir un compte existant :

```bash
npx vercel env pull .env.local
npm run role:set -- <pseudo> admin
```

Rôles : `user` (défaut), `moderator`, `admin`. Les deux derniers peuvent masquer ou supprimer un sujet/réponse depuis les pages Forum et Sujet.

## Pistes d'évolution

- Notifications email
- Recherche dans les sujets

## Contact

- **Développement** : Hugo Davion — [bulletonsite.com](https://bulletonsite.com)
