import type { PageInfo } from '../types'

interface PaginationProps {
  page: PageInfo
  onChange: (page: number) => void
}

export function Pagination({ page, onChange }: PaginationProps) {
  if (page.totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" onClick={() => onChange(page.page - 1)} disabled={page.page <= 1}>
        Précédent
      </button>
      <span>Page {page.page} / {page.totalPages}</span>
      <button type="button" onClick={() => onChange(page.page + 1)} disabled={page.page >= page.totalPages}>
        Suivant
      </button>
    </nav>
  )
}
