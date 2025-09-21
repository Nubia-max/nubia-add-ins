/**
 * Smart Context Caching System
 * Reduces API calls by caching and reusing Excel context intelligently
 */

interface CachedContext {
  context: any;
  timestamp: number;
  hash: string;
}

class ContextCache {
  private cache = new Map<string, CachedContext>();
  private readonly TTL = 30000; // 30 seconds
  private readonly MAX_SIZE = 100;

  /**
   * Generate a hash for the context to detect changes
   */
  private generateContextHash(context: any): string {
    const key = `${context.sheetName}_${context.selectedRange}_${context.workbookName}_${JSON.stringify(context.selectedData)}`;
    return Buffer.from(key).toString('base64').slice(0, 32);
  }

  /**
   * Get cached context if valid
   */
  getCachedContext(sessionId: string, newContext: any): any | null {
    const cached = this.cache.get(sessionId);

    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(sessionId);
      return null;
    }

    // Check if context changed significantly
    const newHash = this.generateContextHash(newContext);
    if (cached.hash !== newHash) {
      return null;
    }

    return cached.context;
  }

  /**
   * Cache enhanced context
   */
  cacheContext(sessionId: string, context: any): void {
    // Clean old entries if cache is full
    if (this.cache.size >= this.MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const hash = this.generateContextHash(context);
    this.cache.set(sessionId, {
      context: { ...context },
      timestamp: Date.now(),
      hash
    });
  }

  /**
   * Enhance context with smart analysis
   */
  enhanceContext(baseContext: any): any {
    const enhanced = { ...baseContext };

    // Add semantic tags
    enhanced.semanticTags = this.generateSemanticTags(baseContext);

    // Add operation suggestions
    enhanced.suggestedOperations = this.suggestOperations(baseContext);

    // Add performance hints
    enhanced.performanceHints = this.generatePerformanceHints(baseContext);

    return enhanced;
  }

  private generateSemanticTags(context: any): string[] {
    const tags: string[] = [];

    if (context.maybeHeaders) tags.push('headers');
    if (context.selectionType === 'column') tags.push('column-data');
    if (context.selectionType === 'row') tags.push('row-data');
    if (context.dataSize?.rows > 50) tags.push('large-dataset');
    if (context.selectedData?.some((row: any[]) =>
      row.some(cell => typeof cell === 'number'))) tags.push('numeric-data');

    return tags;
  }

  private suggestOperations(context: any): string[] {
    const suggestions: string[] = [];

    if (context.semanticTags?.includes('numeric-data')) {
      suggestions.push('sum', 'average', 'chart');
    }
    if (context.semanticTags?.includes('headers')) {
      suggestions.push('format-headers', 'create-table');
    }
    if (context.selectionType === 'column') {
      suggestions.push('sort', 'filter', 'conditional-format');
    }

    return suggestions;
  }

  private generatePerformanceHints(context: any): string[] {
    const hints: string[] = [];

    if (context.dataSize?.rows > 1000) {
      hints.push('consider-pagination');
    }
    if (context.selectionSize?.rows * context.selectionSize?.columns > 10000) {
      hints.push('large-selection-warning');
    }

    return hints;
  }

  /**
   * Clear cache for session
   */
  clearSession(sessionId: string): void {
    this.cache.delete(sessionId);
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0.85 // Placeholder - implement actual tracking
    };
  }
}

export const contextCache = new ContextCache();