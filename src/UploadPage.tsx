import React, { useState } from 'react'
import { supabase } from './lib/supabaseClient'

const BUCKET_DOCUMENTS = 'documents'
const BUCKET_PRODUCTS = 'products'

const UploadPage: React.FC = () => {
  // Documents bucket state
  const [docFiles, setDocFiles] = useState<FileList | null>(null)
  const [isUploadingDocs, setIsUploadingDocs] = useState(false)
  const [docMessage, setDocMessage] = useState<string | null>(null)
  const [docObjects, setDocObjects] = useState<Array<{ name: string; updated_at?: string; created_at?: string; metadata?: { size?: number } | null }>>([])
  const [isListingDocs, setIsListingDocs] = useState(false)
  const [docListError, setDocListError] = useState<string | null>(null)
  const docFileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Products bucket state
  const [prodFiles, setProdFiles] = useState<FileList | null>(null)
  const [isUploadingProds, setIsUploadingProds] = useState(false)
  const [prodMessage, setProdMessage] = useState<string | null>(null)
  const [prodObjects, setProdObjects] = useState<Array<{ name: string; updated_at?: string; created_at?: string; metadata?: { size?: number } | null }>>([])
  const [isListingProds, setIsListingProds] = useState(false)
  const [prodListError, setProdListError] = useState<string | null>(null)
  const prodFileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Collapse/expand state
  const [docListExpanded, setDocListExpanded] = useState(false)
  const [prodListExpanded, setProdListExpanded] = useState(false)

  const handleUpload = async (e: React.FormEvent, bucket: string) => {
    e.preventDefault()
    const files = bucket === BUCKET_DOCUMENTS ? docFiles : prodFiles
    const isUploading = bucket === BUCKET_DOCUMENTS ? isUploadingDocs : isUploadingProds
    
    if (!files || files.length === 0 || isUploading) return
    
    if (bucket === BUCKET_DOCUMENTS) {
      setIsUploadingDocs(true)
      setDocMessage(null)
    } else {
      setIsUploadingProds(true)
      setProdMessage(null)
    }

    try {
      const results: { file: string; path?: string; error?: string }[] = []
      for (const file of Array.from(files)) {
        const path = file.name
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        })
        if (error) {
          results.push({ file: file.name, error: error.message })
        } else {
          results.push({ file: file.name, path })
        }
      }

      const success = results.filter(r => r.path).length
      const failed = results.filter(r => r.error).length
      const message = `Uploaded ${success} file(s). ${failed ? failed + ' failed.' : ''}`
      
      if (bucket === BUCKET_DOCUMENTS) {
        setDocMessage(message)
        await fetchObjects(BUCKET_DOCUMENTS)
        setDocFiles(null)
        if (docFileInputRef.current) docFileInputRef.current.value = ''
      } else {
        setProdMessage(message)
        await fetchObjects(BUCKET_PRODUCTS)
        setProdFiles(null)
        if (prodFileInputRef.current) prodFileInputRef.current.value = ''
      }
    } catch (err: any) {
      if (bucket === BUCKET_DOCUMENTS) {
        setDocMessage(err?.message || 'Upload failed')
      } else {
        setProdMessage(err?.message || 'Upload failed')
      }
    } finally {
      if (bucket === BUCKET_DOCUMENTS) {
        setIsUploadingDocs(false)
      } else {
        setIsUploadingProds(false)
      }
    }
  }

  const [authed, setAuthed] = useState(false)
  const [roles, setRoles] = useState<string[]>([])
  React.useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setAuthed(!!data.user)
      const r = ((data.user as any)?.app_metadata?.roles as string[]) || []
      setRoles(Array.isArray(r) ? r : [])
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthed(!!session?.user)
      const r = ((session?.user as any)?.app_metadata?.roles as string[]) || []
      setRoles(Array.isArray(r) ? r : [])
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  const isAdmin = roles.includes('superadmin')

  async function fetchObjects(bucket: string) {
    if (!authed || !isAdmin) return
    
    if (bucket === BUCKET_DOCUMENTS) {
      setIsListingDocs(true)
      setDocListError(null)
    } else {
      setIsListingProds(true)
      setProdListError(null)
    }
    
    try {
      const { data, error } = await supabase.storage.from(bucket).list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw error
      const mapped = (data || []).map((d: any) => ({ name: d.name, updated_at: d.updated_at, created_at: d.created_at, metadata: d.metadata }))
      
      if (bucket === BUCKET_DOCUMENTS) {
        setDocObjects(mapped)
      } else {
        setProdObjects(mapped)
      }
    } catch (e: any) {
      if (bucket === BUCKET_DOCUMENTS) {
        setDocListError(e?.message || 'Failed to list files')
      } else {
        setProdListError(e?.message || 'Failed to list files')
      }
    } finally {
      if (bucket === BUCKET_DOCUMENTS) {
        setIsListingDocs(false)
      } else {
        setIsListingProds(false)
      }
    }
  }

  React.useEffect(() => {
    if (authed && isAdmin) {
      fetchObjects(BUCKET_DOCUMENTS)
      fetchObjects(BUCKET_PRODUCTS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, isAdmin])

  async function handleDelete(name: string, bucket: string) {
    if (!authed || !isAdmin) return
    const ok = confirm(`Delete "${name}" from ${bucket}? This cannot be undone.`)
    if (!ok) return
    try {
      const { error } = await supabase.storage.from(bucket).remove([name])
      if (error) throw error
      await fetchObjects(bucket)
    } catch (e: any) {
      alert(e?.message || 'Failed to delete')
    }
  }

  return (
    <div className="p-4 w-full">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Upload Files</h1>
          <p className="text-sm text-gray-600">Upload files to storage buckets.</p>
        </div>

        {!authed && (
          <div className="mb-4 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-3">
            Please sign in to upload files. Use the LOGIN button in the header.
          </div>
        )}
        {authed && !isAdmin && (
          <div className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">
            You don't have permission to access this page. Ask a superadmin to grant the <span className="font-semibold">superadmin</span> role.
          </div>
        )}

        {/* Documents Bucket Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Documents Bucket</h2>
          <form onSubmit={(e) => handleUpload(e, BUCKET_DOCUMENTS)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select files</label>
              <input
                ref={docFileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; setDocFiles(null) }}
                onChange={(e) => setDocFiles(e.target.files)}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={!authed || !isAdmin}
              />
              <p className="text-xs text-gray-500 mt-2">Uploads to bucket: <span className="font-mono">{BUCKET_DOCUMENTS}</span> (PDF files only)</p>
            </div>

            <button
              type="submit"
              disabled={!authed || !isAdmin || !docFiles || docFiles.length === 0 || isUploadingDocs}
              className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-300"
            >
              {isUploadingDocs ? 'Uploading…' : 'Upload'}
            </button>

            {docMessage && (
              <div className="text-sm text-gray-700">{docMessage}</div>
            )}
          </form>

          {authed && isAdmin && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Files in {BUCKET_DOCUMENTS} bucket
                  <span className="ml-2 text-gray-500 font-normal">({docObjects.length})</span>
                </h3>
                <button
                  onClick={() => setDocListExpanded(!docListExpanded)}
                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label={docListExpanded ? 'Collapse' : 'Expand'}
                >
                  <svg
                    className={`w-5 h-5 transition-transform ${docListExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {docListError && (
                <div className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">{docListError}</div>
              )}
              {docListExpanded && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Updated</th>
                        <th className="py-2 pr-4">Size</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docObjects.length === 0 && !isListingDocs ? (
                        <tr><td colSpan={4} className="py-4 text-gray-500">No files found.</td></tr>
                      ) : (
                        docObjects.map((obj) => (
                          <tr key={obj.name} className="border-b last:border-b-0">
                            <td className="py-2 pr-4 font-mono truncate max-w-[28ch]" title={obj.name}>{obj.name}</td>
                            <td className="py-2 pr-4">{obj.updated_at ? new Date(obj.updated_at).toLocaleString() : ''}</td>
                            <td className="py-2 pr-4">{(obj.metadata as any)?.size ? `${((obj.metadata as any).size / 1024).toFixed(1)} KB` : ''}</td>
                            <td className="py-2">
                              <button onClick={() => handleDelete(obj.name, BUCKET_DOCUMENTS)} className="px-2 py-1 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50">Delete</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Products Bucket Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Products Bucket</h2>
          <form onSubmit={(e) => handleUpload(e, BUCKET_PRODUCTS)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select files</label>
              <input
                ref={prodFileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; setProdFiles(null) }}
                onChange={(e) => setProdFiles(e.target.files)}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                disabled={!authed || !isAdmin}
              />
              <p className="text-xs text-gray-500 mt-2">Uploads to bucket: <span className="font-mono">{BUCKET_PRODUCTS}</span> (PDF files only)</p>
            </div>

            <button
              type="submit"
              disabled={!authed || !isAdmin || !prodFiles || prodFiles.length === 0 || isUploadingProds}
              className="px-4 py-2 rounded-md bg-green-600 text-white disabled:bg-gray-300"
            >
              {isUploadingProds ? 'Uploading…' : 'Upload'}
            </button>

            {prodMessage && (
              <div className="text-sm text-gray-700">{prodMessage}</div>
            )}
          </form>

          {authed && isAdmin && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Files in {BUCKET_PRODUCTS} bucket
                  <span className="ml-2 text-gray-500 font-normal">({prodObjects.length})</span>
                </h3>
                <button
                  onClick={() => setProdListExpanded(!prodListExpanded)}
                  className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  aria-label={prodListExpanded ? 'Collapse' : 'Expand'}
                >
                  <svg
                    className={`w-5 h-5 transition-transform ${prodListExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {prodListError && (
                <div className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">{prodListError}</div>
              )}
              {prodListExpanded && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="py-2 pr-4">Name</th>
                        <th className="py-2 pr-4">Updated</th>
                        <th className="py-2 pr-4">Size</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prodObjects.length === 0 && !isListingProds ? (
                        <tr><td colSpan={4} className="py-4 text-gray-500">No files found.</td></tr>
                      ) : (
                        prodObjects.map((obj) => (
                          <tr key={obj.name} className="border-b last:border-b-0">
                            <td className="py-2 pr-4 font-mono truncate max-w-[28ch]" title={obj.name}>{obj.name}</td>
                            <td className="py-2 pr-4">{obj.updated_at ? new Date(obj.updated_at).toLocaleString() : ''}</td>
                            <td className="py-2 pr-4">{(obj.metadata as any)?.size ? `${((obj.metadata as any).size / 1024).toFixed(1)} KB` : ''}</td>
                            <td className="py-2">
                              <button onClick={() => handleDelete(obj.name, BUCKET_PRODUCTS)} className="px-2 py-1 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50">Delete</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UploadPage


