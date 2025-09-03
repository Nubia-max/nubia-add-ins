export interface IElectronAPI {
  // Window management
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  
  // File operations
  showOpenDialog: (options: any) => Promise<any>;
  showSaveDialog: (options: any) => Promise<any>;
  
  // External links
  openExternal: (url: string) => Promise<void>;
  
  // IPC communication
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (...args: any[]) => void) => void;
  
  // App info
  getAppVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
    analytics: {
      track: (event: string, properties?: Record<string, any>) => Promise<void>;
      error: (error: Error, context?: Record<string, any>) => Promise<void>;
    };
  }
}