import type { CanvasImage, Stroke, TextItem } from '../types'

export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
) {
  if (stroke.points.length < 2) return

  ctx.save()
  ctx.beginPath()
  stroke.points.forEach((p, i) => {
    const x = p.x * width
    const y = p.y * height
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.width
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
  }
  ctx.stroke()
  ctx.restore()
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  item: TextItem,
  width: number,
  height: number,
) {
  ctx.save()
  ctx.font = `600 ${item.fontSize}px system-ui, sans-serif`
  ctx.fillStyle = item.color
  ctx.textBaseline = 'top'
  const lines = item.content.split('\n')
  const x = item.x * width
  let y = item.y * height
  for (const line of lines) {
    ctx.fillText(line, x, y)
    y += item.fontSize * 1.25
  }
  ctx.restore()
}

export function drawImageItem(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  item: CanvasImage,
  width: number,
  height: number,
) {
  ctx.drawImage(
    img,
    item.x * width,
    item.y * height,
    item.width * width,
    item.height * height,
  )
}

export function normPoint(
  e: { clientX: number; clientY: number },
  rect: DOMRect,
): { x: number; y: number } {
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  }
}
