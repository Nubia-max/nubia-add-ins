// Middleware wrappers to handle TypeScript issues
import { Request, Response, NextFunction } from 'express';
import { auth } from './auth';
import { checkCreditsMiddleware } from '../services/creditSystem';

// Wrapper for auth middleware
export const authWrapper = (req: Request, res: Response, next: NextFunction) => {
  return auth(req as any, res, next);
};

// Wrapper for credit checking middleware
export const creditCheckWrapper = () => {
  const middleware = checkCreditsMiddleware();
  return (req: Request, res: Response, next: NextFunction) => {
    return middleware(req as any, res, next);
  };
};