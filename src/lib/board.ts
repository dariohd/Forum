import type { BoardSnapshot, CanvasImage, Stroke, TextItem } from '../types'

export async function fetchBoard(since?: string): Promise<BoardSnapshot & { stats?: { strokes: number; texts: number; images: number } }> {
  const url = since ? `/api/board?since=${encodeURIComponent(since)}` : '/api/board'
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Synchronisation impossible')
  return data
}

export async function postStroke(payload: Omit<Stroke, 'id' | 'createdAt'>): Promise<Stroke> {
  const res = await fetch('/api/strokes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Trait non enregistré')
  return data
}

export async function postText(payload: Omit<TextItem, 'id' | 'createdAt'>): Promise<TextItem> {
  const res = await fetch('/api/texts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Texte non enregistré')
  return data
}

export async function postImage(payload: Omit<CanvasImage, 'id' | 'createdAt'>): Promise<CanvasImage> {
  const res = await fetch('/api/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Image non placée')
  return data
}
