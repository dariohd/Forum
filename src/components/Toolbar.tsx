import { useRef } from 'react'

export type Tool = 'pen' | 'eraser' | 'text' | 'image'

interface ToolbarProps {
  author: string
  onAuthorChange: (v: string) => void
  tool: Tool
  onToolChange: (t: Tool) => void
  color: string
  onColorChange: (c: string) => void
  size: number
  onSizeChange: (n: number) => void
  colors: string[]
  onImportImage: (file: File) => void
  onRefresh: () => void
}

export function Toolbar({
  author,
  onAuthorChange,
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  colors,
  onImportImage,
  onRefresh,
}: ToolbarProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <footer className="toolbar">
      <input
        className="toolbar-author"
        placeholder="Pseudo"
        value={author}
        onChange={(e) => onAuthorChange(e.target.value)}
        maxLength={30}
      />

      <div className="toolbar-tools" role="group" aria-label="Outils">
        <button type="button" className={tool === 'pen' ? 'active' : ''} aria-pressed={tool === 'pen'} onClick={() => onToolChange('pen')}>
          Crayon
        </button>
        <button type="button" className={tool === 'eraser' ? 'active' : ''} aria-pressed={tool === 'eraser'} onClick={() => onToolChange('eraser')}>
          Gomme
        </button>
        <button type="button" className={tool === 'text' ? 'active' : ''} aria-pressed={tool === 'text'} onClick={() => onToolChange('text')}>
          Texte
        </button>
        <button
          type="button"
          className={tool === 'image' ? 'active' : ''}
          aria-pressed={tool === 'image'}
          onClick={() => { onToolChange('image'); fileRef.current?.click() }}
        >
          Image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImportImage(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="toolbar-colors" role="group" aria-label="Couleurs">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            className={`color-btn${color === c ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => onColorChange(c)}
            aria-label={`Couleur ${c}`}
          />
        ))}
      </div>

      <label className="toolbar-size">
        <span>Taille</span>
        <input type="range" min={1} max={24} value={size} onChange={(e) => onSizeChange(Number(e.target.value))} />
      </label>

      <button type="button" className="toolbar-refresh" onClick={onRefresh}>
        Actualiser
      </button>
    </footer>
  )
}
