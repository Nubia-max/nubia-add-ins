import { v4 as uuidv4 } from 'uuid';
import { environment } from '../config/environment';
import Store from 'electron-store';

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  userId?: string;
  timestamp?: Date;
  sessionId?: string;
}

export interface UserProperties {
  userId: string;
  appVersion: string;
  platform: string;
  locale: string;
  timezone: string;
  firstSeen: Date;
  lastSeen: Date;
  totalSessions: number;
  isPremium: boolean;
  subscription?: string;
}

export interface SessionInfo {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  events: AnalyticsEvent[];
  errors: number;
  crashes: number;
}

export interface AnalyticsConfig {
  enabled: boolean;
  trackingConsent: boolean;
  anonymized: boolean;
  batchSize: number;
  flushInterval: number; // seconds
  retryAttempts: number;
  endpoint: string;
}

class AnalyticsService {
  private store: Store;
  private config: AnalyticsConfig;
  private userId: string;
  private sessionId: string;
  private sessionStart: Date;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    this.store = new Store({
      name: 'analytics',
      encryptionKey: 'nubia-analytics-2024'
    });

    this.config = this.loadConfig();
    this.userId = this.getUserId();
    this.sessionId = this.createSessionId();
    this.sessionStart = new Date();

    this.setupEventListeners();
    this.startSession();
    this.scheduleFlush();
  }

  private loadConfig(): AnalyticsConfig {
    const stored = this.store.get('config') as Partial<AnalyticsConfig>;
    
    return {
      enabled: environment.isAnalyticsEnabled(),
      trackingConsent: stored?.trackingConsent ?? false,
      anonymized: stored?.anonymized ?? true,
      batchSize: 50,
      flushInterval: 30, // seconds
      retryAttempts: 3,
      endpoint: environment.isDevelopment() 
        ? 'http://localhost:3001/analytics' 
        : 'https://api.nubia.ai/v1/analytics',
      ...stored
    };
  }

  private getUserId(): string {
    let userId = this.store.get('userId') as string;
    if (!userId) {
      userId = uuidv4();
      this.store.set('userId', userId);
    }
    return userId;
  }

  private createSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventListeners(): void {
    // Online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushEvents(); // Send queued events when coming online
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Page visibility for session management
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.track('app_hidden');
      } else {
        this.track('app_visible');
      }
    });

    // Unload event to end session
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
  }

  // Public API
  async track(event: string, properties?: Record<string, any>): Promise<void> {
    if (!this.shouldTrack()) {
      return;
    }

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties: this.sanitizeProperties(properties),
      userId: this.config.anonymized ? this.hashUserId(this.userId) : this.userId,
      timestamp: new Date(),
      sessionId: this.sessionId
    };

    this.eventQueue.push(analyticsEvent);

    // Flush immediately for critical events
    if (this.isCriticalEvent(event)) {
      await this.flushEvents();
    }

    // Flush if queue is full
    if (this.eventQueue.length >= this.config.batchSize) {
      await this.flushEvents();
    }
  }

  async identify(properties: Partial<UserProperties>): Promise<void> {
    if (!this.shouldTrack()) {
      return;
    }

    const userProps: UserProperties = {
      userId: this.userId,
      appVersion: environment.getAppVersion(),
      platform: environment.getPlatform(),
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      firstSeen: this.store.get('firstSeen') as Date || new Date(),
      lastSeen: new Date(),
      totalSessions: (this.store.get('totalSessions') as number || 0) + 1,
      isPremium: false,
      ...properties
    };

    // Update stored user properties
    this.store.set('userProperties', userProps);
    this.store.set('lastSeen', userProps.lastSeen);
    this.store.set('totalSessions', userProps.totalSessions);

    if (!this.store.get('firstSeen')) {
      this.store.set('firstSeen', userProps.firstSeen);
    }

    await this.track('user_identified', userProps);
  }

  async page(name: string, properties?: Record<string, any>): Promise<void> {
    await this.track('page_view', {
      page: name,
      ...properties
    });
  }

  async error(error: Error, context?: Record<string, any>): Promise<void> {
    await this.track('error_occurred', {
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name,
      ...context
    });
  }

  async performance(metric: string, value: number, unit: string = 'ms'): Promise<void> {
    await this.track('performance_metric', {
      metric,
      value,
      unit,
      timestamp: Date.now()
    });
  }

  // Feature tracking
  async feature(featureName: string, action: 'used' | 'enabled' | 'disabled', properties?: Record<string, any>): Promise<void> {
    await this.track('feature_interaction', {
      feature: featureName,
      action,
      ...properties
    });
  }

  // Excel automation specific tracking
  async excelTask(taskType: string, mode: 'visual' | 'background', success: boolean, duration?: number): Promise<void> {
    await this.track('excel_task_executed', {
      task_type: taskType,
      execution_mode: mode,
      success,
      duration_ms: duration
    });
  }

  async llmQuery(provider: string, tokens: number, success: boolean, responseTime?: number): Promise<void> {
    await this.track('llm_query', {
      provider,
      tokens_used: tokens,
      success,
      response_time_ms: responseTime
    });
  }

  // Session management
  private startSession(): void {
    this.track('session_start', {
      app_version: environment.getAppVersion(),
      platform: environment.getPlatform(),
      environment: environment.isDevelopment() ? 'development' : 'production'
    });
  }

  private endSession(): void {
    const duration = Date.now() - this.sessionStart.getTime();
    this.track('session_end', {
      duration_ms: duration,
      events_count: this.eventQueue.length
    });
    
    // Flush remaining events
    this.flushEvents();
  }

  // Configuration
  getConfig(): AnalyticsConfig {
    return { ...this.config };
  }

  async setConfig(newConfig: Partial<AnalyticsConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.store.set('config', this.config);

    // Restart flush timer if interval changed
    if (this.flushTimer && newConfig.flushInterval) {
      clearInterval(this.flushTimer);
      this.scheduleFlush();
    }

    await this.track('analytics_config_updated', {
      enabled: this.config.enabled,
      anonymized: this.config.anonymized,
      consent: this.config.trackingConsent
    });
  }

  async setTrackingConsent(consent: boolean): Promise<void> {
    await this.setConfig({ trackingConsent: consent });
    
    if (consent) {
      await this.track('tracking_consent_granted');
    } else {
      await this.track('tracking_consent_revoked');
      // Clear stored data if consent revoked
      this.clearStoredData();
    }
  }

  // Utility methods
  private shouldTrack(): boolean {
    return this.config.enabled && 
           this.config.trackingConsent && 
           !environment.isTesting();
  }

  private isCriticalEvent(event: string): boolean {
    const criticalEvents = [
      'session_start',
      'session_end', 
      'error_occurred',
      'crash_detected',
      'license_validation_failed'
    ];
    return criticalEvents.includes(event);
  }

  private sanitizeProperties(properties?: Record<string, any>): Record<string, any> {
    if (!properties) return {};

    const sanitized: Record<string, any> = {};
    
    Object.entries(properties).forEach(([key, value]) => {
      // Skip sensitive data
      if (this.isSensitiveKey(key)) {
        return;
      }

      // Truncate long strings
      if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '...';
      } else if (value !== null && value !== undefined) {
        sanitized[key] = value;
      }
    });

    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'password', 'token', 'key', 'secret', 'auth',
      'email', 'phone', 'ssn', 'credit_card',
      'api_key', 'private_key', 'access_token'
    ];
    
    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
  }

  private hashUserId(userId: string): string {
    // Simple hash for anonymization
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `anon_${Math.abs(hash).toString(36)}`;
  }

  // Event flushing
  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.config.flushInterval * 1000);
  }

  private async flushEvents(): Promise<void> {
    if (this.eventQueue.length === 0 || !this.isOnline || !this.shouldTrack()) {
      return;
    }

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      await this.sendEvents(eventsToSend);
    } catch (error) {
      console.warn('Failed to send analytics events:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...eventsToSend);
      
      // Limit queue size to prevent memory issues
      if (this.eventQueue.length > this.config.batchSize * 3) {
        this.eventQueue = this.eventQueue.slice(0, this.config.batchSize);
      }
    }
  }

  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    const payload = {
      events,
      user_id: this.config.anonymized ? this.hashUserId(this.userId) : this.userId,
      session_id: this.sessionId,
      app_version: environment.getAppVersion(),
      platform: environment.getPlatform(),
      timestamp: new Date().toISOString()
    };

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Nubia/${environment.getAppVersion()}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Analytics request failed: ${response.status}`);
    }
  }

  // GDPR Compliance
  async exportUserData(): Promise<any> {
    return {
      userId: this.userId,
      userProperties: this.store.get('userProperties'),
      config: this.config,
      sessionInfo: {
        sessionId: this.sessionId,
        startTime: this.sessionStart,
        eventsCount: this.eventQueue.length
      },
      storedData: this.store.store
    };
  }

  clearStoredData(): void {
    this.store.clear();
    this.eventQueue = [];
    this.userId = this.createSessionId(); // Generate new anonymous ID
  }

  // Statistics
  getAnalyticsStats(): {
    queuedEvents: number;
    sessionDuration: number;
    userId: string;
    sessionId: string;
    isOnline: boolean;
    config: AnalyticsConfig;
  } {
    return {
      queuedEvents: this.eventQueue.length,
      sessionDuration: Date.now() - this.sessionStart.getTime(),
      userId: this.config.anonymized ? this.hashUserId(this.userId) : this.userId,
      sessionId: this.sessionId,
      isOnline: this.isOnline,
      config: this.config
    };
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.endSession();
  }
}

// Singleton instance
export const analytics = new AnalyticsService();

// Convenience methods
export const track = analytics.track.bind(analytics);
export const identify = analytics.identify.bind(analytics);
export const page = analytics.page.bind(analytics);
export const error = analytics.error.bind(analytics);
export const performance = analytics.performance.bind(analytics);
export const feature = analytics.feature.bind(analytics);
export const excelTask = analytics.excelTask.bind(analytics);
export const llmQuery = analytics.llmQuery.bind(analytics);

// React hook for analytics
export const useAnalytics = () => {
  return {
    track,
    identify,
    page,
    error,
    performance,
    feature,
    excelTask,
    llmQuery,
    setTrackingConsent: analytics.setTrackingConsent.bind(analytics),
    getConfig: analytics.getConfig.bind(analytics),
    setConfig: analytics.setConfig.bind(analytics),
    getStats: analytics.getAnalyticsStats.bind(analytics),
    exportData: analytics.exportUserData.bind(analytics),
    clearData: analytics.clearStoredData.bind(analytics)
  };
};