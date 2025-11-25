import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'wallbrowser_search_history';
const MAX_HISTORY_ITEMS = 20;

/**
 * Hook to manage search history with localStorage persistence
 */
export function useSearchHistory() {
  const [history, setHistory] = useState([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Save history to localStorage whenever it changes
  const saveHistory = useCallback((newHistory) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }, []);

  /**
   * Add a search to history
   * @param {Object} filters - The filter object used for the search
   */
  const addToHistory = useCallback((filters) => {
    // Create a summary of the search for display
    const summary = createSearchSummary(filters);
    
    // Don't add empty searches
    if (!summary) return;

    const entry = {
      id: Date.now(),
      filters: { ...filters },
      summary,
      timestamp: new Date().toISOString(),
    };

    setHistory((prev) => {
      // Remove duplicate searches (same summary)
      const filtered = prev.filter((item) => item.summary !== summary);
      
      // Add new entry at the beginning, limit to max items
      const newHistory = [entry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      } catch (error) {
        console.error('Failed to save search history:', error);
      }
      
      return newHistory;
    });
  }, []);

  /**
   * Remove a specific entry from history
   */
  const removeFromHistory = useCallback((id) => {
    setHistory((prev) => {
      const newHistory = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      } catch (error) {
        console.error('Failed to save search history:', error);
      }
      return newHistory;
    });
  }, []);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setHistory([]);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, []);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}

/**
 * Create a human-readable summary of the search filters
 */
function createSearchSummary(filters) {
  const parts = [];

  // Query
  if (filters.query?.trim()) {
    parts.push(`"${filters.query.trim()}"`);
  }

  // Categories
  const categories = [];
  if (filters.general) categories.push('General');
  if (filters.anime) categories.push('Anime');
  if (filters.people) categories.push('People');
  if (categories.length > 0 && categories.length < 3) {
    parts.push(categories.join(', '));
  }

  // Resolution
  if (filters.resolution) {
    parts.push(filters.resolution);
  } else if (filters.ratio) {
    parts.push(filters.ratio.replace('x', ':'));
  }

  // Sort
  if (filters.sort && filters.sort !== 'date_added') {
    const sortLabels = {
      relevance: 'Relevance',
      random: 'Random',
      views: 'Views',
      favorites: 'Favorites',
      toplist: 'Toplist',
      hot: 'Hot',
    };
    if (sortLabels[filters.sort]) {
      parts.push(sortLabels[filters.sort]);
    }
  }

  // Color
  if (filters.color) {
    parts.push(`Color: ${filters.color}`);
  }

  // If no meaningful filters, return null
  if (parts.length === 0) {
    // Check if it's just default "all" search
    if (filters.general && filters.anime && filters.people) {
      return 'All wallpapers';
    }
    return null;
  }

  return parts.join(' · ');
}

/**
 * Format relative time for display
 */
export function formatHistoryTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
