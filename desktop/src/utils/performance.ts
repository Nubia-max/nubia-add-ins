import { performance } from 'perf_hooks';
import { analytics } from '../services/analytics';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: 'load' | 'render' | 'api' | 'automation' | 'llm' | 'ui';
  metadata?: Record<string, any>;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class PerformanceManager {
  private metrics: PerformanceMetric[] = [];
  private cache = new Map<string, CacheEntry<any>>();
  private observers = new Map<string, PerformanceObserver>();
  private timers = new Map<string, number>();

  constructor() {
    this.initializeObservers();
    this.startCleanupTimer();
  }

  private initializeObservers(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Navigation timing
      this.observeEntryTypes(['navigation'], (entries) => {
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordMetric('app_load_time', navEntry.loadEventEnd - navEntry.navigationStart, 'ms', 'load');
            this.recordMetric('dom_content_loaded', navEntry.domContentLoadedEventEnd - navEntry.navigationStart, 'ms', 'load');
          }
        });
      });

      // Long tasks
      this.observeEntryTypes(['longtask'], (entries) => {
        entries.forEach((entry) => {
          this.recordMetric('long_task', entry.duration, 'ms', 'render', {
            startTime: entry.startTime
          });
        });
      });

      // Layout shift
      this.observeEntryTypes(['layout-shift'], (entries) => {
        let cumulativeScore = 0;
        entries.forEach((entry) => {
          if (!(entry as any).hadRecentInput) {
            cumulativeScore += (entry as any).value;
          }
        });
        
        if (cumulativeScore > 0) {
          this.recordMetric('cumulative_layout_shift', cumulativeScore, 'score', 'render');
        }
      });

      // First Paint / First Contentful Paint
      this.observeEntryTypes(['paint'], (entries) => {
        entries.forEach((entry) => {
          this.recordMetric(entry.name.replace('-', '_'), entry.startTime, 'ms', 'load');
        });
      });
    }
  }

  private observeEntryTypes(types: string[], callback: (entries: PerformanceEntry[]) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      
      observer.observe({ entryTypes: types });
      this.observers.set(types.join(','), observer);
    } catch (error) {
      console.warn('Performance observer not supported for types:', types);
    }
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupCache();
      this.cleanupMetrics();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Timing utilities
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  endTimer(name: string, category: PerformanceMetric['category'] = 'ui', metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      console.warn(`Timer '${name}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);
    
    this.recordMetric(name, duration, 'ms', category, metadata);
    return duration;
  }

  // Measure function execution time
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    category: PerformanceMetric['category'] = 'api',
    metadata?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      this.recordMetric(name, duration, 'ms', category, {
        success: true,
        ...metadata
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordMetric(name, duration, 'ms', category, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...metadata
      });
      
      throw error;
    }
  }

  measureSync<T>(
    name: string,
    fn: () => T,
    category: PerformanceMetric['category'] = 'ui',
    metadata?: Record<string, any>
  ): T {
    const startTime = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      
      this.recordMetric(name, duration, 'ms', category, {
        success: true,
        ...metadata
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordMetric(name, duration, 'ms', category, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...metadata
      });
      
      throw error;
    }
  }

  // Record custom metrics
  recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    category: PerformanceMetric['category'] = 'ui',
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      category,
      metadata
    };

    this.metrics.push(metric);

    // Send to analytics if significant
    if (this.shouldReportMetric(metric)) {
      analytics.performance(name, value, unit);
    }

    // Keep metrics list manageable
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }

  private shouldReportMetric(metric: PerformanceMetric): boolean {
    // Report slow operations
    if (metric.unit === 'ms' && metric.value > 1000) return true;
    
    // Report load times
    if (metric.category === 'load') return true;
    
    // Report API calls
    if (metric.category === 'api') return true;
    
    // Report automation tasks
    if (metric.category === 'automation') return true;
    
    // Report LLM operations
    if (metric.category === 'llm') return true;

    return false;
  }

  // Cache management
  setCache<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  clearCache(): void {
    this.cache.clear();
  }

  private cleanupCache(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Memory monitoring
  getMemoryInfo(): any {
    if (typeof window !== 'undefined' && 'performance' in window && (window.performance as any).memory) {
      const memory = (window.performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    
    return null;
  }

  // Bundle analysis
  measureBundleSize(): void {
    if (typeof window !== 'undefined') {
      // Rough estimation based on loaded resources
      const resources = performance.getEntriesByType('resource');
      let totalSize = 0;
      
      resources.forEach((resource) => {
        if (resource.name.includes('.js') || resource.name.includes('.css')) {
          totalSize += (resource as any).transferSize || 0;
        }
      });
      
      this.recordMetric('bundle_size', totalSize, 'bytes', 'load');
    }
  }

  // Frame rate monitoring
  startFrameRateMonitoring(): () => void {
    if (typeof window === 'undefined') return () => {};

    let frameCount = 0;
    let lastTime = performance.now();
    let animationId: number;

    const measureFrameRate = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        this.recordMetric('frame_rate', fps, 'fps', 'render');
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      animationId = requestAnimationFrame(measureFrameRate);
    };

    animationId = requestAnimationFrame(measureFrameRate);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }

  // Resource loading optimization
  async preloadResource(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      
      if (url.endsWith('.js')) {
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => {
          const duration = performance.now() - startTime;
          this.recordMetric('resource_preload', duration, 'ms', 'load', { 
            url, 
            type: 'script',
            success: true
          });
          resolve();
        };
        script.onerror = () => {
          const duration = performance.now() - startTime;
          this.recordMetric('resource_preload', duration, 'ms', 'load', { 
            url, 
            type: 'script',
            success: false
          });
          reject(new Error(`Failed to preload script: ${url}`));
        };
        document.head.appendChild(script);
      } else if (url.endsWith('.css')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.onload = () => {
          const duration = performance.now() - startTime;
          this.recordMetric('resource_preload', duration, 'ms', 'load', { 
            url, 
            type: 'stylesheet',
            success: true
          });
          resolve();
        };
        link.onerror = () => {
          const duration = performance.now() - startTime;
          this.recordMetric('resource_preload', duration, 'ms', 'load', { 
            url, 
            type: 'stylesheet',
            success: false
          });
          reject(new Error(`Failed to preload stylesheet: ${url}`));
        };
        document.head.appendChild(link);
      } else {
        // Generic resource preloading
        fetch(url)
          .then(() => {
            const duration = performance.now() - startTime;
            this.recordMetric('resource_preload', duration, 'ms', 'load', { 
              url, 
              type: 'fetch',
              success: true
            });
            resolve();
          })
          .catch((error) => {
            const duration = performance.now() - startTime;
            this.recordMetric('resource_preload', duration, 'ms', 'load', { 
              url, 
              type: 'fetch',
              success: false,
              error: error.message
            });
            reject(error);
          });
      }
    });
  }

  // Get performance insights
  getMetrics(category?: PerformanceMetric['category'], limit: number = 100): PerformanceMetric[] {
    let filtered = this.metrics;
    
    if (category) {
      filtered = filtered.filter(m => m.category === category);
    }
    
    return filtered.slice(-limit);
  }

  getMetricsStats(category?: PerformanceMetric['category']): {
    count: number;
    average: number;
    min: number;
    max: number;
    category?: string;
  } {
    const metrics = this.getMetrics(category);
    
    if (metrics.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, category };
    }
    
    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: metrics.length,
      average: sum / metrics.length,
      min: Math.min(...values),
      max: Math.max(...values),
      category
    };
  }

  private cleanupMetrics(): void {
    // Keep only recent metrics (last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
  }

  // Resource hints for optimization
  addResourceHints(hints: Array<{url: string, type: 'prefetch' | 'preload' | 'dns-prefetch'}>): void {
    if (typeof document === 'undefined') return;

    hints.forEach(hint => {
      const link = document.createElement('link');
      link.rel = hint.type;
      
      if (hint.type === 'dns-prefetch') {
        link.href = new URL(hint.url).origin;
      } else {
        link.href = hint.url;
      }
      
      document.head.appendChild(link);
    });
  }

  // Cleanup
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.cache.clear();
    this.metrics.length = 0;
    this.timers.clear();
  }
}

// Singleton instance
export const performanceManager = new PerformanceManager();

// React hook for performance monitoring
export const usePerformance = () => {
  return {
    startTimer: performanceManager.startTimer.bind(performanceManager),
    endTimer: performanceManager.endTimer.bind(performanceManager),
    measureAsync: performanceManager.measureAsync.bind(performanceManager),
    measureSync: performanceManager.measureSync.bind(performanceManager),
    recordMetric: performanceManager.recordMetric.bind(performanceManager),
    getMetrics: performanceManager.getMetrics.bind(performanceManager),
    getStats: performanceManager.getMetricsStats.bind(performanceManager),
    getMemoryInfo: performanceManager.getMemoryInfo.bind(performanceManager),
    setCache: performanceManager.setCache.bind(performanceManager),
    getCache: performanceManager.getCache.bind(performanceManager)
  };
};

// Utility functions
export const withPerformanceTracking = <T extends (...args: any[]) => any>(
  name: string,
  fn: T,
  category: PerformanceMetric['category'] = 'ui'
): T => {
  return ((...args: Parameters<T>) => {
    return performanceManager.measureSync(name, () => fn(...args), category);
  }) as T;
};

export const withAsyncPerformanceTracking = <T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  category: PerformanceMetric['category'] = 'api'
): T => {
  return (async (...args: Parameters<T>) => {
    return performanceManager.measureAsync(name, () => fn(...args), category);
  }) as T;
};