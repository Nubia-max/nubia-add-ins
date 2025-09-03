import * as crypto from 'crypto';
import { environment } from '../config/environment';

export interface SecurityConfig {
  enableCSP: boolean;
  enableHSTS: boolean;
  enableXSSProtection: boolean;
  enableContentTypeNoSniff: boolean;
  enableFrameOptions: boolean;
  encryptionKey?: string;
}

class SecurityManager {
  private config: SecurityConfig;
  private encryptionKey: string;
  private rateLimiters = new Map<string, { count: number; resetTime: number }>();
  private blockedIPs = new Set<string>();
  private suspiciousAttempts = new Map<string, number>();

  constructor() {
    this.config = {
      enableCSP: environment.isProduction(),
      enableHSTS: environment.isProduction(),
      enableXSSProtection: true,
      enableContentTypeNoSniff: true,
      enableFrameOptions: true
    };

    this.encryptionKey = this.generateEncryptionKey();
    this.startCleanupTimer();
  }

  private generateEncryptionKey(): string {
    const key = process.env.NUBIA_ENCRYPTION_KEY;
    if (key && key.length >= 32) {
      return key;
    }

    // Generate a new key for this session
    return crypto.randomBytes(32).toString('hex');
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupRateLimiters();
      this.cleanupSuspiciousAttempts();
    }, 60 * 1000); // Every minute
  }

  // Input validation and sanitization
  sanitizeInput(input: string, options: {
    allowHTML?: boolean;
    maxLength?: number;
    stripScripts?: boolean;
  } = {}): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    let sanitized = input;

    // Length limiting
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Script tag removal
    if (options.stripScripts !== false) {
      sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      sanitized = sanitized.replace(/javascript:/gi, '');
      sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    }

    // HTML sanitization
    if (!options.allowHTML) {
      sanitized = sanitized
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }

    return sanitized;
  }

  // Validate file paths to prevent directory traversal
  validateFilePath(filePath: string): boolean {
    const normalized = require('path').normalize(filePath);
    
    // Check for directory traversal attempts
    if (normalized.includes('..') || normalized.includes('~')) {
      return false;
    }

    // Check for absolute paths that might access system files
    if (require('path').isAbsolute(normalized)) {
      const allowedPrefixes = [
        process.env.HOME || process.env.USERPROFILE || '',
        require('path').join(process.cwd()),
        require('os').tmpdir()
      ];

      return allowedPrefixes.some(prefix => 
        prefix && normalized.startsWith(require('path').normalize(prefix))
      );
    }

    return true;
  }

  // Rate limiting
  checkRateLimit(identifier: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const limiter = this.rateLimiters.get(identifier);

    if (!limiter || now > limiter.resetTime) {
      this.rateLimiters.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }

    if (limiter.count >= limit) {
      this.recordSuspiciousActivity(identifier, 'rate_limit_exceeded');
      return false;
    }

    limiter.count++;
    return true;
  }

  // API key validation and encryption
  encryptApiKey(apiKey: string): string {
    if (!apiKey) throw new Error('API key is required');

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  decryptApiKey(encryptedApiKey: string): string {
    if (!encryptedApiKey) throw new Error('Encrypted API key is required');

    try {
      const parts = encryptedApiKey.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted key format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt API key');
    }
  }

  // Secure random token generation
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  generateSecureId(): string {
    return crypto.randomUUID();
  }

  // Hash sensitive data
  hashSensitiveData(data: string, salt?: string): { hash: string; salt: string } {
    const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, generatedSalt, 10000, 64, 'sha512').toString('hex');
    
    return { hash, salt: generatedSalt };
  }

  verifyHash(data: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  // Content Security Policy headers
  generateCSPHeader(): string {
    if (!this.config.enableCSP) {
      return '';
    }

    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' ws: wss: https://api.nubia.ai https://updates.nubia.ai https://license.nubia.ai",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ];

    if (environment.isDevelopment()) {
      directives.push(
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "connect-src 'self' ws: wss: http: https:"
      );
    }

    return directives.join('; ');
  }

  // Security headers for HTTP responses
  getSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.config.enableCSP) {
      headers['Content-Security-Policy'] = this.generateCSPHeader();
    }

    if (this.config.enableHSTS && environment.isProduction()) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }

    if (this.config.enableXSSProtection) {
      headers['X-XSS-Protection'] = '1; mode=block';
    }

    if (this.config.enableContentTypeNoSniff) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    if (this.config.enableFrameOptions) {
      headers['X-Frame-Options'] = 'DENY';
    }

    headers['X-Powered-By'] = ''; // Remove server fingerprinting
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()';

    return headers;
  }

  // Input validation for specific data types
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  validateApiKey(apiKey: string, provider: 'openai' | 'anthropic'): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    switch (provider) {
      case 'openai':
        return apiKey.startsWith('sk-') && apiKey.length > 20;
      case 'anthropic':
        return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
      default:
        return false;
    }
  }

  validateLicenseKey(licenseKey: string): boolean {
    if (!licenseKey || typeof licenseKey !== 'string') {
      return false;
    }

    // Basic format validation for license keys
    const licenseRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return licenseRegex.test(licenseKey.toUpperCase());
  }

  // Suspicious activity monitoring
  private recordSuspiciousActivity(identifier: string, activity: string): void {
    const current = this.suspiciousAttempts.get(identifier) || 0;
    const newCount = current + 1;
    
    this.suspiciousAttempts.set(identifier, newCount);

    if (newCount >= 5) {
      this.blockedIPs.add(identifier);
      console.warn(`Blocked suspicious identifier: ${identifier} for activity: ${activity}`);
    }

    // Log security event
    this.logSecurityEvent('suspicious_activity', {
      identifier,
      activity,
      count: newCount,
      blocked: newCount >= 5
    });
  }

  isBlocked(identifier: string): boolean {
    return this.blockedIPs.has(identifier);
  }

  unblock(identifier: string): void {
    this.blockedIPs.delete(identifier);
    this.suspiciousAttempts.delete(identifier);
  }

  // Secure data storage validation
  validateStorageData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check for potential code injection in object values
    const jsonString = JSON.stringify(data);
    
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /function\s*\(/i
    ];

    return !dangerousPatterns.some(pattern => pattern.test(jsonString));
  }

  // Audit logging
  private logSecurityEvent(event: string, details: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
      sessionId: this.generateSecureToken(16)
    };

    console.warn('Security Event:', logEntry);

    // In production, you'd send this to a secure logging service
    if (environment.isProduction()) {
      // Send to security monitoring service
    }
  }

  // Memory protection
  clearSensitiveMemory(sensitiveString: string): void {
    // In JavaScript, we can't truly clear memory, but we can overwrite references
    if (typeof sensitiveString === 'string') {
      // Create a new string filled with zeros to potentially overwrite memory
      const zeros = '0'.repeat(sensitiveString.length);
      sensitiveString = zeros;
    }
  }

  // Cleanup functions
  private cleanupRateLimiters(): void {
    const now = Date.now();
    for (const [key, limiter] of this.rateLimiters.entries()) {
      if (now > limiter.resetTime) {
        this.rateLimiters.delete(key);
      }
    }
  }

  private cleanupSuspiciousAttempts(): void {
    // Reset suspicious attempt counts every hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    // Simple cleanup - in production you'd want more sophisticated tracking
    if (Date.now() % (60 * 60 * 1000) < 60000) { // Roughly every hour
      this.suspiciousAttempts.clear();
    }
  }

  // Configuration
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logSecurityEvent('config_updated', { config: this.config });
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  // Destroy and cleanup
  destroy(): void {
    this.rateLimiters.clear();
    this.blockedIPs.clear();
    this.suspiciousAttempts.clear();
    this.clearSensitiveMemory(this.encryptionKey);
  }
}

// Singleton instance
export const securityManager = new SecurityManager();

// Utility functions
export const sanitizeInput = securityManager.sanitizeInput.bind(securityManager);
export const validateFilePath = securityManager.validateFilePath.bind(securityManager);
export const encryptApiKey = securityManager.encryptApiKey.bind(securityManager);
export const decryptApiKey = securityManager.decryptApiKey.bind(securityManager);
export const generateSecureToken = securityManager.generateSecureToken.bind(securityManager);
export const validateEmail = securityManager.validateEmail.bind(securityManager);
export const validateApiKey = securityManager.validateApiKey.bind(securityManager);
export const checkRateLimit = securityManager.checkRateLimit.bind(securityManager);

// React hook for security utilities
export const useSecurity = () => {
  return {
    sanitizeInput,
    validateFilePath,
    validateEmail,
    validateApiKey: securityManager.validateApiKey.bind(securityManager),
    validateLicenseKey: securityManager.validateLicenseKey.bind(securityManager),
    generateSecureToken,
    checkRateLimit: securityManager.checkRateLimit.bind(securityManager),
    isBlocked: securityManager.isBlocked.bind(securityManager),
    getSecurityHeaders: securityManager.getSecurityHeaders.bind(securityManager)
  };
};