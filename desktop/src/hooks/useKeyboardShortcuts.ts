import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
  global?: boolean; // If true, works even when input is focused
}

interface UseKeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export const useKeyboardShortcuts = ({ 
  shortcuts, 
  enabled = true 
}: UseKeyboardShortcutsProps) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const activeElement = document.activeElement;
    const isInputActive = activeElement?.tagName === 'INPUT' || 
                         activeElement?.tagName === 'TEXTAREA' ||
                         (activeElement as HTMLElement)?.contentEditable === 'true';

    for (const shortcut of shortcuts) {
      // Skip if input is active and shortcut is not global
      if (isInputActive && !shortcut.global) continue;

      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                        event.code.toLowerCase() === shortcut.key.toLowerCase();

      const modifiersMatch = 
        (!shortcut.ctrlKey || event.ctrlKey) &&
        (!shortcut.metaKey || event.metaKey) &&
        (!shortcut.shiftKey || event.shiftKey) &&
        (!shortcut.altKey || event.altKey) &&
        // Ensure exact modifier match
        (!!shortcut.ctrlKey === event.ctrlKey || (!shortcut.ctrlKey && !event.ctrlKey)) &&
        (!!shortcut.metaKey === event.metaKey || (!shortcut.metaKey && !event.metaKey)) &&
        (!!shortcut.shiftKey === event.shiftKey || (!shortcut.shiftKey && !event.shiftKey)) &&
        (!!shortcut.altKey === event.altKey || (!shortcut.altKey && !event.altKey));

      if (keyMatches && modifiersMatch) {
        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
        break; // Only execute first matching shortcut
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown, enabled]);

  // Helper function to format shortcut for display
  const formatShortcut = (shortcut: KeyboardShortcut): string => {
    const parts = [];
    
    if (shortcut.ctrlKey) parts.push(navigator.platform.includes('Mac') ? '⌃' : 'Ctrl');
    if (shortcut.metaKey) parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Cmd');
    if (shortcut.shiftKey) parts.push(navigator.platform.includes('Mac') ? '⇧' : 'Shift');
    if (shortcut.altKey) parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
    
    // Format key display
    let keyDisplay = shortcut.key;
    if (shortcut.key === ' ') keyDisplay = 'Space';
    else if (shortcut.key === 'Escape') keyDisplay = 'Esc';
    else if (shortcut.key === 'Enter') keyDisplay = '⏎';
    else if (shortcut.key === 'ArrowUp') keyDisplay = '↑';
    else if (shortcut.key === 'ArrowDown') keyDisplay = '↓';
    else if (shortcut.key === 'ArrowLeft') keyDisplay = '←';
    else if (shortcut.key === 'ArrowRight') keyDisplay = '→';
    
    parts.push(keyDisplay.toUpperCase());
    
    return parts.join(navigator.platform.includes('Mac') ? '' : '+');
  };

  return {
    formatShortcut,
    shortcuts: shortcuts.map(s => ({
      ...s,
      formatted: formatShortcut(s)
    }))
  };
};