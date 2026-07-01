export interface Stroke {
  id: string
  points: { x: number; y: number }[]
  color: string
  width: number
  tool: 'pen' | 'eraser'
  author: string
  createdAt: string
}

export interface TextItem {
  id: string
  x: number
  y: number
  content: string
  author: string
  color: string
  fontSize: number
  createdAt: string
}

export interface CanvasImage {
  id: string
  x: number
  y: number
  width: number
  height: number
  url: string
  author: string
  createdAt: string
}

export interface BoardSnapshot {
  strokes: Stroke[]
  texts: TextItem[]
  images: CanvasImage[]
  serverTime: string
}

export interface PublicUser {
  id: string
  username: string
  displayName: string
  bio: string
  createdAt: string
}

export interface Forum {
  id: string
  slug: string
  name: string
  description: string
  threadCount: number
  createdAt: string
}

export interface ThreadSummary {
  id: string
  forumId: string
  title: string
  author: PublicUser
  replyCount: number
  createdAt: string
  updatedAt: string
}

export interface Reply {
  id: string
  threadId: string
  author: PublicUser
  content: string
  createdAt: string
}

export interface ThreadDetail {
  id: string
  forum: { id: string; slug: string; name: string }
  title: string
  author: PublicUser
  replies: Reply[]
  createdAt: string
  updatedAt: string
}

export interface SitePage {
  id: string
  slug: string
  title: string
  content: string
  author: PublicUser | null
  createdAt: string
  updatedAt: string
}

export interface UserProfile extends PublicUser {
  threadCount: number
  replyCount: number
}
