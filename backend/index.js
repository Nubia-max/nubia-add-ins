// Firebase Cloud Functions entry point
const { onRequest } = require('firebase-functions/v2/https');
const { app } = require('./dist/server');

// Export the Express app as a Firebase Function
exports.api = onRequest({
  region: 'us-central1',
  memory: '1GiB',
  timeoutSeconds: 300
}, app);