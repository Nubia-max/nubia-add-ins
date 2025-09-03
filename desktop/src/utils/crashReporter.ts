import { app, crashReporter } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { environment } from '../config/environment';
import { analytics } from '../services/analytics';

export interface CrashReport {
  id: string;
  timestamp: Date;
  version: string;
  platform: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: Record<string, any>;
  systemInfo: {
    arch: string;
    platform: string;
    version: string;
    memory: {
      total: number;
      free: number;
    };
  };
  userConsent: boolean;
}

class CrashReportingService {
  private reportsDir: string;
  private maxReports: number = 10;
  private isInitialized: boolean = false;

  constructor() {
    this.reportsDir = path.join(app.getPath('userData'), 'crash-reports');
    this.ensureReportsDirectory();
  }

  initialize(): void {
    if (this.isInitialized) return;

    try {
      // Only initialize crash reporter in production
      if (environment.isProduction()) {
        crashReporter.start({
          productName: 'Nubia',
          companyName: 'Nubia Team',
          submitURL: environment.isDevelopment() 
            ? 'http://localhost:3004/crashes' 
            : 'https://crashes.nubia.ai/reports',
          uploadToServer: true,
          ignoreSystemCrashHandler: false,
          rateLimit: true,
          compress: true
        });

        console.log('Crash reporter initialized');
      }

      // Set up unhandled error handlers
      this.setupErrorHandlers();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize crash reporter:', error);
    }
  }

  private setupErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      
      this.createCrashReport(error, {
        type: 'uncaught_exception',
        fatal: true
      }).then(() => {
        // Give some time for the report to be saved/sent
        setTimeout(() => {
          process.exit(1);
        }, 1000);
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
      
      const error = reason instanceof Error ? reason : new Error(String(reason));
      
      this.createCrashReport(error, {
        type: 'unhandled_rejection',
        fatal: false,
        promise: String(promise)
      });
    });

    // Handle main process crashes in Electron
    if (app) {
      app.on('render-process-gone', (event, webContents, details) => {
        console.error('Renderer process gone:', details);
        
        const error = new Error(`Renderer process crashed: ${details.reason}`);
        this.createCrashReport(error, {
          type: 'renderer_crash',
          fatal: false,
          details: details,
          webContentsId: webContents.id
        });
      });

      app.on('child-process-gone', (event, details) => {
        console.error('Child process gone:', details);
        
        const error = new Error(`Child process crashed: ${details.type}`);
        this.createCrashReport(error, {
          type: 'child_process_crash',
          fatal: false,
          details: details
        });
      });
    }
  }

  private ensureReportsDirectory(): void {
    try {
      if (!fs.existsSync(this.reportsDir)) {
        fs.mkdirSync(this.reportsDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create reports directory:', error);
    }
  }

  async createCrashReport(error: Error, context: Record<string, any> = {}): Promise<string> {
    const reportId = this.generateReportId();
    
    try {
      const report: CrashReport = {
        id: reportId,
        timestamp: new Date(),
        version: environment.getAppVersion(),
        platform: environment.getPlatform(),
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context: {
          ...context,
          isDevelopment: environment.isDevelopment(),
          isProduction: environment.isProduction()
        },
        systemInfo: this.getSystemInfo(),
        userConsent: await this.getUserConsent()
      };

      // Save report locally
      await this.saveReportLocally(report);

      // Send to analytics if user consented
      if (report.userConsent) {
        await this.sendToAnalytics(report);
      }

      // Clean up old reports
      await this.cleanupOldReports();

      console.log(`Crash report created: ${reportId}`);
      return reportId;
    } catch (reportError) {
      console.error('Failed to create crash report:', reportError);
      return '';
    }
  }

  private generateReportId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `crash-${timestamp}-${random}`;
  }

  private getSystemInfo(): CrashReport['systemInfo'] {
    const os = require('os');
    
    return {
      arch: os.arch(),
      platform: os.platform(),
      version: os.release(),
      memory: {
        total: os.totalmem(),
        free: os.freemem()
      }
    };
  }

  private async getUserConsent(): Promise<boolean> {
    // In a real app, this would check user preferences
    // For now, respect the analytics consent
    try {
      return environment.isErrorReportingEnabled();
    } catch {
      return false;
    }
  }

  private async saveReportLocally(report: CrashReport): Promise<void> {
    const filePath = path.join(this.reportsDir, `${report.id}.json`);
    
    try {
      const reportData = JSON.stringify(report, null, 2);
      fs.writeFileSync(filePath, reportData, 'utf8');
    } catch (error) {
      console.error('Failed to save crash report locally:', error);
      throw error;
    }
  }

  private async sendToAnalytics(report: CrashReport): Promise<void> {
    try {
      // Send crash data to analytics
      await analytics.error(new Error(report.error.message), {
        crash_report_id: report.id,
        error_name: report.error.name,
        platform: report.platform,
        version: report.version,
        context: report.context,
        system_memory_total: report.systemInfo.memory.total,
        system_memory_free: report.systemInfo.memory.free
      });
    } catch (error) {
      console.error('Failed to send crash report to analytics:', error);
    }
  }

  private async cleanupOldReports(): Promise<void> {
    try {
      const files = fs.readdirSync(this.reportsDir);
      const reportFiles = files.filter(file => file.endsWith('.json'));
      
      if (reportFiles.length > this.maxReports) {
        // Sort by modification time and remove oldest
        const filePaths = reportFiles.map(file => ({
          path: path.join(this.reportsDir, file),
          mtime: fs.statSync(path.join(this.reportsDir, file)).mtime
        }));
        
        filePaths.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        
        const filesToDelete = filePaths.slice(0, filePaths.length - this.maxReports);
        
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old reports:', error);
    }
  }

  async getLocalReports(): Promise<CrashReport[]> {
    try {
      const files = fs.readdirSync(this.reportsDir);
      const reportFiles = files.filter(file => file.endsWith('.json'));
      
      const reports: CrashReport[] = [];
      
      for (const file of reportFiles) {
        try {
          const filePath = path.join(this.reportsDir, file);
          const reportData = fs.readFileSync(filePath, 'utf8');
          const report = JSON.parse(reportData);
          
          // Convert timestamp back to Date
          report.timestamp = new Date(report.timestamp);
          
          reports.push(report);
        } catch (error) {
          console.error(`Failed to read report file ${file}:`, error);
        }
      }
      
      return reports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      console.error('Failed to get local reports:', error);
      return [];
    }
  }

  async deleteReport(reportId: string): Promise<boolean> {
    try {
      const filePath = path.join(this.reportsDir, `${reportId}.json`);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete report:', error);
      return false;
    }
  }

  async clearAllReports(): Promise<void> {
    try {
      const files = fs.readdirSync(this.reportsDir);
      const reportFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of reportFiles) {
        const filePath = path.join(this.reportsDir, file);
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Failed to clear all reports:', error);
      throw error;
    }
  }

  // Manual crash reporting for handled errors
  async reportError(error: Error, context: Record<string, any> = {}): Promise<string> {
    return this.createCrashReport(error, {
      ...context,
      type: 'manual_report',
      fatal: false
    });
  }

  // Test crash reporting
  async testCrashReporting(): Promise<string> {
    const testError = new Error('Test crash report - this is not a real error');
    testError.stack = 'Test stack trace\n  at testCrashReporting\n  at Object.test';
    
    return this.createCrashReport(testError, {
      type: 'test_report',
      fatal: false,
      test: true
    });
  }

  getReportsDirectory(): string {
    return this.reportsDir;
  }

  isEnabled(): boolean {
    return this.isInitialized && environment.isErrorReportingEnabled();
  }

  destroy(): void {
    this.isInitialized = false;
    // Remove process event listeners if needed
  }
}

// Singleton instance
export const crashReporting = new CrashReportingService();

// Export utility functions
export const reportError = crashReporting.reportError.bind(crashReporting);
export const initializeCrashReporting = crashReporting.initialize.bind(crashReporting);