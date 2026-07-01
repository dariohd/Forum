import type { ReactNode } from 'react'
import { SiteNav } from './SiteNav'

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site">
      <SiteNav />
      <main className="site-main">{children}</main>
    </div>
  )
}
