import React, { useEffect, useState } from 'react'
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './lib/supabaseClient'
import { createClient } from '@supabase/supabase-js'

const SetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [linkEmail, setLinkEmail] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [success, setSuccess] = useState(false)

  // Isolated client: keeps the invite session local to this tab/page
  const iso = React.useMemo(() => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: undefined, autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }), [])

  useEffect(() => {
    const init = async () => {
      try {
        setError(null)
        // Robust extraction: handle double-hash "#/set-password#access_token=..."
        const href = window.location.href
        const getParam = (name: string) => {
          const m = href.match(new RegExp(`[?#&]${name}=([^&]+)`))
          return m ? decodeURIComponent(m[1]) : null
        }
        const type = getParam('type') // invite | recovery
        const access_token = getParam('access_token')
        const refresh_token = getParam('refresh_token')

        if (access_token && refresh_token && (type === 'recovery' || type === 'invite')) {
          const { error: setErr } = await iso.auth.setSession({ access_token, refresh_token })
          if (setErr) throw setErr
        }

        const { data: me } = await iso.auth.getUser()
        if (!me?.user) {
          setError('Invitation expired. Please open your newest invite email and try again.')
        } else {
          setLinkEmail(me.user.email ?? null)
        }
      } catch (e: any) {
        setError('Invitation expired. Please open your newest invite email and try again.')
      } finally {
        setInitialized(true)
      }
    }
    init()
  }, [iso])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      if (password !== confirm) throw new Error('Passwords do not match')
      if (password.length < 6) throw new Error('Password must be at least 6 characters')
      const { data: sessionData } = await iso.auth.getSession()
      if (!sessionData.session) throw new Error('Invitation expired. Please open your newest invite email and try again.')
      const { error } = await iso.auth.updateUser({ password })
      if (error) throw error
      // After successful password set, copy session into the shared client so the rest of the app is logged in
      const fresh = await iso.auth.getSession()
      if (fresh.data.session) {
        await supabase.auth.setSession({ access_token: fresh.data.session.access_token, refresh_token: fresh.data.session.refresh_token })
      }
      setMessage('Password set successfully. You can now use the app.')
      setSuccess(true)
    } catch (err: any) {
      setError(err?.message || 'Invitation expired. Please open your newest invite email and try again.')
    } finally {
      setLoading(false)
    }
  }

  const goToChat = () => {
    try {
      window.location.assign(`${window.location.origin}/`)
    } catch {
      window.location.href = '/'
    }
  }

  return (
    <div className="p-4 w-full">
      <div className="max-w-md mx-auto w-full">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Set Password</h1>
          <p className="text-sm text-gray-600">Complete your account setup by creating a password.</p>
          {initialized && linkEmail && (
            <p className="text-xs text-gray-500 mt-1">Account: <span className="font-medium">{linkEmail}</span></p>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {success ? (
            <div className="space-y-3">
              {message && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">{message}</div>}
              <button onClick={goToChat} className="px-4 py-2 rounded-md bg-blue-600 text-white">Go to Chat</button>
            </div>
          ) : error ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm new password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" disabled={loading || password.length < 6 || confirm.length < 6} className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-300 inline-flex items-center gap-2">
                {loading && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeOpacity="0.25" strokeWidth="4"/><path d="M12 3a9 9 0 0 1 9 9" strokeWidth="4"/></svg>
                )}
                {loading ? 'Saving…' : 'Set Password'}
              </button>
              {message && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">{message}</div>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default SetPasswordPage


