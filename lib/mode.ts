/** Données persistantes : Neon si DATABASE_URL, sinon Blob JSON (dev local). */
export function useBlobStorage(): boolean {
  return !process.env.DATABASE_URL
}

/** Auth en prod : Neon obligatoire (le mode Blob auth est instable sur Vercel). */
export function assertAuthDatabase(): void {
  if (process.env.DATABASE_URL) return
  if (process.env.VERCEL) {
    throw new Error(
      'Authentification indisponible : DATABASE_URL manquant. Installe Neon sur Vercel — voir docs/NEON-SETUP.md.',
    )
  }
}

export function assertStorageConfigured(): void {
  if (process.env.DATABASE_URL) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN manquant (uploads pièces jointes).')
    }
    return
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN manquant. Mode dev sans BDD : Storage → Blob. Ou définis DATABASE_URL pour Neon.',
    )
  }
}
