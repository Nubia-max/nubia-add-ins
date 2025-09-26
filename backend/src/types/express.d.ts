import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        id: string;
        isAnonymous: boolean;
        email?: string;
        name?: string;
      };
      subscription?: any;
      creditValidation?: {
        canProceed: boolean;
        requiredCredits: number;
        availableCredits: number;
        needsLogin: boolean;
        needsPurchase: boolean;
        message?: string;
      };
    }
  }
}