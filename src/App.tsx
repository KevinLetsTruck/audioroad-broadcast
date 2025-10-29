import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, useUser, SignIn, SignUp } from '@clerk/clerk-react'
import { BroadcastProvider } from './contexts/BroadcastContext'
import RoleGate from './components/RoleGate'
import Sidebar from './components/Sidebar'
import BroadcastControl from './pages/BroadcastControl'
import HostDashboard from './pages/HostDashboard'
import ScreeningRoom from './pages/ScreeningRoom'
import CallNow from './pages/CallNow'
import Recordings from './pages/Recordings'
import ShowSettings from './pages/ShowSettings'
import ContentDashboard from './pages/ContentDashboard'
import Commercials from './pages/Commercials'
import Listen from './pages/Listen'

// Get Clerk publishable key from environment
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key')
}

function AppContent() {
  const location = useLocation()
  const { user } = useUser()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Don't show navigation on auth pages or public pages
  const isAuthPage = location.pathname === '/sign-in' || location.pathname === '/sign-up'
  const isPublicPage = location.pathname === '/call-now'
  const showSidebar = !isAuthPage && !isPublicPage && user

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {/* Sidebar Navigation */}
      {showSidebar && (
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
      )}

      {/* Page Content */}
      <main className="flex-1 overflow-y-auto bg-gray-900">
        <Routes>
          {/* Auth Routes - Clerk's beautiful pre-built pages */}
          <Route 
            path="/sign-in/*" 
            element={
              <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <SignIn 
                  afterSignInUrl="/"
                  appearance={{
                    layout: {
                      socialButtonsPlacement: "bottom",
                      socialButtonsVariant: "blockButton"
                    },
                    variables: {
                      colorPrimary: "#22c55e",
                      colorBackground: "#ffffff",
                      colorText: "#1f2937",
                      colorInputBackground: "#f3f4f6",
                      colorInputText: "#1f2937",
                      borderRadius: "0.5rem"
                    },
                    elements: {
                      rootBox: "mx-auto",
                      card: "shadow-2xl",
                      headerTitle: "text-2xl font-bold text-gray-900",
                      headerSubtitle: "text-gray-600",
                      socialButtonsBlockButton: "border-2 hover:bg-gray-50",
                      formButtonPrimary: "bg-green-600 hover:bg-green-700 text-white font-semibold",
                      formFieldInput: "border-gray-300 text-gray-900",
                      footerActionLink: "text-green-600 hover:text-green-700 font-semibold"
                    }
                  }}
                />
              </div>
            } 
          />
          <Route 
            path="/sign-up/*" 
            element={
              <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <SignUp 
                  afterSignUpUrl="/"
                  appearance={{
                    layout: {
                      socialButtonsPlacement: "bottom",
                      socialButtonsVariant: "blockButton"
                    },
                    variables: {
                      colorPrimary: "#22c55e",
                      colorBackground: "#ffffff",
                      colorText: "#1f2937",
                      colorInputBackground: "#f3f4f6",
                      colorInputText: "#1f2937",
                      borderRadius: "0.5rem"
                    },
                    elements: {
                      rootBox: "mx-auto",
                      card: "shadow-2xl",
                      headerTitle: "text-2xl font-bold text-gray-900",
                      headerSubtitle: "text-gray-600",
                      socialButtonsBlockButton: "border-2 hover:bg-gray-50",
                      formButtonPrimary: "bg-green-600 hover:bg-green-700 text-white font-semibold",
                      formFieldInput: "border-gray-300 text-gray-900",
                      footerActionLink: "text-green-600 hover:text-green-700 font-semibold"
                    }
                  }}
                />
              </div>
            } 
          />
          
          {/* Public Routes - No authentication required */}
          <Route path="/call-now" element={<CallNow />} />
          <Route path="/listen" element={<Listen />} />
          
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
          <Route path="/commercials" element={
            <SignedIn>
              <RoleGate allowedRoles={['host', 'admin', 'producer']}>
                <Commercials />
              </RoleGate>
            </SignedIn>
          } />
          <Route path="/content" element={
            <SignedIn>
              <RoleGate allowedRoles={['host', 'admin', 'producer']}>
                <ContentDashboard />
              </RoleGate>
            </SignedIn>
          } />
        </Routes>
        
        {/* Redirect to sign-in if not authenticated (except public pages) */}
        <SignedOut>
          <Routes>
            {/* Don't redirect public pages */}
            <Route path="/call-now" element={null} />
            <Route path="/listen" element={null} />
            <Route path="/sign-in/*" element={null} />
            <Route path="/sign-up/*" element={null} />
            {/* Redirect everything else to sign-in */}
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

