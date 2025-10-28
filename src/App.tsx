import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, UserButton, useUser, SignIn, SignUp } from '@clerk/clerk-react'
import { BroadcastProvider } from './contexts/BroadcastContext'
import RoleGate from './components/RoleGate'
import BroadcastControl from './pages/BroadcastControl'
import HostDashboard from './pages/HostDashboard'
import ScreeningRoom from './pages/ScreeningRoom'
import CallNow from './pages/CallNow'
import Recordings from './pages/Recordings'
import ShowSettings from './pages/ShowSettings'

// Get Clerk publishable key from environment
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key')
}

function AppContent() {
  const location = useLocation()
  const { user } = useUser()

  // Get user role from Clerk metadata
  const userRole = user?.publicMetadata?.role as string | undefined

  // Don't show navigation on auth pages
  const isAuthPage = location.pathname === '/sign-in' || location.pathname === '/sign-up'
  const showNav = !isAuthPage && user

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation */}
      {showNav && (
        <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-500">
                🎙️ AudioRoad Network
              </h1>
              {user && (
                <p className="text-xs text-gray-400 mt-1">
                  {user.firstName} {user.lastName} • {userRole || 'user'}
                </p>
              )}
            </div>
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
            {/* Clerk's UserButton - includes profile, settings, and sign out */}
            <UserButton 
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10"
                }
              }}
            />
          </div>
        </div>
      </nav>
      )}

      {/* Page Content */}
      <main>
        <Routes>
          {/* Auth Routes - Clerk's beautiful pre-built pages */}
          <Route 
            path="/sign-in/*" 
            element={
              <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <SignIn 
                  afterSignInUrl="/"
                  appearance={{
                    elements: {
                      rootBox: "mx-auto",
                      card: "bg-gray-800 shadow-xl"
                    }
                  }}
                />
              </div>
            } 
          />
          <Route 
            path="/sign-up/*" 
            element={
              <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <SignUp 
                  afterSignUpUrl="/"
                  appearance={{
                    elements: {
                      rootBox: "mx-auto",
                      card: "bg-gray-800 shadow-xl"
                    }
                  }}
                />
              </div>
            } 
          />
          
          {/* Public Route */}
          <Route path="/call-now" element={<CallNow />} />
          
          {/* Protected Routes - Only accessible when signed in */}
          <Route path="/" element={
            <SignedIn>
              <RoleGate allowedRoles={['host', 'admin']}>
                <BroadcastControl />
              </RoleGate>
            </SignedIn>
          } />
          <Route path="/host-dashboard" element={
            <SignedIn>
              <RoleGate allowedRoles={['host', 'admin']}>
                <HostDashboard />
              </RoleGate>
            </SignedIn>
          } />
          <Route path="/screening-room" element={
            <SignedIn>
              <RoleGate allowedRoles={['screener', 'admin']}>
                <ScreeningRoom />
              </RoleGate>
            </SignedIn>
          } />
          <Route path="/recordings" element={
            <SignedIn>
              <Recordings />
            </SignedIn>
          } />
          <Route path="/settings" element={
            <SignedIn>
              <ShowSettings />
            </SignedIn>
          } />
        </Routes>
        
        {/* Redirect to sign-in if not authenticated */}
        <SignedOut>
          <Routes>
            <Route path="*" element={<Navigate to="/sign-in" replace />} />
          </Routes>
        </SignedOut>
      </main>
    </div>
  )
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <BrowserRouter>
        <BroadcastProvider>
          <AppContent />
        </BroadcastProvider>
      </BrowserRouter>
    </ClerkProvider>
  )
}

export default App

