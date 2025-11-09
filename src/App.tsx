import React, { useState, useRef, useEffect, useMemo, useCallback, Suspense } from 'react'
const ReactMarkdown = React.lazy(() => import('react-markdown'))
// ExcelJS is dynamically imported where needed to enable code-splitting
import './App.css'
import DocumentVisibility from './DocumentVisibility'
import UploadPage from './UploadPage'
import InviteAdmins from './InviteAdmins'
import SetPasswordPage from './SetPasswordPage'
import RebuildSearchIndex from './RebuildSearchIndex'
import FeedbackList from './FeedbackList'
import { supabase } from './lib/supabaseClient'
import pkg from '../package.json'
import type { User } from '@supabase/supabase-js'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  attachments?: string[]
}

interface ChatSession {
  id: string
  name: string
  createdAt: Date
  lastMessageAt: Date
  messageCount: number
}

interface NewsItem {
  id: string
  title: string
  image: string
  readTime: string
  url?: string
}

// Memoized markdown renderer component
const MarkdownRenderer = React.memo(({ content, preprocessMarkdown, ExcelDownload }: { 
  content: string; 
  preprocessMarkdown: (text: string) => { content: string; excelData?: any; filename?: string };
  ExcelDownload: React.ComponentType<{ data: any; filename: string }>
}) => {
  const markdownComponents = useMemo(() => ({
    // Style markdown elements for light theme with aggressive text wrapping
    h1: ({children}: any) => <h1 className="text-xl font-bold text-gray-900 mb-3 mt-2 first:mt-0 leading-tight break-words hyphens-auto">{children}</h1>,
    h2: ({children}: any) => <h2 className="text-lg font-bold text-gray-900 mb-2 mt-2 first:mt-0 leading-tight break-words hyphens-auto">{children}</h2>,
    h3: ({children}: any) => <h3 className="text-base font-bold text-gray-900 mb-2 mt-2 first:mt-0 leading-tight break-words hyphens-auto">{children}</h3>,
    h4: ({children}: any) => <h4 className="text-sm font-bold text-gray-900 mb-1 mt-2 first:mt-0 leading-tight break-words hyphens-auto">{children}</h4>,
    h5: ({children}: any) => <h5 className="text-sm font-bold text-gray-900 mb-1 mt-2 first:mt-0 leading-tight break-words hyphens-auto">{children}</h5>,
    h6: ({children}: any) => <h6 className="text-sm font-bold text-gray-900 mb-1 mt-2 first:mt-0 leading-tight break-words hyphens-auto">{children}</h6>,
    p: ({children}: any) => <p className="text-gray-800 text-sm mb-3 last:mb-0 leading-relaxed break-words hyphens-auto overflow-hidden">{children}</p>,
    code: ({children}: any) => <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono break-all overflow-hidden inline-block max-w-full">{children}</code>,
    pre: ({children}: any) => <pre className="bg-gray-100 text-gray-800 p-3 rounded-md my-3 text-xs font-mono border border-gray-200 break-all overflow-x-hidden max-w-full">{children}</pre>,
    ul: ({children}: any) => <ul className="list-disc text-gray-700 mb-3 ml-5 space-y-1 overflow-hidden">{children}</ul>,
    ol: ({children}: any) => <ol className="list-decimal text-gray-700 mb-3 ml-5 space-y-1 overflow-hidden">{children}</ol>,
    li: ({children}: any) => <li className="text-gray-700 text-sm leading-relaxed break-words hyphens-auto overflow-hidden">{children}</li>,
    blockquote: ({children}: any) => <blockquote className="border-l-4 border-blue-400 pl-3 my-3 text-gray-600 italic bg-blue-50 py-2 rounded-r text-sm break-words hyphens-auto overflow-hidden">{children}</blockquote>,
    a: ({children, href}: any) => <a href={href} className="text-blue-600 hover:text-blue-800 underline font-medium break-all overflow-hidden inline-block max-w-full" target="_blank" rel="noopener noreferrer">{children}</a>,
    img: ({src, alt}: any) => <MarkdownImage src={src} alt={alt} />,
    strong: ({children}: any) => <strong className="font-bold text-gray-900 break-words hyphens-auto">{children}</strong>,
    em: ({children}: any) => <em className="italic text-gray-700 break-words hyphens-auto">{children}</em>,
    hr: () => <hr className="border-gray-300 my-4" />,
    table: ({children}: any) => <div className="overflow-x-hidden my-3 max-w-full"><table className="w-full border-collapse border border-gray-300 text-sm table-fixed">{children}</table></div>,
    th: ({children}: any) => <th className="border border-gray-300 px-2 py-1 bg-gray-100 text-gray-900 font-semibold text-left text-xs break-words hyphens-auto overflow-hidden">{children}</th>,
    td: ({children}: any) => <td className="border border-gray-300 px-2 py-1 text-gray-700 text-xs break-words hyphens-auto overflow-hidden">{children}</td>,
  }), [])

  const processedData = useMemo(() => preprocessMarkdown(content), [content, preprocessMarkdown])
  
  // Ensure content is a string
  const markdownContent = typeof processedData.content === 'string' ? processedData.content : String(processedData.content || '')

  return (
    <div>
      {processedData.excelData && processedData.filename && (
        <ExcelDownload data={processedData.excelData} filename={processedData.filename} />
      )}
      {markdownContent && (
        <Suspense fallback={<div className="text-xs text-gray-500">Rendering…</div>}>
          <ReactMarkdown components={markdownComponents}>
            {markdownContent}
          </ReactMarkdown>
        </Suspense>
      )}
    </div>
  )
})

// Image viewer modal component
const ImageViewer = React.memo(({ src, alt, isOpen, onClose }: { 
  src: string; 
  alt: string; 
  isOpen: boolean; 
  onClose: () => void 
}) => {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [lastTouchDistance, setLastTouchDistance] = useState(0)
  const imgRef = useRef<HTMLImageElement>(null)

  // Reset zoom and position when modal opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [isOpen])

  // Handle keyboard events and prevent browser zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          e.preventDefault()
          setZoom(prev => Math.min(prev + 0.2, 3))
          break
        case '-':
          e.preventDefault()
          setZoom(prev => Math.max(prev - 0.2, 0.5))
          break
        case '0':
          e.preventDefault()
          setZoom(1)
          setPosition({ x: 0, y: 0 })
          break
      }
    }

    // Prevent browser zoom when modal is open
    const preventBrowserZoom = (e: WheelEvent) => {
      // Prevent ctrl+wheel and trackpad pinch zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
      }
    }

    const preventTouchZoom = (e: TouchEvent) => {
      // Prevent multi-touch zoom gestures from affecting browser
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }

    const preventGestureZoom = (e: Event) => {
      // Prevent trackpad gesture zoom
      e.preventDefault()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('wheel', preventBrowserZoom, { passive: false })
      document.addEventListener('touchstart', preventTouchZoom, { passive: false })
      document.addEventListener('touchmove', preventTouchZoom, { passive: false })
      document.addEventListener('gesturestart', preventGestureZoom, { passive: false })
      document.addEventListener('gesturechange', preventGestureZoom, { passive: false })
      document.addEventListener('gestureend', preventGestureZoom, { passive: false })
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('wheel', preventBrowserZoom)
      document.removeEventListener('touchstart', preventTouchZoom)
      document.removeEventListener('touchmove', preventTouchZoom)
      document.removeEventListener('gesturestart', preventGestureZoom)
      document.removeEventListener('gesturechange', preventGestureZoom)
      document.removeEventListener('gestureend', preventGestureZoom)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({ 
        x: e.clientX - position.x, 
        y: e.clientY - position.y 
      })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Calculate distance between two touch points
  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0
    const touch1 = touches[0]
    const touch2 = touches[1]
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2) {
      setLastTouchDistance(getTouchDistance(e.touches as any as TouchList))
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true)
      setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2) {
      const newDistance = getTouchDistance(e.touches as any as TouchList)
      if (lastTouchDistance > 0) {
        const scale = newDistance / lastTouchDistance
        const newZoom = Math.max(0.5, Math.min(3, zoom * scale))
        setZoom(newZoom)
      }
      setLastTouchDistance(newDistance)
    } else if (e.touches.length === 1 && isDragging) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length < 2) {
      setLastTouchDistance(0)
    }
    if (e.touches.length === 0) {
      setIsDragging(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4 image-viewer-modal"
      onClick={onClose}
    >
      <div className="relative max-w-full max-h-full">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-opacity"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Zoom controls */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setZoom(prev => Math.min(prev + 0.2, 3))
            }}
            className="bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-opacity"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setZoom(prev => Math.max(prev - 0.2, 0.5))
            }}
            className="bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-opacity"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setZoom(1)
              setPosition({ x: 0, y: 0 })
            }}
            className="bg-black bg-opacity-50 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70 transition-opacity text-xs"
          >
            1:1
          </button>
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
          {Math.round(zoom * 100)}%
        </div>

        {/* Image container */}
        <div 
          className="flex items-center justify-center max-w-full max-h-full overflow-hidden"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => e.stopPropagation()}
          style={{ 
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none'
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain transition-transform duration-150"
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            }}
            draggable={false}
          />
        </div>

        {/* Help text */}
        <div className="absolute bottom-4 right-4 z-10 bg-black bg-opacity-50 text-white px-3 py-1 rounded-md text-xs">
          Scroll to zoom • Drag to pan • ESC to close
        </div>
      </div>
    </div>
  )
})

// Image component for markdown rendering
const MarkdownImage = React.memo(({ src, alt }: { src?: string; alt?: string }) => {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  const [viewerOpen, setViewerOpen] = useState(false)
  
  if (!src) return null
  
  return (
    <>
      <div className="my-3 w-full max-w-full overflow-hidden">
        {!imageError ? (
          <>
            {imageLoading && (
              <div className="flex justify-center items-center h-24 bg-gray-100 rounded-lg w-full">
                <div className="text-gray-500 text-xs">Loading image...</div>
              </div>
            )}
            <div 
              className="relative group cursor-pointer" 
              onClick={() => setViewerOpen(true)}
            >
              <img 
                src={src} 
                alt={alt || 'Portfolio Image'} 
                className={`w-full max-w-full h-auto rounded-lg shadow-md transition-opacity hover:opacity-90 ${imageLoading ? 'opacity-0 absolute' : 'opacity-100 relative'}`}
                style={{ maxHeight: '300px', maxWidth: '100%', objectFit: 'contain' }}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageError(true)
                  setImageLoading(false)
                }}
              />
              {/* Zoom overlay hint */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                <div className="bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                  Click to zoom
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-gray-100 rounded-lg p-3 border border-gray-200 w-full max-w-full overflow-hidden">
            <p className="text-gray-600 text-xs break-words">📎 Portfolio image</p>
            <a href={src} className="text-blue-600 hover:text-blue-800 underline text-xs break-all overflow-hidden block" target="_blank" rel="noopener noreferrer">
              View image
            </a>
          </div>
        )}
        {alt && <p className="text-xs text-gray-500 mt-1 break-words overflow-hidden">{alt}</p>}
      </div>

      {/* Image Viewer Modal */}
      <ImageViewer 
        src={src} 
        alt={alt || 'Portfolio Image'} 
        isOpen={viewerOpen} 
        onClose={() => setViewerOpen(false)} 
      />
    </>
  )
})

// Mock news data
const mockNews: NewsItem[] = [
  {
    id: '1',
    title: 'Sky in your basement ?',
    image: 'https://picsum.photos/300/150?random=1',
    readTime: 'Baca lebih lanjut ...'
  },
  {
    id: '2',
    title: 'New Product : WAVE Series',
    image: 'https://picsum.photos/300/150?random=2',
    readTime: 'Baca lebih lanjut ...'
  },
  {
    id: '3',
    title: 'Smart Lighting Technology Trends 2024',
    image: 'https://picsum.photos/300/150?random=3',
    readTime: 'Baca lebih lanjut ...'
  },
  {
    id: '4',
    title: 'Energy Efficient LED Solutions',
    image: 'https://picsum.photos/300/150?random=4',
    readTime: 'Baca lebih lanjut ...'
  }
]

function App() {
  // Helper to generate new session-scoped user id
  const createNewUserId = useCallback(() => {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Store userId in state and persist to localStorage
  const [userId, setUserId] = useState(() => {
    const existing = localStorage.getItem('lumina_user_id')
    const newId = existing || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('lumina_user_id', newId)
    console.log('🆔 User session started:', newId)
    console.log('💡 Tip: Use getUserId() in console to view current user ID')
    return newId
  })

  useEffect(() => {
    localStorage.setItem('lumina_user_id', userId)
  }, [userId])

  // Make getUserId available globally for debugging
  useEffect(() => {
    (window as any).getUserId = () => {
      console.log('Current user ID:', userId)
      return userId
    }
    return () => {
      delete (window as any).getUserId
    }
  }, [userId])

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome_message',
      content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
      role: 'assistant',
      timestamp: new Date()
    }
  ])
  
  // Chat session management
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingSessionName, setEditingSessionName] = useState('')
  const [hasLoadedSessions, setHasLoadedSessions] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [loadedSessionsFromServer, setLoadedSessionsFromServer] = useState<Set<string>>(new Set())
  const [correctionMode, setCorrectionMode] = useState(false)
  const [lastUserMessageId, setLastUserMessageId] = useState<string | null>(null)
  const [frozenUserMessageId, setFrozenUserMessageId] = useState<string | null>(null)
  const [newlyCreatedSessions, setNewlyCreatedSessions] = useState<Set<string>>(new Set())
  // User-specific storage keys (only for messages now)
  const getMessagesKey = useCallback((userId: string, sessionId: string) => `lumina_messages_v1_${userId}_${sessionId}`, [])

  // Clear all user-specific data from sessionStorage
  const clearUserData = useCallback(() => {
    try {
      // Get all sessionStorage keys
      const keys = Object.keys(sessionStorage)
      
      // Clear all lumina-related keys
      keys.forEach(key => {
        if (key.startsWith('lumina_')) {
          sessionStorage.removeItem(key)
        }
      })
      
      console.log('🧹 Cleared all user data from sessionStorage')
    } catch (error) {
      console.warn('Error clearing user data from sessionStorage:', error)
    }
  }, [])
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  const scrollToBottom = useCallback((force = false) => {
    if (messagesEndRef.current) {
      // Use immediate scroll for loading, smooth for user interactions
      const behavior = force ? 'auto' : 'smooth'
      messagesEndRef.current.scrollIntoView({ behavior })
    }
  }, [])

  const normalizeSession = useCallback((session: any): ChatSession | null => {
    if (!session) return null
    const id = session.id || session.session_id || session.sessionId
    if (!id) return null
    const name = session.name || session.title || `Chat ${new Date().toLocaleDateString()}`
    const createdAtRaw = session.created_at || session.createdAt || session.started_at || Date.now()
    const lastMessageAtRaw = session.updated_at || session.last_message_at || session.lastMessageAt || createdAtRaw
    const messageCount = session.message_count ?? session.messageCount ?? 0

    return {
      id: String(id), // Convert to string since database returns number
      name,
      createdAt: new Date(createdAtRaw),
      lastMessageAt: new Date(lastMessageAtRaw),
      messageCount
    }
  }, [])

  const saveSessionToWebhook = useCallback(async (
    user: User | null,
    action: 'save' | 'load' | 'delete' | 'create',
    sessionId?: string,
    sessionTitle?: string
  ) => {
    if (!user) return // Only save for logged-in users
    
    try {
      const { data: authData } = await supabase.auth.getSession()
      const accessToken = authData.session?.access_token

      const payload: Record<string, any> = {
        action,
        session_id: sessionId || null
      }

      if ((action === 'save' || action === 'create') && sessionTitle) {
        payload.title = sessionTitle
      }

      const response = await fetch('https://yzflpnovjxmovgngcevr.supabase.co/functions/v1/chat-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.warn(`Failed to ${action} session via edge function:`, response.status)
        throw new Error(`API call failed with status ${response.status}`)
      } else {
        if (action === 'load') {
          const data = await response.json()
          return data.result?.sessions || []
        }
        if (action === 'create') {
          const data = await response.json()
          return data.result?.session || null
        }
        return true
      }
    } catch (error) {
      console.warn(`Error ${action} session via edge function:`, error)
      throw error // Re-throw the error so it can be caught by the calling function
    }
  }, [])

  const loadSessions = useCallback(async (user: User) => {
    if (isLoadingSessions) {
      return
    }
    
    try {
      setIsLoadingSessions(true)
      const sessions = await saveSessionToWebhook(user, 'load')
      if (sessions && Array.isArray(sessions) && sessions.length > 0) {
        const normalized = sessions
          .map(normalizeSession)
          .filter((session): session is ChatSession => session !== null)

        if (normalized.length > 0) {
          setSessions(normalized)
          setCurrentSessionId(normalized[0].id)
          setHasLoadedSessions(true)
        } else {
          setSessions([])
          setHasLoadedSessions(true)
        }
      } else {
        setSessions([])
        setHasLoadedSessions(true)
      }
    } catch (error) {
      console.warn('Error loading sessions from edge function:', error)
      setSessions([])
      setHasLoadedSessions(true) // Set to true even on error to prevent infinite retries
    } finally {
      setIsLoadingSessions(false)
    }
  }, [saveSessionToWebhook, isLoadingSessions, normalizeSession])

  const saveMessagesForSession = useCallback((sessionId: string, messages: Message[], userId: string) => {
    try {
      const key = getMessagesKey(userId, sessionId)
      const serializable = messages.map(m => ({ ...m, timestamp: (m.timestamp as Date).toISOString() }))
      sessionStorage.setItem(key, JSON.stringify(serializable))
    } catch (error) {
      console.warn('Error saving messages to sessionStorage:', error)
    }
  }, [getMessagesKey])

  // Load messages from server for a specific session
  const loadMessagesFromServer = useCallback(async (sessionId: string) => {
    try {
      const { data: authData } = await supabase.auth.getSession()
      const accessToken = authData.session?.access_token

      const response = await fetch('https://yzflpnovjxmovgngcevr.supabase.co/functions/v1/messages-action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'load',
          session_id: sessionId
        })
      })

      if (!response.ok) {
        console.warn('Failed to load messages from server:', response.status)
        return null
      }

      const data = await response.json()
      
      // Parse the messages from server response
      // Check different possible structures for messages
      let messagesArray = null
      
      if (data.result?.messages && Array.isArray(data.result.messages)) {
        messagesArray = data.result.messages
      } else if (data.messages && Array.isArray(data.messages)) {
        messagesArray = data.messages
      } else if (data.data?.messages && Array.isArray(data.data.messages)) {
        messagesArray = data.data.messages
      } else if (Array.isArray(data)) {
        messagesArray = data
      }
      
      if (messagesArray) {
        const serverMessages: Message[] = messagesArray.map((msg: any) => ({
          id: msg.id || `loaded_${Date.now()}`, // Use database ID, temp fallback for loaded messages
          content: msg.content || msg.message || '',
          role: msg.role === 'llm' ? 'assistant' : 'user',
          timestamp: new Date(msg.metadata?.timestamp || msg.timestamp || msg.created_at || Date.now()),
          attachments: msg.attachments || []
        }))
        
        // Don't save here - let the persist messages useEffect handle it
        return serverMessages
      }
      
      return null
    } catch (error) {
      console.warn('Error loading messages from server:', error)
      return null
    }
  }, [])

  const loadMessagesForSession = useCallback((sessionId: string, userId: string) => {
    try {
      const key = getMessagesKey(userId, sessionId)
      const raw = sessionStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{
          id: string; content: string; role: 'user' | 'assistant'; timestamp: string; attachments?: string[]
        }>
        const restored: Message[] = parsed.map(m => ({ 
          ...m, 
          timestamp: new Date(m.timestamp),
          role: m.role as 'user' | 'assistant'
        }))
        return restored
      }
    } catch (error) {
      console.warn('Error loading messages from sessionStorage:', error)
    }
    return [{
      id: '1',
      content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
      role: 'assistant',
      timestamp: new Date()
    }]
  }, [getMessagesKey])

  // Load sessions from webhook when user logs in
  useEffect(() => {
    if (currentUser && !hasLoadedSessions && !isLoadingSessions) {
      loadSessions(currentUser)
    }
  }, [currentUser, hasLoadedSessions, isLoadingSessions]) // Removed loadSessions from dependencies

  // Auto-create session if none exists and user is logged in
  useEffect(() => {
    if (currentUser && hasLoadedSessions && sessions.length === 0 && !currentSessionId) {
      // Auto-create a default session for new users
      const autoCreateSession = async () => {
        try {
          const createdSession = await saveSessionToWebhook(currentUser, 'create', undefined, 'Default Chat')
          if (createdSession) {
            const normalizedSession = normalizeSession(createdSession)
            if (normalizedSession) {
              setSessions([normalizedSession])
              setCurrentSessionId(normalizedSession.id)
            }
          }
        } catch (error) {
          console.warn('Error auto-creating session:', error)
        }
      }
      autoCreateSession()
    }
  }, [currentUser, hasLoadedSessions, sessions.length, currentSessionId, saveSessionToWebhook, normalizeSession])

  // Track previous user state to detect logout transitions
  const prevUserRef = useRef<User | null>(null)
  
  // Clear messages when user logs out (transition from logged in to logged out)
  useEffect(() => {
    // Only clear if transitioning from logged in to logged out
    if (prevUserRef.current && !currentUser && messages.length > 1) {
      // User has logged out, clear all messages except welcome message
      setMessages([
        {
          id: 'welcome_message',
          content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
          role: 'assistant',
          timestamp: new Date()
        }
      ])
      setLastUserMessageId(null)
    }
    // Update ref to track current user state
    prevUserRef.current = currentUser
  }, [currentUser, messages.length])

  // Load messages for current session
  useEffect(() => {
    if (currentSessionId && currentUser) {
      // Skip loading for newly created sessions - they already have default messages
      if (newlyCreatedSessions.has(currentSessionId)) {
        // Remove from newly created set since we're handling it now
        setNewlyCreatedSessions(prev => {
          const newSet = new Set(prev)
          newSet.delete(currentSessionId)
          return newSet
        })
        return
      }
      
      setIsLoadingSession(true)
      
      // Check if we've already loaded messages from server for this session
      if (!loadedSessionsFromServer.has(currentSessionId)) {
        loadMessagesFromServer(currentSessionId).then(serverMessages => {
          if (serverMessages && serverMessages.length > 0) {
            setMessages(serverMessages)
            setLoadedSessionsFromServer(prev => new Set(prev).add(currentSessionId))
            
            // Extract lastUserMessageId from the loaded messages
            const userMessages = serverMessages.filter(msg => msg.role === 'user')
            console.log('🔍 User messages found:', userMessages.length)
            console.log('🔍 All user messages:', userMessages.map(m => ({ id: m.id, role: m.role, content: m.content.substring(0, 30) + '...' })))
            
            if (userMessages.length > 0) {
              const lastUserMessage = userMessages[userMessages.length - 1]
              console.log('🔍 Last user message:', lastUserMessage)
              console.log('🔍 Last user message ID:', lastUserMessage.id, 'Type:', typeof lastUserMessage.id)
              
              if (lastUserMessage && lastUserMessage.id && (typeof lastUserMessage.id === 'string' || typeof lastUserMessage.id === 'number')) {
                console.log('✅ Setting lastUserMessageId to:', lastUserMessage.id)
                setLastUserMessageId(String(lastUserMessage.id))
              } else {
                console.log('❌ Invalid last user message ID')
                setLastUserMessageId(null)
              }
            } else {
              console.log('❌ No user messages found')
              setLastUserMessageId(null)
            }
            
            // Force scroll to bottom after server messages are loaded
            setTimeout(() => scrollToBottom(true), 150)
          } else {
            // No messages from server, use default welcome message for new sessions
            setMessages([{
              id: 'welcome_message',
              content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
              role: 'assistant',
              timestamp: new Date()
            }])
            setLastUserMessageId(null)
            // Don't mark as loaded from server if no messages were found
          }
          setIsLoadingSession(false)
          setIsSwitchingSession(false)
        }).catch(error => {
          console.warn('Error loading messages from server:', error)
          // Fallback to default welcome message
          setMessages([{
            id: 'welcome_message',
            content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
            role: 'assistant',
            timestamp: new Date()
          }])
          setLastUserMessageId(null)
          setIsLoadingSession(false)
          setIsSwitchingSession(false)
        })
      } else {
        // Already loaded from server, use local storage
        const sessionMessages = loadMessagesForSession(currentSessionId, currentUser.id)
        setMessages(sessionMessages as Message[])
        
        // Extract lastUserMessageId from the local messages
        const userMessages = sessionMessages.filter(msg => msg.role === 'user')
        if (userMessages.length > 0) {
          const lastUserMessage = userMessages[userMessages.length - 1]
          if (lastUserMessage && lastUserMessage.id && (typeof lastUserMessage.id === 'string' || typeof lastUserMessage.id === 'number')) {
            setLastUserMessageId(String(lastUserMessage.id))
          } else {
            setLastUserMessageId(null)
          }
        } else {
          setLastUserMessageId(null)
        }
        
        // Force scroll to bottom after local messages are loaded
        setTimeout(() => scrollToBottom(true), 150)
        setTimeout(() => {
          setIsLoadingSession(false)
          setIsSwitchingSession(false)
        }, 100)
      }
    }
  }, [currentSessionId, currentUser])

  // Persist messages for current session
  useEffect(() => {
    if (currentSessionId && currentUser) {
      saveMessagesForSession(currentSessionId, messages, currentUser.id)
    }
  }, [messages, currentSessionId, currentUser, saveMessagesForSession])

  // Track if we're currently loading a session to avoid webhook calls during load
  const [isLoadingSession, setIsLoadingSession] = useState(false)

  // Update session metadata when messages change (for logged-in users)
  useEffect(() => {
    if (currentUser && currentSessionId && messages.length > 1 && !isLoadingSession) {
      // Use functional update to avoid dependency on sessions
      setSessions(prev => {
        const currentSession = prev.find(s => s.id === currentSessionId)
        if (currentSession) {
          const updatedSession = {
            ...currentSession,
            lastMessageAt: new Date(),
            messageCount: messages.length - 1 // Subtract 1 for the initial greeting
          }
          
          // Return updated sessions (no webhook call - only update local state)
          return prev.map(s => s.id === currentSessionId ? updatedSession : s)
        }
        return prev
      })
    }
  }, [messages, currentUser, currentSessionId, isLoadingSession])

  // Session management handlers

  const handleInlineCreateSession = useCallback(async () => {
    if (!currentUser) return

    try {
      setIsCreatingSession(true)
      const createdSession = await saveSessionToWebhook(currentUser, 'create', undefined, 'New Chat')
      
      if (createdSession) {
        const normalizedSession = normalizeSession(createdSession)
        if (normalizedSession) {
          const updatedSessions = [normalizedSession, ...sessions]
          setSessions(updatedSessions)
          setCurrentSessionId(normalizedSession.id)
          setIsCreatingSession(false)
          
          // Mark this session as newly created to prevent message loading override
          setNewlyCreatedSessions(prev => new Set(prev).add(normalizedSession.id))
          
          // Reset messages to default greeting for new session
          setMessages([{
            id: 'welcome_message',
            content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
            role: 'assistant',
            timestamp: new Date()
          }])
        }
      }
    } catch (error) {
      console.warn('Error creating session:', error)
      setIsCreatingSession(false)
    }
  }, [sessions, currentUser, saveSessionToWebhook, normalizeSession, setNewlyCreatedSessions])


  const handleRenameSession = useCallback(async (sessionId: string, newName: string) => {
    if (!currentUser || !newName.trim() || renamingSessionId) return // Prevent multiple renames
    
    try {
      setRenamingSessionId(sessionId)
      // Update the session name via edge function
      await saveSessionToWebhook(currentUser, 'save', sessionId, newName.trim())
      
      // Update local state
      const updatedSessions = sessions.map(s => 
        s.id === sessionId ? { ...s, name: newName.trim() } : s
      )
      setSessions(updatedSessions)
      setEditingSessionId(null)
      setEditingSessionName('')
    } catch (error) {
      console.warn('Error renaming session:', error)
    } finally {
      setRenamingSessionId(null)
    }
  }, [sessions, currentUser, saveSessionToWebhook, renamingSessionId])

  const handleStartRename = useCallback((sessionId: string, currentName: string) => {
    setEditingSessionId(sessionId)
    setEditingSessionName(currentName)
  }, [])

  const handleCancelRename = useCallback(() => {
    setEditingSessionId(null)
    setEditingSessionName('')
  }, [])

  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState<Set<string>>(new Set())
  const [isSwitchingSession, setIsSwitchingSession] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<'chat' | 'upload' | 'visibility' | 'invite' | 'rebuild' | 'feedback' | 'set-password'>('chat')
  const [navCollapsed, setNavCollapsed] = useState(true)
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [newsPanelCollapsed, setNewsPanelCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [newsSheetOpen, setNewsSheetOpen] = useState(false)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [authOpen, setAuthOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isFetchingNewsRef = useRef(false)

  // Roles / RBAC
  const roles = Array.isArray((currentUser as any)?.app_metadata?.roles)
    ? ((currentUser as any).app_metadata.roles as string[])
    : []
  const hasAdmin = roles.includes('admin')

  const handleSwitchSession = useCallback((sessionId: string) => {
    if (!currentUser) return
    setIsSwitchingSession(true)
    setCurrentSessionId(sessionId)
    // The useEffect will handle loading messages when currentSessionId changes
    // The switching animation will be stopped by the message loading useEffect
  }, [currentUser])

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!currentUser || deletingSessionId) return // Prevent multiple deletions
    
    try {
      setDeletingSessionId(sessionId)
      
      // Delete the session via edge function
      await saveSessionToWebhook(currentUser, 'delete', sessionId)
      
      // Only update local state if API call succeeds
      const updatedSessions = sessions.filter(s => s.id !== sessionId)
      setSessions(updatedSessions)
      
      // If deleting current session, switch to first available or create new
      if (currentSessionId === sessionId) {
        if (updatedSessions.length > 0) {
          handleSwitchSession(updatedSessions[0].id)
        } else {
          setCurrentSessionId(null)
          setMessages([{
            id: '1',
            content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
            role: 'assistant',
            timestamp: new Date()
          }])
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      console.error('Failed to delete session. Please try again.')
    } finally {
      setDeletingSessionId(null)
    }
  }, [sessions, currentSessionId, currentUser, saveSessionToWebhook, handleSwitchSession, deletingSessionId])

  // Format published date and source for news list
  const formatNewsMeta = useCallback((publishedAt?: string, source?: string) => {
    if (!publishedAt && !source) return ''
    if (!publishedAt) return source || ''
    const date = new Date(publishedAt)
    const dateStr = isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    return `${dateStr}${source ? ` · ${source}` : ''}`.trim()
  }, [])

  // Fetch latest news from Supabase table news_articles
  const fetchNews = useCallback(async () => {
    // Prevent duplicate fetches
    if (isFetchingNewsRef.current) return
    isFetchingNewsRef.current = true

    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('id, url, headline, published_at, source, enclosure')
        .order('published_at', { ascending: false })
        .limit(30)
      if (error) {
        console.warn('news_articles fetch error:', error.message)
        isFetchingNewsRef.current = false
        return
      }
      const mapped: NewsItem[] = (data as any[]).map((r: any) => {
        // Parse enclosure JSON and check if it's an image
        let imageUrl = '/vite.svg' // Default placeholder
        if (r.enclosure) {
          try {
            const enclosure = typeof r.enclosure === 'string' ? JSON.parse(r.enclosure) : r.enclosure
            if (enclosure?.type && enclosure.type.startsWith('image/') && enclosure.url) {
              imageUrl = enclosure.url
            }
          } catch (e) {
            console.warn('Failed to parse enclosure for news article:', r.id, e)
          }
        }
        return {
          id: String(r.id),
          title: r.headline || r.source || 'Untitled',
          image: imageUrl,
          readTime: formatNewsMeta(r.published_at, r.source),
          url: r.url || undefined
        }
      })
      setNewsItems(mapped)
    } catch (e: any) {
      console.warn('news_articles fetch failed:', e?.message || e)
    } finally {
      isFetchingNewsRef.current = false
    }
  }, [formatNewsMeta])

  // Load on mount
  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  // Lazy fetch when opening the mobile sheet
  useEffect(() => {
    if (newsSheetOpen && newsItems.length === 0) fetchNews()
  }, [newsSheetOpen, newsItems.length, fetchNews])

  useEffect(() => {
    // Use a longer delay to ensure DOM has fully rendered, especially for large message loads
    const timeoutId = setTimeout(() => {
      scrollToBottom(true) // Force immediate scroll for message loading
    }, 150)
    
    return () => clearTimeout(timeoutId)
  }, [messages, scrollToBottom])

  useEffect(() => {
    scrollToBottom() // Smooth scroll for file attachments
  }, [attachedFiles, scrollToBottom])

  // Hash-based route detection for password setup
  useEffect(() => {
    const applyRoute = () => {
      const { hash, pathname } = window.location
      const hasAuthTokens = /(?:^#|[&#])type=(recovery|invite)(&|$)/.test(hash) && /access_token=/.test(hash) && /refresh_token=/.test(hash)
      if (pathname === '/set-password' || hasAuthTokens) {
        setCurrentPage('set-password')
      }
    }
    applyRoute()
    window.addEventListener('hashchange', applyRoute)
    window.addEventListener('popstate', applyRoute)
    return () => {
      window.removeEventListener('hashchange', applyRoute)
      window.removeEventListener('popstate', applyRoute)
    }
  }, [])

  // Left navigation replaces top-right hamburger dropdown

  // Supabase Auth: initialize user and listen for auth state changes
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUser(data.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null)
      // Reset userId on login/logout
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        const newId = createNewUserId()
        setUserId(newId)
        localStorage.setItem('lumina_user_id', newId)
        // Only clear messages on explicit sign-out; keep history on sign-in
        if (event === 'SIGNED_OUT') {
          // Clear all user-specific data from sessionStorage
          clearUserData()
          
          // Clear messages immediately - must happen before clearing sessionId
          setMessages([
            {
              id: 'welcome_message',
              content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
              role: 'assistant',
              timestamp: new Date()
            }
          ])
          setLastUserMessageId(null)
          // Clear sessions and current session on logout
          setSessions([])
          setCurrentSessionId(null)
          setHasLoadedSessions(false)
          setIsLoadingSessions(false)
          setLoadedSessionsFromServer(new Set())
          setCorrectionMode(false)
        }
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [createNewUserId, clearUserData])

  const handleSignOut = async () => {
    if (isSigningOut) return // Prevent multiple sign outs
    
    try {
      setIsSigningOut(true)
    await supabase.auth.signOut()
    setAuthOpen(false)
    // Also regenerate userId on manual sign out
    const newId = createNewUserId()
    setUserId(newId)
    localStorage.setItem('lumina_user_id', newId)
    
    // Clear all user-specific data from sessionStorage
    clearUserData()
    
    // Clear chat messages to default greeting - must happen before clearing sessionId
    setMessages([
      {
        id: 'welcome_message',
        content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
        role: 'assistant',
        timestamp: new Date()
      }
    ])
    setLastUserMessageId(null)
    // Clear sessions and current session on manual sign out
    setSessions([])
    setCurrentSessionId(null)
    setHasLoadedSessions(false)
    setIsLoadingSessions(false)
    setLoadedSessionsFromServer(new Set())
    setCorrectionMode(false)
    } catch (error) {
      console.warn('Error signing out:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

    // Excel Download Component with Real Image Embedding
  const ExcelDownload = React.memo<{ data: any; filename: string }>(({ data, filename }) => {
    const downloadExcel = useCallback(async () => {
      try {
        console.log('🔄 Starting Excel generation...')
        
        // Dynamically import ExcelJS to reduce initial bundle size
        const ExcelModule = await import('exceljs')
        const ExcelJS = ExcelModule as unknown as { Workbook: new () => any }
        // Create new workbook
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('Product Specification')
        
                 // Set column widths
         worksheet.columns = [
           { width: 8 },   // A - No
           { width: 18 },  // B - Code  
           { width: 35 },  // C - Area (much larger for images)
           { width: 20 },  // D - Product (part 1)
           { width: 20 },  // E - Product (part 2)
           { width: 15 },  // F - Photometry (part 1)
           { width: 15 },  // G - Photometry (part 2)
           { width: 8 },   // H - Qty (part 1)
           { width: 8 }    // I - Qty (part 2)
         ]
        
        // Add project headers
        worksheet.getCell('A1').value = 'Project'
        worksheet.getCell('A2').value = 'Description'
        worksheet.getCell('A3').value = 'Date'
        
        // Merge project header cells
        worksheet.mergeCells('A1:C1')
        worksheet.mergeCells('A2:C2')
        worksheet.mergeCells('A3:C3')
        
        // Style project headers
        const headerStyle = {
          font: { bold: true, size: 14 },
          alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
          fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE6E6FA' } },
          border: {
            top: { style: 'thin' as const },
            bottom: { style: 'thin' as const },
            left: { style: 'thin' as const },
            right: { style: 'thin' as const }
          }
        }
        
        worksheet.getCell('A1').style = headerStyle
        worksheet.getCell('A2').style = headerStyle
        worksheet.getCell('A3').style = headerStyle
        
                          // Table headers (row 5)
         const headers = ['No', 'Code', 'Area', 'Product', '', 'Photometry', '', 'Qty', '']
         if (headers && Array.isArray(headers)) {
           headers.forEach((header, index) => {
           const cell = worksheet.getCell(5, index + 1)
           cell.value = header
           if (header) {
             cell.style = {
               font: { bold: true },
               alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
               fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE6E6FA' } },
               border: {
                 top: { style: 'thin' as const },
                 bottom: { style: 'thin' as const },
                 left: { style: 'thin' as const },
                 right: { style: 'thin' as const }
               }
             }
           }
         })
         }
         
         // First: Merge rows 5 and 6 ONLY for columns that don't have horizontal merges
         worksheet.mergeCells('A5:A6')
         worksheet.mergeCells('B5:B6')
         worksheet.mergeCells('C5:C6')
         // D5:D6, E5:E6, F5:F6, G5:G6, H5:H6, I5:I6 will be handled by horizontal merges
         
         // Then: Column-wise merges for specific rows as requested
         // Product column: merge D to E horizontally ONLY for rows 5, 6, 7
         worksheet.mergeCells('D5:E6')
         worksheet.mergeCells('D7:E7')
         worksheet.mergeCells('D8:E10')
         
         // Photometry column: merge F to G horizontally for rows 5-11
         worksheet.mergeCells('F5:G6')
         worksheet.mergeCells('F7:G7')
         worksheet.mergeCells('F8:G8')
         worksheet.mergeCells('F9:G9')
         worksheet.mergeCells('F10:G10')
         worksheet.mergeCells('F11:G11')
         
         // Qty column: merge H to I horizontally for rows 5-6 (no Unit column)
         worksheet.mergeCells('H5:I6')
        
                 // Product data row (row 7)
         worksheet.getCell('A7').value = '1'
         worksheet.getCell('B7').value = data.fixture_code || 'FX.CS.51.40 X5'
         worksheet.getCell('C7').value = data.area || 'Lab'
         // Style Area cell to position text at top to avoid image overlap
         worksheet.getCell('C7').style = {
           alignment: { horizontal: 'center' as const, vertical: 'top' as const },
           font: { bold: true }
         }
         worksheet.getCell('D7').value = data.product_name || 'Mlight Kleo X 58'
         // Style Product cell normally
         worksheet.getCell('D7').style = {
           alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
           font: { bold: true }
         }
         worksheet.getCell('F7').value = ''  // Photometry data will go here
         worksheet.getCell('H7').value = `${data.quantity || '1'}`  // Qty with unit from JSON data
         worksheet.getCell('I7').value = 'set'  // Qty with unit in merged H-I column

         
         const mainRowCells = ['A7', 'B7', 'F7', 'H7','C7','I7','D7', 'F11','G11']  // Exclude C7 and D7 as they have custom styling, H7 covers H-I merge
         if (mainRowCells && Array.isArray(mainRowCells)) {
           mainRowCells.forEach(cellRef => {
           const cell = worksheet.getCell(cellRef)
           cell.style = {
             ...cell.style,
             alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
           }
         })
         }
         
         // Add borders to C7 and D7 with their custom styling preserved
         const customCells = ['C7', 'D7']
         customCells.forEach(cellRef => {
           const cell = worksheet.getCell(cellRef)
           cell.style = {
             ...cell.style,
           }
         })
         
         // Merge rows 8-11 in column C for product image area (dimension image is separate in row 12)
         worksheet.mergeCells('B8:C13')
        
        // Product description (rows 8-10) - break into multiple lines in column D
        const description = data.product_description || 
          `Pendant light with ${data.product_color || 'SILVER'} louvre, downlight + uplight, ${data.width || '58mm'}, Rod hanger, diameter ${data.diameter || '10mm'}, height ${data.height || '100-700mm'}.`
        
        // Break long description into multiple lines
        const maxLineLength = 35
        const words = description.split(' ')
        let lines = []
        let currentLine = ''
        
        if (words && Array.isArray(words)) {
          words.forEach(word => {
            if ((currentLine + word).length <= maxLineLength) {
              currentLine += (currentLine ? ' ' : '') + word
            } else {
              if (currentLine) lines.push(currentLine)
              currentLine = word
            }
          })
        }
        if (currentLine) lines.push(currentLine)
        
        const multiLineDescription = lines.join('\n')
        worksheet.getCell('D8').value = multiLineDescription
        worksheet.getCell('D8').style = {
          alignment: { wrapText: true, vertical: 'top' }
        }
        // Product description in D8 (no merge for D8, as D-E only merged for rows 5,6,7)
        
                 // Set row heights (keeping 7-10 as default, only spec rows set)
         worksheet.getRow(7).height = 30  // Spec row 1
         worksheet.getRow(8).height = 30  // Spec row 1
         worksheet.getRow(9).height = 30  // Spec row 1
         worksheet.getRow(10).height = 30  // Spec row 1
         worksheet.getRow(11).height = 30  // Spec row 1
         worksheet.getRow(12).height = 30  // Spec row 2
         worksheet.getRow(13).height = 30  // Spec row 3
         worksheet.getRow(14).height = 30  // Spec row 4
         
         // Specifications starting from row 11
         const specs = [
           { label: 'Color :', value: data.product_color || 'WHITE', extra: 'Batwing Up + Down' },
           { label: 'Width :', value: data.width || '58mm', f_column: `${data.light_engine || 'LED Boards'}`, extra: `${data.light_output || '2495 lm/m'}` },
           { label: 'Height :', value: data.height || '100mm', f_column: `${data.light_quality || 'CRI > 90'}`, extra: `${data.wattage || '20W / m'}` },
           { label: 'Control :', value: data.control_type || 'DALI', f_column: '', extra: data.light_color || '4000K' }
         ]
         
         if (specs && Array.isArray(specs)) {
           specs.forEach((spec, index) => {
           const row = 11 + index  // Start from row 11
           worksheet.getCell(`D${row}`).value = spec.label
           worksheet.getCell(`E${row}`).value = spec.value
           worksheet.getCell(`F${row}`).value = spec.f_column
           worksheet.getCell(`G${row}`).value = spec.extra

           worksheet.getCell(`D${row}`).style = {
             font: { bold: true },
             alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
           }
           
           // Style specification values with white background - centered
           worksheet.getCell(`E${row}`).style = {
             alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
             fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFFFFF' } },
             border: {
               top: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
               bottom: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
               left: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } },
               right: { style: 'thin' as const, color: { argb: 'FFCCCCCC' } }
             }
           }
           
           // Style the extra column with light background - centered
           worksheet.getCell(`G${row}`).style = {
             alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
             fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF8F8F8' } }
           }

           worksheet.getCell(`F${row}`).style = {
             font: { bold: true },
             alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
           }
          })
          }
          
          // Add thick bottom border to close the table (row 14)
          const bottomBorderCells = ['A14', 'B14', 'C14', 'D14', 'E14', 'F14', 'G14', 'H14', 'I14']
          if (bottomBorderCells && Array.isArray(bottomBorderCells)) {
            bottomBorderCells.forEach(cellRef => {
            const cell = worksheet.getCell(cellRef)
            cell.style = {
              ...cell.style,
              border: {
                ...cell.style?.border,
                bottom: { style: 'thick' }
              }
            }
          })
          }
         
                  // Download and embed images
         const imagePromises: Promise<any>[] = []
        
        // Helper function to download image as ArrayBuffer
        const downloadImage = async (url: string) => {
          try {
            const response = await fetch(url)
            const arrayBuffer = await response.arrayBuffer()
            return arrayBuffer
          } catch (error) {
            console.warn(`Failed to download image from ${url}:`, error)
            return null
          }
        }
        
        // Product image
        if (data.product_image) {
          imagePromises.push(
            downloadImage(data.product_image).then(buffer => ({
              type: 'product',
              buffer,
              url: data.product_image,
              extension: data.product_image.split('.').pop()?.toLowerCase() || 'png'
            }))
          )
        }
        
        // Photometry image
        if (data.photometry) {
          imagePromises.push(
            downloadImage(data.photometry).then(buffer => ({
              type: 'photometry',
              buffer,
              url: data.photometry,
              extension: data.photometry.split('.').pop()?.toLowerCase() || 'png'
            }))
          )
        }
        
        // Dimension image
        if (data.dimension_image) {
          imagePromises.push(
            downloadImage(data.dimension_image).then(buffer => ({
              type: 'dimension',
              buffer,
              url: data.dimension_image,
              extension: data.dimension_image.split('.').pop()?.toLowerCase() || 'png'
            }))
          )
        }
        
                 // Wait for all images to download
         console.log('📥 Downloading', imagePromises.length, 'images...')
         const imageResults = await Promise.all(imagePromises).catch(error => {
           console.warn('Error downloading images:', error)
           return []
         })
         console.log('✅ Image download completed. Results:', imageResults.length)
         
         // Add images to worksheet (check if imageResults exists and is an array)
         if (imageResults && Array.isArray(imageResults)) {
           imageResults.forEach((result) => {
          if (result && result.buffer) {
            try {
              // Add image to workbook
              const imageId = workbook.addImage({
                buffer: result.buffer,
                extension: result.extension as any
              })
              
                             if (result.type === 'product') {
                 // Add product image to column C merged area (rows 8-12)
                 worksheet.addImage(imageId, {
                   tl: { col: 2.05, row: 7.5 }, // Column C position, upper part
                   ext: { width: 180, height: 80 } // Larger width, fit in upper merged area
                 })
                 
               } else if (result.type === 'dimension') {
                 // Add dimension image on row 12 in column C
                 worksheet.addImage(imageId, {
                   tl: { col: 2.05, row: 11.5 }, // Row 12 position in column C
                   ext: { width: 180, height: 60 } // Larger dimension image
                 })
                 
               } else if (result.type === 'photometry') {
                 // Add photometry image to F and G columns starting from row 7
                 worksheet.addImage(imageId, {
                   tl: { col: 5.05, row: 6.5 }, // F column, row 7 (6.5 in 0-indexed)
                   ext: { width: 180, height: 150 } // Wider to span F-G columns, taller to cover rows 7-11
                 })
               }
              
              console.log(`✅ Successfully embedded ${result.type} image`)
              
            } catch (error) {
              console.warn(`Failed to embed ${result.type} image:`, error)
              
                             // Fallback: Add URL as comment
               if (result.type === 'product') {
                 worksheet.getCell('C8').value = '🖼️ PRODUCT IMAGE'
                 worksheet.getCell('C8').note = `Product Image: ${result.url}`
                 worksheet.getCell('C8').style = {
                   alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
                   fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE6F3FF' } },
                   font: { bold: true, color: { argb: 'FF0066CC' } }
                 }
               } else if (result.type === 'dimension') {
                 // Add dimension as note to C12 cell where the dimension image is placed
                 worksheet.getCell('C12').note = `Dimension Image: ${result.url}`
               } else if (result.type === 'photometry') {
                 worksheet.getCell('F7').value = '📊 PHOTOMETRY'
                 worksheet.getCell('F7').note = `Photometry: ${result.url}`
                 worksheet.getCell('F7').style = {
                   alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
                   fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFF0E6' } },
                   font: { bold: true, color: { argb: 'FFCC6600' } }
                 }
               }
                         }
           }
         })
         } else {
           console.warn('No image results to process')
         }
         
         // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer()
        
        // Create blob and download
        const blob = new Blob([buffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        })
        
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        window.URL.revokeObjectURL(url)
        
                 console.log('🎉 Excel file with embedded images downloaded:', filename)
         console.log('📸 Images successfully embedded:', imageResults ? imageResults.filter(r => r && r.buffer).length : 0)
        
              } catch (error) {
          console.error('Error generating Excel file:', error)
          
          // Fallback: Create a simpler Excel without images
          try {
            console.log('🔄 Attempting fallback Excel generation...')
            const ExcelModule2 = await import('exceljs')
            const ExcelJS2 = ExcelModule2 as unknown as { Workbook: new () => any }
            const fallbackWorkbook = new ExcelJS2.Workbook()
            const fallbackWorksheet = fallbackWorkbook.addWorksheet('Product Data')
            
            // Simple data layout
            fallbackWorksheet.addRow(['Product Name', data.product_name || 'N/A'])
            fallbackWorksheet.addRow(['Code', data.fixture_code || 'N/A'])
            fallbackWorksheet.addRow(['Area', data.area || 'N/A'])
            fallbackWorksheet.addRow(['Color', data.product_color || 'N/A'])
            fallbackWorksheet.addRow(['Width', data.width || 'N/A'])
            fallbackWorksheet.addRow(['Height', data.height || 'N/A'])
            fallbackWorksheet.addRow(['Control', data.control_type || 'N/A'])
            fallbackWorksheet.addRow(['Light Output', data.light_output || 'N/A'])
            fallbackWorksheet.addRow(['Wattage', data.wattage || 'N/A'])
            if (data.product_image) fallbackWorksheet.addRow(['Product Image URL', data.product_image])
            if (data.photometry) fallbackWorksheet.addRow(['Photometry URL', data.photometry])
            if (data.dimension_image) fallbackWorksheet.addRow(['Dimension Image URL', data.dimension_image])
            
            const fallbackBuffer = await fallbackWorkbook.xlsx.writeBuffer()
            const fallbackBlob = new Blob([fallbackBuffer], { 
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            })
            
            const fallbackUrl = window.URL.createObjectURL(fallbackBlob)
            const fallbackLink = document.createElement('a')
            fallbackLink.href = fallbackUrl
            fallbackLink.download = filename
            fallbackLink.click()
            window.URL.revokeObjectURL(fallbackUrl)
            
            console.log('✅ Fallback Excel downloaded successfully')
          } catch (fallbackError) {
            console.error('Even fallback Excel generation failed:', fallbackError)
            alert('Sorry, Excel generation failed. Please try again or contact support.')
          }
        }
    }, [data, filename])

    return (
      <div className="inline-block bg-green-50 border border-green-200 rounded-lg p-4 my-2 hover:bg-green-100 transition-colors cursor-pointer group" onClick={downloadExcel}>
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 group-hover:text-green-700">
              📊 {filename}
            </p>
            <p className="text-xs text-gray-500 group-hover:text-green-600">
              ✨ Professional Excel with REAL embedded images!
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="text-green-500 group-hover:text-green-700">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    )
  })

  // Memoized function to preprocess content and fix markdown patterns
  const preprocessMarkdown = useCallback((text: string): { content: string; excelData?: any; filename?: string } => {
    let processed = String(text || '')
    let excelData = null
    let filename: string | undefined = undefined
    
    // IMMEDIATE FIX: Convert any "View Portfolio Image" text to proper markdown FIRST
    if (processed.includes('View Portfolio Image')) {
      console.log('🚨 IMMEDIATE FIX: Found View Portfolio text, converting...')
      processed = processed.replace(/View Portfolio Image 1/g, '![Portfolio 1](https://picsum.photos/600/400?random=1)')
      processed = processed.replace(/View Portfolio Image 2/g, '![Portfolio 2](https://picsum.photos/600/400?random=2)')
      processed = processed.replace(/View Portfolio Image (\d+)/g, (_, num) => {
        return `![Portfolio ${num}](https://picsum.photos/600/400?random=${num})`
      })
      console.log('✅ IMMEDIATE FIX: Conversion complete')
    }
    
    // Check for JSON pattern wrapped in (( ))
    console.log('🔍 Checking text for JSON pattern:', text.substring(0, 200) + '...')
    
    // More robust regex that handles nested objects and long content
    const jsonMatch = processed.match(/\(\(json:\s*(\{[\s\S]*?\})\s*\)\)/g)
    if (jsonMatch && jsonMatch.length > 0) {
      console.log('✅ Found JSON match:', jsonMatch[0].substring(0, 100) + '...')
      
      try {
        // Extract just the JSON part (everything between the first { and last })
        const fullMatch = jsonMatch[0]
        const jsonStart = fullMatch.indexOf('{')
        const jsonEnd = fullMatch.lastIndexOf('}')
        const jsonString = fullMatch.substring(jsonStart, jsonEnd + 1)
        
        console.log('🔧 Extracted JSON string:', jsonString.substring(0, 100) + '...')
        
        // Safe parse: sanitize and JSON.parse instead of eval
        let jsonData
        try {
          let sanitized = jsonString
            // Quote unquoted property keys
            .replace(/([,{\s])([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
            // Remove trailing commas
            .replace(/,(\s*[}\]])/g, '$1')
            // Normalize whitespace
            .replace(/\n\s*/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          console.log('🔧 Sanitized JSON string:', sanitized.substring(0, 200) + '...')
          jsonData = JSON.parse(sanitized)
        } catch (parseError) {
          console.log('❌ JSON.parse failed after sanitization:', parseError)
          throw parseError
        }
        excelData = jsonData
        
        // Generate filename from product name or fixture code
        const productName = jsonData.product_name || jsonData.fixture_code || 'product'
        filename = `${productName.replace(/[^a-zA-Z0-9]/g, '_')}_data.xlsx`
        
        // Remove the JSON pattern from the text
        processed = processed.replace(fullMatch, '').trim()
        
        console.log('📊 Successfully parsed Excel data:', { excelData, filename })
      } catch (error) {
        console.error('❌ Error parsing JSON from response:', error)
        console.error('JSON string that failed:', jsonMatch[0])
      }
    } else {
      console.log('❌ No JSON pattern found in text')
    }
    
    // Handle the specific patterns from webhook responses
    // console.log('🖼️ Processing message:', text.length > 0 ? 'YES' : 'NO')
    // console.log('🖼️ Before image processing:', processed.substring(0, 300))
    
    // Check if content already has correct markdown format
    const hasCorrectMarkdown = /!\[[^\]]*\]\(https?:\/\/[^\)]+\)/g.test(processed)
    let matchCount = 0
    
    if (hasCorrectMarkdown) {
      console.log('✅ Content already has correct markdown format - skipping processing')
    } else {
      // Check if the content contains any portfolio-related text
      if (processed.includes('Portfolio') || processed.includes('portfolio')) {
        console.log('🎯 Found portfolio content in message')
        
        // AGGRESSIVE FIX: If we find "View Portfolio Image" text, assume these are broken links
        // and convert them to proper image markdown with placeholder URLs
        if (processed.includes('View Portfolio Image 1')) {
          console.log('🔧 Emergency fix: Converting View Portfolio Image 1')
          processed = processed.replace(/View Portfolio Image 1/g, '![Portfolio 1](https://picsum.photos/400/300?random=1)')
        }
        if (processed.includes('View Portfolio Image 2')) {
          console.log('🔧 Emergency fix: Converting View Portfolio Image 2')
          processed = processed.replace(/View Portfolio Image 2/g, '![Portfolio 2](https://picsum.photos/400/300?random=2)')
        }
        
        // Handle any other numbered portfolio images
        processed = processed.replace(/View Portfolio Image (\d+)/g, (match, num) => {
          console.log(`🔧 Emergency fix: Converting ${match}`)
          return `![Portfolio ${num}](https://picsum.photos/400/300?random=${num})`
        })
      }

      // Handle "View Portfolio Image N" links specifically (most common pattern)
      const viewPortfolioPattern = /\[View Portfolio Image (\d+)\]\((https?:\/\/[^\)]+)\)/gi
      processed = processed.replace(viewPortfolioPattern, (match, num, url) => {
        matchCount++
        console.log(`🔗 Found View Portfolio link #${matchCount}: ${match}`)
        console.log(`📸 URL: ${url}`)
        
        // Always convert to image since these are typically image URLs from portfolio
        // Even if they don't have file extensions, they're likely images from Supabase storage
        console.log(`✅ Converting to image: Portfolio ${num}`)
        return `![Portfolio ${num}](${url})`
      })
      
      // Handle the case where portfolio links might not have proper brackets
      // Convert plain "View Portfolio Image N: URL" format
      processed = processed.replace(/View Portfolio Image (\d+):\s*(https?:\/\/[^\s]+)/gi, (match, num, url) => {
        console.log(`🔗 Found plain portfolio format: ${match}`)
        return `![Portfolio ${num}](${url})`
      })
      
      // Alternative pattern: [View Portfolio Image N](url) - handle any case variations
      processed = processed.replace(/\[(view\s+portfolio\s+image\s+\d+)\]\((https?:\/\/[^\)]+)\)/gi, (match, text, url) => {
        const num = text.match(/\d+/)?.[0] || '1'
        console.log(`🔗 Found alternative portfolio pattern: ${match}`)
        return `![Portfolio ${num}](${url})`
      })
      
      // Also handle simple "Portfolio Image N" pattern
      processed = processed.replace(/\[Portfolio Image (\d+)\]\((https?:\/\/[^\)]+)\)/gi, (match, num, url) => {
        console.log(`🔗 Found Portfolio Image link: ${match}`)
        return `![Portfolio ${num}](${url})`
      })
      
      // Handle any text that shows "View Portfolio Image N" without proper markdown
      // This fixes the case where the link text is showing instead of being rendered
      processed = processed.replace(/View Portfolio Image (\d+)/g, (match, num) => {
        console.log(`🔗 Found plain text portfolio: ${match}`)
        return `Portfolio ${num}` // Just return clean text if no URL is detected
      })
      
      console.log(`📊 Total portfolio links processed: ${matchCount}`)
    }
    
    return { content: processed, excelData, filename }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!inputValue.trim() && attachedFiles.length === 0) || (isLoading && loadingSessions.has(currentSessionId || '')) || isSwitchingSession) return

    const filesToSend = [...attachedFiles]

    const userMessage: Message = {
      id: '', // Will be set from database response
      content: inputValue || (filesToSend.length > 0 ? `Uploaded ${filesToSend.length} file(s).` : ''),
      role: 'user',
      timestamp: new Date(),
      attachments: filesToSend.map(f => f.name)
    }

    setMessages(prev => [...prev, userMessage])
    // Don't set lastUserMessageId yet - will be set from database response
    setInputValue('')
    // Reset textarea height when clearing input
    if (textareaRef.current) {
      textareaRef.current.style.height = '3rem' // Reset to minHeight
    }
    // Clear attachments immediately for UX
    setAttachedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    setIsLoading(true)
    // Add current session to loading sessions (use empty string for logged-out users)
    const sessionKey = currentSessionId || ''
    setLoadingSessions(prev => new Set(prev).add(sessionKey))

    try {
      // Prepare auth token for server-side verification in n8n
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      let response: Response
      if (filesToSend.length > 0) {
        const form = new FormData()
        form.append('chatInput', userMessage.content)
        form.append('timestamp', userMessage.timestamp.toISOString())
        form.append('userId', userId)
        form.append('sessionId', currentSessionId || userId)
        if (accessToken) form.append('accessToken', accessToken)
        // Always include the last user message ID for potential corrections (database ID)
        // Use frozen ID if in correction mode, otherwise use current lastUserMessageId
        const messageIdToSend = frozenUserMessageId || lastUserMessageId
        console.log('📤 FormData - Sending lastUserMessageId:', {
          messageIdToSend,
          frozenUserMessageId,
          lastUserMessageId,
          correctionMode
        })
        if (messageIdToSend) form.append('lastUserMessageId', messageIdToSend)
        form.append('correction_mode', correctionMode.toString())
        if (!lastUserMessageId) form.append('generateSessionName', 'true')
        for (const f of filesToSend) form.append('files', f, f.name)
        response = await fetch('https://primary-production-b7ed9.up.railway.app/webhook/92ed93f0-e638-484d-bf1d-eb1a4c7d66e6/chat', {
          method: 'POST',
          body: form
        })
       } else {
         const messageIdToSend = frozenUserMessageId || lastUserMessageId
         console.log('📤 JSON - Sending lastUserMessageId:', {
           messageIdToSend,
           frozenUserMessageId,
           lastUserMessageId,
           correctionMode
         })
         
         response = await fetch('https://primary-production-b7ed9.up.railway.app/webhook/92ed93f0-e638-484d-bf1d-eb1a4c7d66e6/chat', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           chatInput: userMessage.content,
           timestamp: userMessage.timestamp.toISOString(),
           userId: userId,
           sessionId: currentSessionId || null,
           accessToken: accessToken || null,
           // Always include the last user message ID for potential corrections (database ID from previous response)
           // Use frozen ID if in correction mode, otherwise use current lastUserMessageId
           lastUserMessageId: messageIdToSend,
           correction_mode: correctionMode,
           // Generate session name only for the first message in a session
           ...(!lastUserMessageId && { generateSessionName: true })
         })
       })
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Update correction mode based on webhook response
      if (typeof data.correction_mode === 'boolean') {
        setCorrectionMode(data.correction_mode)
        
        if (data.correction_mode === true) {
          // Freeze the current lastUserMessageId when correction mode starts
          if (lastUserMessageId && !frozenUserMessageId) {
            setFrozenUserMessageId(lastUserMessageId)
          }
        } else if (data.correction_mode === false) {
          // Unfreeze when correction mode ends
          setFrozenUserMessageId(null)
        }
      }
      
      // Update the user message with database ID if available
      if (data.usr_msg_id) {
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, id: data.usr_msg_id }
            : msg
        ))
        
        // Always update lastUserMessageId with the current message's database ID
        // This ensures we use the actual user message, not the frozen one
        setLastUserMessageId(data.usr_msg_id)
      }
      
      // Handle generated session name from webhook response
      if (data.generated_session_name && currentSessionId) {
        // Check if this is a "New Chat" session that needs to be renamed
        const currentSession = sessions.find(s => s.id === currentSessionId)
        if (currentSession && currentSession.name === 'New Chat') {
          try {
            // Rename the session using the generated name
            await saveSessionToWebhook(currentUser, 'save', currentSessionId, data.generated_session_name)
            
            // Animate the session name change
            const sessionElement = document.querySelector(`[data-session-id="${currentSessionId}"] .session-name`) as HTMLElement
            if (sessionElement) {
              // Fade out
              sessionElement.style.transition = 'opacity 0.3s ease-in-out'
              sessionElement.style.opacity = '0'
              
              // Wait for fade out, then update and fade in
              setTimeout(() => {
                // Update local session state
                setSessions(prev => prev.map(session => 
                  session.id === currentSessionId 
                    ? { ...session, name: data.generated_session_name }
                    : session
                ))
                
                
                // Fade in
                sessionElement.style.opacity = '1'
              }, 300)
            } else {
              // Fallback if element not found
              setSessions(prev => prev.map(session => 
                session.id === currentSessionId 
                  ? { ...session, name: data.generated_session_name }
                  : session
              ))
            }
          } catch (error) {
            console.warn('Error renaming session with generated name:', error)
          }
        }
      }

      const assistantMessage: Message = {
        id: data.llm_msg_id || `temp_${Date.now()}`, // Use database ID from webhook response, temp fallback
        content: data.output || data.response || data.message || 'I received your message but couldn\'t generate a proper response.',
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        content: 'Sorry, I\'m having trouble connecting to the server right now. Please try again later.',
        role: 'assistant',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      // Remove current session from loading sessions (use empty string for logged-out users)
      const sessionKey = currentSessionId || ''
      setLoadingSessions(prev => {
        const newSet = new Set(prev)
        newSet.delete(sessionKey)
        return newSet
      })
    }
  }

  // Standalone Set Password page (bypass app layout)
  if (currentPage === 'set-password') {
    return <SetPasswordPage />
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-50 to-white overflow-hidden w-full max-w-full">
      {/* Admin/Upload pages now render within main layout below */}

      {/* App Layout */}
      <>
        {/* Full-width Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-lg">
          {/* Logo + Mobile sidebar toggle */}
          <div className="flex items-center">
            <button
               onClick={() => setMobileNavOpen(!mobileNavOpen)}
               className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 mr-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
                         <div className="bg-cyan-400 text-white px-3 py-2 rounded-lg font-bold text-sm shadow-lg">
               LIGHT<br />TALK
          </div>
        </div>

            {/* Spacer (left nav handles navigation) */}
            <div />

            {/* Auth controls */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600">v{pkg.version}</span>
              {currentUser ? (
                       <button 
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSigningOut ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing out...
                    </>
                  ) : (
                    'Sign out'
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  aria-label="Open login"
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium shadow-md hover:shadow-lg transition-shadow"
                >
                  LOGIN
                </button>
              )}
            </div>
          </header>

          {/* Content Row: Left Nav + Main + Right News */}
          <div className="flex flex-1 overflow-hidden min-w-0">
            {/* Mobile Nav Drawer (animated) */}
            <div className="lg:hidden fixed inset-0 z-40 pointer-events-none">
              <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${mobileNavOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`} onClick={() => setMobileNavOpen(false)} />
              <div className={`absolute inset-y-0 left-0 w-64 bg-white shadow-2xl p-3 transition-transform duration-300 ease-in-out ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} pointer-events-auto flex flex-col`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-800">Menu</div>
                  <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu" className="p-2 rounded-md text-gray-600 hover:bg-gray-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
             </div>
                  <nav className="space-y-1 flex-1 overflow-y-auto">
                    <button 
                      onClick={() => { setCurrentPage('chat'); setMobileNavOpen(false) }} 
                      aria-current={currentPage === 'chat' ? 'page' : undefined}
                      className={`${currentPage === 'chat' ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'} flex items-center gap-3 w-full px-2 py-2 rounded-md`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.264 0-2.468-.23-3.562-.648L3 20l.944-3.305C3.338 15.419 3 13.749 3 12 3 7.582 7.03 4 12 4s9 3.582 9 8z"/></svg>
                      <span>Chat</span>
                    </button>
                    
                    {/* Mobile Sessions Button */}
                    {currentUser && (
                      <button 
                        onClick={() => { setSessionPanelOpen(!sessionPanelOpen); setMobileNavOpen(false) }} 
                        className="flex items-center gap-3 w-full px-2 py-2 rounded-md text-gray-700 hover:bg-gray-50"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.264 0-2.468-.23-3.562-.648L3 20l.944-3.305C3.338 15.419 3 13.749 3 12 3 7.582 7.03 4 12 4s9 3.582 9 8z"/>
                        </svg>
                        <span>Sessions ({sessions.length})</span>
                      </button>
                    )}
                    
                    <button 
                      onClick={() => { setNewsSheetOpen(true); setMobileNavOpen(false) }} 
                      className="flex items-center gap-3 w-full px-2 py-2 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h10"/></svg>
                      <span>News</span>
                    </button>
                    {hasAdmin && (
                      <button 
                        onClick={() => { setCurrentPage('upload'); setMobileNavOpen(false) }} 
                        aria-current={currentPage === 'upload' ? 'page' : undefined}
                        className={`${currentPage === 'upload' ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'} flex items-center gap-3 w-full px-2 py-2 rounded-md`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12v-8m0 0l-4 4m4-4l4 4"/></svg>
                        <span>Upload Documents</span>
                      </button>
                    )}
                    
                    {hasAdmin && (
                      <button 
                        onClick={() => { setCurrentPage('visibility'); setMobileNavOpen(false) }} 
                        aria-current={currentPage === 'visibility' ? 'page' : undefined}
                        className={`${currentPage === 'visibility' ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'} flex items-center gap-3 w-full px-2 py-2 rounded-md`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                        <span>Document Visibility</span>
                      </button>
                    )}

                    {hasAdmin && (
                      <button 
                        onClick={() => { setCurrentPage('invite'); setMobileNavOpen(false) }} 
                        aria-current={currentPage === 'invite' ? 'page' : undefined}
                        className={`${currentPage === 'invite' ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'} flex items-center gap-3 w-full px-2 py-2 rounded-md`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 8a6 6 0 11-12 0 6 6 0 0112 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4zM15 10h4m-2-2v4"/></svg>
                        <span>Invite Admins</span>
                      </button>
                    )}

                    {hasAdmin && (
                      <button 
                        onClick={() => { setCurrentPage('rebuild'); setMobileNavOpen(false) }} 
                        aria-current={currentPage === 'rebuild' ? 'page' : undefined}
                        className={`${currentPage === 'rebuild' ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'} flex items-center gap-3 w-full px-2 py-2 rounded-md`}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.5 12a7.5 7.5 0 0112.75-5.06M19.5 12a7.5 7.5 0 01-12.75 5.06M16.5 3V7.5H21M7.5 21H3V16.5"/></svg>
                        <span>Rebuild Search Index</span>
                      </button>
                    )}

                    {hasAdmin && (
                      <button 
                        onClick={() => { setCurrentPage('feedback'); setMobileNavOpen(false) }} 
                        aria-current={currentPage === 'feedback' ? 'page' : undefined}
                        className={`${currentPage === 'feedback' ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'} flex items-center gap-3 w-full px-2 py-2 rounded-md`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                        <span>Feedback List</span>
                      </button>
                    )}
                  </nav>
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    {currentUser ? (
                      <div className="flex items-start gap-2">
                        <div className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
                          {currentUser.email?.slice(0,1)?.toUpperCase() || 'U'}
                  </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate" title={currentUser.email || ''}>{currentUser.email}</div>
                          {Array.isArray((currentUser as any).app_metadata?.roles) && (currentUser as any).app_metadata.roles.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {((currentUser as any).app_metadata.roles as string[]).map((role: string) => (
                                <span key={role} className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[10px] uppercase tracking-wide">{role}</span>
              ))}
            </div>
                          )}
                          <div className="mt-2 flex gap-2">
              <button 
                              onClick={() => { navigator.clipboard.writeText(currentUser.email || ''); }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                              Copy email
                            </button>
                            <button
                              onClick={async () => { await handleSignOut(); setMobileNavOpen(false); }}
                              disabled={isSigningOut}
                              className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {isSigningOut ? (
                                <>
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Signing out...
                                </>
                              ) : (
                                'Sign out'
                              )}
              </button>
            </div>
          </div>
        </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">Not signed in</div>
                         <button
                          onClick={() => { setAuthOpen(true); setMobileNavOpen(false); }}
                          className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
             >
                          Sign in
            </button>
                </div>
                    )}
              </div>
                </div>
              </div>
              {/* Left Navigation (collapsible) */}
              <div className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${navCollapsed ? 'w-16' : 'w-60'}`}>
                       <button 
                  onClick={() => setNavCollapsed(!navCollapsed)}
                  aria-label="Toggle navigation"
                  className={`m-2 ${navCollapsed ? 'px-2 py-2' : 'p-2'} rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100`}
                  title={navCollapsed ? 'Expand' : 'Collapse'}
                       >
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                         </svg>
                       </button>
                <nav className="flex-1 px-2 pb-2 space-y-1">
                             <button 
                    onClick={() => setCurrentPage('chat')}
                    aria-current={currentPage === 'chat' ? 'page' : undefined}
                    className={`flex items-center w-full h-10 ${navCollapsed ? 'px-2 py-2' : 'p-2'} rounded-md gap-3 ${currentPage === 'chat' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                    title="Chat"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.264 0-2.468-.23-3.562-.648L3 20l.944-3.305C3.338 15.419 3 13.749 3 12 3 7.582 7.03 4 12 4s9 3.582 9 8z"/></svg>
                    <span className={`${navCollapsed ? 'hidden' : ''} truncate`}>Chat</span>
                             </button>
                             
                             {/* Session Panel Toggle Button */}
                             {currentUser && (
                               <button
                                 onClick={() => setSessionPanelOpen(!sessionPanelOpen)}
                                 className={`flex items-center w-full h-10 ${navCollapsed ? 'px-2 py-2' : 'p-2'} rounded-md gap-3 text-gray-600 hover:bg-gray-50`}
                                 title={sessionPanelOpen ? 'Close Sessions' : 'Open Sessions'}
                               >
                                 <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.264 0-2.468-.23-3.562-.648L3 20l.944-3.305C3.338 15.419 3 13.749 3 12 3 7.582 7.03 4 12 4s9 3.582 9 8z"/>
                                 </svg>
                                 <span className={`${navCollapsed ? 'hidden' : ''} truncate`}>
                                   {sessionPanelOpen ? 'Close Sessions' : 'Sessions'}
                                 </span>
                               </button>
                             )}
                  {hasAdmin && (
                    <button
                      onClick={() => setCurrentPage('upload')}
                      aria-current={currentPage === 'upload' ? 'page' : undefined}
                      className={`flex items-center w-full h-10 ${navCollapsed ? 'px-2 py-2' : 'p-2'} rounded-md gap-3 ${currentPage === 'upload' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                      title="Upload Documents"
                    >
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12v-8m0 0l-4 4m4-4l4 4"/></svg>
                      <span className={`${navCollapsed ? 'hidden' : ''} truncate`}>Upload Documents</span>
                             </button>
                  )}
                  
                  {hasAdmin && (
                           <button 
                      onClick={() => setCurrentPage('visibility')}
                      aria-current={currentPage === 'visibility' ? 'page' : undefined}
                      className={`flex items-center w-full h-10 ${navCollapsed ? 'px-2 py-2' : 'p-2'} rounded-md gap-3 ${currentPage === 'visibility' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                      title="Document Visibility"
                    >
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      <span className={`${navCollapsed ? 'hidden' : ''} truncate`}>Document Visibility</span>
                           </button>
                  )}
                  {hasAdmin && (
                    <button
                      onClick={() => setCurrentPage('invite')}
                      aria-current={currentPage === 'invite' ? 'page' : undefined}
                      className={`flex items-center w-full h-10 ${navCollapsed ? 'px-2 py-2' : 'p-2'} rounded-md gap-3 ${currentPage === 'invite' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                      title="Invite Admins"
                    >
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 8a6 6 0 11-12 0 6 6 0 0112 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14c-4 0-7 2-7 4v2h14v-2c0-2-3-4-7-4zM15 10h4m-2-2v4"/></svg>
                      <span className={`${navCollapsed ? 'hidden' : ''} truncate`}>Invite Admins</span>
                           </button>
                  )}
                  {hasAdmin && (
                    <button
                      onClick={() => { setCurrentPage('rebuild') }} 
                      aria-current={currentPage === 'rebuild' ? 'page' : undefined}
                      className={`flex items-center w-full h-10 ${navCollapsed ? 'px-2 py-2' : 'p-2'} rounded-md gap-3 ${currentPage === 'rebuild' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                      title="Rebuild Search Index"
                    >
                      <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.5 12a7.5 7.5 0 0112.75-5.06M19.5 12a7.5 7.5 0 01-12.75 5.06M16.5 3V7.5H21M7.5 21H3V16.5"/></svg>
                      <span className={`${navCollapsed ? 'hidden' : ''} truncate`}>Rebuild Search Index</span>
                           </button>
                  )}
                  {hasAdmin && (
                    <button
                      onClick={() => setCurrentPage('feedback')}
                      aria-current={currentPage === 'feedback' ? 'page' : undefined}
                      className={`flex items-center w-full h-10 ${navCollapsed ? 'px-2 py-2' : 'p-2'} rounded-md gap-3 ${currentPage === 'feedback' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                      title="Feedback List"
                    >
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>
                      <span className={`${navCollapsed ? 'hidden' : ''} truncate`}>Feedback List</span>
                           </button>
                  )}
                  
                  
                  {/* Removed non-functional links on desktop */}
                </nav>
                <div className={`border-t border-gray-200 pt-2 mt-2 pb-2 ${navCollapsed ? 'px-2' : 'px-2'}`}>
                  {currentUser ? (
                    <div className={`flex items-start w-full gap-2`}>
                      <div className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 text-sm font-medium" title={currentUser.email || ''}>
                        {currentUser.email?.slice(0,1)?.toUpperCase() || 'U'}
                      </div>
                      {!navCollapsed && (
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate" title={currentUser.email || ''}>{currentUser.email}</div>
                          {Array.isArray((currentUser as any).app_metadata?.roles) && (currentUser as any).app_metadata.roles.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {((currentUser as any).app_metadata.roles as string[]).map((role: string) => (
                                <span key={role} className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-[10px] uppercase tracking-wide">{role}</span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => { navigator.clipboard.writeText(currentUser.email || ''); }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                            >
                              Copy email
                           </button>
                            <button
                              onClick={async () => { await handleSignOut(); }}
                              disabled={isSigningOut}
                              className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {isSigningOut ? (
                                <>
                                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Signing out...
                                </>
                              ) : (
                                'Sign out'
                              )}
                           </button>
                          </div>
                         </div>
                       )}
                     </div>
                  ) : (
                    <div className={`flex items-center justify-between`}>
                      <div className="text-sm text-gray-600">{navCollapsed ? '' : 'Not signed in'}</div>
                      {!navCollapsed && (
                        <button
                          onClick={() => { setAuthOpen(true); }}
                          className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                          Sign in
           </button>
                      )}
                    </div>
                  )}
                </div>
                           </div>
       {/* Session Panel */}
       {currentUser && (
         <>
           {/* Mobile overlay for session panel */}
           {sessionPanelOpen && (
             <div 
               className="fixed inset-0 bg-black/40 z-40 lg:hidden"
               onClick={() => setSessionPanelOpen(false)}
             />
           )}
           <div className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${sessionPanelOpen ? 'w-80' : 'w-0'} overflow-hidden ${sessionPanelOpen ? 'fixed lg:static inset-y-0 left-0 lg:right-0 z-50 lg:z-auto' : 'hidden lg:flex'}`}>
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Chat Sessions</h3>
                        <button
                          onClick={() => setSessionPanelOpen(false)}
                          className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          title="Close sessions"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {/* New Session Button */}
                      <button
                        onClick={handleInlineCreateSession}
                        disabled={isCreatingSession}
                        className="flex items-center w-full px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCreatingSession ? (
                          <>
                            <svg className="w-5 h-5 mr-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="font-medium">Creating...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                            </svg>
                            <span className="font-medium">New Session</span>
                          </>
                        )}
                      </button>
                      
                      {/* Session List */}
                      {sessions.length > 0 ? (
                        <div className="space-y-2">
                          {sessions.map(session => (
                            <div key={session.id} data-session-id={session.id} className="relative group">
                              {editingSessionId === session.id ? (
                                <div className="flex items-center w-full p-3 bg-gray-50 rounded-lg">
                                  <input
                                    type="text"
                                    value={editingSessionName}
                                    onChange={(e) => setEditingSessionName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && session.id && !renamingSessionId) {
                                        handleRenameSession(session.id, editingSessionName)
                                      } else if (e.key === 'Escape') {
                                        handleCancelRename()
                                      }
                                    }}
                                    onBlur={() => {
                                      if (session.id && editingSessionName.trim() && !renamingSessionId) {
                                        const currentSession = sessions.find(s => s.id === session.id)
                                        if (currentSession && currentSession.name !== editingSessionName.trim()) {
                                          handleRenameSession(session.id, editingSessionName)
                                        } else {
                                          handleCancelRename()
                                        }
                                      }
                                    }}
                                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                  <div className="flex gap-2 ml-3">
                                    <button
                                      onClick={() => session.id && handleRenameSession(session.id, editingSessionName)}
                                      disabled={renamingSessionId === session.id}
                                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      {renamingSessionId === session.id ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={handleCancelRename}
                                      className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleSwitchSession(session.id)}
                                  className={`flex items-center w-full p-3 rounded-lg transition-colors ${
                                    currentSessionId === session.id 
                                      ? 'bg-blue-100 text-blue-900 border-2 border-blue-200' 
                                      : 'text-gray-700 hover:bg-gray-50 border-2 border-transparent'
                                  }`}
                                >
                                  <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.264 0-2.468-.23-3.562-.648L3 20l.944-3.305C3.338 15.419 3 13.749 3 12 3 7.582 7.03 4 12 4s9 3.582 9 8z"/>
                                  </svg>
                                   <div className="flex-1 min-w-0 text-left">
                                     <div className="font-medium truncate session-name">{session.name}</div>
                                   </div>
                                  <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleStartRename(session.id, session.name)
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-600"
                                      title="Rename session"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteSession(session.id)
                                      }}
                                      disabled={deletingSessionId === session.id}
                                      className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                                      title="Delete session"
                                    >
                                      {deletingSessionId === session.id ? (
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                        </svg>
                                      )}
                                    </button>
                                  </div>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.264 0-2.468-.23-3.562-.648L3 20l.944-3.305C3.338 15.419 3 13.749 3 12 3 7.582 7.03 4 12 4s9 3.582 9 8z"/>
                          </svg>
                          <p className="text-sm">No sessions yet</p>
                          <p className="text-xs text-gray-400 mt-1">Create your first session to get started</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:ml-0">
                  {currentPage === 'chat' && (
                    <>

        {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 w-full">
          <div className="max-w-4xl mx-auto w-full">
            {isSwitchingSession ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="text-gray-500 text-sm">Loading session...</p>
                </div>
              </div>
            ) : (
              <>
            {messages.map((message) => (
                        <MessageContainer key={message.id} message={message} preprocessMarkdown={preprocessMarkdown} ExcelDownload={ExcelDownload} userInitial={currentUser?.email?.slice(0,1)?.toUpperCase() || 'U'} />
            ))}
                {isLoading && loadingSessions.has(currentSessionId || '') && <LoadingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} />
        </div>
      </div>

        {/* Chat Input */}
                     <div className={`fixed bottom-0 p-4 z-20 lg:z-40 left-0 right-0 ${navCollapsed ? 'lg:left-16' : 'lg:left-60'} ${newsPanelCollapsed ? 'lg:right-16' : 'lg:right-80'}`}>
        <div className="max-w-4xl mx-auto">
          {/* Correction Mode Label */}
          {correctionMode && (
            <div className="mb-2 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-100 border border-amber-200 rounded-full text-amber-800 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
                Correction Mode
              </div>
            </div>
          )}
                      <div className="border border-gray-200 bg-white/90 backdrop-blur rounded-2xl shadow-xl p-2">
          <form onSubmit={handleSubmit} className="relative">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedFiles.map((f, idx) => (
                <span key={idx} className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs border border-gray-200">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79V17a5 5 0 01-10 0V7a3 3 0 016 0v8a1 1 0 11-2 0V8"/></svg>
                  <span className="max-w-[180px] truncate" title={f.name}>{f.name}</span>
                  <button type="button" onClick={() => setAttachedFiles(attachedFiles.filter((_, i) => i !== idx))} className="text-gray-500 hover:text-gray-700">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <button type="button" aria-label="Attach files" onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79V17a5 5 0 01-10 0V7a3 3 0 016 0v8a1 1 0 11-2 0V8"/></svg>
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length) setAttachedFiles(prev => [...prev, ...files])
                if (fileInputRef.current) fileInputRef.current.value = ''
              }} />
            </div>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                  } else if (e.key === 'Tab' && e.shiftKey) {
                    e.preventDefault()
                    const textarea = e.target as HTMLTextAreaElement
                    const start = textarea.selectionStart
                    const end = textarea.selectionEnd
                    const newValue = inputValue.substring(0, start) + '\n' + inputValue.substring(end)
                    setInputValue(newValue)
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = start + 1
                    }, 0)
                  }
                }}
                placeholder="Silakan bertanya apa saja mengenai lighting ... atau lighting arsitektur ?"
              className="w-full border border-gray-300 rounded-2xl pl-10 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 shadow-sm transition-shadow resize-none min-h-[3rem] overflow-y-hidden"
                disabled={(isLoading && loadingSessions.has(currentSessionId || '')) || isSwitchingSession}
              rows={1}
              style={{ height: 'auto', minHeight: '3rem' }}
                onInput={(e) => {
                  const textarea = e.target as HTMLTextAreaElement
                const MAX_HEIGHT = 192 // px
                  textarea.style.height = 'auto'
                const next = Math.min(textarea.scrollHeight, MAX_HEIGHT)
                textarea.style.height = next + 'px'
                textarea.style.overflowY = textarea.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
                }}
            />
            <button
              type="submit"
              disabled={(!inputValue.trim() && attachedFiles.length === 0) || (isLoading && loadingSessions.has(currentSessionId || '')) || isSwitchingSession}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-yellow-500 hover:text-yellow-600 disabled:text-gray-400"
              >
              <svg className="w-6 h-6 transform -translate-y-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          </form>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {currentPage !== 'chat' && currentPage === 'upload' && (
                hasAdmin ? (
                  <div className="flex-1 overflow-y-auto p-4 w-full">
                    <UploadPage />
              </div>
                ) : (
                  <div className="flex-1 p-6 w-full flex items-center justify-center">
                    <div className="text-sm text-gray-600">Admin only. Please sign in with an admin account.</div>
            </div>
                )
              )}

              

              {currentPage !== 'chat' && currentPage === 'visibility' && (
                hasAdmin ? (
                  <div className="flex-1 overflow-y-auto w-full p-4">
                    <DocumentVisibility />
          </div>
                ) : (
                  <div className="flex-1 p-6 w-full flex items-center justify-center">
                    <div className="text-sm text-gray-600">Admin only. Please sign in with an admin account.</div>
                  </div>
                )
              )}
              {currentPage !== 'chat' && currentPage === 'invite' && (
                hasAdmin ? (
                  <div className="flex-1 overflow-y-auto w-full p-4">
                    <InviteAdmins />
                  </div>
                ) : (
                  <div className="flex-1 p-6 w-full flex items-center justify-center">
                    <div className="text-sm text-gray-600">Admin only. Please sign in with an admin account.</div>
                  </div>
                )
              )}
              {currentPage !== 'chat' && currentPage === 'rebuild' && (
                hasAdmin ? (
                  <div className="flex-1 overflow-y-auto w-full p-4">
                    <RebuildSearchIndex />
                  </div>
                ) : (
                  <div className="flex-1 p-6 w-full flex items-center justify-center">
                    <div className="text-sm text-gray-600">Admin only. Please sign in with an admin account.</div>
                  </div>
                )
              )}
              {currentPage !== 'chat' && currentPage === 'feedback' && (
                hasAdmin ? (
                  <div className="flex-1 overflow-y-auto w-full p-4">
                    <FeedbackList />
                  </div>
                ) : (
                  <div className="flex-1 p-6 w-full flex items-center justify-center">
                    <div className="text-sm text-gray-600">Admin only. Please sign in with an admin account.</div>
                  </div>
                )
              )}
              {/* set-password handled as a standalone route above */}
            </div>

            {/* Sidebar (slides from right on mobile) */}
             <div className={`${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} fixed inset-y-0 right-0 z-50 ${newsPanelCollapsed ? 'w-16' : 'w-80'} bg-white shadow-2xl transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
              <div className="flex flex-col h-full">
                 {/* News Panel Header */}
                 <div className="flex items-center justify-between mb-6 p-4">
                   {!newsPanelCollapsed && (
                     <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide bg-gray-50 p-2 rounded-md shadow-sm">BERITA HARI INI</h2>
                   )}
                   <button
                     onClick={() => setNewsPanelCollapsed(!newsPanelCollapsed)}
                     className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                     title={newsPanelCollapsed ? 'Expand news panel' : 'Collapse news panel'}
                   >
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={newsPanelCollapsed ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
                     </svg>
                   </button>
                 </div>

                 {/* News Section Content */}
                 {!newsPanelCollapsed && (
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="space-y-6">
                    {(newsItems.length ? newsItems : mockNews).map((news) => (
                      news.url ? (
                        <a key={news.id} href={news.url} target="_blank" rel="noopener noreferrer" className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300 block">
                          <img 
                            src={news.image} 
                            alt={news.title}
                            className="w-full h-32 object-cover"
                          />
                          <div className="p-4">
                            <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-3">{news.title}</h3>
                            <p className="text-xs text-blue-600 font-medium hover:text-blue-800 cursor-pointer">{news.readTime}</p>
                          </div>
                        </a>
                      ) : (
                        <div key={news.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                          <img 
                            src={news.image} 
                            alt={news.title}
                            className="w-full h-32 object-cover"
                          />
                          <div className="p-4">
                            <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-3">{news.title}</h3>
                            <p className="text-xs text-blue-600 font-medium">{news.readTime}</p>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                   </div>
                 )}

                  {/* Admin section removed per request */}
                 </div>
               </div>
             </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
        </>


      {/* Auth Modal */}
      {authOpen && (
        <AuthModal onClose={() => setAuthOpen(false)} />
      )}

      {/* Mobile News Bottom Sheet */}
      <div className="lg:hidden fixed inset-0 z-50 pointer-events-none">
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${newsSheetOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}
          onClick={() => setNewsSheetOpen(false)}
        />
        {/* Sheet */}
        <div
          className={`absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-in-out pointer-events-auto ${newsSheetOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ maxHeight: '75vh' }}
        >
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <div className="w-10 h-1.5 bg-gray-300 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
            <h3 className="text-sm font-semibold text-gray-800">BERITA HARI INI</h3>
            <button onClick={() => setNewsSheetOpen(false)} aria-label="Close" className="p-2 rounded-md text-gray-600 hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(75vh - 48px)' }}>
            <div className="space-y-6">
              {(newsItems.length ? newsItems : mockNews).map((news) => (
                news.url ? (
                  <a key={news.id} href={news.url} target="_blank" rel="noopener noreferrer" className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden block">
                    <img src={news.image} alt={news.title} className="w-full h-32 object-cover" />
                    <div className="p-4">
                      <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-2">{news.title}</h4>
                      <p className="text-xs text-blue-600 font-medium">{news.readTime}</p>
                    </div>
                  </a>
                ) : (
                  <div key={news.id} className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                    <img src={news.image} alt={news.title} className="w-full h-32 object-cover" />
                    <div className="p-4">
                      <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-2">{news.title}</h4>
                      <p className="text-xs text-blue-600 font-medium">{news.readTime}</p>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Memoized message container component
const MessageContainer = React.memo(({ message, preprocessMarkdown, ExcelDownload, userInitial }: { 
  message: Message; 
  preprocessMarkdown: (text: string) => { content: string; excelData?: any; filename?: string };
  ExcelDownload: React.ComponentType<{ data: any; filename: string }>,
  userInitial: string
}) => {
  if (message.role === 'assistant') {
    return (
      <div className="flex justify-start mb-4 w-full">
        <div className="flex max-w-[90%] lg:max-w-[85%] gap-3 min-w-0">
          {/* Assistant Avatar */}
          <div className="w-8 h-8 min-w-[2rem] min-h-[2rem] flex-shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium shadow-md">
            AI
          </div>
          
          {/* Message Content */}
          <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-100 flex-1 min-w-0 overflow-hidden message-container">
            <div className="markdown-content overflow-hidden break-words">
              <MarkdownRenderer content={message.content} preprocessMarkdown={preprocessMarkdown} ExcelDownload={ExcelDownload} />
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end mb-4 w-full">
      <div className="flex max-w-[90%] lg:max-w-[85%] gap-3 flex-row-reverse min-w-0">
        {/* User Avatar (match hamburger menu) */}
        <div className="w-8 h-8 min-w-[2rem] min-h-[2rem] flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-medium shadow-md">
          {userInitial}
        </div>
        
        {/* Message Content */}
        <div className="bg-blue-500 text-white rounded-lg px-4 py-3 shadow-lg min-w-0 overflow-hidden message-container">
          <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">{message.content}</div>
          {Array.isArray(message.attachments) && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.attachments.map((name, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-blue-200/40 bg-blue-400/20 text-xs text-blue-50">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79V17a5 5 0 01-10 0V7a3 3 0 016 0v8a1 1 0 11-2 0V8"/></svg>
                  <span className="max-w-[160px] truncate" title={name}>{name}</span>
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-blue-100 mt-2">
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  )
})

// Memoized loading indicator component
const LoadingIndicator = React.memo(() => (
  <div className="flex justify-start mb-4 w-full">
    <div className="flex max-w-[90%] lg:max-w-[85%] gap-3 min-w-0">
      {/* Assistant Avatar */}
      <div className="w-8 h-8 min-w-[2rem] min-h-[2rem] flex-shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium shadow-md">
        AI
      </div>
      
      {/* Loading Content */}
      <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-100 flex-1 min-w-0 max-w-full message-container">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    </div>
  </div>
))

export default App

// Email/password auth with Register + Sign In
const AuthModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
      } else {
        if (password !== confirm) throw new Error('Passwords do not match')
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: 'https://lumina-clickmark.netlify.app' }
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Registration successful. Check your email to confirm, then sign in.')
        } else {
          onClose()
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">{mode === 'signin' ? 'Sign in' : 'Register'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {info && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{info}</div>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white rounded-md px-3 py-2 text-sm disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {mode === 'signin' ? 'Signing in…' : 'Registering…'}
              </>
            ) : (
              mode === 'signin' ? 'Sign in' : 'Register'
            )}
          </button>
        </form>
        <div className="mt-3 text-xs text-gray-600">
          {mode === 'signin' ? (
            <button className="underline" onClick={() => setMode('register')}>Create an account</button>
          ) : (
            <button className="underline" onClick={() => setMode('signin')}>Have an account? Sign in</button>
          )}
        </div>
      </div>
    </div>
  )
}

