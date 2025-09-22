import React, { useState } from 'react'
import { supabase } from './lib/supabaseClient'

const BUCKET = 'documents'

const UploadPage: React.FC = () => {
  const [files, setFiles] = useState<FileList | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [objects, setObjects] = useState<Array<{ name: string; updated_at?: string; created_at?: string; metadata?: { size?: number } | null }>>([])
  const [isListing, setIsListing] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!files || files.length === 0 || isUploading) return
    setIsUploading(true)
    setMessage(null)

    try {
      const results: { file: string; path?: string; error?: string }[] = []
      for (const file of Array.from(files)) {
        const path = file.name
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
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
      setMessage(`Uploaded ${success} file(s). ${failed ? failed + ' failed.' : ''}`)
      await fetchObjects()
      setFiles(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      setMessage(err?.message || 'Upload failed')
    } finally {
      setIsUploading(false)
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

  const isAdmin = roles.includes('admin')

  async function fetchObjects() {
    if (!authed || !isAdmin) return
    setIsListing(true)
    setListError(null)
    try {
      const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
      if (error) throw error
      setObjects((data || []).map((d: any) => ({ name: d.name, updated_at: d.updated_at, created_at: d.created_at, metadata: d.metadata })))
    } catch (e: any) {
      setListError(e?.message || 'Failed to list files')
    } finally {
      setIsListing(false)
    }
  }

  React.useEffect(() => {
    fetchObjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, isAdmin])

  async function handleDelete(name: string) {
    if (!authed || !isAdmin) return
    const ok = confirm(`Delete "${name}"? This cannot be undone.`)
    if (!ok) return
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([name])
      if (error) throw error
      await fetchObjects()
    } catch (e: any) {
      alert(e?.message || 'Failed to delete')
    }
  }

  return (
    <div className="p-4 w-full">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Upload Documents</h1>
          <p className="text-sm text-gray-600">Upload files to the documents bucket.</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {!authed && (
            <div className="mb-4 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-3">
              Please sign in to upload files. Use the LOGIN button in the header.
            </div>
          )}
          {authed && !isAdmin && (
            <div className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">
              You don’t have permission to access this page. Ask an admin to grant the <span className="font-semibold">admin</span> role.
            </div>
          )}
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select files</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; setFiles(null) }}
                onChange={(e) => setFiles(e.target.files)}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={!authed || !isAdmin}
              />
              <p className="text-xs text-gray-500 mt-2">Uploads to bucket: <span className="font-mono">{BUCKET}</span></p>
            </div>

            <button
              type="submit"
              disabled={!authed || !isAdmin || !files || files.length === 0 || isUploading}
              className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-300"
            >
              {isUploading ? 'Uploading…' : 'Upload'}
            </button>

            {message && (
              <div className="text-sm text-gray-700">{message}</div>
            )}
          </form>

          {authed && isAdmin && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-900">Files in bucket</h2>
                <button onClick={fetchObjects} disabled={isListing} className="text-sm px-3 py-1 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50">{isListing ? 'Refreshing…' : 'Refresh'}</button>
              </div>
              {listError && (
                <div className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">{listError}</div>
              )}
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
                    {objects.length === 0 && !isListing ? (
                      <tr><td colSpan={4} className="py-4 text-gray-500">No files found.</td></tr>
                    ) : (
                      objects.map((obj) => (
                        <tr key={obj.name} className="border-b last:border-b-0">
                          <td className="py-2 pr-4 font-mono truncate max-w-[28ch]" title={obj.name}>{obj.name}</td>
                          <td className="py-2 pr-4">{obj.updated_at ? new Date(obj.updated_at).toLocaleString() : ''}</td>
                          <td className="py-2 pr-4">{(obj.metadata as any)?.size ? `${((obj.metadata as any).size / 1024).toFixed(1)} KB` : ''}</td>
                          <td className="py-2">
                            <button onClick={() => handleDelete(obj.name)} className="px-2 py-1 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50">Delete</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UploadPage


