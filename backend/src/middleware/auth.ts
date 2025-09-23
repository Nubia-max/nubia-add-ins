import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const auth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // Simple auth middleware - in production, this would verify JWT tokens, etc.
  // For now, we'll add a mock user for development

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For development, add a mock user
    req.user = {
      id: 'dev-user-1',
      email: 'dev@example.com'
    };
  } else {
    // In production, decode and verify JWT token here
    // For now, mock user based on token
    req.user = {
      id: 'user-from-token',
      email: 'user@example.com'
    };
  }

  next();
};