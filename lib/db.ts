import { randomUUID } from 'crypto'
import * as blob from './blob-store'
import { useBlobStorage } from './mode'
import { ensureSchema, sql } from './sql'
import type { BoardSnapshot, CanvasImage, Stroke, TextItem } from './types'

type StrokeRow = {
  id: string
  points: { x: number; y: number }[]
  color: string
  width: number
  tool: 'pen' | 'eraser'
  author: string
  created_at: string
}

type TextRow = {
  id: string
  x: number
  y: number
  content: string
  author: string
  color: string
  font_size: number
  created_at: string
}

type ImageRow = {
  id: string
  x: number
  y: number
  width: number
  height: number
  url: string
  author: string
  created_at: string
}

function mapStroke(r: StrokeRow): Stroke {
  return { id: r.id, points: r.points, color: r.color, width: r.width, tool: r.tool, author: r.author, createdAt: new Date(r.created_at).toISOString() }
}

function mapText(r: TextRow): TextItem {
  return { id: r.id, x: r.x, y: r.y, content: r.content, author: r.author, color: r.color, fontSize: r.font_size, createdAt: new Date(r.created_at).toISOString() }
}

function mapImage(r: ImageRow): CanvasImage {
  return { id: r.id, x: r.x, y: r.y, width: r.width, height: r.height, url: r.url, author: r.author, createdAt: new Date(r.created_at).toISOString() }
}

export async function getBoard(since?: string): Promise<BoardSnapshot> {
  if (useBlobStorage()) return blob.blobGetBoard(since)

  await ensureSchema()
  const db = sql()
  const sinceDate = since ? new Date(since) : null
  const sinceIso = sinceDate && !Number.isNaN(sinceDate.getTime()) ? sinceDate.toISOString() : null

  const strokes = sinceIso
    ? await db`SELECT id, points, color, width, tool, author, created_at FROM strokes WHERE created_at > ${sinceIso} ORDER BY created_at ASC` as StrokeRow[]
    : await db`SELECT id, points, color, width, tool, author, created_at FROM strokes ORDER BY created_at ASC` as StrokeRow[]

  const texts = sinceIso
    ? await db`SELECT id, x, y, content, author, color, font_size, created_at FROM text_items WHERE created_at > ${sinceIso} ORDER BY created_at ASC` as TextRow[]
    : await db`SELECT id, x, y, content, author, color, font_size, created_at FROM text_items ORDER BY created_at ASC` as TextRow[]

  const images = sinceIso
    ? await db`SELECT id, x, y, width, height, url, author, created_at FROM canvas_images WHERE created_at > ${sinceIso} ORDER BY created_at ASC` as ImageRow[]
    : await db`SELECT id, x, y, width, height, url, author, created_at FROM canvas_images ORDER BY created_at ASC` as ImageRow[]

  return { strokes: strokes.map(mapStroke), texts: texts.map(mapText), images: images.map(mapImage), serverTime: new Date().toISOString() }
}

export async function addStroke(input: Omit<Stroke, 'id' | 'createdAt'>): Promise<Stroke> {
  if (useBlobStorage()) return blob.blobAddStroke(input)

  await ensureSchema()
  const db = sql()
  const id = randomUUID()
  await db`INSERT INTO strokes (id, points, color, width, tool, author) VALUES (${id}, ${input.points}, ${input.color}, ${input.width}, ${input.tool}, ${input.author})`
  return { ...input, id, createdAt: new Date().toISOString() }
}

export async function addText(input: Omit<TextItem, 'id' | 'createdAt'>): Promise<TextItem> {
  if (useBlobStorage()) return blob.blobAddText(input)

  await ensureSchema()
  const db = sql()
  const id = randomUUID()
  await db`INSERT INTO text_items (id, x, y, content, author, color, font_size) VALUES (${id}, ${input.x}, ${input.y}, ${input.content}, ${input.author}, ${input.color}, ${input.fontSize})`
  return { ...input, id, createdAt: new Date().toISOString() }
}

export async function addImage(input: Omit<CanvasImage, 'id' | 'createdAt'>): Promise<CanvasImage> {
  if (useBlobStorage()) return blob.blobAddImage(input)

  await ensureSchema()
  const db = sql()
  const id = randomUUID()
  await db`INSERT INTO canvas_images (id, x, y, width, height, url, author) VALUES (${id}, ${input.x}, ${input.y}, ${input.width}, ${input.height}, ${input.url}, ${input.author})`
  return { ...input, id, createdAt: new Date().toISOString() }
}

export async function getStats(): Promise<{ strokes: number; texts: number; images: number }> {
  if (useBlobStorage()) return blob.blobGetStats()

  await ensureSchema()
  const db = sql()
  const [s, t, i] = await Promise.all([
    db`SELECT COUNT(*)::int AS c FROM strokes` as Promise<{ c: number }[]>,
    db`SELECT COUNT(*)::int AS c FROM text_items` as Promise<{ c: number }[]>,
    db`SELECT COUNT(*)::int AS c FROM canvas_images` as Promise<{ c: number }[]>,
  ])
  return { strokes: s[0]?.c ?? 0, texts: t[0]?.c ?? 0, images: i[0]?.c ?? 0 }
}
