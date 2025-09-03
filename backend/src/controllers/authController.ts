import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  userId?: string;
}

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'User already exists with this email' 
      });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        settings: {
          automationMode: 'visual',
          notifications: true,
          autoMinimize: false
        }
      },
      select: {
        id: true,
        email: true,
        settings: true,
        createdAt: true
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    logger.info(`User registered: ${email}`);

    return res.status(201).json({
      message: 'User registered successfully',
      user,
      token
    });
  } catch (error) {
    logger.error('Registration error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        settings: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${email}`);

    return res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        settings: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    return res.json(user);
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
};