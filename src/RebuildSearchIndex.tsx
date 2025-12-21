import React, { useState } from 'react'

const WEBHOOK_DOCS_URL = import.meta.env.VITE_N8N_WEBHOOK_REBUILD_SEARCH_INDEX
const WEBHOOK_PRODUCTS_URL = import.meta.env.VITE_N8N_WEBHOOK_REBUILD_PRODUCT_INDEX

const RebuildSearchIndex: React.FC = () => {
  const [runningDocs, setRunningDocs] = useState(false)
  const [resultDocs, setResultDocs] = useState<string | null>(null)
  const [errorDocs, setErrorDocs] = useState<string | null>(null)

  const [runningProducts, setRunningProducts] = useState(false)
  const [resultProducts, setResultProducts] = useState<string | null>(null)
  const [errorProducts, setErrorProducts] = useState<string | null>(null)

  const trigger = async (
    url: string | undefined, 
    envVarName: string, 
    setRunning: (v: boolean) => void, 
    setResult: (v: string | null) => void, 
    setError: (v: string | null) => void
  ) => {
    if (!url) {
      setError(`Configuration error: ${envVarName} is not set`)
      return
    }
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json().catch(() => ({}))
      
      console.log('🔍 Full n8n response:', json)
      
      let resultMessage = json.message || 'Embedding job started. You can continue using the app while we rebuild the index.'
      
      if (json.status) resultMessage += `\nStatus: ${json.status}`
      if (json.jobId) resultMessage += `\nJob ID: ${json.jobId}`
      if (json.documentsProcessed) resultMessage += `\nItems to process: ${json.documentsProcessed}`
      if (json.estimatedTime) resultMessage += `\nEstimated time: ${json.estimatedTime}`
      
      setResult(resultMessage)
    } catch (e: any) {
      setError(e?.message || 'Failed to start the job. Please try again.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-4 w-full">
      <div className="max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Rebuild Search Indexes</h1>
          <p className="text-sm text-gray-600">
            This tool refreshes the app’s “brain” by scanning stored files and generating new
            embeddings. It helps the system understand and find your content more accurately. Safe to re-run
            anytime; your files are not changed.
          </p>
        </div>

        <div className="space-y-6">
          {/* Documents Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Documents Index</h2>
            <p className="text-sm text-gray-500 mb-4">
              Rebuilds the search index for general documents (PDFs, text files) in the 'documents' bucket.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => trigger(WEBHOOK_DOCS_URL, 'VITE_N8N_WEBHOOK_REBUILD_SEARCH_INDEX', setRunningDocs, setResultDocs, setErrorDocs)}
                disabled={runningDocs}
                className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-300 inline-flex items-center gap-2 hover:bg-blue-700 transition-colors"
              >
                {runningDocs && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeOpacity="0.25" strokeWidth="4"/><path d="M12 3a9 9 0 0 1 9 9" strokeWidth="4"/></svg>
                )}
                {runningDocs ? 'Starting…' : 'Rebuild Documents'}
              </button>

              {resultDocs && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3 whitespace-pre-line">{resultDocs}</div>
              )}
              {errorDocs && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{errorDocs}</div>
              )}
            </div>
          </div>

          {/* Products Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Products Index</h2>
            <p className="text-sm text-gray-500 mb-4">
              Rebuilds the search index for product catalogs and specifications in the 'products' bucket.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => trigger(WEBHOOK_PRODUCTS_URL, 'VITE_N8N_WEBHOOK_REBUILD_PRODUCT_INDEX', setRunningProducts, setResultProducts, setErrorProducts)}
                disabled={runningProducts}
                className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:bg-gray-300 inline-flex items-center gap-2 hover:bg-indigo-700 transition-colors"
              >
                {runningProducts && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeOpacity="0.25" strokeWidth="4"/><path d="M12 3a9 9 0 0 1 9 9" strokeWidth="4"/></svg>
                )}
                {runningProducts ? 'Starting…' : 'Rebuild Products'}
              </button>

              {resultProducts && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3 whitespace-pre-line">{resultProducts}</div>
              )}
              {errorProducts && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{errorProducts}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RebuildSearchIndex


