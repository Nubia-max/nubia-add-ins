import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  userId?: string;
}

interface JwtPayload {
  userId: string;
}

export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No token provided or invalid format' 
      });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'fallback-secret'
      ) as JwtPayload;

      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true }
      });

      if (!user) {
        return res.status(401).json({ 
          error: 'User not found' 
        });
      }

      req.userId = decoded.userId;
      next();
    } catch (jwtError) {
      logger.error('JWT verification error:', jwtError);
      return res.status(401).json({ 
        error: 'Invalid or expired token' 
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};