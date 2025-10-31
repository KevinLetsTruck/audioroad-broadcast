/**
 * Authentication Service
 * Handles user authentication, password hashing, and JWT token generation
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// JWT secret - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  showId?: string | null;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: UserPayload): string {
  return jwt.sign(user, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): UserPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Authenticate a user with email and password
 */
export async function authenticateUser(email: string, password: string) {
  const user = await prisma.broadcastUser.findUnique({
    where: { email }
  });

  if (!user || !user.password) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }

  // Don't include password in the response
  const { password: _unused, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Create a new user
 */
export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role: string;
  showId?: string;
}) {
  // Hash the password
  const hashedPassword = await hashPassword(data.password);

  const user = await prisma.broadcastUser.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role,
      showId: data.showId,
      isActive: true
    }
  });

  // Don't include password in the response
  const { password: _unused, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Get user by ID (without password)
 */
export async function getUserById(id: string) {
  const user = await prisma.broadcastUser.findUnique({
    where: { id }
  });

  if (!user) {
    return null;
  }

  // When password field exists, exclude it:
  // const { password: _, ...userWithoutPassword } = user;
  // return userWithoutPassword;
  
  return user;
}

/**
 * Get user by email (without password)
 */
export async function getUserByEmail(email: string) {
  const user = await prisma.broadcastUser.findUnique({
    where: { email }
  });

  if (!user) {
    return null;
  }

  return user;
}

