import { useState, useCallback } from 'react';
import {
  DEFAULT_FILTERS,
  FILE_TYPE_OPTIONS,
  TIME_RANGE_OPTIONS,
  getColorName,
} from '../constants';

const STORAGE_KEY = 'wallbrowser_search_history';
const MAX_HISTORY_ITEMS = 20;

/**
 * Hook to manage search history with localStorage persistence
 */
export function useSearchHistory() {
  // Read before the first paint so a fetch in that first moment is added
  // onto the saved list instead of being replaced by it.
  const [history, setHistory] = useState(readHistory);

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
    const { seed, ...filtersWithoutSeed } = filters || {};
    const summary = createSearchSummary(filtersWithoutSeed);
    
    // Don't add empty searches
    if (!summary) return;

    const entry = {
      id: Date.now(),
      filters: { ...filtersWithoutSeed },
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
function readHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set();
    const cleaned = [];
    parsed.forEach((entry) => {
      const normalized = normalizeEntry(entry);
      if (!normalized || seen.has(normalized.summary)) return;
      seen.add(normalized.summary);
      cleaned.push(normalized);
    });

    if (JSON.stringify(cleaned) !== JSON.stringify(parsed)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (error) {
    console.error('Failed to load search history:', error);
    return [];
  }
}

function normalizeEntry(entry) {
  if (!entry?.filters) return null;
  const { seed, ...filters } = entry.filters;
  const summary = createSearchSummary(filters);
  if (!summary) return null;
  return { ...entry, filters, summary };
}

function createSearchSummary(filters) {
  const parts = [];

  if (filters.query?.trim()) {
    parts.push(`"${filters.query.trim()}"`);
  }

  const categoryLabel = categorySummary(filters.categories);
  if (categoryLabel) parts.push(categoryLabel);

  if (filters.resolution) {
    const size = filters.resolution.replace(/x/gi, '×');
    parts.push(filters.exactResolution ? `= ${size}` : `≥ ${size}`);
  }
  if (filters.ratio) {
    parts.push(filters.ratio.replace(/x/gi, ':'));
  }

  if (filters.fileType) {
    const fileLabel = FILE_TYPE_OPTIONS.find((option) => option.value === filters.fileType)?.label;
    if (fileLabel && fileLabel !== 'Any') parts.push(fileLabel);
  }

  if (filters.sort === 'toplist') {
    const range = TIME_RANGE_OPTIONS.find((option) => option.value === filters.timeRange)?.label || 'Month';
    parts.push(`Top · ${range}`);
  } else if (filters.sort && filters.sort !== 'date_added') {
    const sortLabels = {
      relevance: 'Relevance',
      random: 'Random',
      views: 'Views',
      favorites: 'Favorites',
      hot: 'Hot',
    };
    if (sortLabels[filters.sort]) parts.push(sortLabels[filters.sort]);
  }

  if (filters.color) {
    parts.push(`Color: ${getColorName(filters.color)}`);
  }

  if (filters.includeNsfw) {
    parts.push('NSFW');
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function categorySummary(categories) {
  const selected = categories || DEFAULT_FILTERS.categories;
  const defaults = DEFAULT_FILTERS.categories;
  const isDefault = selected.general === defaults.general
    && selected.anime === defaults.anime
    && selected.people === defaults.people;
  if (isDefault) return null;

  const names = [];
  if (selected.general) names.push('General');
  if (selected.anime) names.push('Anime');
  if (selected.people) names.push('People');
  return names.length > 0 ? names.join(', ') : 'No categories';
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
