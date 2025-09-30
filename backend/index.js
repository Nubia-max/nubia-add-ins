/**
 * Firebase Functions entry point for Moose Excel Add-in
 */

const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

// Set global options for all functions
setGlobalOptions({
  region: 'us-central1',
  memory: '1GiB',
  timeoutSeconds: 300, // 5 minutes for AI operations
  maxInstances: 10
});

// Import the Express app
const { app } = require('./dist/server');

// Export the API function
exports.api = onRequest({
  cors: true,
  invoker: 'public'
}, app);