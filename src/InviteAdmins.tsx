import React, { useState, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'

const InviteAdmins: React.FC = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const getRedirectTo = useCallback(() => {
    try {
      const origin = window.location.origin
      return `${origin}/#/set-password`
    } catch {
      return 'http://localhost:5173/#/set-password'
    }
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error('You must be signed in to invite users.')
      }

      const { data, error } = await supabase.functions.invoke('invite-admin', {
        body: { email, redirectTo: getRedirectTo() },
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (error) throw error
      if ((data as any)?.error) throw new Error((data as any).error)
      setMessage('Invitation sent. The recipient will receive an email to set their password.')
      setEmail('')
    } catch (err: any) {
      setError(err?.message || 'Failed to send invite')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 w-full">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Invite Admins</h1>
          <p className="text-sm text-gray-600">Send an invite email. The recipient will set a password and be granted the admin role.</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Recipient email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="name@example.com"
              />
              <p className="text-xs text-gray-500 mt-2">Redirect: <span className="font-mono">{getRedirectTo()}</span></p>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-300"
            >
              {loading ? 'Sending…' : 'Send Invite'}
            </button>

            {message && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">{message}</div>}
            {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
          </form>
        </div>
      </div>
    </div>
  )
}

export default InviteAdmins


