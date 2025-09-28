// Paystack Payment Service
import fetch from 'node-fetch';
import { logger } from '../utils/logger';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export interface PaystackTransactionData {
  reference: string;
  amount: number; // in kobo (Nigerian currency)
  email: string;
  currency: string;
  callback_url?: string;
  metadata?: any;
}

export interface PaystackResponse {
  status: boolean;
  message: string;
  data?: any;
}

export class PaystackService {
  private static headers = {
    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };

  // Initialize a transaction
  static async initializeTransaction(data: PaystackTransactionData): Promise<PaystackResponse> {
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data)
      });

      const result = await response.json() as PaystackResponse;

      if (result.status) {
        logger.info(`Paystack transaction initialized: ${data.reference}`);
      } else {
        logger.error('Paystack transaction initialization failed:', result.message);
      }

      return result;
    } catch (error) {
      logger.error('Paystack API error:', error);
      return {
        status: false,
        message: 'Payment service unavailable'
      };
    }
  }

  // Verify a transaction
  static async verifyTransaction(reference: string): Promise<PaystackResponse> {
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: this.headers
      });

      const result = await response.json() as PaystackResponse;

      if (result.status) {
        logger.info(`Paystack transaction verified: ${reference}`);
      } else {
        logger.warn(`Paystack transaction verification failed: ${reference}`);
      }

      return result;
    } catch (error) {
      logger.error('Paystack verification error:', error);
      return {
        status: false,
        message: 'Payment verification failed'
      };
    }
  }

  // Convert USD to Naira using environment-configured rate
  static usdToNaira(usdAmount: number): number {
    const exchangeRate = process.env.USD_TO_NGN_RATE ?
      parseFloat(process.env.USD_TO_NGN_RATE) : 1500; // Fallback rate

    // Log rate for debugging
    logger.info(`Converting $${usdAmount} USD to NGN at rate ${exchangeRate}`);

    return Math.round(usdAmount * exchangeRate * 100); // Convert to kobo
  }

  // Convert Naira kobo back to USD using environment-configured rate
  static nairaToUsd(koboAmount: number): number {
    const exchangeRate = process.env.USD_TO_NGN_RATE ?
      parseFloat(process.env.USD_TO_NGN_RATE) : 1500; // Fallback rate

    return Math.round((koboAmount / 100) / exchangeRate * 100) / 100; // Convert to USD
  }

  // Get current exchange rate from external API (implement if needed)
  static async updateExchangeRate(): Promise<void> {
    try {
      // TODO: Implement real-time exchange rate fetching
      // const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      // const data = await response.json();
      // process.env.USD_TO_NGN_RATE = data.rates.NGN.toString();

      logger.info('Exchange rate update not implemented - using configured rate');
    } catch (error) {
      logger.warn('Failed to update exchange rate:', error);
    }
  }

  // Generate a unique transaction reference
  static generateReference(userId: string): string {
    return `moose_${userId}_${Date.now()}`;
  }

  // Validate webhook signature (for security)
  static validateWebhookSignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(payload, 'utf8')
      .digest('hex');

    return hash === signature;
  }
}

export default PaystackService;