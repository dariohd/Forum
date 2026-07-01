import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { HomePage } from './pages/HomePage'
import { ForumsPage } from './pages/ForumsPage'
import { ForumPage } from './pages/ForumPage'
import { ThreadPage } from './pages/ThreadPage'
import { PagesPage } from './pages/PagesPage'
import { PageView } from './pages/PageView'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { UserPage } from './pages/UserPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/forums" element={<ForumsPage />} />
          <Route path="/forums/:slug" element={<ForumPage />} />
          <Route path="/t/:id" element={<ThreadPage />} />
          <Route path="/pages" element={<PagesPage />} />
          <Route path="/pages/:slug" element={<PageView />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/u/:username" element={<UserPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
