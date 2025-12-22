import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './lib/supabaseClient'

type Visibility = 'public' | 'user' | 'admin' | 'superadmin'

type FeedbackItem = {
  id: number
  content: string
  correction: string
  created_by: string
  created_at: string
  visibility?: Visibility | null
  updated_at?: string | null
  updated_by?: string | null
}

const VISIBILITY_OPTIONS: Visibility[] = ['public', 'user', 'admin', 'superadmin']

type PageInfo = {
  limit: number
  offset: number
  total: number
  has_more: boolean
}

const FeedbackList: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null)
  const limit = 20 // Fixed limit of 20 items per page
  const [offset, setOffset] = useState<number>(0)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<FeedbackItem | null>(null)
  const [expandedContent, setExpandedContent] = useState<Set<number>>(new Set())
  const [expandedCorrection, setExpandedCorrection] = useState<Set<number>>(new Set())
  const isFetchingRef = useRef(false)
  const lastFetchParamsRef = useRef<{ limit: number; offset: number } | null>(null)

  const toggleContent = (id: number) => {
    setExpandedContent(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleCorrection = (id: number) => {
    setExpandedCorrection(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const truncateText = (text: string, maxLength: number = 200) => {
    if (!text || text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const fetchFeedbacks = async (currentLimit: number, currentOffset: number) => {
    // Prevent duplicate fetches with same parameters
    if (isFetchingRef.current) return
    if (lastFetchParamsRef.current?.limit === currentLimit && lastFetchParamsRef.current?.offset === currentOffset) {
      return
    }
    
    isFetchingRef.current = true
    lastFetchParamsRef.current = { limit: currentLimit, offset: currentOffset }
    setLoading(true)
    setError(null)
    
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error('You must be signed in to view feedbacks.')
      }

      const requestBody: { action: string; limit?: number; offset?: number } = { 
        action: 'load',
        limit: currentLimit,
        offset: currentOffset
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_FEEDBACK_ACTION || 'feedback-action'
      if (!supabaseUrl) {
        setError('Configuration error: Supabase URL is not set')
        setLoading(false)
        isFetchingRef.current = false
        return
      }
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Failed to load feedbacks: ${response.status} ${errorData}`)
      }

      const data = await response.json()
      
      // Parse the new response structure
      if (data.items && Array.isArray(data.items) && data.page) {
        setFeedbacks(data.items)
        setPageInfo(data.page)
      } else {
        throw new Error('Invalid response format from server')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load feedbacks')
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }

  useEffect(() => {
    fetchFeedbacks(limit, offset)
  }, [offset]) // limit is a constant, no need to include in dependencies

  const handlePrevious = () => {
    if (offset > 0) {
      const newOffset = Math.max(0, offset - limit)
      setOffset(newOffset)
    }
  }

  const handleNext = () => {
    if (pageInfo?.has_more) {
      setOffset(offset + limit)
    }
  }

  const handleDelete = async (feedback: FeedbackItem) => {
    setError(null)
    setDeletingId(feedback.id)
    
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error('You must be signed in to delete feedbacks.')
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_FEEDBACK_ACTION || 'feedback-action'
      if (!supabaseUrl) {
        setError('Configuration error: Supabase URL is not set')
        setDeletingId(null)
        return
      }
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'delete', feedback_id: feedback.id })
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Failed to delete feedback: ${response.status} ${errorData}`)
      }

      // Refetch the current page after successful deletion
      // Reset the last fetch params to allow refetch even with same parameters
      lastFetchParamsRef.current = null
      await fetchFeedbacks(limit, offset)
      setShowDeleteConfirm(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to delete feedback')
    } finally {
      setDeletingId(null)
    }
  }

  const formatTimestamp = (timestamp: string | null | undefined): string => {
    if (!timestamp) return 'N/A'
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Invalid date'
    }
  }

  const handleChange = async (feedback: FeedbackItem, next: Visibility) => {
    setError(null)
    setUpdatingId(feedback.id)
    const previous = feedbacks
    
    // Get current user's email for updated_by
    const { data: { user } } = await supabase.auth.getUser()
    const adminEmail = user?.email || null
    
    const now = new Date().toISOString()
    
    // Optimistic update
    setFeedbacks(feedbacks.map(f => (f.id === feedback.id ? { ...f, visibility: next, updated_at: now, updated_by: adminEmail } : f)))
    
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error('You must be signed in to update feedback visibility.')
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_FEEDBACK_ACTION || 'feedback-action'
      if (!supabaseUrl) {
        setError('Configuration error: Supabase URL is not set')
        setFeedbacks(previous)
        setUpdatingId(null)
        return
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ 
          action: 'update', 
          feedback_id: feedback.id,
          visibility: next,
          updated_at: now,
          updated_by: adminEmail
        })
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(`Failed to update feedback: ${response.status} ${errorData}`)
      }

      // Refetch the current page after successful update to get the latest data
      lastFetchParamsRef.current = null
      await fetchFeedbacks(limit, offset)
    } catch (err: any) {
      setError(err?.message || 'Failed to update feedback visibility')
      setFeedbacks(previous)
    } finally {
      setUpdatingId(null)
    }
  }

  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = pageInfo ? Math.ceil(pageInfo.total / limit) : 0
  const startItem = offset + 1
  const endItem = pageInfo ? Math.min(offset + feedbacks.length, pageInfo.total) : offset + feedbacks.length

  return (
    <div className="p-4 w-full">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Feedback List</h1>
          <p className="text-sm text-gray-600">View all feedback entries submitted by admins.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-600">Loading feedbacks…</div>
        ) : feedbacks.length === 0 ? (
          <div className="text-sm text-gray-600">No feedbacks found.</div>
        ) : (
          <>
            {/* Pagination Info */}
            {pageInfo && (
              <div className="mb-4 flex items-center justify-between text-sm text-gray-600">
                <div>
                  Showing {startItem} to {endItem} of {pageInfo.total} feedbacks
                </div>
                <div>
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {feedbacks.map((feedback) => {
                const isContentExpanded = expandedContent.has(feedback.id)
                const isCorrectionExpanded = expandedCorrection.has(feedback.id)
                const contentText = feedback.content || 'N/A'
                const correctionText = feedback.correction || 'N/A'
                const shouldTruncateContent = contentText.length > 200
                const shouldTruncateCorrection = correctionText.length > 200

                return (
                  <div key={feedback.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    {/* Header with metadata, visibility dropdown, and delete */}
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
                      <div className="flex-1 flex flex-col gap-1 text-xs text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-500">By:</span>
                          <span className="truncate max-w-[200px] lg:max-w-none" title={feedback.created_by || 'N/A'}>
                            {feedback.created_by || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-500">At:</span>
                          <span>{formatTimestamp(feedback.created_at)}</span>
                        </div>
                        {feedback.updated_by && feedback.updated_at && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-500">Updated by:</span>
                              <span>{feedback.updated_by}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-500">Updated at:</span>
                              <span>{formatTimestamp(feedback.updated_at)}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Visibility</label>
                        <select
                          value={(feedback.visibility as Visibility) || 'public'}
                          onChange={(e) => handleChange(feedback, e.target.value as Visibility)}
                          disabled={updatingId === feedback.id}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {VISIBILITY_OPTIONS.map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowDeleteConfirm(feedback)}
                          disabled={deletingId === feedback.id}
                          className="flex-shrink-0 p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete"
                          aria-label="Delete feedback"
                        >
                          {deletingId === feedback.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Content</div>
                          <div className="text-sm text-gray-900">
                            {isContentExpanded || !shouldTruncateContent ? (
                              <div className="whitespace-pre-wrap break-words">{contentText}</div>
                            ) : (
                              <>
                                <div className="break-words">{truncateText(contentText, 200)}</div>
                                <button
                                  onClick={() => toggleContent(feedback.id)}
                                  className="text-xs text-blue-600 hover:text-blue-700 mt-1 focus:outline-none"
                                >
                                  Show more
                                </button>
                              </>
                            )}
                            {isContentExpanded && shouldTruncateContent && (
                              <button
                                onClick={() => toggleContent(feedback.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 mt-1 block focus:outline-none"
                              >
                                Show less
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Correction Section */}
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Correction</div>
                          <div className="text-sm text-gray-900">
                            {isCorrectionExpanded || !shouldTruncateCorrection ? (
                              <div className="whitespace-pre-wrap break-words">{correctionText}</div>
                            ) : (
                              <>
                                <div className="break-words">{truncateText(correctionText, 200)}</div>
                                <button
                                  onClick={() => toggleCorrection(feedback.id)}
                                  className="text-xs text-blue-600 hover:text-blue-700 mt-1 focus:outline-none"
                                >
                                  Show more
                                </button>
                              </>
                            )}
                            {isCorrectionExpanded && shouldTruncateCorrection && (
                              <button
                                onClick={() => toggleCorrection(feedback.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 mt-1 block focus:outline-none"
                              >
                                Show less
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination Controls */}
            {pageInfo && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <button
                  onClick={handlePrevious}
                  disabled={offset === 0 || loading}
                  className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={!pageInfo.has_more || loading}
                  className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-80 rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete this feedback entry? 
              This action cannot be undone.
            </p>
            <div className="mb-4 p-3 bg-gray-50 rounded-md text-xs text-gray-600">
              <div className="font-semibold mb-1">Content:</div>
              <div className="truncate">{showDeleteConfirm.content || 'N/A'}</div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deletingId === showDeleteConfirm.id}
                className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-red-400"
              >
                {deletingId === showDeleteConfirm.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FeedbackList

