import React, { useState } from 'react'
import { supabase } from './lib/supabaseClient'

const BUCKET = 'documents'

const UploadPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [files, setFiles] = useState<FileList | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!files || files.length === 0 || isUploading) return
    setIsUploading(true)
    setMessage(null)

    try {
      const results: { file: string; path?: string; error?: string }[] = []
      for (const file of Array.from(files)) {
        const path = `${Date.now()}_${file.name}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
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

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow">
        <button onClick={onBack} className="px-3 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 text-sm">← Back</button>
        <h1 className="text-base font-semibold text-gray-900">Upload Documents</h1>
        <div />
      </header>

      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-xl mx-auto bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {!authed && (
            <div className="mb-4 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-3">
              Please sign in to upload files. Use the LOGIN button in the header.
            </div>
          )}
          {authed && !isAdmin && (
            <div className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded p-3">
              You dont have permission to access this page. Ask an admin to grant the <span className="font-semibold">admin</span> role.
            </div>
          )}
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select files</label>
              <input
                type="file"
                multiple
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
        </div>
      </main>
    </div>
  )
}

export default UploadPage


