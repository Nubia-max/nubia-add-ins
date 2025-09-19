// Simple logger utility for the backend
export const logger = {
  info: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.log(`${timestamp} [info]: ${message}`, JSON.stringify(meta, null, 2));
    } else {
      console.log(`${timestamp} [info]: ${message}`);
    }
  },

  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString();
    if (error) {
      console.error(`${timestamp} [error]: ${message}`, error);
    } else {
      console.error(`${timestamp} [error]: ${message}`);
    }
  },

  warn: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.warn(`${timestamp} [warn]: ${message}`, JSON.stringify(meta, null, 2));
    } else {
      console.warn(`${timestamp} [warn]: ${message}`);
    }
  },

  debug: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.debug(`${timestamp} [debug]: ${message}`, JSON.stringify(meta, null, 2));
    } else {
      console.debug(`${timestamp} [debug]: ${message}`);
    }
  }
};