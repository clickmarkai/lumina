import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import * as ExcelJS from 'exceljs'
import './App.css'
// AdminConsole removed
import DocumentVisibility from './DocumentVisibility'
import UploadPage from './UploadPage'
import { supabase } from './lib/supabaseClient'
import pkg from '../package.json'
import type { User } from '@supabase/supabase-js'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

interface NewsItem {
  id: string
  title: string
  image: string
  readTime: string
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
        <>

          <ReactMarkdown components={markdownComponents}>
            {markdownContent}
          </ReactMarkdown>
        </>
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
  // Generate and store user_id in localStorage on each app load
  const [userId] = useState(() => {
    const newUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('lumina_user_id', newUserId)
    console.log('🆔 New user session started:', newUserId)
    console.log('💡 Tip: Use getUserId() in console to view current user ID')
    return newUserId
  })

  // Make getUserId available globally for debugging
  useEffect(() => {
    (window as any).getUserId = () => {
      const currentUserId = localStorage.getItem('lumina_user_id')
      console.log('Current user ID:', currentUserId)
      return currentUserId || undefined
    }
    
    return () => {
      delete (window as any).getUserId
    }
  }, [])

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'HAI ... apa yang bisa saya bantu untuk membuat harimu lebih cerah ?',
      role: 'assistant',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<'chat' | 'admin' | 'upload' | 'visibility'>('chat')
  const [navCollapsed, setNavCollapsed] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [newsSheetOpen, setNewsSheetOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Roles / RBAC
  const roles = Array.isArray((currentUser as any)?.app_metadata?.roles)
    ? ((currentUser as any).app_metadata.roles as string[])
    : []
  const hasAdmin = roles.includes('admin')

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Left navigation replaces top-right hamburger dropdown

  // Supabase Auth: initialize user and listen for auth state changes
  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCurrentUser(data.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setAuthOpen(false)
  }

    // Excel Download Component with Real Image Embedding
  const ExcelDownload = React.memo<{ data: any; filename: string }>(({ data, filename }) => {
    const downloadExcel = useCallback(async () => {
      try {
        console.log('🔄 Starting Excel generation...')
        
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
            const fallbackWorkbook = new ExcelJS.Workbook()
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
    let processed = text
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
        
        // Use eval to parse JavaScript object literal (safer than regex fixing)
        let jsonData
        try {
          // Wrap in parentheses and use eval (controlled environment)
          const objectLiteral = `(${jsonString})`
          jsonData = eval(objectLiteral)
          console.log('✅ Successfully parsed with eval')
        } catch (evalError) {
          console.log('❌ Eval failed, trying regex fixes...', evalError)
          
          // Fallback: Try regex fixes
          let fixedJsonString = jsonString
            .replace(/(\w+):/g, '"$1":')  // Add quotes around property names
            .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
            .replace(/\n\s*/g, ' ')  // Replace newlines with spaces
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .trim()
          
          console.log('🔧 Fixed JSON string:', fixedJsonString.substring(0, 200) + '...')
          jsonData = JSON.parse(fixedJsonString)
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
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Send message to webhook endpoint
      const response = await fetch('https://primary-production-b68a.up.railway.app/webhook/lumina_chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          timestamp: userMessage.timestamp.toISOString(),
          user_id: userId // Use the stored user ID
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Create assistant response from API using "output" field
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.output || data.response || data.message || 'I received your message but couldn\'t generate a proper response.',
        role: 'assistant',
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Show error message to user
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I\'m having trouble connecting to the server right now. Please try again later.',
        role: 'assistant',
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
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
                  className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium shadow-md hover:shadow-lg transition-shadow"
                >
                  Sign out
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
                      <span>Upload Files</span>
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
                            className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                          >
                            Sign out
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
                  className={`flex items-center w-full px-2 py-2 rounded-md ${navCollapsed ? 'justify-center gap-0' : 'gap-3'} ${currentPage === 'chat' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                  title="Chat"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8-1.264 0-2.468-.23-3.562-.648L3 20l.944-3.305C3.338 15.419 3 13.749 3 12 3 7.582 7.03 4 12 4s9 3.582 9 8z"/></svg>
                  <span className={navCollapsed ? 'hidden' : ''}>Chat</span>
                </button>
                {hasAdmin && (
                  <button
                    onClick={() => setCurrentPage('upload')}
                    aria-current={currentPage === 'upload' ? 'page' : undefined}
                    className={`flex items-center w-full px-2 py-2 rounded-md ${navCollapsed ? 'justify-center gap-0' : 'gap-3'} ${currentPage === 'upload' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                    title="Upload Files"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12v-8m0 0l-4 4m4-4l4 4"/></svg>
                    <span className={navCollapsed ? 'hidden' : ''}>Upload Files</span>
                  </button>
                )}
                
                {hasAdmin && (
                  <button
                    onClick={() => setCurrentPage('visibility')}
                    aria-current={currentPage === 'visibility' ? 'page' : undefined}
                    className={`flex items-center w-full px-2 py-2 rounded-md ${navCollapsed ? 'justify-center gap-0' : 'gap-3'} ${currentPage === 'visibility' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
                    title="Document Visibility"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    <span className={navCollapsed ? 'hidden' : ''}>Document Visibility</span>
                  </button>
                )}
                {/* Removed non-functional links on desktop */}
              </nav>
              <div className={`border-t border-gray-200 pt-2 mt-2 pb-2 ${navCollapsed ? 'px-2' : 'px-2'}`}>
                {currentUser ? (
                  <div className={`flex items-start w-full ${navCollapsed ? 'justify-center gap-0' : 'gap-2'}`}>
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
                            className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                          >
                            Sign out
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`${navCollapsed ? 'flex items-center justify-center' : 'flex items-center justify-between'}`}>
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
            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 lg:ml-0">
              {currentPage === 'chat' && (
                <>
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 w-full">
                    <div className="max-w-4xl mx-auto w-full">
                      {messages.map((message) => (
                        <MessageContainer key={message.id} message={message} preprocessMarkdown={preprocessMarkdown} ExcelDownload={ExcelDownload} userInitial={currentUser?.email?.slice(0,1)?.toUpperCase() || 'U'} />
                      ))}
                      {isLoading && <LoadingIndicator />}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Chat Input */}
                  <div className={`fixed bottom-0 p-4 z-20 lg:z-40 left-0 right-0 ${navCollapsed ? 'lg:left-16' : 'lg:left-60'} lg:right-80`}>
                    <div className="max-w-4xl mx-auto">
                      <div className="border border-gray-200 bg-white/90 backdrop-blur rounded-2xl shadow-xl p-2">
                        <form onSubmit={handleSubmit} className="relative">
                          <textarea
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
                            className="w-full border border-gray-300 rounded-2xl px-6 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 shadow-sm transition-shadow resize-none min-h-[3rem] max-h-32 overflow-y-auto"
                            disabled={isLoading}
                            rows={1}
                            style={{ height: 'auto', minHeight: '3rem' }}
                            onInput={(e) => {
                              const textarea = e.target as HTMLTextAreaElement
                              textarea.style.height = 'auto'
                              textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px'
                            }}
                          />
                          <button
                            type="submit"
                            disabled={!inputValue.trim() || isLoading}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-yellow-500 hover:text-yellow-600 disabled:text-gray-400"
                          >
                            <svg className="w-6 h-6 transform -translate-y-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {currentPage !== 'chat' && currentPage === 'upload' && (
                hasAdmin ? (
                  <div className="flex-1 overflow-y-auto p-4 w-full">
                    <UploadPage onBack={() => setCurrentPage('chat')} />
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
            </div>

            {/* Sidebar (slides from right on mobile) */}
            <div className={`${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
              <div className="flex flex-col h-full">
                {/* News Section */}
                <div className="flex-1 overflow-y-auto p-4">
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-6 bg-gray-50 p-2 rounded-md shadow-sm">BERITA HARI INI</h2>
                  <div className="space-y-6">
                    {mockNews.map((news) => (
                      <div key={news.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                        <img 
                          src={news.image} 
                          alt={news.title}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-4">
                          <h3 className="text-sm font-semibold text-gray-900 leading-tight mb-3">{news.title}</h3>
                          <p className="text-xs text-blue-600 font-medium hover:text-blue-800 cursor-pointer">{news.readTime}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Admin section removed per request */}
            </div>
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
              {mockNews.map((news) => (
                <div key={news.id} className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                  <img src={news.image} alt={news.title} className="w-full h-32 object-cover" />
                  <div className="p-4">
                    <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-2">{news.title}</h4>
                    <p className="text-xs text-blue-600 font-medium">{news.readTime}</p>
                  </div>
                </div>
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
          <p className="text-sm leading-relaxed break-words">{message.content}</p>
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
        const { data, error } = await supabase.auth.signUp({ email, password })
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
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white rounded-md px-3 py-2 text-sm disabled:bg-gray-300">
            {loading ? (mode === 'signin' ? 'Signing in…' : 'Registering…') : (mode === 'signin' ? 'Sign in' : 'Register')}
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
