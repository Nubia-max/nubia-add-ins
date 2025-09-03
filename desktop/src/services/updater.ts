import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app, BrowserWindow, dialog, Notification } from 'electron';
import { environment } from '../config/environment';
import log from 'electron-log';

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  progress: number;
  version?: string;
  releaseNotes?: string;
  downloadedDate?: Date;
}

export interface UpdateConfig {
  checkOnStartup: boolean;
  checkInterval: number; // hours
  autoDownload: boolean;
  autoInstall: boolean;
  allowPrerelease: boolean;
  notifyUser: boolean;
}

class UpdaterService {
  private mainWindow: BrowserWindow | null = null;
  private status: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
    error: null,
    progress: 0
  };
  
  private config: UpdateConfig = {
    checkOnStartup: true,
    checkInterval: 24, // Check every 24 hours
    autoDownload: true,
    autoInstall: false, // Require user confirmation
    allowPrerelease: false,
    notifyUser: true
  };

  private checkTimer: NodeJS.Timeout | null = null;
  private lastCheckTime: Date | null = null;

  constructor() {
    this.initializeUpdater();
    this.setupEventHandlers();
  }

  private initializeUpdater(): void {
    // Configure auto-updater
    autoUpdater.logger = log;
    
    // Set update server URL
    const updateUrl = environment.getUpdateServerUrl();
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: updateUrl
    });

    // Configure updater options
    autoUpdater.autoDownload = this.config.autoDownload;
    autoUpdater.autoInstallOnAppQuit = this.config.autoInstall;
    autoUpdater.allowPrerelease = this.config.allowPrerelease;

    // Disable auto-updater in development
    if (environment.isDevelopment()) {
      autoUpdater.updateConfigPath = null;
      return;
    }

    log.info('Auto-updater initialized');
  }

  private setupEventHandlers(): void {
    // Checking for update
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for update...');
      this.status.checking = true;
      this.status.error = null;
      this.notifyStatusChange();
    });

    // Update available
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      log.info('Update available:', info);
      this.status.checking = false;
      this.status.available = true;
      this.status.version = info.version;
      this.status.releaseNotes = info.releaseNotes as string;
      
      this.notifyStatusChange();
      
      if (this.config.notifyUser) {
        this.showUpdateAvailableNotification(info);
      }
    });

    // Update not available
    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      log.info('Update not available:', info);
      this.status.checking = false;
      this.status.available = false;
      this.lastCheckTime = new Date();
      this.notifyStatusChange();
    });

    // Update error
    autoUpdater.on('error', (error: Error) => {
      log.error('Update error:', error);
      this.status.checking = false;
      this.status.downloading = false;
      this.status.error = error.message;
      this.notifyStatusChange();

      if (this.config.notifyUser) {
        this.showUpdateErrorNotification(error.message);
      }
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const progress = Math.round(progressObj.percent);
      log.info(`Download progress: ${progress}%`);
      
      this.status.downloading = true;
      this.status.progress = progress;
      this.notifyStatusChange();
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      log.info('Update downloaded:', info);
      this.status.downloading = false;
      this.status.downloaded = true;
      this.status.downloadedDate = new Date();
      this.status.progress = 100;
      
      this.notifyStatusChange();
      
      if (this.config.notifyUser) {
        this.showUpdateDownloadedNotification(info);
      }
    });
  }

  // Initialize with main window reference
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  // Start automatic update checking
  startAutomaticChecks(): void {
    if (environment.isDevelopment()) {
      log.info('Auto-updater disabled in development mode');
      return;
    }

    // Check on startup if enabled
    if (this.config.checkOnStartup) {
      setTimeout(() => {
        this.checkForUpdates(false); // Silent check on startup
      }, 10000); // Wait 10 seconds after startup
    }

    // Set up periodic checks
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(() => {
      this.checkForUpdates(false);
    }, this.config.checkInterval * 60 * 60 * 1000); // Convert hours to ms

    log.info(`Automatic update checks started (every ${this.config.checkInterval} hours)`);
  }

  // Stop automatic update checking
  stopAutomaticChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    log.info('Automatic update checks stopped');
  }

  // Manual check for updates
  async checkForUpdates(showNoUpdateDialog: boolean = true): Promise<void> {
    if (environment.isDevelopment()) {
      if (showNoUpdateDialog) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Development Mode',
          message: 'Updates are disabled in development mode'
        });
      }
      return;
    }

    try {
      log.info('Manually checking for updates');
      await autoUpdater.checkForUpdatesAndNotify();
      
      // If no update was found and user requested manual check
      if (!this.status.available && showNoUpdateDialog) {
        setTimeout(() => {
          if (!this.status.available) {
            dialog.showMessageBox({
              type: 'info',
              title: 'No Updates Available',
              message: `You are already running the latest version of Nubia (${environment.getAppVersion()})`
            });
          }
        }, 3000);
      }
    } catch (error) {
      log.error('Error checking for updates:', error);
      
      if (showNoUpdateDialog) {
        dialog.showErrorBox('Update Check Failed', 
          'Unable to check for updates. Please check your internet connection and try again.');
      }
    }
  }

  // Download update (if not auto-downloading)
  async downloadUpdate(): Promise<void> {
    if (!this.status.available) {
      throw new Error('No update available to download');
    }

    try {
      log.info('Starting update download');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Error downloading update:', error);
      throw error;
    }
  }

  // Install update and restart app
  async installUpdate(): Promise<void> {
    if (!this.status.downloaded) {
      throw new Error('No update downloaded to install');
    }

    try {
      log.info('Installing update and restarting');
      autoUpdater.quitAndInstall();
    } catch (error) {
      log.error('Error installing update:', error);
      throw error;
    }
  }

  // Show update dialog to user
  async showUpdateDialog(): Promise<void> {
    if (!this.status.available || !this.mainWindow) {
      return;
    }

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'question',
      title: 'Update Available',
      message: `A new version of Nubia is available (${this.status.version})`,
      detail: this.status.releaseNotes || 'No release notes available.',
      buttons: ['Download Now', 'Download Later', 'Skip This Version'],
      defaultId: 0,
      cancelId: 1
    });

    switch (result.response) {
      case 0: // Download Now
        if (!this.config.autoDownload) {
          await this.downloadUpdate();
        }
        break;
      case 1: // Download Later
        // Do nothing, will check again later
        break;
      case 2: // Skip This Version
        // Mark this version as skipped (could implement in storage)
        log.info(`User skipped update to version ${this.status.version}`);
        break;
    }
  }

  // Show install dialog after download
  async showInstallDialog(): Promise<void> {
    if (!this.status.downloaded || !this.mainWindow) {
      return;
    }

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'question',
      title: 'Update Ready',
      message: `Update to version ${this.status.version} has been downloaded and is ready to install.`,
      detail: 'The application will restart to complete the installation.',
      buttons: ['Install Now', 'Install on Exit'],
      defaultId: 0
    });

    if (result.response === 0) {
      // Install now
      await this.installUpdate();
    } else {
      // Install on exit
      autoUpdater.autoInstallOnAppQuit = true;
    }
  }

  // Notification helpers
  private showUpdateAvailableNotification(info: UpdateInfo): void {
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title: 'Nubia Update Available',
      body: `Version ${info.version} is available for download`,
      icon: 'assets/icon.png'
    });

    notification.on('click', () => {
      this.showUpdateDialog();
    });

    notification.show();
  }

  private showUpdateDownloadedNotification(info: UpdateInfo): void {
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title: 'Nubia Update Ready',
      body: `Version ${info.version} has been downloaded and is ready to install`,
      icon: 'assets/icon.png'
    });

    notification.on('click', () => {
      this.showInstallDialog();
    });

    notification.show();
  }

  private showUpdateErrorNotification(error: string): void {
    if (!Notification.isSupported()) return;

    const notification = new Notification({
      title: 'Update Error',
      body: `Failed to check for updates: ${error}`,
      icon: 'assets/icon.png'
    });

    notification.show();
  }

  // Notify renderer process of status changes
  private notifyStatusChange(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-status-changed', this.status);
    }
  }

  // Configuration methods
  getConfig(): UpdateConfig {
    return { ...this.config };
  }

  setConfig(newConfig: Partial<UpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Apply configuration changes
    autoUpdater.autoDownload = this.config.autoDownload;
    autoUpdater.autoInstallOnAppQuit = this.config.autoInstall;
    autoUpdater.allowPrerelease = this.config.allowPrerelease;
    
    // Restart automatic checks if interval changed
    if (this.checkTimer) {
      this.stopAutomaticChecks();
      this.startAutomaticChecks();
    }

    log.info('Updater configuration updated:', this.config);
  }

  // Status getters
  getStatus(): UpdateStatus {
    return { ...this.status };
  }

  isUpdateAvailable(): boolean {
    return this.status.available;
  }

  isUpdateDownloaded(): boolean {
    return this.status.downloaded;
  }

  isChecking(): boolean {
    return this.status.checking;
  }

  isDownloading(): boolean {
    return this.status.downloading;
  }

  getLastCheckTime(): Date | null {
    return this.lastCheckTime;
  }

  // Cleanup
  destroy(): void {
    this.stopAutomaticChecks();
    this.mainWindow = null;
  }
}

// Singleton instance
export const updaterService = new UpdaterService();

// IPC handlers for renderer process
export const setupUpdaterIPC = (window: BrowserWindow) => {
  const { ipcMain } = require('electron');
  
  updaterService.setMainWindow(window);

  ipcMain.handle('updater-get-status', () => {
    return updaterService.getStatus();
  });

  ipcMain.handle('updater-get-config', () => {
    return updaterService.getConfig();
  });

  ipcMain.handle('updater-set-config', (event, config: Partial<UpdateConfig>) => {
    updaterService.setConfig(config);
  });

  ipcMain.handle('updater-check-for-updates', () => {
    return updaterService.checkForUpdates(true);
  });

  ipcMain.handle('updater-download-update', () => {
    return updaterService.downloadUpdate();
  });

  ipcMain.handle('updater-install-update', () => {
    return updaterService.installUpdate();
  });

  ipcMain.handle('updater-start-automatic', () => {
    updaterService.startAutomaticChecks();
  });

  ipcMain.handle('updater-stop-automatic', () => {
    updaterService.stopAutomaticChecks();
  });
};