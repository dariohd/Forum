import { useCallback, useEffect, useRef, useState } from 'react'
import type { CanvasImage, Stroke, TextItem } from '../types'
import { fetchBoard, postImage, postStroke, postText } from '../lib/board'
import { drawImageItem, drawStroke, drawText, normPoint } from '../lib/render'
import { uploadImage } from '../lib/upload'
import { Toolbar, type Tool } from './Toolbar'

const COLORS = ['#f0eef8', '#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b794f6', '#1a1a24']
const SYNC_MS = 1500

interface TextDraft {
  x: number
  y: number
  screenX: number
  screenY: number
}

export function SharedCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const strokesRef = useRef<Map<string, Stroke>>(new Map())
  const textsRef = useRef<Map<string, TextItem>>(new Map())
  const imagesRef = useRef<Map<string, CanvasImage>>(new Map())
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map())
  const lastSyncRef = useRef<string | null>(null)
  const drawingRef = useRef(false)
  const currentPoints = useRef<{ x: number; y: number }[]>([])
  const rafRef = useRef<number>(0)

  const [author, setAuthor] = useState(() => localStorage.getItem('mur-author') || '')
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(4)
  const [syncing, setSyncing] = useState(true)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ strokes: 0, texts: 0, images: 0 })
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [draftText, setDraftText] = useState('')

  const mergeBoard = useCallback((data: Awaited<ReturnType<typeof fetchBoard>>) => {
    for (const s of data.strokes) strokesRef.current.set(s.id, s)
    for (const t of data.texts) textsRef.current.set(t.id, t)
    for (const img of data.images) imagesRef.current.set(img.id, img)
    if (data.stats) setStats(data.stats)
    lastSyncRef.current = data.serverTime
  }, [])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const dpr = window.devicePixelRatio || 1
    const w = wrap.clientWidth
    const h = wrap.clientHeight
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }

    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#16161f'
    ctx.fillRect(0, 0, w, h)

    ctx.globalCompositeOperation = 'source-over'

    for (const item of imagesRef.current.values()) {
      let img = imageCache.current.get(item.url)
      if (!img) {
        img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = item.url
        img.onload = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(paint) }
        imageCache.current.set(item.url, img)
      }
      if (img.complete && img.naturalWidth > 0) {
        drawImageItem(ctx, img, item, w, h)
      }
    }

    for (const stroke of strokesRef.current.values()) {
      drawStroke(ctx, stroke, w, h)
    }

    if (currentPoints.current.length >= 2) {
      drawStroke(ctx, {
        id: 'preview',
        points: currentPoints.current,
        color,
        width: tool === 'eraser' ? size * 2.5 : size,
        tool: tool === 'eraser' ? 'eraser' : 'pen',
        author,
        createdAt: '',
      }, w, h)
    }

    for (const item of textsRef.current.values()) {
      drawText(ctx, item, w, h)
    }
  }, [author, color, size, tool])

  const sync = useCallback(async (full = false) => {
    try {
      const data = await fetchBoard(full ? undefined : lastSyncRef.current ?? undefined)
      mergeBoard(data)
      setOnline(true)
      setError(null)
    } catch (e) {
      setOnline(false)
      setError(e instanceof Error ? e.message : 'Hors ligne')
    } finally {
      setSyncing(false)
    }
  }, [mergeBoard])

  useEffect(() => {
    sync(true)
    const id = setInterval(() => sync(false), SYNC_MS)
    return () => clearInterval(id)
  }, [sync])

  useEffect(() => {
    const loop = () => {
      paint()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [paint])

  useEffect(() => {
    const onResize = () => paint()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [paint])

  useEffect(() => {
    if (author.trim()) localStorage.setItem('mur-author', author.trim())
  }, [author])

  const finishStroke = async () => {
    if (currentPoints.current.length < 2) {
      currentPoints.current = []
      return
    }

    const payload = {
      points: [...currentPoints.current],
      color,
      width: tool === 'eraser' ? size * 2.5 : size,
      tool: (tool === 'eraser' ? 'eraser' : 'pen') as 'pen' | 'eraser',
      author: author.trim() || 'Anonyme',
    }

    const tempId = `local-${Date.now()}`
    strokesRef.current.set(tempId, { ...payload, id: tempId, createdAt: new Date().toISOString() })
    currentPoints.current = []

    try {
      const saved = await postStroke(payload)
      strokesRef.current.delete(tempId)
      strokesRef.current.set(saved.id, saved)
      setStats((s) => ({ ...s, strokes: s.strokes + 1 }))
      setError(null)
    } catch (e) {
      strokesRef.current.delete(tempId)
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === 'text' || tool === 'image') return
    const rect = e.currentTarget.getBoundingClientRect()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    currentPoints.current = [normPoint(e, rect)]
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || tool === 'text' || tool === 'image') return
    const rect = e.currentTarget.getBoundingClientRect()
    currentPoints.current.push(normPoint(e, rect))
  }

  const onPointerUp = async (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    await finishStroke()
  }

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'text') return
    const rect = e.currentTarget.getBoundingClientRect()
    const p = normPoint(e, rect)
    setTextDraft({
      x: p.x,
      y: p.y,
      screenX: e.clientX,
      screenY: e.clientY,
    })
    setDraftText('')
  }

  const submitText = async () => {
    if (!textDraft || !draftText.trim()) {
      setTextDraft(null)
      return
    }

    try {
      const saved = await postText({
        x: textDraft.x,
        y: textDraft.y,
        content: draftText.trim(),
        author: author.trim() || 'Anonyme',
        color,
        fontSize: Math.round(size * 4 + 12),
      })
      textsRef.current.set(saved.id, saved)
      setStats((s) => ({ ...s, texts: s.texts + 1 }))
      setTextDraft(null)
      setDraftText('')
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  const importImage = async (file: File) => {
    try {
      const url = await uploadImage(file)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Image illisible'))
        img.src = url
      })

      const aspect = img.naturalWidth / img.naturalHeight
      let width = 0.25
      let height = width / aspect
      if (height > 0.35) {
        height = 0.35
        width = height * aspect
      }

      const saved = await postImage({
        x: 0.5 - width / 2,
        y: 0.5 - height / 2,
        width,
        height,
        url,
        author: author.trim() || 'Anonyme',
      })
      imagesRef.current.set(saved.id, saved)
      imageCache.current.delete(url)
      setStats((s) => ({ ...s, images: s.images + 1 }))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    }
  }

  return (
    <div className="mur">
      <header className="mur-header">
        <div className="mur-meta">
          <span className={`sync-dot${online ? ' on' : ''}`} />
          <span className="mur-stats">
            {stats.strokes} traits · {stats.texts} textes · {stats.images} images
          </span>
        </div>
      </header>

      <div className="mur-stage" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className={`mur-canvas tool-${tool}`}
          role="img"
          aria-label="Mur collaboratif : dessinez ou ajoutez du texte. Outils dans la barre ci-dessous."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={onCanvasClick}
        />

        {textDraft && (
          <form
            className="text-popover"
            style={{ left: textDraft.screenX, top: textDraft.screenY }}
            onSubmit={(e) => { e.preventDefault(); submitText() }}
          >
            <textarea
              autoFocus
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Ton texte…"
              rows={3}
              maxLength={280}
            />
            <div className="text-popover-actions">
              <button type="button" onClick={() => setTextDraft(null)}>Annuler</button>
              <button type="submit">Poser</button>
            </div>
          </form>
        )}
      </div>

      <Toolbar
        author={author}
        onAuthorChange={setAuthor}
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        size={size}
        onSizeChange={setSize}
        colors={COLORS}
        onImportImage={importImage}
        onRefresh={() => sync(true)}
      />

      {(syncing || error) && (
        <div className="mur-toast" role="status">
          {syncing ? 'Connexion au mur…' : error}
        </div>
      )}
    </div>
  )
}
