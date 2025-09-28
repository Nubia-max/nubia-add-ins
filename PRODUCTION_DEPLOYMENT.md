# Moose Excel Add-in - Production Deployment Guide

## Overview

This guide covers deploying Moose Excel Add-in with Firebase Anonymous Authentication and Paystack payment integration to production.

## Features Implemented

✅ **Anonymous Authentication**
- Firebase anonymous users get 10 free credits
- No sign-up required to start using the app
- Seamless user experience

✅ **Credit System**
- 10 free credits for all users
- Usage-based pricing: $2 = 200 credits, 1 credit = 1000 tokens
- Real-time credit tracking and validation

✅ **Paystack Payment Integration**
- Secure payment processing with Paystack
- Webhook support for automatic credit fulfillment
- Multiple payment packages ($2-$100)

✅ **Production Security**
- Comprehensive error handling
- Input validation and sanitization
- Rate limiting and suspicious activity detection
- Security headers and CORS protection

## Pre-deployment Checklist

### 1. Environment Configuration

1. Copy `.env.production` to `.env` and update:
   ```bash
   cp backend/.env.production backend/.env
   ```

2. Replace placeholder values:
   - `FIREBASE_PRIVATE_KEY`: Your Firebase service account private key
   - `PAYSTACK_SECRET_KEY`: Your Paystack secret key
   - `PAYSTACK_PUBLIC_KEY`: Your Paystack public key
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `DEEPSEEK_API_KEY`: Your DeepSeek API key
   - `CORS_ORIGIN`: Your production domain

### 2. Paystack Configuration

1. **Create Paystack Account**: Sign up at https://paystack.com
2. **Get API Keys**: From Paystack Dashboard > Settings > API Keys & Webhooks
3. **Set Webhook URL**: Configure webhook URL to `https://yourdomain.com/api/credits/webhook/paystack`
4. **Test Payments**: Use test keys first, then switch to live keys

### 3. Firebase Setup

1. **Project Configuration**: Ensure Firebase project is configured for production
2. **Anonymous Auth**: Enable Anonymous authentication in Firebase Console
3. **Firestore Rules**: Update Firestore security rules:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /credits/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       match /transactions/{transactionId} {
         allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
       }
     }
   }
   ```

## Deployment Steps

### Backend Deployment

1. **Build the application**:
   ```bash
   cd backend
   npm run build
   ```

2. **Install dependencies**:
   ```bash
   npm install --production
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Health Check**:
   ```bash
   curl https://yourdomain.com/api/health
   ```

### Frontend Deployment

1. **Update webpack config** for production:
   ```javascript
   // webpack.config.js - update proxy target
   proxy: {
     '/api': {
       target: 'https://yourdomain.com',
       secure: true,
       changeOrigin: true
     }
   }
   ```

2. **Build the add-in**:
   ```bash
   cd add-in
   npm run build
   ```

3. **Upload manifest**: Upload `manifest.xml` to your web server

4. **Side-load in Excel**:
   - Excel > Insert > My Add-ins > Upload My Add-in
   - Select your manifest.xml file

## Monitoring and Maintenance

### 1. Health Monitoring

Set up monitoring for:
- `/api/health` endpoint
- Credit system operations
- Payment webhook processing
- Anonymous user creation

### 2. Logging

Key logs to monitor:
- Payment transactions
- Credit usage patterns
- Authentication failures
- Security incidents

### 3. Database Maintenance

Regular maintenance tasks:
- Clean up expired anonymous users
- Archive old transactions
- Monitor credit balances
- Review suspicious activity logs

## Security Considerations

### 1. Rate Limiting

- Anonymous users: 20 requests/hour for AI commands
- Authenticated users: Higher limits
- Payment endpoints: Strict rate limiting

### 2. Input Validation

All endpoints validate:
- Request size limits
- Input sanitization
- Credit manipulation prevention
- Suspicious pattern detection

### 3. Payment Security

- Webhook signature verification
- Payment reference validation
- Duplicate transaction prevention
- Secure error handling

## Troubleshooting

### Common Issues

1. **Payment Failures**:
   - Check Paystack webhook configuration
   - Verify API keys are correct
   - Monitor webhook logs

2. **Credit Issues**:
   - Check Firebase connection
   - Verify user authentication
   - Review credit calculation logic

3. **CORS Errors**:
   - Update allowed origins
   - Check Excel add-in domain
   - Verify SSL certificates

### Support

For issues:
1. Check logs: `tail -f logs/app.log`
2. Verify health endpoint: `GET /api/health`
3. Test payment flow: Use Paystack test cards
4. Monitor credit usage: Check Firebase console

## Performance Optimization

### 1. Caching

- Credit balance caching (5 minute TTL)
- Firebase connection pooling
- Response compression

### 2. Database Optimization

- Index frequently queried fields
- Archive old transaction data
- Optimize credit queries

### 3. Monitoring

- Response time tracking
- Error rate monitoring
- Credit usage analytics
- Payment success rates

## Scaling Considerations

### For High Traffic

1. **Load Balancing**: Use multiple backend instances
2. **Database Scaling**: Consider Firebase scaling limits
3. **Caching Layer**: Implement Redis for session storage
4. **CDN**: Use CDN for static assets

### Cost Management

1. **AI API Usage**: Monitor token consumption
2. **Firebase Costs**: Track read/write operations
3. **Server Resources**: Monitor CPU/memory usage
4. **Payment Processing**: Review Paystack fees

---

## Success Metrics

Track these KPIs:
- Anonymous user activation rate
- Credit purchase conversion rate
- Average credits per user
- Payment success rate
- User retention (anonymous vs authenticated)
- Command success rate
- Response time metrics

Your Moose Excel Add-in is now ready for production! 🚀