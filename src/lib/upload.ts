import { upload } from '@vercel/blob/client'

export async function uploadImage(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Seules les images sont acceptées (JPEG, PNG, GIF, WebP).')
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image trop lourde (max 8 Mo).')
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'image'
  const blob = await upload(`mur/${Date.now()}-${safeName}`, file, {
    access: 'private',
    handleUploadUrl: '/api/upload',
  })
  return blob.url
}
