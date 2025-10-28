/**
 * Clerk Authentication Middleware
 * Replaces our custom JWT auth with Clerk's secure authentication
 */

import { Request, Response, NextFunction } from 'express';
import { createClerkClient } from '@clerk/backend';

// Create Clerk client
const clerkClient = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

// Clerk user type for request
export interface ClerkUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role?: string;
  showId?: string;
}

// Extend Express Request type to include Clerk auth
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
      };
      clerkUser?: ClerkUser;
    }
  }
}

/**
 * Middleware to require Clerk authentication
 * Verifies the session token from Clerk
 */
export async function requireClerkAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get session token from Authorization header or cookie
    const sessionToken = req.headers.authorization?.replace('Bearer ', '') || 
                        req.cookies.__session;

    if (!sessionToken) {
      console.log('❌ [CLERK] No session token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Verify the session with Clerk
      const session = await clerkClient.sessions.verifySession(sessionToken, sessionToken);
      
      if (!session) {
        console.log('❌ [CLERK] Invalid session');
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      // Get full user details from Clerk
      const user = await clerkClient.users.getUser(session.userId);

      // Attach auth info to request
      req.auth = {
        userId: session.userId,
        sessionId: session.id
      };

      // Attach user info with role from metadata
      req.clerkUser = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.publicMetadata?.role as string | undefined,
        showId: user.publicMetadata?.showId as string | undefined
      };

      console.log(`✅ [CLERK] Authenticated: ${req.clerkUser.email} (${req.clerkUser.role || 'no role'})`);
      next();
    } catch (clerkError: any) {
      console.error('❌ [CLERK] Verification error:', clerkError.message);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    console.error('❌ [CLERK] Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to require specific role(s)
 * Must be used AFTER requireClerkAuth
 */
export function requireRole(allowedRoles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.clerkUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const userRole = req.clerkUser.role;

    if (!userRole || !roles.includes(userRole)) {
      console.log(`❌ [CLERK] User ${req.clerkUser.email} lacks required role. Has: ${userRole || 'none'}, Needs: ${roles.join(' or ')}`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: userRole || 'none'
      });
    }

    next();
  };
}

/**
 * Optional Clerk auth - attaches user if authenticated but doesn't require it
 */
export async function optionalClerkAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '') || 
                        req.cookies.__session;

    if (sessionToken) {
      try {
        const session = await clerkClient.sessions.verifySession(sessionToken, sessionToken);
        if (session) {
          const user = await clerkClient.users.getUser(session.userId);
          
          req.auth = {
            userId: session.userId,
            sessionId: session.id
          };

          req.clerkUser = {
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress || '',
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.publicMetadata?.role as string | undefined,
            showId: user.publicMetadata?.showId as string | undefined
          };
        }
      } catch (error) {
        // Ignore errors, just continue without user
      }
    }
    
    next();
  } catch (error) {
    // Ignore errors, just continue without user
    next();
  }
}

