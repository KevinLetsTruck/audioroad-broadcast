/**
 * Authentication Middleware
 * Protects routes and checks user roles
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, UserPayload } from '../services/authService.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

/**
 * Middleware to require authentication
 * Checks for valid JWT token in cookie or Authorization header
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies.auth_token || 
                  req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.log('❌ [AUTH] No token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const payload = verifyToken(token);

    if (!payload) {
      console.log('❌ [AUTH] Invalid token');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user to request
    req.user = payload;
    next();
  } catch (error) {
    console.error('❌ [AUTH] Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to require specific role(s)
 * Usage: requireRole('admin') or requireRole(['host', 'admin'])
 */
export function requireRole(allowedRoles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(req.user.role)) {
      console.log(`❌ [AUTH] User ${req.user.email} lacks required role. Has: ${req.user.role}, Needs: ${roles.join(' or ')}`);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
}

/**
 * Optional authentication - attaches user if token is valid but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.auth_token || 
                  req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        req.user = payload;
      }
    }
    
    next();
  } catch (error) {
    // Ignore errors, just continue without user
    next();
  }
}

