import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface JwtPayload {
  userId: string;
}

export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'No token provided or invalid format' 
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }
      
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      });

      if (!user) {
        res.status(401).json({ 
          error: 'User not found' 
        });
        return;
      }

      // Attach user info to request object
      (req as any).user = {
        id: decoded.userId,
        email: user.email
      };
      next();
    } catch (jwtError) {
      logger.error('JWT verification error:', jwtError);
      res.status(401).json({ 
        error: 'Invalid or expired token' 
      });
      return;
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};