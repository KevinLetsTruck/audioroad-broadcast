import { useState } from 'react'
import HostDashboard from './pages/HostDashboard'
import ScreeningRoom from './pages/ScreeningRoom'
import CallNow from './pages/CallNow'
import ShowSetupMock from './pages/ShowSetupMock'

function App() {
  const [currentPage, setCurrentPage] = useState<'host' | 'screener' | 'callnow' | 'setup'>('setup')

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary-500">
            🎙️ AudioRoad Network
          </h1>
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentPage('setup')}
              className={`px-4 py-2 rounded ${
                currentPage === 'setup'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🎬 Show Setup
            </button>
            <button
              onClick={() => setCurrentPage('host')}
              className={`px-4 py-2 rounded ${
                currentPage === 'host'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Host Dashboard
            </button>
            <button
              onClick={() => setCurrentPage('screener')}
              className={`px-4 py-2 rounded ${
                currentPage === 'screener'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Screening Room
            </button>
            <button
              onClick={() => setCurrentPage('callnow')}
              className={`px-4 py-2 rounded ${
                currentPage === 'callnow'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              📞 Call Now
            </button>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main>
        {currentPage === 'setup' && <ShowSetupMock />}
        {currentPage === 'host' && <HostDashboard />}
        {currentPage === 'screener' && <ScreeningRoom />}
        {currentPage === 'callnow' && <CallNow />}
      </main>
    </div>
  )
}

export default App

