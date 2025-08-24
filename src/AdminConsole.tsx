import React, { useState, useEffect } from 'react'

interface User {
  id: string
  name: string
  email: string
  lastActive: string
  status: 'active' | 'inactive' | 'suspended'
}

interface ChatStats {
  totalMessages: number
  activeUsers: number
  avgResponseTime: number
  satisfactionScore: number
}

const AdminConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      lastActive: '2024-01-15 14:30',
      status: 'active'
    },
    {
      id: '2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      lastActive: '2024-01-15 13:45',
      status: 'active'
    },
    {
      id: '3',
      name: 'Bob Johnson',
      email: 'bob@example.com',
      lastActive: '2024-01-14 16:20',
      status: 'inactive'
    }
  ])

  const [chatStats, setChatStats] = useState<ChatStats>({
    totalMessages: 1247,
    activeUsers: 89,
    avgResponseTime: 2.3,
    satisfactionScore: 4.7
  })

  const [systemStatus, setSystemStatus] = useState({
    api: 'operational',
    database: 'operational',
    storage: 'operational',
    aiModel: 'operational'
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600 bg-green-100'
      case 'degraded': return 'text-yellow-600 bg-yellow-100'
      case 'down': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return '🟢'
      case 'degraded': return '🟡'
      case 'down': return '🔴'
      default: return '⚪'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="bg-red-600 text-white px-3 py-2 rounded-lg font-bold text-sm shadow-lg mr-4">
                ADMIN<br />CONSOLE
              </div>
              <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Admin User</span>
              <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'dashboard', name: 'Dashboard', icon: '📊' },
              { id: 'users', name: 'User Management', icon: '👥' },
              { id: 'analytics', name: 'Analytics', icon: '📈' },
              { id: 'system', name: 'System', icon: '⚙️' },
              { id: 'logs', name: 'Logs', icon: '📝' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                        <span className="text-white text-lg">💬</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Messages</dt>
                        <dd className="text-lg font-medium text-gray-900">{chatStats.totalMessages.toLocaleString()}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                        <span className="text-white text-lg">👥</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Users</dt>
                        <dd className="text-lg font-medium text-gray-900">{chatStats.activeUsers}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                        <span className="text-white text-lg">⏱️</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Avg Response Time</dt>
                        <dd className="text-lg font-medium text-gray-900">{chatStats.avgResponseTime}s</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                        <span className="text-white text-lg">⭐</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Satisfaction Score</dt>
                        <dd className="text-lg font-medium text-gray-900">{chatStats.satisfactionScore}/5.0</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(systemStatus).map(([service, status]) => (
                    <div key={service} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700 capitalize">{service}</span>
                      <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                        <span className="mr-1">{getStatusIcon(status)}</span>
                        {status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">User Management</h3>
                <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
                  Add User
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {user.name.split(' ').map(n => n[0]).join('')}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.lastActive}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.status === 'active' ? 'bg-green-100 text-green-800' :
                            user.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-red-600 hover:text-red-900 mr-3">Edit</button>
                          <button className="text-red-600 hover:text-red-900">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Analytics Dashboard</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Message Volume Trends</h4>
                  <div className="h-32 bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-gray-500">Chart Placeholder</span>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-md font-medium text-gray-900 mb-3">User Engagement</h4>
                  <div className="h-32 bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-gray-500">Chart Placeholder</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">🔄</span>
                      <div>
                        <h4 className="font-medium text-gray-900">Restart Services</h4>
                        <p className="text-sm text-gray-500">Restart all system services</p>
                      </div>
                    </div>
                  </button>
                  <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">💾</span>
                      <div>
                        <h4 className="font-medium text-gray-900">Backup Database</h4>
                        <p className="text-sm text-gray-500">Create system backup</p>
                      </div>
                    </div>
                  </button>
                  <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">🔒</span>
                      <div>
                        <h4 className="font-medium text-gray-900">Security Scan</h4>
                        <p className="text-sm text-gray-500">Run security audit</p>
                      </div>
                    </div>
                  </button>
                  <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">📊</span>
                      <div>
                        <h4 className="font-medium text-gray-900">Performance Test</h4>
                        <p className="text-sm text-gray-500">Run performance tests</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Logs</h3>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
                <div>[2024-01-15 14:30:15] INFO: System startup complete</div>
                <div>[2024-01-15 14:30:16] INFO: Database connection established</div>
                <div>[2024-01-15 14:30:17] INFO: AI model loaded successfully</div>
                <div>[2024-01-15 14:31:22] INFO: User session started: user_12345</div>
                <div>[2024-01-15 14:31:45] INFO: Chat message processed successfully</div>
                <div>[2024-01-15 14:32:10] INFO: Response generated in 2.3s</div>
                <div>[2024-01-15 14:33:15] WARN: High response time detected</div>
                <div>[2024-01-15 14:34:20] INFO: User session ended: user_12345</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminConsole
