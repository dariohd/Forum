import { SiteNav } from '../components/SiteNav'
import { SharedCanvas } from '../components/SharedCanvas'

export function HomePage() {
  return (
    <div className="home">
      <SiteNav variant="overlay" />
      <SharedCanvas />
    </div>
  )
}
