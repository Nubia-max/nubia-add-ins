/**
 * Environment configuration for Firebase Functions and local development
 */

// Get configuration from Firebase Functions config or environment variables
const getConfig = () => {
  // In Firebase Functions, use functions.config()
  if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIREBASE_CONFIG) {
    try {
      const functions = require('firebase-functions');
      return functions.config();
    } catch (error) {
      console.warn('Failed to load Firebase Functions config, falling back to env vars');
    }
  }

  // Fallback to environment variables for local development
  return {
    node: { env: process.env.NODE_ENV },
    cors: { origin: process.env.CORS_ORIGIN },
    openai: { api_key: process.env.OPENAI_API_KEY },
    deepseek: { api_key: process.env.DEEPSEEK_API_KEY },
    paystack: {
      secret_key: process.env.PAYSTACK_SECRET_KEY,
      public_key: process.env.PAYSTACK_PUBLIC_KEY
    },
    credits: { default_free: process.env.DEFAULT_FREE_CREDITS },
    frontend: { url: process.env.FRONTEND_URL },
    backend: { url: process.env.BACKEND_URL }
  };
};

const config = getConfig();

export const ENV = {
  NODE_ENV: config.node?.env || process.env.NODE_ENV || 'development',
  CORS_ORIGIN: config.cors?.origin || process.env.CORS_ORIGIN || 'https://aibun-ai.web.app',
  OPENAI_API_KEY: config.openai?.api_key || process.env.OPENAI_API_KEY,
  DEEPSEEK_API_KEY: config.deepseek?.api_key || process.env.DEEPSEEK_API_KEY,
  PAYSTACK_SECRET_KEY: config.paystack?.secret_key || process.env.PAYSTACK_SECRET_KEY,
  PAYSTACK_PUBLIC_KEY: config.paystack?.public_key || process.env.PAYSTACK_PUBLIC_KEY,
  DEFAULT_FREE_CREDITS: parseInt(config.credits?.default_free || process.env.DEFAULT_FREE_CREDITS || '10'),
  FRONTEND_URL: config.frontend?.url || process.env.FRONTEND_URL || 'https://aibun-ai.web.app',
  BACKEND_URL: config.backend?.url || process.env.BACKEND_URL || 'https://aibun-ai.web.app'
};

export default ENV;