import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((item: T, index: number) => number);
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
  getItemKey?: (item: T, index: number) => string | number;
}

interface ItemPosition {
  index: number;
  top: number;
  height: number;
}

export function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  className = '',
  overscan = 3,
  onScroll,
  getItemKey
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const itemPositions = useMemo<ItemPosition[]>(() => {
    const positions: ItemPosition[] = [];
    let currentTop = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const currentHeight = typeof itemHeight === 'function' 
        ? itemHeight(item, i) 
        : itemHeight;

      positions.push({
        index: i,
        top: currentTop,
        height: currentHeight
      });

      currentTop += currentHeight;
    }

    return positions;
  }, [items, itemHeight]);

  const totalHeight = useMemo(() => {
    if (itemPositions.length === 0) return 0;
    const lastItem = itemPositions[itemPositions.length - 1];
    return lastItem.top + lastItem.height;
  }, [itemPositions]);

  const visibleRange = useMemo(() => {
    const viewportStart = scrollTop;
    const viewportEnd = scrollTop + height;

    let startIndex = 0;
    let endIndex = items.length - 1;

    // Binary search for start index
    let left = 0;
    let right = itemPositions.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const position = itemPositions[mid];
      
      if (position.top + position.height <= viewportStart) {
        left = mid + 1;
      } else {
        startIndex = mid;
        right = mid - 1;
      }
    }

    // Binary search for end index
    left = startIndex;
    right = itemPositions.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const position = itemPositions[mid];
      
      if (position.top < viewportEnd) {
        endIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Add overscan
    startIndex = Math.max(0, startIndex - overscan);
    endIndex = Math.min(items.length - 1, endIndex + overscan);

    return { startIndex, endIndex };
  }, [scrollTop, height, itemPositions, items.length, overscan]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      const item = items[i];
      const position = itemPositions[i];
      if (item && position) {
        result.push({
          item,
          index: i,
          position,
          key: getItemKey ? getItemKey(item, i) : i
        });
      }
    }
    return result;
  }, [items, itemPositions, visibleRange, getItemKey]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setScrollTop(scrollTop);
    onScroll?.(scrollTop);
  }, [onScroll]);

  // Scroll to item
  const scrollToItem = useCallback((index: number, alignment: 'start' | 'center' | 'end' = 'start') => {
    if (!scrollElementRef.current || index < 0 || index >= items.length) return;

    const position = itemPositions[index];
    if (!position) return;

    let scrollTop: number;

    switch (alignment) {
      case 'start':
        scrollTop = position.top;
        break;
      case 'center':
        scrollTop = position.top - (height - position.height) / 2;
        break;
      case 'end':
        scrollTop = position.top - height + position.height;
        break;
    }

    scrollTop = Math.max(0, Math.min(scrollTop, totalHeight - height));
    scrollElementRef.current.scrollTop = scrollTop;
  }, [itemPositions, items.length, height, totalHeight]);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    if (scrollElementRef.current) {
      scrollElementRef.current.scrollTop = 0;
    }
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollElementRef.current) {
      scrollElementRef.current.scrollTop = totalHeight - height;
    }
  }, [totalHeight, height]);

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, position, key }) => (
          <div
            key={key}
            style={{
              position: 'absolute',
              top: position.top,
              height: position.height,
              left: 0,
              right: 0
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook for controlling virtual list
export const useVirtualList = () => {
  const listRef = useRef<{
    scrollToItem: (index: number, alignment?: 'start' | 'center' | 'end') => void;
    scrollToTop: () => void;
    scrollToBottom: () => void;
  } | null>(null);

  const scrollToItem = useCallback((index: number, alignment?: 'start' | 'center' | 'end') => {
    listRef.current?.scrollToItem(index, alignment);
  }, []);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToTop();
  }, []);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToBottom();
  }, []);

  return {
    listRef,
    scrollToItem,
    scrollToTop,
    scrollToBottom
  };
};