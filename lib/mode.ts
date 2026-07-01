/** Stockage sans BDD : tout passe par Vercel Blob (fichiers JSON privés). */
export function useBlobStorage(): boolean {
  return !process.env.DATABASE_URL
}

export function assertStorageConfigured(): void {
  if (process.env.DATABASE_URL) return
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN manquant. Sur Vercel : Storage → Create Store → Blob. Aucune base de données requise.',
    )
  }
}
