import { useEffect } from 'react';

/**
 * Custom hook for keyboard shortcuts
 */
export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger if user is typing in an input
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.tagName === 'SELECT'
      ) {
        // But allow Enter in search inputs
        if (event.key === 'Enter' && shortcuts.onEnter) {
          shortcuts.onEnter();
        }
        return;
      }

      // Handle shortcuts
      if (event.key === 'Escape' && shortcuts.onEscape) {
        shortcuts.onEscape();
      }
      
      if (event.key === 'ArrowLeft' && shortcuts.onArrowLeft) {
        shortcuts.onArrowLeft();
      }
      
      if (event.key === 'ArrowRight' && shortcuts.onArrowRight) {
        shortcuts.onArrowRight();
      }

      // Ctrl/Cmd + A for select all
      if ((event.ctrlKey || event.metaKey) && event.key === 'a' && shortcuts.onSelectAll) {
        event.preventDefault();
        shortcuts.onSelectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
