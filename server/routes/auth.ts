import express, { Request, Response } from 'express';
import { authenticateUser, createUser, generateToken, getUserById } from '../services/authService.js';

const router = express.Router();

/**
 * POST /api/auth/login - Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    console.log('🔐 [AUTH] Login attempt for:', email);

    const user = await authenticateUser(email, password);

    if (!user) {
      console.log('❌ [AUTH] Invalid credentials for:', email);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      console.log('❌ [AUTH] Inactive user attempted login:', email);
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      showId: user.showId
    });

    console.log('✅ [AUTH] Login successful for:', email, '- Role:', user.role);

    // Set token in HTTP-only cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Also return token in response for client-side storage if needed
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        showId: user.showId
      }
    });
  } catch (error) {
    console.error('❌ [AUTH] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/register - Register new user (admin only in production)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role, showId } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ 
        error: 'Email, password, name, and role are required' 
      });
    }

    // Validate role
    const validRoles = ['host', 'co-host', 'producer', 'screener', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
      });
    }

    console.log('📝 [AUTH] Registration attempt for:', email, '- Role:', role);

    const user = await createUser({
      email,
      password,
      name,
      role,
      showId
    });

    console.log('✅ [AUTH] User created:', email);

    // Generate token for immediate login
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      showId: user.showId
    });

    // Set token in cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        showId: user.showId
      }
    });
  } catch (error: any) {
    console.error('❌ [AUTH] Registration error:', error);
    
    // Handle unique constraint violation (duplicate email)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/logout - Logout user
 */
router.post('/logout', (req: Request, res: Response) => {
  console.log('👋 [AUTH] User logging out');
  
  // Clear the auth cookie
  res.clearCookie('auth_token');
  
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me - Get current user info
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies.auth_token || 
                  req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { verifyToken } = await import('../services/authService.js');
    const payload = verifyToken(token);

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get fresh user data from database
    const user = await getUserById(payload.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        showId: user.showId
      }
    });
  } catch (error) {
    console.error('❌ [AUTH] Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

export default router;

