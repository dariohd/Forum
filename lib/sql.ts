import { neon } from '@neondatabase/serverless'

let schemaReady = false

export function sql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL manquant. Ajoute Neon via le Marketplace Vercel.')
  return neon(url)
}

async function seedDefaults(db: ReturnType<typeof sql>) {
  const [{ c: forumCount }] = await db`SELECT COUNT(*)::int AS c FROM forums` as { c: number }[]
  if (forumCount === 0) {
    await db`
      INSERT INTO forums (id, slug, name, description, sort_order) VALUES
        ('f-general', 'general', 'Général', 'Discussions libres et présentations.', 0),
        ('f-creations', 'creations', 'Créations', 'Dessins, projets et idées du mur.', 1),
        ('f-aide', 'aide', 'Aide', 'Questions sur le site et la communauté.', 2)
    `
  }

  const [{ c: pageCount }] = await db`SELECT COUNT(*)::int AS c FROM pages` as { c: number }[]
  if (pageCount === 0) {
    await db`
      INSERT INTO pages (id, slug, title, content, published) VALUES
        ('p-bienvenue', 'bienvenue', 'Bienvenue',
         'Le Mur libre est la page d''accueil : un espace ouvert pour dessiner et écrire ensemble.

Les forums permettent des discussions structurées par thème. Crée un compte pour ouvrir des sujets et répondre.

Les pages regroupent les contenus permanents du site.', true)
    `
  }
}

export async function ensureSchema() {
  if (!process.env.DATABASE_URL) return
  if (schemaReady) return
  const db = sql()

  await db`
    CREATE TABLE IF NOT EXISTS strokes (
      id TEXT PRIMARY KEY,
      points JSONB NOT NULL,
      color TEXT NOT NULL,
      width REAL NOT NULL,
      tool TEXT NOT NULL CHECK (tool IN ('pen', 'eraser')),
      author TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS text_items (
      id TEXT PRIMARY KEY,
      x REAL NOT NULL,
      y REAL NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL,
      color TEXT NOT NULL,
      font_size REAL NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS canvas_images (
      id TEXT PRIMARY KEY,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      url TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS rate_events (
      id BIGSERIAL PRIMARY KEY,
      rate_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS forums (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      forum_id TEXT NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await db`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id TEXT REFERENCES users(id),
      published BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await db`CREATE INDEX IF NOT EXISTS idx_strokes_created ON strokes(created_at)`
  await db`CREATE INDEX IF NOT EXISTS idx_texts_created ON text_items(created_at)`
  await db`CREATE INDEX IF NOT EXISTS idx_images_created ON canvas_images(created_at)`
  await db`CREATE INDEX IF NOT EXISTS idx_rate_key ON rate_events(rate_key, created_at)`
  await db`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)`
  await db`CREATE INDEX IF NOT EXISTS idx_threads_forum ON threads(forum_id, updated_at DESC)`
  await db`CREATE INDEX IF NOT EXISTS idx_replies_thread ON replies(thread_id, created_at)`

  await seedDefaults(db)
  schemaReady = true
}
