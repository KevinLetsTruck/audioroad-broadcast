import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { BroadcastProvider } from './contexts/BroadcastContext'
import BroadcastControl from './pages/BroadcastControl'
import HostDashboard from './pages/HostDashboard'
import ScreeningRoom from './pages/ScreeningRoom'
import CallNow from './pages/CallNow'
import Recordings from './pages/Recordings'
import ShowSettings from './pages/ShowSettings'

function AppContent() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary-500">
            🎙️ AudioRoad Network
          </h1>
          <div className="flex gap-4">
            <Link
              to="/"
              className={`px-4 py-2 rounded font-bold ${
                location.pathname === '/'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🎙️ Broadcast Control
            </Link>
            <Link
              to="/host-dashboard"
              className={`px-4 py-2 rounded ${
                location.pathname === '/host-dashboard'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Host Dashboard
            </Link>
            <Link
              to="/screening-room"
              className={`px-4 py-2 rounded ${
                location.pathname === '/screening-room'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Screening Room
            </Link>
            <Link
              to="/recordings"
              className={`px-4 py-2 rounded ${
                location.pathname === '/recordings'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📁 Recordings
            </Link>
            <Link
              to="/settings"
              className={`px-4 py-2 rounded ${
                location.pathname === '/settings'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ⚙️ Settings
            </Link>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main>
        <Routes>
          <Route path="/" element={<BroadcastControl />} />
          <Route path="/host-dashboard" element={<HostDashboard />} />
          <Route path="/screening-room" element={<ScreeningRoom />} />
          <Route path="/recordings" element={<Recordings />} />
          <Route path="/settings" element={<ShowSettings />} />
          <Route path="/call-now" element={<CallNow />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <BroadcastProvider>
        <AppContent />
      </BroadcastProvider>
    </BrowserRouter>
  )
}

export default App

