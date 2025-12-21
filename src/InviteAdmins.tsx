import React, { useState, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'

const InviteAdmins: React.FC = () => {
  const [adminEmail, setAdminEmail] = useState('')
  const [superadminEmail, setSuperadminEmail] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)
  const [superadminLoading, setSuperadminLoading] = useState(false)
  const [adminMessage, setAdminMessage] = useState<string | null>(null)
  const [superadminMessage, setSuperadminMessage] = useState<string | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [superadminError, setSuperadminError] = useState<string | null>(null)

  const getRedirectTo = useCallback(() => {
    try {
      const origin = window.location.origin
      return `${origin}/#/set-password`
    } catch {
      return 'http://localhost:5173/#/set-password'
    }
  }, [])

  const handleAdminInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminEmail) return
    setAdminLoading(true)
    setAdminMessage(null)
    setAdminError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error('You must be signed in to invite users.')
      }

      const { data, error } = await supabase.functions.invoke('invite-admin', {
        body: { email: adminEmail, redirectTo: getRedirectTo() },
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (error) throw error
      if ((data as any)?.error) throw new Error((data as any).error)
      setAdminMessage('Invitation sent. The recipient will receive an email to set their password.')
      setAdminEmail('')
    } catch (err: any) {
      setAdminError(err?.message || 'Failed to send invite')
    } finally {
      setAdminLoading(false)
    }
  }

  const handleSuperadminInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!superadminEmail) return
    setSuperadminLoading(true)
    setSuperadminMessage(null)
    setSuperadminError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        throw new Error('You must be signed in to invite users.')
      }

      const { data, error } = await supabase.functions.invoke('invite-admin', {
        body: { email: superadminEmail, redirectTo: getRedirectTo(), role: 'superadmin' },
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (error) throw error
      if ((data as any)?.error) throw new Error((data as any).error)
      setSuperadminMessage('Invitation sent. The recipient will receive an email to set their password.')
      setSuperadminEmail('')
    } catch (err: any) {
      setSuperadminError(err?.message || 'Failed to send invite')
    } finally {
      setSuperadminLoading(false)
    }
  }

  return (
    <div className="p-4 w-full">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Invite Users</h1>
          <p className="text-sm text-gray-600">Send invite emails. Recipients will set a password and be granted the selected role.</p>
        </div>

        <div className="space-y-6">
          {/* Admin Invite Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-md font-semibold text-gray-900 mb-2">Invite Admin</h2>
            <p className="text-sm text-gray-600 mb-4">The recipient will be granted the admin role.</p>
            <form onSubmit={handleAdminInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipient email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="name@example.com"
                />
                <p className="text-xs text-gray-500 mt-2">Redirect: <span className="font-mono">{getRedirectTo()}</span></p>
              </div>

              <button
                type="submit"
                disabled={adminLoading || !adminEmail}
                className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-300"
              >
                {adminLoading ? 'Sending…' : 'Send Admin Invite'}
              </button>

              {adminMessage && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">{adminMessage}</div>}
              {adminError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{adminError}</div>}
            </form>
          </div>

          {/* Superadmin Invite Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-md font-semibold text-gray-900 mb-2">Invite Superadmin</h2>
            <p className="text-sm text-gray-600 mb-4">The recipient will be granted the superadmin role.</p>
            <form onSubmit={handleSuperadminInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipient email</label>
                <input
                  type="email"
                  required
                  value={superadminEmail}
                  onChange={(e) => setSuperadminEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="name@example.com"
                />
                <p className="text-xs text-gray-500 mt-2">Redirect: <span className="font-mono">{getRedirectTo()}</span></p>
              </div>

              <button
                type="submit"
                disabled={superadminLoading || !superadminEmail}
                className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:bg-gray-300"
              >
                {superadminLoading ? 'Sending…' : 'Send Superadmin Invite'}
              </button>

              {superadminMessage && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">{superadminMessage}</div>}
              {superadminError && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{superadminError}</div>}
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InviteAdmins


