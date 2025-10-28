import { ReactNode } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

interface RoleGateProps {
  children: ReactNode;
  allowedRoles?: string[];
}

/**
 * Component to restrict access based on user roles stored in Clerk metadata
 */
export default function RoleGate({ children, allowedRoles }: RoleGateProps) {
  const { user, isLoaded } = useUser();

  // Show loading while Clerk is initializing
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user (shouldn't happen inside SignedIn), redirect
  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  // Get user role from Clerk public metadata
  const userRole = user.publicMetadata?.role as string | undefined;

  // If no role restrictions, allow access
  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>;
  }

  // Check if user has required role
  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-4">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Required role: {allowedRoles.join(' or ')}
            <br />
            Your role: {userRole || 'none'}
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // User has required role, render children
  return <>{children}</>;
}

