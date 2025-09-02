import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'

type Visibility = 'public_theory' | 'user' | 'admin'

type DocumentRow = {
  id: string | number
  visibility?: Visibility | null
  title?: string | null
  filename?: string | null
  created_at?: string | null
}

const VISIBILITY_OPTIONS: Visibility[] = ['public_theory', 'user', 'admin']

const DocumentVisibility: React.FC = () => {
  const [docs, setDocs] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | number | null>(null)

  useEffect(() => {
    const fetchDocs = async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, visibility, lang, source, checksum, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setDocs(data || [])
      }
      setLoading(false)
    }
    fetchDocs()
  }, [])

  const nameForDoc = useMemo(() => {
    return (doc: DocumentRow) => {
      return (
        doc.title || doc.filename || `Document ${String(doc.id)}`
      )
    }
  }, [])

  const handleChange = async (doc: DocumentRow, next: Visibility) => {
    setError(null)
    setUpdatingId(doc.id)
    const previous = docs
    // optimistic update
    setDocs(docs.map(d => (d.id === doc.id ? { ...d, visibility: next } : d)))
    const { error } = await supabase
      .from('documents')
      .update({ visibility: next })
      .eq('id', doc.id)
    if (error) {
      setError(error.message)
      setDocs(previous)
    }
    setUpdatingId(null)
  }

  return (
    <div className="p-4 w-full">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Document Visibility</h1>
          <p className="text-sm text-gray-600">Manage who can see each document.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-600">Loading documents…</div>
        ) : docs.length === 0 ? (
          <div className="text-sm text-gray-600">No documents found.</div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="min-w-0 pr-3">
                  <div className="truncate text-sm font-medium text-gray-900">{nameForDoc(doc)}</div>
                  <div className="text-xs text-gray-500">ID: {String(doc.id)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Visibility</label>
                  <select
                    value={(doc.visibility as Visibility) || 'public_theory'}
                    onChange={(e) => handleChange(doc, e.target.value as Visibility)}
                    disabled={updatingId === doc.id}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {VISIBILITY_OPTIONS.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DocumentVisibility


