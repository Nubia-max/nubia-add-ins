import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { securityManager } from '../utils/security';
import { analytics } from './analytics';

export interface IpcSecurityOptions {
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  validateOrigin?: boolean;
  requireAuth?: boolean;
  sanitizeArgs?: boolean;
  logRequests?: boolean;
}

interface SecureIpcHandler {
  channel: string;
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any;
  options: IpcSecurityOptions;
}

class IpcSecurityManager {
  private handlers = new Map<string, SecureIpcHandler>();
  private sessions = new Map<string, { windowId: number; authenticated: boolean; lastActivity: number }>();
  private defaultOptions: IpcSecurityOptions = {
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100
    },
    validateOrigin: true,
    requireAuth: false,
    sanitizeArgs: true,
    logRequests: false
  };

  registerSecureHandler(
    channel: string,
    handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
    options: Partial<IpcSecurityOptions> = {}
  ): void {
    const secureOptions = { ...this.defaultOptions, ...options };
    
    this.handlers.set(channel, {
      channel,
      handler,
      options: secureOptions
    });

    ipcMain.handle(channel, async (event: IpcMainInvokeEvent, ...args: any[]) => {
      try {
        // Security validation
        const validationResult = await this.validateRequest(event, channel, args, secureOptions);
        if (!validationResult.allowed) {
          throw new Error(`IPC request denied: ${validationResult.reason}`);
        }

        // Sanitize arguments if enabled
        let sanitizedArgs = args;
        if (secureOptions.sanitizeArgs) {
          sanitizedArgs = this.sanitizeArguments(args);
        }

        // Log request if enabled
        if (secureOptions.logRequests) {
          this.logIpcRequest(event, channel, sanitizedArgs);
        }

        // Execute handler
        const result = await handler(event, ...sanitizedArgs);
        
        // Update session activity
        this.updateSessionActivity(event);

        return result;
      } catch (error) {
        this.logSecurityEvent('ipc_handler_error', {
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
          webContentsId: event.sender.id
        });

        // Track security violation
        analytics.error(error as Error, { 
          context: 'ipc_security',
          channel,
          webContentsId: event.sender.id 
        });

        throw error;
      }
    });
  }

  private async validateRequest(
    event: IpcMainInvokeEvent,
    channel: string,
    args: any[],
    options: IpcSecurityOptions
  ): Promise<{ allowed: boolean; reason?: string }> {
    const webContentsId = event.sender.id;
    const sessionId = this.getSessionId(event);

    // Rate limiting
    if (options.rateLimit) {
      const identifier = `${webContentsId}:${channel}`;
      const rateLimitOk = securityManager.checkRateLimit(
        identifier,
        options.rateLimit.maxRequests,
        options.rateLimit.windowMs
      );

      if (!rateLimitOk) {
        this.logSecurityEvent('ipc_rate_limit_exceeded', {
          channel,
          webContentsId,
          sessionId
        });
        return { allowed: false, reason: 'Rate limit exceeded' };
      }
    }

    // Origin validation
    if (options.validateOrigin) {
      const isValidOrigin = this.validateOrigin(event);
      if (!isValidOrigin) {
        this.logSecurityEvent('ipc_invalid_origin', {
          channel,
          webContentsId,
          url: event.sender.getURL()
        });
        return { allowed: false, reason: 'Invalid origin' };
      }
    }

    // Authentication check
    if (options.requireAuth) {
      const session = this.sessions.get(sessionId);
      if (!session || !session.authenticated) {
        this.logSecurityEvent('ipc_authentication_required', {
          channel,
          webContentsId,
          sessionId
        });
        return { allowed: false, reason: 'Authentication required' };
      }
    }

    // Argument validation
    const argsValid = this.validateArguments(args, channel);
    if (!argsValid) {
      this.logSecurityEvent('ipc_invalid_arguments', {
        channel,
        webContentsId,
        argsLength: args.length
      });
      return { allowed: false, reason: 'Invalid arguments' };
    }

    return { allowed: true };
  }

  private validateOrigin(event: IpcMainInvokeEvent): boolean {
    const url = event.sender.getURL();
    
    // Allow file:// protocol for Electron apps
    if (url.startsWith('file://')) {
      return true;
    }

    // Allow localhost in development
    if (url.startsWith('http://localhost') || url.startsWith('https://localhost')) {
      return true;
    }

    // In production, validate against allowed domains
    const allowedDomains = [
      'https://app.nubia.ai',
      'https://nubia.ai'
    ];

    return allowedDomains.some(domain => url.startsWith(domain));
  }

  private validateArguments(args: any[], channel: string): boolean {
    try {
      // Basic validation - ensure arguments are serializable
      JSON.stringify(args);

      // Check for potentially dangerous content
      for (const arg of args) {
        if (!this.isArgumentSafe(arg)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private isArgumentSafe(arg: any): boolean {
    if (arg === null || arg === undefined) {
      return true;
    }

    if (typeof arg === 'string') {
      // Check for script injection attempts
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /on\w+\s*=/i
      ];

      return !dangerousPatterns.some(pattern => pattern.test(arg));
    }

    if (typeof arg === 'object' && !Array.isArray(arg)) {
      // Recursively check object properties
      for (const value of Object.values(arg)) {
        if (!this.isArgumentSafe(value)) {
          return false;
        }
      }
    }

    if (Array.isArray(arg)) {
      // Recursively check array elements
      return arg.every(item => this.isArgumentSafe(item));
    }

    return true;
  }

  private sanitizeArguments(args: any[]): any[] {
    return args.map(arg => this.sanitizeArgument(arg));
  }

  private sanitizeArgument(arg: any): any {
    if (arg === null || arg === undefined) {
      return arg;
    }

    if (typeof arg === 'string') {
      return securityManager.sanitizeInput(arg, {
        maxLength: 10000,
        stripScripts: true,
        allowHTML: false
      });
    }

    if (typeof arg === 'object' && !Array.isArray(arg)) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(arg)) {
        // Sanitize both key and value
        const sanitizedKey = securityManager.sanitizeInput(key, { allowHTML: false });
        sanitized[sanitizedKey] = this.sanitizeArgument(value);
      }
      return sanitized;
    }

    if (Array.isArray(arg)) {
      return arg.map(item => this.sanitizeArgument(item));
    }

    return arg;
  }

  private getSessionId(event: IpcMainInvokeEvent): string {
    const webContentsId = event.sender.id;
    let sessionId = '';

    for (const [id, session] of this.sessions.entries()) {
      if (session.windowId === webContentsId) {
        sessionId = id;
        break;
      }
    }

    if (!sessionId) {
      sessionId = securityManager.generateSecureToken(16);
      this.sessions.set(sessionId, {
        windowId: webContentsId,
        authenticated: false,
        lastActivity: Date.now()
      });
    }

    return sessionId;
  }

  private updateSessionActivity(event: IpcMainInvokeEvent): void {
    const sessionId = this.getSessionId(event);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  authenticateSession(webContentsId: number): void {
    for (const session of this.sessions.values()) {
      if (session.windowId === webContentsId) {
        session.authenticated = true;
        break;
      }
    }
  }

  deauthenticateSession(webContentsId: number): void {
    for (const session of this.sessions.values()) {
      if (session.windowId === webContentsId) {
        session.authenticated = false;
        break;
      }
    }
  }

  private logIpcRequest(event: IpcMainInvokeEvent, channel: string, args: any[]): void {
    console.log('IPC Request:', {
      timestamp: new Date().toISOString(),
      channel,
      webContentsId: event.sender.id,
      argsCount: args.length,
      url: event.sender.getURL()
    });
  }

  private logSecurityEvent(eventType: string, details: any): void {
    console.warn('IPC Security Event:', {
      timestamp: new Date().toISOString(),
      type: eventType,
      ...details
    });

    // Track security events
    analytics.track('ipc_security_event', {
      event_type: eventType,
      ...details
    });
  }

  // Cleanup expired sessions
  private cleanupSessions(): void {
    const now = Date.now();
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > sessionTimeout) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Remove handlers
  removeHandler(channel: string): void {
    if (this.handlers.has(channel)) {
      ipcMain.removeHandler(channel);
      this.handlers.delete(channel);
    }
  }

  // Get registered handlers
  getHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  // Block specific web contents
  blockWebContents(webContentsId: number, reason: string): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.windowId === webContentsId) {
        this.sessions.delete(sessionId);
        break;
      }
    }

    this.logSecurityEvent('web_contents_blocked', {
      webContentsId,
      reason
    });
  }

  // Initialize cleanup timer
  init(): void {
    // Cleanup expired sessions every 10 minutes
    setInterval(() => {
      this.cleanupSessions();
    }, 10 * 60 * 1000);

    this.logSecurityEvent('ipc_security_initialized', {
      handlersCount: this.handlers.size
    });
  }

  // Destroy and cleanup
  destroy(): void {
    // Remove all handlers
    for (const channel of this.handlers.keys()) {
      ipcMain.removeHandler(channel);
    }

    this.handlers.clear();
    this.sessions.clear();

    this.logSecurityEvent('ipc_security_destroyed', {});
  }
}

// Singleton instance
export const ipcSecurity = new IpcSecurityManager();

// Convenience function for registering secure handlers
export const registerSecureIpcHandler = (
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
  options?: Partial<IpcSecurityOptions>
): void => {
  ipcSecurity.registerSecureHandler(channel, handler, options);
};

// Security decorators
export const requireAuth = (options?: Partial<IpcSecurityOptions>) => ({
  ...options,
  requireAuth: true
});

export const rateLimit = (maxRequests: number, windowMs: number = 60 * 1000) => (options?: Partial<IpcSecurityOptions>) => ({
  ...options,
  rateLimit: { maxRequests, windowMs }
});

export const sanitizeInput = (options?: Partial<IpcSecurityOptions>) => ({
  ...options,
  sanitizeArgs: true
});

export const logRequests = (options?: Partial<IpcSecurityOptions>) => ({
  ...options,
  logRequests: true
});