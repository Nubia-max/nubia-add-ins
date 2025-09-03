import { performanceManager } from './performance';

export interface LazyComponentModule {
  default: React.ComponentType<any>;
}

export interface CodeSplitPoint {
  name: string;
  loader: () => Promise<LazyComponentModule>;
  fallback?: React.ComponentType;
  preload?: boolean;
}

class BundleOptimizer {
  private preloadedModules = new Set<string>();
  private loadingModules = new Map<string, Promise<LazyComponentModule>>();

  // Lazy load components with performance tracking
  async loadComponent(splitPoint: CodeSplitPoint): Promise<React.ComponentType<any>> {
    const startTime = performance.now();
    
    try {
      // Check if already loading
      if (this.loadingModules.has(splitPoint.name)) {
        const module = await this.loadingModules.get(splitPoint.name)!;
        return module.default;
      }

      // Start loading
      const loadPromise = splitPoint.loader();
      this.loadingModules.set(splitPoint.name, loadPromise);

      const module = await loadPromise;
      
      performanceManager.recordMetric(
        `component_load_${splitPoint.name}`,
        performance.now() - startTime,
        'ms',
        'load',
        { success: true }
      );

      this.preloadedModules.add(splitPoint.name);
      this.loadingModules.delete(splitPoint.name);

      return module.default;
    } catch (error) {
      performanceManager.recordMetric(
        `component_load_${splitPoint.name}`,
        performance.now() - startTime,
        'ms',
        'load',
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      );

      this.loadingModules.delete(splitPoint.name);
      throw error;
    }
  }

  // Preload components for better UX
  async preloadComponent(splitPoint: CodeSplitPoint): Promise<void> {
    if (this.preloadedModules.has(splitPoint.name)) {
      return;
    }

    try {
      await this.loadComponent(splitPoint);
    } catch (error) {
      console.warn(`Failed to preload component ${splitPoint.name}:`, error);
    }
  }

  // Preload multiple components
  async preloadComponents(splitPoints: CodeSplitPoint[]): Promise<void> {
    const preloadPromises = splitPoints
      .filter(sp => !this.preloadedModules.has(sp.name))
      .map(sp => this.preloadComponent(sp));

    await Promise.allSettled(preloadPromises);
  }

  // Resource hints for bundle optimization
  addResourceHints(): void {
    if (typeof document === 'undefined') return;

    // DNS prefetch for external resources
    const externalDomains = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com'
    ];

    externalDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = domain;
      document.head.appendChild(link);
    });

    // Preconnect to important origins
    const preconnectDomains = [
      'https://api.nubia.ai',
      'https://updates.nubia.ai'
    ];

    preconnectDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      document.head.appendChild(link);
    });
  }

  // Tree shaking helpers
  static createLazyComponent<T = {}>(
    loader: () => Promise<LazyComponentModule>,
    fallback?: React.ComponentType
  ) {
    return React.lazy(async () => {
      const startTime = performance.now();
      
      try {
        const module = await loader();
        
        performanceManager.recordMetric(
          'lazy_component_load',
          performance.now() - startTime,
          'ms',
          'load',
          { success: true }
        );

        return module;
      } catch (error) {
        performanceManager.recordMetric(
          'lazy_component_load',
          performance.now() - startTime,
          'ms',
          'load',
          { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        );

        throw error;
      }
    });
  }

  // Analyze bundle composition
  getBundleAnalysis(): {
    loadedModules: number;
    preloadedModules: number;
    loadingModules: number;
    memoryUsage?: any;
  } {
    return {
      loadedModules: this.preloadedModules.size,
      preloadedModules: this.preloadedModules.size,
      loadingModules: this.loadingModules.size,
      memoryUsage: performanceManager.getMemoryInfo()
    };
  }

  // Critical resource loading
  async loadCriticalResources(): Promise<void> {
    const criticalCSS = [
      '/styles/critical.css'
    ];

    const criticalJS = [
      // Add critical JS files here
    ];

    const loadPromises = [
      ...criticalCSS.map(url => this.loadStylesheet(url)),
      ...criticalJS.map(url => this.loadScript(url))
    ];

    await Promise.allSettled(loadPromises);
  }

  private loadStylesheet(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`link[href="${url}"]`)) {
        resolve();
        return;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to load stylesheet: ${url}`));
      
      document.head.appendChild(link);
    });
  }

  private loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
      
      document.head.appendChild(script);
    });
  }

  // Service worker integration for caching
  async registerServiceWorker(swUrl: string = '/sw.js'): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(swUrl);
        
        performanceManager.recordMetric(
          'service_worker_registration',
          0,
          'boolean',
          'load',
          { success: true, scope: registration.scope }
        );

        console.log('Service worker registered:', registration.scope);
      } catch (error) {
        performanceManager.recordMetric(
          'service_worker_registration',
          0,
          'boolean',
          'load',
          { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        );

        console.error('Service worker registration failed:', error);
      }
    }
  }

  // Clear unused resources
  cleanup(): void {
    // Clear loading promises for failed loads
    this.loadingModules.clear();
    
    // Remove unused preloaded modules from memory if needed
    // This would require more sophisticated memory management
  }
}

// Singleton instance
export const bundleOptimizer = new BundleOptimizer();

// Utility functions for React components
export const withLazyLoading = <P extends object>(
  loader: () => Promise<LazyComponentModule>,
  fallback?: React.ComponentType
) => {
  return BundleOptimizer.createLazyComponent(loader, fallback);
};

// Route-based code splitting
export const createRouteSplit = (
  routeName: string,
  loader: () => Promise<LazyComponentModule>
): CodeSplitPoint => ({
  name: `route_${routeName}`,
  loader,
  preload: false
});

// Feature-based code splitting
export const createFeatureSplit = (
  featureName: string,
  loader: () => Promise<LazyComponentModule>,
  preload: boolean = false
): CodeSplitPoint => ({
  name: `feature_${featureName}`,
  loader,
  preload
});

// Vendor library splitting
export const createVendorSplit = (
  vendorName: string,
  loader: () => Promise<LazyComponentModule>
): CodeSplitPoint => ({
  name: `vendor_${vendorName}`,
  loader,
  preload: true // Vendors are usually worth preloading
});

// Initialize bundle optimization
export const initializeBundleOptimization = async (): Promise<void> => {
  // Add resource hints
  bundleOptimizer.addResourceHints();
  
  // Load critical resources
  await bundleOptimizer.loadCriticalResources();
  
  // Register service worker for caching
  await bundleOptimizer.registerServiceWorker();
  
  // Track bundle size
  performanceManager.measureBundleSize();
};