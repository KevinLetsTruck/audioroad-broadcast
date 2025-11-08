import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Custom application error class
 */
export class AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Centralized error handler middleware
 * Must be added AFTER all routes
 */
export function errorHandler(
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log the error
  console.error('❌ [ERROR]', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    error: err.message,
    stack: err.stack
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  // Handle custom AppError
  if (err instanceof AppError && err.isOperational) {
    const response: any = {
      error: err.message,
      code: err.code,
    };
    if (err.details) {
      response.details = err.details;
    }
    return res.status(err.statusCode).json(response);
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'Duplicate entry',
        code: 'DUPLICATE_ERROR',
        details: 'A record with this value already exists',
      });
    }

    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Record not found',
        code: 'NOT_FOUND',
      });
    }

    if (err.code === 'P1001') {
      return res.status(503).json({
        error: 'Database connection failed',
        code: 'DATABASE_ERROR',
        details: 'Unable to connect to database',
      });
    }
  }

  // Default to 500 server error
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An internal server error occurred'
    : err.message;

  res.status(statusCode).json({
    error: message,
    code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      details: err instanceof Error ? err.message : String(err),
    }),
  });
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const err = new AppError(
    `Route ${req.method} ${req.path} not found`,
    404,
    'NOT_FOUND'
  );
  next(err);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

