import { app } from 'electron';
import Store from 'electron-store';

export interface EnvironmentConfig {
  isDevelopment: boolean;
  isProduction: boolean;
  isTesting: boolean;
  apiBaseUrl: string;
  automationServiceUrl: string;
  updateServerUrl: string;
  analyticsEnabled: boolean;
  errorReportingEnabled: boolean;
  debugMode: boolean;
  appVersion: string;
  buildNumber: string;
  platform: string;
  sentryDsn?: string;
  mixpanelToken?: string;
  licenseServerUrl: string;
}

class EnvironmentManager {
  private config: EnvironmentConfig;
  private store: Store;

  constructor() {
    this.store = new Store({
      name: 'environment',
      encryptionKey: 'nubia-env-key-2024'
    });

    this.config = this.initializeConfig();
  }

  private initializeConfig(): EnvironmentConfig {
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.ELECTRON_IS_DEV === '1';
    const isProduction = process.env.NODE_ENV === 'production';
    const isTesting = process.env.NODE_ENV === 'test';

    return {
      isDevelopment,
      isProduction,
      isTesting,
      
      // API Configuration
      apiBaseUrl: this.getApiUrl(),
      automationServiceUrl: this.getAutomationServiceUrl(),
      updateServerUrl: this.getUpdateServerUrl(),
      licenseServerUrl: this.getLicenseServerUrl(),
      
      // Feature Flags
      analyticsEnabled: this.getFeatureFlag('analytics', isProduction),
      errorReportingEnabled: this.getFeatureFlag('errorReporting', isProduction),
      debugMode: this.getFeatureFlag('debug', isDevelopment),
      
      // App Information
      appVersion: this.initAppVersion(),
      buildNumber: this.initBuildNumber(),
      platform: process.platform,
      
      // External Services
      sentryDsn: process.env.SENTRY_DSN,
      mixpanelToken: process.env.MIXPANEL_TOKEN || 
                    (isProduction ? 'prod_mixpanel_token' : 'dev_mixpanel_token')
    };
  }

  private getApiUrl(): string {
    // Check for environment variable first
    if (process.env.NUBIA_API_URL) {
      return process.env.NUBIA_API_URL;
    }

    // Check for stored override
    const storedUrl = this.store.get('apiUrl') as string;
    if (storedUrl) {
      return storedUrl;
    }

    // Default based on environment
    if (this.config?.isDevelopment) {
      return 'http://localhost:3001/api';
    } else {
      return 'https://api.nubia.ai/v1';
    }
  }

  private getAutomationServiceUrl(): string {
    if (process.env.NUBIA_AUTOMATION_URL) {
      return process.env.NUBIA_AUTOMATION_URL;
    }

    const storedUrl = this.store.get('automationUrl') as string;
    if (storedUrl) {
      return storedUrl;
    }

    if (this.config?.isDevelopment) {
      return 'http://localhost:8000';
    } else {
      return 'http://localhost:8000'; // Production still uses local service
    }
  }

  private getUpdateServerUrl(): string {
    if (process.env.NUBIA_UPDATE_URL) {
      return process.env.NUBIA_UPDATE_URL;
    }

    if (this.config?.isDevelopment) {
      return 'http://localhost:3002/updates';
    } else {
      return 'https://updates.nubia.ai/releases';
    }
  }

  private getLicenseServerUrl(): string {
    if (process.env.NUBIA_LICENSE_URL) {
      return process.env.NUBIA_LICENSE_URL;
    }

    if (this.config?.isDevelopment) {
      return 'http://localhost:3003/license';
    } else {
      return 'https://license.nubia.ai/v1';
    }
  }

  private getFeatureFlag(flagName: string, defaultValue: boolean): boolean {
    // Check environment variable
    const envVar = process.env[`NUBIA_${flagName.toUpperCase()}`];
    if (envVar !== undefined) {
      return envVar === 'true' || envVar === '1';
    }

    // Check stored preference
    const storedValue = this.store.get(`features.${flagName}`) as boolean;
    if (storedValue !== undefined) {
      return storedValue;
    }

    return defaultValue;
  }

  private initAppVersion(): string {
    try {
      return app.getVersion();
    } catch (error) {
      return process.env.npm_package_version || '1.0.0';
    }
  }

  private initBuildNumber(): string {
    return process.env.BUILD_NUMBER || 
           process.env.GITHUB_RUN_NUMBER || 
           Date.now().toString();
  }

  // Public getters
  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  isDevelopment(): boolean {
    return this.config.isDevelopment;
  }

  isProduction(): boolean {
    return this.config.isProduction;
  }

  isTesting(): boolean {
    return this.config.isTesting;
  }

  getApiUrl(): string {
    return this.config.apiBaseUrl;
  }

  getAutomationServiceUrl(): string {
    return this.config.automationServiceUrl;
  }

  getUpdateServerUrl(): string {
    return this.config.updateServerUrl;
  }

  getLicenseServerUrl(): string {
    return this.config.licenseServerUrl;
  }

  isAnalyticsEnabled(): boolean {
    return this.config.analyticsEnabled;
  }

  isErrorReportingEnabled(): boolean {
    return this.config.errorReportingEnabled;
  }

  isDebugMode(): boolean {
    return this.config.debugMode;
  }

  getAppVersion(): string {
    return this.config.appVersion;
  }

  getBuildNumber(): string {
    return this.config.buildNumber;
  }

  getPlatform(): string {
    return this.config.platform;
  }

  getSentryDsn(): string | undefined {
    return this.config.sentryDsn;
  }

  getMixpanelToken(): string | undefined {
    return this.config.mixpanelToken;
  }

  // Configuration setters (for user preferences)
  setApiUrl(url: string): void {
    this.store.set('apiUrl', url);
    this.config.apiBaseUrl = url;
  }

  setAutomationServiceUrl(url: string): void {
    this.store.set('automationUrl', url);
    this.config.automationServiceUrl = url;
  }

  setFeatureFlag(flagName: string, enabled: boolean): void {
    this.store.set(`features.${flagName}`, enabled);
    
    // Update config
    switch (flagName) {
      case 'analytics':
        this.config.analyticsEnabled = enabled;
        break;
      case 'errorReporting':
        this.config.errorReportingEnabled = enabled;
        break;
      case 'debug':
        this.config.debugMode = enabled;
        break;
    }
  }

  // Reset to defaults
  resetToDefaults(): void {
    this.store.clear();
    this.config = this.initializeConfig();
  }

  // Environment-specific helpers
  getLogLevel(): 'error' | 'warn' | 'info' | 'debug' {
    if (this.isDebugMode()) return 'debug';
    if (this.isDevelopment()) return 'info';
    return 'warn';
  }

  shouldShowDevTools(): boolean {
    return this.isDevelopment() || this.isDebugMode();
  }

  getTimeouts(): { api: number; automation: number; update: number } {
    return {
      api: this.isDevelopment() ? 30000 : 10000,
      automation: this.isDevelopment() ? 60000 : 30000,
      update: 15000
    };
  }

  // Security configuration
  getSecurityConfig(): {
    nodeIntegration: boolean;
    contextIsolation: boolean;
    enableRemoteModule: boolean;
    webSecurity: boolean;
  } {
    return {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: this.isProduction()
    };
  }

  // CSP (Content Security Policy) for production
  getContentSecurityPolicy(): string {
    if (this.isDevelopment()) {
      return "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss: http: https:;";
    }

    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss: https://api.nubia.ai https://updates.nubia.ai https://license.nubia.ai",
      "frame-src 'none'",
      "object-src 'none'"
    ].join('; ');
  }

  // Rate limiting configuration
  getRateLimits(): { 
    apiCalls: number; 
    automationTasks: number; 
    licenseChecks: number 
  } {
    return {
      apiCalls: this.isDevelopment() ? 1000 : 100, // per minute
      automationTasks: this.isDevelopment() ? 100 : 10, // per minute  
      licenseChecks: 10 // per hour
    };
  }

  // Error reporting configuration
  getErrorReportingConfig(): {
    enabled: boolean;
    sampleRate: number;
    environment: string;
  } {
    return {
      enabled: this.isErrorReportingEnabled(),
      sampleRate: this.isDevelopment() ? 1.0 : 0.1,
      environment: this.isDevelopment() ? 'development' : 'production'
    };
  }

  // Analytics configuration  
  getAnalyticsConfig(): {
    enabled: boolean;
    sampleRate: number;
    trackingId?: string;
  } {
    return {
      enabled: this.isAnalyticsEnabled(),
      sampleRate: this.isDevelopment() ? 1.0 : 0.8,
      trackingId: this.getMixpanelToken()
    };
  }
}

// Singleton instance
export const environment = new EnvironmentManager();

// Convenience exports
export const {
  isDevelopment,
  isProduction,
  isTesting,
  getConfig,
  getApiUrl,
  getAutomationServiceUrl,
  getUpdateServerUrl,
  getLicenseServerUrl,
  isAnalyticsEnabled,
  isErrorReportingEnabled,
  isDebugMode,
  getAppVersion,
  getBuildNumber,
  getPlatform,
  getSentryDsn,
  getMixpanelToken,
  getLogLevel,
  shouldShowDevTools,
  getTimeouts,
  getSecurityConfig,
  getContentSecurityPolicy,
  getRateLimits,
  getErrorReportingConfig,
  getAnalyticsConfig
} = environment;