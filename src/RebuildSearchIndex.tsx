import React, { useState } from 'react'

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_REBUILD_SEARCH_INDEX

const RebuildSearchIndex: React.FC = () => {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trigger = async () => {
    if (running) return
    if (!WEBHOOK_URL) {
      setError('Configuration error: VITE_N8N_WEBHOOK_REBUILD_SEARCH_INDEX is not set')
      return
    }
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        // body: JSON.stringify({ initiatedBy, triggeredAt: new Date().toISOString() })
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const json = await response.json().catch(() => ({}))
      
      // Log the full response for debugging
      console.log('🔍 Full n8n response:', json)
      
      // Display more detailed information if available
      let resultMessage = json.message || 'Embedding job started. You can continue using the app while we rebuild the search index.'
      
      // Add additional details if available
      if (json.status) resultMessage += `\nStatus: ${json.status}`
      if (json.jobId) resultMessage += `\nJob ID: ${json.jobId}`
      if (json.documentsProcessed) resultMessage += `\nDocuments to process: ${json.documentsProcessed}`
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
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Rebuild Search Index</h1>
          <p className="text-sm text-gray-600">
            This tool refreshes the app’s “brain” by scanning all stored documents and generating new
            embeddings. It helps the system understand and find your content more accurately. Safe to re-run
            anytime; your files are not changed.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <button
            onClick={trigger}
            disabled={running}
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-300 inline-flex items-center gap-2"
          >
            {running && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeOpacity="0.25" strokeWidth="4"/><path d="M12 3a9 9 0 0 1 9 9" strokeWidth="4"/></svg>
            )}
            {running ? 'Starting…' : 'Start Rebuild'}
          </button>

          {result && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">{result}</div>
          )}
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RebuildSearchIndex


