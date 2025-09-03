import { app } from 'electron';
import Store from 'electron-store';
import * as crypto from 'crypto';
import { environment } from '../config/environment';
import { analytics } from './analytics';

export interface LicenseInfo {
  key: string;
  email: string;
  purchaseDate: Date;
  expiryDate: Date | null;
  maxDevices: number;
  deviceId: string;
  type: 'trial' | 'personal' | 'professional' | 'enterprise';
  features: {
    maxTasks: number;
    maxTokens: number;
    cloudSync: boolean;
    prioritySupport: boolean;
    advancedAutomation: boolean;
    customTemplates: boolean;
    teamCollaboration: boolean;
    apiAccess: boolean;
  };
}

export interface TrialInfo {
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  isExpired: boolean;
  tasksUsed: number;
  tokensUsed: number;
}

export interface LicenseValidationResult {
  isValid: boolean;
  error?: string;
  licenseInfo?: LicenseInfo;
  trialInfo?: TrialInfo;
  needsActivation?: boolean;
  isOnline?: boolean;
}

class LicensingService {
  private store: Store;
  private deviceId: string;
  private currentLicense: LicenseInfo | null = null;
  private trialInfo: TrialInfo | null = null;
  private lastValidation: Date | null = null;
  private validationCache: LicenseValidationResult | null = null;
  private validationTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.store = new Store({
      name: 'licensing',
      encryptionKey: 'nubia-license-2024'
    });

    this.deviceId = this.getOrCreateDeviceId();
    this.loadStoredLicense();
    this.initializeTrial();
    this.startPeriodicValidation();
  }

  private getOrCreateDeviceId(): string {
    let deviceId = this.store.get('deviceId') as string;
    
    if (!deviceId) {
      const machineId = crypto.createHash('sha256')
        .update(require('os').hostname() + require('os').platform() + require('os').arch())
        .digest('hex');
      deviceId = `nubia_${machineId.substring(0, 16)}`;
      this.store.set('deviceId', deviceId);
    }
    
    return deviceId;
  }

  private loadStoredLicense(): void {
    const stored = this.store.get('licenseInfo') as LicenseInfo | null;
    if (stored) {
      this.currentLicense = {
        ...stored,
        purchaseDate: new Date(stored.purchaseDate),
        expiryDate: stored.expiryDate ? new Date(stored.expiryDate) : null
      };
    }
  }

  private initializeTrial(): void {
    if (this.currentLicense) {
      return;
    }

    let trial = this.store.get('trialInfo') as any;
    
    if (!trial) {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      trial = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        tasksUsed: 0,
        tokensUsed: 0
      };

      this.store.set('trialInfo', trial);
      analytics.track('trial_started');
    }

    this.trialInfo = {
      startDate: new Date(trial.startDate),
      endDate: new Date(trial.endDate),
      daysRemaining: Math.max(0, Math.ceil((new Date(trial.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))),
      isExpired: new Date(trial.endDate) < new Date(),
      tasksUsed: trial.tasksUsed || 0,
      tokensUsed: trial.tokensUsed || 0
    };
  }

  private startPeriodicValidation(): void {
    this.validationTimer = setInterval(async () => {
      if (this.currentLicense) {
        await this.validateLicense(false);
      }
    }, 24 * 60 * 60 * 1000); // Daily validation
  }

  async activateLicense(licenseKey: string, email: string): Promise<LicenseValidationResult> {
    try {
      const validation = await this.validateLicenseOnline(licenseKey, email);
      
      if (validation.isValid && validation.licenseInfo) {
        this.currentLicense = validation.licenseInfo;
        this.store.set('licenseInfo', {
          ...validation.licenseInfo,
          purchaseDate: validation.licenseInfo.purchaseDate.toISOString(),
          expiryDate: validation.licenseInfo.expiryDate?.toISOString() || null
        });

        // Clear trial data
        this.store.delete('trialInfo');
        this.trialInfo = null;
        
        this.validationCache = validation;
        this.lastValidation = new Date();

        await analytics.track('license_activated', {
          license_type: validation.licenseInfo.type,
          max_devices: validation.licenseInfo.maxDevices
        });

        return validation;
      }

      await analytics.track('license_activation_failed', {
        error: validation.error
      });

      return validation;
    } catch (error) {
      const result = {
        isValid: false,
        error: 'Failed to connect to licensing server',
        isOnline: false
      };

      await analytics.error(error as Error, { context: 'license_activation' });
      return result;
    }
  }

  private async validateLicenseOnline(licenseKey: string, email: string): Promise<LicenseValidationResult> {
    const payload = {
      license_key: licenseKey,
      email: email,
      device_id: this.deviceId,
      app_version: environment.getAppVersion(),
      platform: environment.getPlatform()
    };

    const response = await fetch(`${environment.getLicenseServerUrl()}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Nubia/${environment.getAppVersion()}`
      },
      body: JSON.stringify(payload),
      timeout: 15000
    });

    if (!response.ok) {
      if (response.status === 400) {
        return { isValid: false, error: 'Invalid license key or email', isOnline: true };
      } else if (response.status === 403) {
        return { isValid: false, error: 'License key is not valid for this device', isOnline: true };
      } else if (response.status === 429) {
        return { isValid: false, error: 'Too many validation attempts. Please try again later.', isOnline: true };
      } else {
        return { isValid: false, error: 'License validation failed', isOnline: true };
      }
    }

    const data = await response.json();

    const licenseInfo: LicenseInfo = {
      key: licenseKey,
      email: email,
      purchaseDate: new Date(data.purchase_date),
      expiryDate: data.expiry_date ? new Date(data.expiry_date) : null,
      maxDevices: data.max_devices,
      deviceId: this.deviceId,
      type: data.license_type,
      features: {
        maxTasks: data.features.max_tasks || -1,
        maxTokens: data.features.max_tokens || -1,
        cloudSync: data.features.cloud_sync || false,
        prioritySupport: data.features.priority_support || false,
        advancedAutomation: data.features.advanced_automation || false,
        customTemplates: data.features.custom_templates || false,
        teamCollaboration: data.features.team_collaboration || false,
        apiAccess: data.features.api_access || false
      }
    };

    return {
      isValid: true,
      licenseInfo: licenseInfo,
      isOnline: true
    };
  }

  async validateLicense(showOfflineWarning: boolean = true): Promise<LicenseValidationResult> {
    if (!this.currentLicense) {
      return this.validateTrial();
    }

    // Check cached validation first
    if (this.validationCache && this.lastValidation) {
      const hoursSinceValidation = (Date.now() - this.lastValidation.getTime()) / (1000 * 60 * 60);
      if (hoursSinceValidation < 24) {
        return this.validationCache;
      }
    }

    // Check expiry date locally first
    if (this.currentLicense.expiryDate && this.currentLicense.expiryDate < new Date()) {
      const result = {
        isValid: false,
        error: 'License has expired',
        licenseInfo: this.currentLicense
      };

      await analytics.track('license_expired', {
        license_type: this.currentLicense.type,
        expiry_date: this.currentLicense.expiryDate
      });

      return result;
    }

    try {
      // Online validation
      const result = await this.validateLicenseOnline(this.currentLicense.key, this.currentLicense.email);
      this.validationCache = result;
      this.lastValidation = new Date();
      return result;
    } catch (error) {
      // Offline validation - trust local license for up to 7 days
      const daysSinceValidation = this.lastValidation 
        ? (Date.now() - this.lastValidation.getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      if (daysSinceValidation < 7) {
        if (showOfflineWarning) {
          console.warn('License validation failed, using offline validation');
        }

        return {
          isValid: true,
          licenseInfo: this.currentLicense,
          isOnline: false
        };
      } else {
        await analytics.error(error as Error, { context: 'license_validation' });
        
        return {
          isValid: false,
          error: 'Cannot validate license - please check your internet connection',
          licenseInfo: this.currentLicense,
          needsActivation: true,
          isOnline: false
        };
      }
    }
  }

  private validateTrial(): LicenseValidationResult {
    if (!this.trialInfo) {
      this.initializeTrial();
    }

    if (!this.trialInfo) {
      return { isValid: false, error: 'Failed to initialize trial' };
    }

    // Update days remaining
    this.trialInfo.daysRemaining = Math.max(0, Math.ceil((this.trialInfo.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    this.trialInfo.isExpired = this.trialInfo.endDate < new Date();

    if (this.trialInfo.isExpired) {
      return {
        isValid: false,
        error: 'Trial period has expired',
        trialInfo: this.trialInfo
      };
    }

    // Check usage limits
    const trialLimits = this.getTrialLimits();
    if (this.trialInfo.tasksUsed >= trialLimits.maxTasks) {
      return {
        isValid: false,
        error: 'Trial task limit reached',
        trialInfo: this.trialInfo
      };
    }

    if (this.trialInfo.tokensUsed >= trialLimits.maxTokens) {
      return {
        isValid: false,
        error: 'Trial token limit reached',
        trialInfo: this.trialInfo
      };
    }

    return {
      isValid: true,
      trialInfo: this.trialInfo
    };
  }

  private getTrialLimits() {
    return {
      maxTasks: 50,
      maxTokens: 100000,
      maxDays: 30
    };
  }

  async recordUsage(type: 'task' | 'tokens', amount: number = 1): Promise<boolean> {
    const validation = await this.validateLicense(false);
    
    if (!validation.isValid) {
      return false;
    }

    if (validation.trialInfo) {
      // Update trial usage
      if (type === 'task') {
        this.trialInfo!.tasksUsed += amount;
      } else if (type === 'tokens') {
        this.trialInfo!.tokensUsed += amount;
      }

      // Store updated usage
      this.store.set('trialInfo', {
        startDate: this.trialInfo!.startDate.toISOString(),
        endDate: this.trialInfo!.endDate.toISOString(),
        tasksUsed: this.trialInfo!.tasksUsed,
        tokensUsed: this.trialInfo!.tokensUsed
      });

      await analytics.track('trial_usage_recorded', {
        type,
        amount,
        tasks_used: this.trialInfo!.tasksUsed,
        tokens_used: this.trialInfo!.tokensUsed,
        days_remaining: this.trialInfo!.daysRemaining
      });
    } else if (validation.licenseInfo) {
      // Check license limits
      const limits = validation.licenseInfo.features;
      
      if (type === 'task' && limits.maxTasks > 0) {
        const currentUsage = this.store.get('monthlyUsage.tasks', 0) as number;
        if (currentUsage >= limits.maxTasks) {
          return false;
        }
        this.store.set('monthlyUsage.tasks', currentUsage + amount);
      }

      if (type === 'tokens' && limits.maxTokens > 0) {
        const currentUsage = this.store.get('monthlyUsage.tokens', 0) as number;
        if (currentUsage >= limits.maxTokens) {
          return false;
        }
        this.store.set('monthlyUsage.tokens', currentUsage + amount);
      }

      await analytics.track('license_usage_recorded', {
        type,
        amount,
        license_type: validation.licenseInfo.type
      });
    }

    return true;
  }

  async deactivateLicense(): Promise<void> {
    if (!this.currentLicense) {
      return;
    }

    try {
      await fetch(`${environment.getLicenseServerUrl()}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          license_key: this.currentLicense.key,
          device_id: this.deviceId
        }),
        timeout: 10000
      });
    } catch (error) {
      console.warn('Failed to deactivate license online:', error);
    }

    // Clear local data
    this.store.delete('licenseInfo');
    this.store.delete('monthlyUsage');
    this.currentLicense = null;
    this.validationCache = null;
    this.lastValidation = null;

    // Reinitialize trial
    this.initializeTrial();

    await analytics.track('license_deactivated');
  }

  canUseFeature(feature: keyof LicenseInfo['features']): boolean {
    if (this.currentLicense) {
      return this.currentLicense.features[feature];
    }
    
    // Trial features
    const trialFeatures = {
      maxTasks: 50,
      maxTokens: 100000,
      cloudSync: false,
      prioritySupport: false,
      advancedAutomation: true,
      customTemplates: false,
      teamCollaboration: false,
      apiAccess: false
    };

    return trialFeatures[feature] as boolean;
  }

  getLicenseInfo(): LicenseInfo | null {
    return this.currentLicense;
  }

  getTrialInfo(): TrialInfo | null {
    return this.trialInfo;
  }

  isTrialUser(): boolean {
    return !this.currentLicense && !!this.trialInfo;
  }

  isLicensedUser(): boolean {
    return !!this.currentLicense;
  }

  getRemainingUsage(): { tasks: number; tokens: number } {
    if (this.trialInfo) {
      const limits = this.getTrialLimits();
      return {
        tasks: Math.max(0, limits.maxTasks - this.trialInfo.tasksUsed),
        tokens: Math.max(0, limits.maxTokens - this.trialInfo.tokensUsed)
      };
    }

    if (this.currentLicense) {
      const limits = this.currentLicense.features;
      const currentUsage = {
        tasks: this.store.get('monthlyUsage.tasks', 0) as number,
        tokens: this.store.get('monthlyUsage.tokens', 0) as number
      };

      return {
        tasks: limits.maxTasks > 0 ? Math.max(0, limits.maxTasks - currentUsage.tasks) : -1,
        tokens: limits.maxTokens > 0 ? Math.max(0, limits.maxTokens - currentUsage.tokens) : -1
      };
    }

    return { tasks: 0, tokens: 0 };
  }

  async openPurchaseUrl(): Promise<void> {
    const purchaseUrl = environment.isDevelopment() 
      ? 'http://localhost:3000/purchase'
      : 'https://nubia.ai/purchase';
    
    const { shell } = require('electron');
    await shell.openExternal(purchaseUrl);
    
    await analytics.track('purchase_url_opened', {
      user_type: this.isTrialUser() ? 'trial' : 'unlicensed'
    });
  }

  resetMonthlyUsage(): void {
    this.store.delete('monthlyUsage');
  }

  exportLicenseData(): any {
    return {
      deviceId: this.deviceId,
      currentLicense: this.currentLicense,
      trialInfo: this.trialInfo,
      monthlyUsage: {
        tasks: this.store.get('monthlyUsage.tasks', 0),
        tokens: this.store.get('monthlyUsage.tokens', 0)
      },
      lastValidation: this.lastValidation,
      validationCache: this.validationCache
    };
  }

  destroy(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }
  }
}

export const licensing = new LicensingService();

export const useActiveLicense = async (): Promise<LicenseValidationResult> => {
  return licensing.validateLicense();
};

export const useLicenseFeatures = () => {
  return {
    canUseFeature: licensing.canUseFeature.bind(licensing),
    recordUsage: licensing.recordUsage.bind(licensing),
    getRemainingUsage: licensing.getRemainingUsage.bind(licensing),
    isTrialUser: licensing.isTrialUser.bind(licensing),
    isLicensedUser: licensing.isLicensedUser.bind(licensing),
    openPurchase: licensing.openPurchaseUrl.bind(licensing)
  };
};