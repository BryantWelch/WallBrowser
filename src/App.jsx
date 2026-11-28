import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ControlsPanel } from './components/ControlsPanel';
import { usePortraitPhone } from './components/FilterMenu';
import { WallpaperGrid } from './components/WallpaperGrid';
import { PaginationBar } from './components/PaginationBar';
import { PreviewModal } from './components/PreviewModal';
import { SettingsModal } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
import { PrivacyModal } from './components/PrivacyModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useWallhavenAPI } from './hooks/useWallhavenAPI';
import { usePagination } from './hooks/usePagination';
import { useFavorites } from './hooks/useFavorites';
import { useDownloadedWallpapers } from './hooks/useDownloadedWallpapers';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSearchHistory } from './hooks/useSearchHistory';
import { DEFAULT_FILTERS, STORAGE_KEYS, VIEW_MODES } from './constants';
import { clearCache } from './utils';
import { prefetchImage, toProxiedFullUrl, toWorkerFullUrl, downloadWallpaperBlob, createWallpapersZip } from './utils/imageUtils';
import { ToastContainer } from './components/Toast';
import { useToast } from './context/ToastContext';

const HEADER_STATS = [
  { key: 'wallpapers', label: 'Wallpapers', title: 'Total wallpapers' },
  { key: 'views', label: 'Views', title: 'Total wallpaper views' },
  { key: 'tags', label: 'Tags', title: 'Total tags' },
  { key: 'users', label: 'Users', title: 'Total users' },
];

function parseCount(text) {
  const value = Number(String(text).replace(/,/g, '').trim());
  return Number.isFinite(value) ? value : null;
}

function parseDayMonth(text) {
  const [today, month] = String(text).split('/').map(parseCount);
  return { today: today ?? null, month: month ?? null };
}

function parseWallhavenStats(html) {
  const sections = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>\s*<dl class="datalist">(.*?)<\/dl>/g)];
  const byName = {};
  sections.forEach(([, heading, body]) => {
    const name = heading.replace(/<[^>]+>/g, '').trim();
    const rows = [...body.matchAll(/<dt>(.*?)<\/dt>\s*<dd>(.*?)<\/dd>/g)].map(([, label, value]) => ({
      label: label.replace(/<[^>]+>/g, '').trim(),
      value: value.replace(/<[^>]+>/g, '').trim(),
    }));
    byName[name] = rows;
  });

  const row = (section, label) => byName[section]?.find((item) => item.label === label)?.value;
  const wallNew = parseDayMonth(row('Wallpapers', 'New this day/month') || '');
  const tagNew = parseDayMonth(row('Tags', 'New this day/month') || '');
  const userNew = parseDayMonth(row('Users', 'New this day/month') || '');
  const userActive = parseDayMonth(row('Users', 'Active this day/month') || '');

  return {
    wallpapers: { total: parseCount(row('Wallpapers', 'Total Wallpapers')), ...wallNew },
    views: { total: parseCount(row('Wallpapers', 'Total Views')) },
    tags: { total: parseCount(row('Tags', 'Total Tags')), ...tagNew },
    users: {
      total: parseCount(row('Users', 'Total Users')),
      ...userNew,
      activeToday: userActive.today,
      activeMonth: userActive.month,
    },
  };
}

function formatCatalogCount(value, compact) {
  if (value == null) return '—';
  if (compact || value >= 1000000000) {
    if (value >= 1000000000) {
      const billions = value / 1000000000;
      return `${billions >= 10 ? Math.round(billions) : billions.toFixed(2)}B`;
    }
    if (value >= 1000000) {
      const millions = value / 1000000;
      return `${millions >= 10 ? Math.round(millions) : millions.toFixed(1)}M`;
    }
    if (value >= 1000) return `${Math.round(value / 1000)}K`;
  }
  return value.toLocaleString();
}

const CATALOG_STATS_MAX_AGE = 30 * 60 * 1000;

function catalogStatTitle(stat, data) {
  if (data?.total == null) return stat.title;
  const parts = [`${stat.title}: ${data.total.toLocaleString()}`];
  if (data.today != null) parts.push(`${data.today.toLocaleString()} new today`);
  if (data.month != null) parts.push(`${data.month.toLocaleString()} this month`);
  if (data.activeToday != null) parts.push(`${data.activeToday.toLocaleString()} active today`);
  return parts.join('. ');
}

function sameSearchFilters(left, right) {
  if (!left || !right) return false;
  const query = (filters) => {
    const text = (filters.query || '').trim();
    if (!filters.fileType) return text;
    return text ? `type:${filters.fileType} ${text}` : `type:${filters.fileType}`;
  };
  const categories = (filters) => {
    const selected = filters.categories || {};
    return `${selected.general ? 1 : 0}${selected.anime ? 1 : 0}${selected.people ? 1 : 0}`;
  };
  const resolution = (filters) => {
    if (!filters.resolution) return '';
    return `${filters.exactResolution ? '=' : '>='}${filters.resolution}`;
  };
  const sort = left.sort || '';
  return sort === (right.sort || '')
    && (sort === 'toplist' ? (left.timeRange || '1M') === (right.timeRange || '1M') : true)
    && query(left) === query(right)
    && categories(left) === categories(right)
    && (left.ratio || '') === (right.ratio || '')
    && Boolean(left.includeNsfw) === Boolean(right.includeNsfw)
    && (left.color || '').replace('#', '').toLowerCase() === (right.color || '').replace('#', '').toLowerCase()
    && resolution(left) === resolution(right);
}

function App() {
  const { addToast } = useToast();
  // Always start with default filters - no persistence
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [desktopViewMode, setDesktopViewMode] = useLocalStorage(STORAGE_KEYS.VIEW_MODE, VIEW_MODES.COMFORTABLE);
  const [mobileViewMode, setMobileViewMode] = useLocalStorage(STORAGE_KEYS.VIEW_MODE_MOBILE, VIEW_MODES.CINEMATIC);
  const portraitPhone = usePortraitPhone();
  const viewMode = portraitPhone ? mobileViewMode : desktopViewMode;
  const setViewMode = portraitPhone ? setMobileViewMode : setDesktopViewMode;
  
  // Clear the wallpaper request cache on mount. Header stats are stored separately.
  useEffect(() => {
    clearCache();

    const savedAt = catalogCache?.savedAt;
    const hasStats = catalogCache?.stats?.wallpapers?.total != null;
    if (hasStats && savedAt && Date.now() - savedAt < CATALOG_STATS_MAX_AGE) return;

    let cancelled = false;
    const fetchTotalCount = async () => {
      try {
        const response = await fetch('/api/wallhaven/stats');
        if (!response.ok || cancelled) return;
        const html = await response.text();
        const stats = parseWallhavenStats(html);
        if (cancelled || stats?.wallpapers?.total == null) return;
        setCatalogCache({ savedAt: Date.now(), stats });
      } catch (error) {
        console.error('Failed to fetch Wallhaven stats:', error);
      }
    };

    fetchTotalCount();
    return () => {
      cancelled = true;
    };
  }, []);
  
  // API and data management
  const { isLoading, error, searchFailed, searchFailure, wallpapers, totalPages: apiTotalPages, totalResults, fetchWallpapers, fetchWallpaperDetails, prefetchPages, clearError, retrySearch } = useWallhavenAPI();
  
  // Pagination
  const { page, totalPages, setTotalPages, goToPage, goToNextPage, goToPreviousPage, resetPage, canGoNext, canGoPrevious } = usePagination();
  
  // Selection state - store full wallpaper objects to persist across pages
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedWallpapers, setSelectedWallpapers] = useState(new Map()); // Map<id, wallpaper>
  
  // Favorites management
  const { favorites, toggleFavorite, isFavorite, removeFavorite, removeManyFavorites } = useFavorites();

  // Downloaded wallpapers tracking (per-device)
  const { downloadedIds, markDownloaded: markDownloadedIds, isDownloaded, removeDownloaded } = useDownloadedWallpapers();
  
  // Search history management
  const { history: searchHistory, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();
  
  // Preview modal state
  const [previewWallpaper, setPreviewWallpaper] = useState(null);
  
  // Show only selected wallpapers toggle
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [pageBeforeShowingSelected, setPageBeforeShowingSelected] = useState(1);
  
  // Show only favorites toggle
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [pageBeforeShowingFavorites, setPageBeforeShowingFavorites] = useState(1);
  // Selection that existed before Favorites opened. Leaving the view restores
  // it, so checks made inside Favorites do not replace the search selection.
  const selectionBeforeFavoritesRef = useRef(null);

  // Show only downloaded wallpapers toggle
  const [showOnlyDownloaded, setShowOnlyDownloaded] = useState(false);
  const [pageBeforeShowingDownloaded, setPageBeforeShowingDownloaded] = useState(1);
  const [downloadedViewWallpapers, setDownloadedViewWallpapers] = useLocalStorage(STORAGE_KEYS.DOWNLOADED_DATA, []);
  
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Footer modal states
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  // Header stats, kept locally so a reload can show the last counts immediately.
  const [catalogCache, setCatalogCache] = useLocalStorage(STORAGE_KEYS.CATALOG_STATS, null);
  const catalogStats = catalogCache?.stats ?? null;

  // Download status state
  const [downloadStatus, setDownloadStatus] = useState('idle'); // 'idle', 'downloading', 'zipping', 'success', 'error'


  const getDownloadButtonLabel = useCallback((status, count) => {
    if (status === 'downloading') return '⏳ Downloading...';
    if (status === 'zipping') return '⏳ Creating ZIP...';
    if (status === 'success') return '✓ Downloaded';
    if (status === 'error') return '✕ Failed';
    return `Download selected (${count})`;
  }, []);
  
  // Track last clicked index for shift-click range selection
  const lastClickedIndexRef = useRef(null);
  
  // Sync API total pages with pagination
  useEffect(() => {
    if (apiTotalPages) {
      setTotalPages(apiTotalPages);
    }
  }, [apiTotalPages, setTotalPages]);

  const isDefaultFilters = useMemo(() => {
    return JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);
  }, [filters]);
  
  // Filters last sent to Wallhaven. Fetch pulses only when the form would
  // change the grid, so undoing an edit turns the pulse off again.
  const [appliedSearchFilters, setAppliedSearchFilters] = useState(filters);
  const appliedFiltersRef = useRef(filters);
  const hasPendingFilterChanges = !sameSearchFilters(filters, appliedSearchFilters);
  const rememberApplied = useCallback((nextFilters) => {
    appliedFiltersRef.current = nextFilters;
    setAppliedSearchFilters(nextFilters);
  }, []);
  // Options for a search that still has to wait for the page to reset.
  const pendingFetchOptionsRef = useRef(null);
  const fetchApplied = useCallback((nextFilters, nextPage, options) => {
    rememberApplied(nextFilters);
    return fetchWallpapers(nextFilters, nextPage, options);
  }, [fetchWallpapers, rememberApplied]);
  const startSearch = useCallback((nextFilters) => {
    rememberApplied(nextFilters);
    const fetchOptions = { renewSeed: true };
    if (page === 1) {
      return fetchWallpapers(nextFilters, 1, fetchOptions);
    }
    pendingFetchOptionsRef.current = fetchOptions;
    resetPage();
    return Promise.resolve();
  }, [page, resetPage, fetchWallpapers, rememberApplied]);

  // Handle filter changes (no auto-fetch, just update state)
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: typeof value === 'function' ? value(prev[key]) : value
    }));
  }, []);

  // Handle multiple filter changes at once (no auto-fetch)
  const handleMultipleFilterChanges = useCallback((updates) => {
    setFilters(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Clear the form back to defaults without searching. The current page
  // stays put until the user presses Fetch.
  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // A click on a wallpaper starts a fresh search. The only search filter that
  // carries over is the NSFW preference from Settings.
  const freshSearch = useCallback((overrides) => ({
    ...DEFAULT_FILTERS,
    categories: { ...DEFAULT_FILTERS.categories },
    includeNsfw: Boolean(filters.includeNsfw),
    ...overrides,
  }), [filters.includeNsfw]);

  // Leave Favorites, Selected, and Downloads and show this search.
  // The saved Favorites selection is dropped, because this is a new search.
  const showSearchResults = useCallback((nextFilters, { recordHistory = false } = {}) => {
    selectionBeforeFavoritesRef.current = null;
    setShowOnlyFavorites(false);
    setShowOnlySelected(false);
    setShowOnlyDownloaded(false);
    setPreviewWallpaper(null);
    setFilters(nextFilters);
    setSelectedIds(new Set());
    setSelectedWallpapers(new Map());
    if (recordHistory) addToHistory(nextFilters);
    return startSearch(nextFilters);
  }, [addToHistory, startSearch]);

  // Handle search for similar wallpapers
  const handleSearchSimilar = useCallback((wallpaperId) => {
    return showSearchResults(
      freshSearch({ query: `like:${wallpaperId}` }),
      { recordHistory: true }
    );
  }, [freshSearch, showSearchResults]);
  
  // Fetch wallpapers (manual fetch via button)
  const handleFetch = useCallback(() => {
    clearCache();
    return showSearchResults(filters, { recordHistory: true });
  }, [filters, showSearchResults]);
  
  // Handle selecting a search from history
  const handleSelectHistory = useCallback((historyFilters) => {
    const { seed, ...formFilters } = historyFilters;
    clearCache();
    showSearchResults(formFilters);
  }, [showSearchResults]);
  
  // Initial load - fetch with default filters
  const hasInitialFetchRef = useRef(false);
  useEffect(() => {
    if (!hasInitialFetchRef.current) {
      hasInitialFetchRef.current = true;
      fetchApplied(filters, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Auto-fetch ONLY on page changes (not filter changes)
  // Note: Only 'page' in dependency array - filters handled via ref
  // fetchApplied is NOT in deps to prevent a page-change loop
  const prevPageRef = useRef(page);
  useEffect(() => {
    // Skip if this is just the initial page value
    if (prevPageRef.current === page) {
      return;
    }
    prevPageRef.current = page;
    
    // Page changed. Keep the search that produced this grid. Unsent form
    // edits stay pending until the user presses Fetch.
    const appliedFilters = appliedFiltersRef.current;
    if (!appliedFilters || !appliedFilters.categories) {
      return;
    }

    // Scroll behavior on page change:
    // - Desktop: scroll to very top (search + filters)
    // - Mobile: scroll to the pagination bar instead of all the way to the top
    try {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        const paginationEl = document.querySelector('.pagination-bar');
        if (paginationEl && typeof paginationEl.scrollIntoView === 'function') {
          paginationEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (e) {
      // Fallback in case of any runtime issues
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const pendingOptions = pendingFetchOptionsRef.current;
    pendingFetchOptionsRef.current = null;
    fetchApplied(appliedFilters, page, pendingOptions || { renewSeed: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  
  // Prefetch next page thumbnails (full-size images are loaded on demand in preview)
  useEffect(() => {
    if (wallpapers.length > 0 && totalPages && !isLoading) {
      const timer = setTimeout(() => {
        prefetchPages(appliedFiltersRef.current, page, totalPages);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [wallpapers, page, totalPages, isLoading, prefetchPages]);
  
  // Filter wallpapers based on showOnlySelected, favorites, or downloaded (needed for range selection)
  const displayedWallpapers = showOnlySelected 
    ? Array.from(selectedWallpapers.values())
    : showOnlyFavorites
    ? favorites
    : showOnlyDownloaded
    ? downloadedViewWallpapers
    : wallpapers;

  // Toggle selection (with shift-click range selection support)
  const toggleSelect = useCallback((id, index, shiftKey = false) => {
    // Handle shift-click range selection
    if (shiftKey && lastClickedIndexRef.current !== null && index !== null) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const idsToSelect = displayedWallpapers.slice(start, end + 1).map(w => w.id);
      
      setSelectedIds(prev => {
        const next = new Set(prev);
        idsToSelect.forEach(id => next.add(id));
        return next;
      });
      
      setSelectedWallpapers(prevMap => {
        const nextMap = new Map(prevMap);
        displayedWallpapers.slice(start, end + 1).forEach(wallpaper => {
          nextMap.set(wallpaper.id, wallpaper);
        });
        return nextMap;
      });
    } else {
      // A click unchecks the last selected wallpaper. A shift-click only adds,
      // so it must not leave this view while that wallpaper stays checked.
      const removedLast = showOnlySelected && selectedIds.size === 1 && selectedIds.has(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          setSelectedWallpapers(prevMap => {
            const nextMap = new Map(prevMap);
            nextMap.delete(id);
            return nextMap;
          });
        } else {
          next.add(id);
          const wallpaper = displayedWallpapers.find(w => w.id === id);
          if (wallpaper) {
            setSelectedWallpapers(prevMap => {
              const nextMap = new Map(prevMap);
              nextMap.set(id, wallpaper);
              return nextMap;
            });
          }
        }
        return next;
      });
      if (removedLast) {
        setShowOnlySelected(false);
        goToPage(pageBeforeShowingSelected);
      }
    }

    // Update last clicked index
    if (index !== null) {
      lastClickedIndexRef.current = index;
    }
  }, [displayedWallpapers, showOnlySelected, selectedIds, pageBeforeShowingSelected, goToPage]);
  
  // Select all visible (current page only, or all visible in favorites/downloaded views)
  const selectAllVisible = useCallback(() => {
    // Selected view has no Select all button. The shortcut must not reach
    // through it and check the search page behind the list.
    if (showOnlySelected) return;
    const sourceList = (showOnlyFavorites || showOnlyDownloaded) ? displayedWallpapers : wallpapers;
    const currentPageIds = sourceList.map(w => w.id);
    
    // Select all on current page
    setSelectedIds(prev => {
      const next = new Set(prev);
      currentPageIds.forEach(id => next.add(id));
      return next;
    });
    setSelectedWallpapers(prevMap => {
      const nextMap = new Map(prevMap);
      sourceList.forEach(w => nextMap.set(w.id, w));
      return nextMap;
    });
  }, [wallpapers, displayedWallpapers, showOnlyFavorites, showOnlyDownloaded, showOnlySelected]);

  // Deselect all visible (current page only, or all if in show-selected mode)
  const deselectAllVisible = useCallback(() => {
    if (showOnlySelected) {
      // In show-selected mode: clear all selections and return to previous page
      setSelectedIds(new Set());
      setSelectedWallpapers(new Map());
      setShowOnlySelected(false);
      goToPage(pageBeforeShowingSelected);
    } else {
      // Normal mode: deselect only current page (or all visible in favorites/downloaded views)
      const sourceList = (showOnlyFavorites || showOnlyDownloaded) ? displayedWallpapers : wallpapers;
      const currentPageIds = sourceList.map(w => w.id);
      
      setSelectedIds(prev => {
        const next = new Set(prev);
        currentPageIds.forEach(id => next.delete(id));
        return next;
      });
      setSelectedWallpapers(prevMap => {
        const nextMap = new Map(prevMap);
        currentPageIds.forEach(id => nextMap.delete(id));
        return nextMap;
      });
    }
  }, [wallpapers, displayedWallpapers, showOnlySelected, showOnlyFavorites, showOnlyDownloaded, pageBeforeShowingSelected, goToPage]);

  // Bulk remove selected items from downloaded history (primarily used in downloaded view)
  const handleRemoveDownloadedSelected = useCallback(() => {
    if (!selectedIds.size) return;

    const idsToRemove = downloadedIds.filter(id => selectedIds.has(id));
    if (!idsToRemove.length) return;

    removeDownloaded(idsToRemove);

    // Also remove from cached downloaded view data
    setDownloadedViewWallpapers((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const removeSet = new Set(idsToRemove);
      return current.filter((w) => !removeSet.has(w.id));
    });

    // Clear those ids from selection state
    setSelectedIds((prev) => {
      const next = new Set(prev);
      idsToRemove.forEach((id) => next.delete(id));
      return next;
    });

    setSelectedWallpapers((prevMap) => {
      const nextMap = new Map(prevMap);
      idsToRemove.forEach((id) => nextMap.delete(id));
      return nextMap;
    });

    // Toast feedback
    addToast(
      idsToRemove.length === 1
        ? 'Removed 1 wallpaper from download history.'
        : `Removed ${idsToRemove.length} wallpapers from download history.`,
      'success'
    );
  }, [selectedIds, downloadedIds, removeDownloaded, setDownloadedViewWallpapers, addToast]);

  // Bulk unfavorite selected wallpapers (primarily used in favorites view)
  const handleUnfavoriteSelected = useCallback(() => {
    if (!selectedIds.size) return;

    // Only operate on favorites that are actually selected, to avoid any stale ids
    const idsToUnfavorite = favorites
      .filter((fav) => selectedIds.has(fav.id))
      .map((fav) => fav.id);

    if (!idsToUnfavorite.length) return;

    // Bulk-remove in a single update to avoid intermediate state issues
    removeManyFavorites(idsToUnfavorite);

    // Clear those ids from selection state
    setSelectedIds((prev) => {
      const next = new Set(prev);
      idsToUnfavorite.forEach((id) => next.delete(id));
      return next;
    });

    setSelectedWallpapers((prevMap) => {
      const nextMap = new Map(prevMap);
      idsToUnfavorite.forEach((id) => nextMap.delete(id));
      return nextMap;
    });

    // Toast feedback
    addToast(
      idsToUnfavorite.length === 1
        ? 'Removed 1 favorite.'
        : `Removed ${idsToUnfavorite.length} favorites.`,
      'success'
    );
  }, [selectedIds, favorites, removeManyFavorites, addToast]);
  
  // Helper to mark wallpapers as downloaded and cache their full data
  const markDownloaded = useCallback((wallpaperOrWallpapers) => {
    if (!wallpaperOrWallpapers) return;

    const wallpapersArray = Array.isArray(wallpaperOrWallpapers)
      ? wallpaperOrWallpapers
      : [wallpaperOrWallpapers];

    const ids = wallpapersArray
      .map((w) => (w && w.id ? w.id : null))
      .filter(Boolean);

    if (ids.length) {
      markDownloadedIds(ids);
    }

    setDownloadedViewWallpapers((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const byId = new Map(current.map((w) => [w.id, w]));
      wallpapersArray.forEach((w) => {
        if (w && w.id) {
          byId.set(w.id, w);
        }
      });
      return Array.from(byId.values());
    });
  }, [markDownloadedIds, setDownloadedViewWallpapers]);

  // Download selected with ZIP
  const handleDownloadSelected = useCallback(async () => {
    // Use selectedWallpapers Map to get all selected wallpapers across all pages
    const selected = Array.from(selectedWallpapers.values());
    if (selected.length === 0) return;
    
    try {
      if (selected.length === 1) {
        // Single file - download via proxy
        const wallpaper = selected[0];
        
        setDownloadStatus('downloading');
        
        const { blob, ext } = await downloadWallpaperBlob(wallpaper.url);
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `wallbrowser-${wallpaper.id}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        
        // Mark as downloaded
        markDownloaded(wallpaper);

        setDownloadStatus('success');
        addToast('Download complete!', 'success');
        setSelectedIds(new Set());
        setSelectedWallpapers(new Map());
        setTimeout(() => setDownloadStatus('idle'), 2000);
        return;
      }
      
      // Multiple files - create ZIP via shared helper
      setDownloadStatus('zipping');
      addToast(`Preparing ZIP for ${selected.length} wallpapers...`, 'loading', 3000);

      const { content, successfulIds, failed } = await createWallpapersZip(selected);
      const successIds = Array.isArray(successfulIds) ? successfulIds : [];
      const failedCount = Array.isArray(failed) ? failed.length : 0;

      if (successIds.length === 0 || !content) {
        setDownloadStatus('error');
        addToast('Download failed. Please try again.', 'error');
        setTimeout(() => setDownloadStatus('idle'), 2000);
        return;
      }

      const blobUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `wallpapers-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      const successSet = new Set(successIds);
      const successfulWallpapers = selected.filter((w) => successSet.has(w.id));
      if (successfulWallpapers.length > 0) {
        markDownloaded(successfulWallpapers);
      }

      // Leave the files that never downloaded selected so they can be tried again.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        successSet.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedWallpapers((prevMap) => {
        const nextMap = new Map(prevMap);
        successSet.forEach((id) => nextMap.delete(id));
        return nextMap;
      });

      if (failedCount > 0) {
        setDownloadStatus('idle');
        addToast(
          `ZIP ready: downloaded ${successIds.length} of ${selected.length} wallpapers (${failedCount} failed).`,
          'warning'
        );
      } else {
        setDownloadStatus('success');
        addToast('ZIP download ready!', 'success');
        setTimeout(() => setDownloadStatus('idle'), 2000);
      }
    } catch (err) {
      console.error('Download failed:', err);
      setDownloadStatus('error');
      addToast('Download failed. Please try again.', 'error');
      setTimeout(() => setDownloadStatus('idle'), 2000);
    }
  }, [selectedWallpapers, addToast, markDownloaded]);
  
  // Preview navigation
  const handleWallpaperClick = useCallback((wallpaper) => {
    setPreviewWallpaper(wallpaper);
  }, []);
  
  const handlePreviewClose = useCallback(() => {
    setPreviewWallpaper(null);
  }, []);
  
  // Handle color click in preview modal
  const handleColorClick = useCallback((colorHex) => {
    const colorValue = colorHex.replace('#', '');
    return showSearchResults(
      freshSearch({ color: colorValue }),
      { recordHistory: true }
    );
  }, [freshSearch, showSearchResults]);

  // Handle resolution click from thumbnails
  const handleResolutionClick = useCallback((width, height) => {
    if (!width || !height) return undefined;

    return showSearchResults(
      freshSearch({
        resolution: `${width}x${height}`,
        exactResolution: true,
      }),
      { recordHistory: true }
    );
  }, [freshSearch, showSearchResults]);

  // Handle uploader click in preview modal
  const handleUploaderClick = useCallback((username) => {
    const name = String(username || '').replace(/^@/, '').trim();
    if (!name || name === 'Anonymous') return undefined;

    return showSearchResults(
      freshSearch({ query: `@${name}` }),
      { recordHistory: true }
    );
  }, [freshSearch, showSearchResults]);

  // Handle category click in preview modal
  const handleCategoryClick = useCallback((category) => {
    const key = String(category || '').toLowerCase();
    if (!['general', 'anime', 'people'].includes(key)) return undefined;

    return showSearchResults(
      freshSearch({
        categories: {
          general: key === 'general',
          anime: key === 'anime',
          people: key === 'people',
        },
      }),
      { recordHistory: true }
    );
  }, [freshSearch, showSearchResults]);

  // Handle tag click in preview modal
  const handleTagClick = useCallback((tagName) => {
    return showSearchResults(
      freshSearch({ query: tagName }),
      { recordHistory: true }
    );
  }, [freshSearch, showSearchResults]);
  
  // Ref to track if we need to reopen preview after page change
  const shouldReopenPreviewRef = useRef(null); // 'next' or 'prev' or null

  // Effect to reopen preview after page change
  useEffect(() => {
    if (shouldReopenPreviewRef.current && wallpapers.length > 0 && !isLoading) {
      if (shouldReopenPreviewRef.current === 'next') {
        setPreviewWallpaper(wallpapers[0]);
      } else if (shouldReopenPreviewRef.current === 'prev') {
        setPreviewWallpaper(wallpapers[wallpapers.length - 1]);
      }
      shouldReopenPreviewRef.current = null;
    }
  }, [wallpapers, isLoading]);

  // Favorites, Selected, and Downloads are one list. Preview next and
  // previous stay inside that list. A normal search still walks the page
  // and turns to the next page at the end.
  const libraryPreview = showOnlySelected || showOnlyFavorites || showOnlyDownloaded;
  const previewList = libraryPreview ? displayedWallpapers : wallpapers;
  const previewIndex = previewList.findIndex(w => w.id === previewWallpaper?.id);
  const hasNextPreview = previewIndex >= 0 && (
    previewIndex < previewList.length - 1 || (!libraryPreview && canGoNext)
  );
  const hasPreviousPreview = previewIndex > 0 || (
    !libraryPreview && previewIndex === 0 && canGoPrevious
  );

  const handlePreviewNext = useCallback(() => {
    const list = libraryPreview ? displayedWallpapers : wallpapers;
    const currentIndex = list.findIndex(w => w.id === previewWallpaper?.id);
    if (currentIndex >= 0 && currentIndex < list.length - 1) {
      setPreviewWallpaper(list[currentIndex + 1]);
      return;
    }
    if (!libraryPreview && currentIndex === list.length - 1 && canGoNext) {
      shouldReopenPreviewRef.current = 'next';
      goToNextPage();
    }
  }, [libraryPreview, displayedWallpapers, wallpapers, previewWallpaper, canGoNext, goToNextPage]);
  
  const handlePreviewPrevious = useCallback(() => {
    const list = libraryPreview ? displayedWallpapers : wallpapers;
    const currentIndex = list.findIndex(w => w.id === previewWallpaper?.id);
    if (currentIndex > 0) {
      setPreviewWallpaper(list[currentIndex - 1]);
      return;
    }
    if (!libraryPreview && currentIndex === 0 && canGoPrevious) {
      shouldReopenPreviewRef.current = 'prev';
      goToPreviousPage();
    }
  }, [libraryPreview, displayedWallpapers, wallpapers, previewWallpaper, canGoPrevious, goToPreviousPage]);

  // Wallhaven returns 24 per page. Keep the counter on the page that actually
  // owns the list currently on screen while the next page is still loading.
  const WALLHAVEN_PAGE_SIZE = 24;
  const loadedResultsPageRef = useRef(page);
  useEffect(() => {
    if (!isLoading) loadedResultsPageRef.current = page;
  }, [isLoading, page]);

  const previewPosition = useMemo(() => {
    if (!previewWallpaper) return null;

    if (showOnlyFavorites || showOnlySelected || showOnlyDownloaded) {
      const index = displayedWallpapers.findIndex((item) => item.id === previewWallpaper.id);
      if (index < 0 || displayedWallpapers.length === 0) return null;
      return { current: index + 1, total: displayedWallpapers.length };
    }

    if (previewIndex < 0 || typeof totalResults !== 'number' || totalResults < 1) return null;
    const resultsPage = isLoading ? loadedResultsPageRef.current : page;
    const current = Math.min((resultsPage - 1) * WALLHAVEN_PAGE_SIZE + previewIndex + 1, totalResults);
    return { current, total: totalResults };
  }, [
    previewWallpaper,
    showOnlyFavorites,
    showOnlySelected,
    showOnlyDownloaded,
    displayedWallpapers,
    previewIndex,
    totalResults,
    isLoading,
    page,
  ]);

  // While preview is open, prefetch the next full image within the current page
  // so navigation feels snappier without globally preloading all full images.
  useEffect(() => {
    if (!previewWallpaper) return;

    const list = libraryPreview ? displayedWallpapers : wallpapers;
    const currentIndex = list.findIndex(w => w.id === previewWallpaper.id);
    if (currentIndex === -1) return;

    const nextWallpaper = list[currentIndex + 1];
    if (!nextWallpaper) return;

    if (nextWallpaper.url) {
      prefetchImage(toProxiedFullUrl(nextWallpaper.url), toWorkerFullUrl(nextWallpaper.url));
    }
    // Search rows omit the uploader, tags, and source. Warm the next
    // wallpaper's details the same way as its image.
    fetchWallpaperDetails(nextWallpaper.id, { silent: true });
  }, [previewWallpaper, wallpapers, displayedWallpapers, libraryPreview, fetchWallpaperDetails]);
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    onEscape: () => {
      if (document.fullscreenElement) return;
      if (previewWallpaper) {
        handlePreviewClose();
      }
      // Don't clear selections on Escape - let users keep their multi-page selections
    },
    onArrowLeft: () => {
      // With the preview closed, these modes have no pages to turn.
      // With it open, the arrow stays inside that list.
      if (showOnlySelected || showOnlyFavorites || showOnlyDownloaded) {
        if (previewWallpaper && hasPreviousPreview) handlePreviewPrevious();
        return;
      }
      if (previewWallpaper && hasPreviousPreview) {
        handlePreviewPrevious();
      } else {
        goToPreviousPage();
      }
    },
    onArrowRight: () => {
      if (showOnlySelected || showOnlyFavorites || showOnlyDownloaded) {
        if (previewWallpaper && hasNextPreview) handlePreviewNext();
        return;
      }
      if (previewWallpaper && hasNextPreview) {
        handlePreviewNext();
      } else {
        goToNextPage();
      }
    },
    onSelectAll: selectAllVisible,
  });
  
  const selectedCount = selectedIds.size;
  
  // Toggle showing only selected wallpapers
  const toggleShowOnlySelected = useCallback(() => {
    setShowOnlySelected(prev => {
      if (!prev) {
        // Entering show-selected mode: save current page and exit favorites mode
        setPageBeforeShowingSelected(page);
        setShowOnlyFavorites(false);
        setShowOnlyDownloaded(false);
      } else {
        // Leave the list. The checks stay so the same wallpapers are still selected.
        goToPage(pageBeforeShowingSelected);
      }
      return !prev;
    });
  }, [page, pageBeforeShowingSelected, goToPage]);
  
  const restoreSelectionAfterFavorites = useCallback(() => {
    const saved = selectionBeforeFavoritesRef.current;
    selectionBeforeFavoritesRef.current = null;
    if (!saved) return;
    setSelectedIds(new Set(saved.ids));
    setSelectedWallpapers(new Map(saved.wallpapers));
  }, []);

  // Toggle showing only favorites
  const toggleShowOnlyFavorites = useCallback(() => {
    if (showOnlyFavorites) {
      // Return to the selection from before this visit, then the saved page.
      restoreSelectionAfterFavorites();
      setShowOnlyFavorites(false);
      goToPage(pageBeforeShowingFavorites);
      return;
    }
    // Entering favorites mode: remember the search selection and the page.
    selectionBeforeFavoritesRef.current = {
      ids: new Set(selectedIds),
      wallpapers: new Map(selectedWallpapers),
    };
    setPageBeforeShowingFavorites(page);
    setShowOnlySelected(false);
    setShowOnlyDownloaded(false);
    setShowOnlyFavorites(true);
  }, [showOnlyFavorites, page, pageBeforeShowingFavorites, goToPage, selectedIds, selectedWallpapers, restoreSelectionAfterFavorites]);

  // Auto-exit favorites view if no favorites remain
  useEffect(() => {
    if (showOnlyFavorites && favorites.length === 0) {
      restoreSelectionAfterFavorites();
      setShowOnlyFavorites(false);
      goToPage(pageBeforeShowingFavorites);
    }
  }, [showOnlyFavorites, favorites, pageBeforeShowingFavorites, goToPage, restoreSelectionAfterFavorites]);

  // Toggle showing only downloaded wallpapers
  const toggleShowOnlyDownloaded = useCallback(() => {
    setShowOnlyDownloaded(prev => {
      if (!prev) {
        // Entering downloaded mode: save current page and exit other modes
        setPageBeforeShowingDownloaded(page);
        setShowOnlySelected(false);
        setShowOnlyFavorites(false);
      } else {
        // Exiting downloaded mode: clear selections made in downloaded view and return to saved page
        setSelectedIds(new Set());
        setSelectedWallpapers(new Map());
        goToPage(pageBeforeShowingDownloaded);
      }
      return !prev;
    });
  }, [page, pageBeforeShowingDownloaded, goToPage]);

  // Auto-exit downloaded view if no downloaded items remain
  useEffect(() => {
    if (showOnlyDownloaded && downloadedIds.length === 0) {
      setSelectedIds(new Set());
      setSelectedWallpapers(new Map());
      setShowOnlyDownloaded(false);
      goToPage(pageBeforeShowingDownloaded);
    }
  }, [showOnlyDownloaded, downloadedIds, pageBeforeShowingDownloaded, goToPage]);
  
  const effectiveCurrentPage = (showOnlyFavorites || showOnlyDownloaded) ? 1 : page;
  const effectiveTotalPages = (showOnlyFavorites || showOnlyDownloaded) ? 1 : totalPages;

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-content">
          <div className="app-header-left">
            <div className="header-title-row">
              <svg className="app-logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{ stopColor: '#2563eb', stopOpacity: 1 }} />
                    <stop offset="100%" style={{ stopColor: '#7c3aed', stopOpacity: 1 }} />
                  </linearGradient>
                </defs>
                <rect width="100" height="100" rx="20" fill="url(#logo-grad)" />
                <rect x="20" y="30" width="25" height="40" rx="3" fill="white" opacity="0.9" />
                <rect x="50" y="20" width="30" height="50" rx="3" fill="white" opacity="1" />
                <rect x="20" y="75" width="60" height="5" rx="2" fill="white" opacity="0.7" />
              </svg>
              <div className="header-title-copy">
                <h1>WallBrowser</h1>
                <p className="app-subtitle">A modern wallpaper browser for Wallhaven</p>
              </div>
              <div className="app-header-right" aria-label="Wallhaven statistics">
                {HEADER_STATS.map((stat) => {
                  const data = catalogStats?.[stat.key];
                  return (
                    <a
                      key={stat.key}
                      href="https://wallhaven.cc/stats"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="header-stats"
                      title={catalogStatTitle(stat, data)}
                    >
                      <span className="header-stat-number">
                        <span className="header-stat-full">{formatCatalogCount(data?.total, false)}</span>
                        <span className="header-stat-compact">{formatCatalogCount(data?.total, true)}</span>
                      </span>
                      <span className="header-stat-label">{stat.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <ControlsPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onMultipleFilterChanges={handleMultipleFilterChanges}
          onClearFilters={handleClearFilters}
          isClearDisabled={isDefaultFilters}
          hasPendingFilterChanges={hasPendingFilterChanges}
          onFetch={handleFetch}
          isLoading={isLoading}
          error={error}
          onClearError={clearError}
          onRetry={retrySearch}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          searchHistory={searchHistory}
          onSelectHistory={handleSelectHistory}
          onRemoveHistory={removeFromHistory}
          onClearHistory={clearHistory}
        />

        <PaginationBar
          currentPage={effectiveCurrentPage}
          totalPages={effectiveTotalPages}
          totalResults={showOnlyFavorites ? favorites.length : showOnlyDownloaded ? displayedWallpapers.length : totalResults}
          onPageChange={goToPage}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
          isLoading={isLoading || showOnlySelected || showOnlyFavorites || showOnlyDownloaded}
          canGoNext={canGoNext && !showOnlySelected && !showOnlyFavorites && !showOnlyDownloaded}
          canGoPrevious={canGoPrevious && !showOnlySelected && !showOnlyFavorites && !showOnlyDownloaded}
        />

        <section className="grid-section">
          {(wallpapers.length > 0 || showOnlyFavorites || showOnlySelected) && (
            <div className="results-bar">
              <div className="results-info">
                <span className="results-count">
                  {showOnlySelected 
                    ? `${displayedWallpapers.length} selected` 
                    : showOnlyFavorites
                    ? `${displayedWallpapers.length} favorites`
                    : showOnlyDownloaded
                    ? `${displayedWallpapers.length} downloaded`
                    : `${wallpapers.length} wallpapers`}
                </span>
                {!showOnlyFavorites && !showOnlyDownloaded && (
                  <button
                    type="button"
                    className="show-selected-button"
                    onClick={toggleShowOnlySelected}
                    disabled={!showOnlySelected && selectedCount === 0}
                    title={showOnlySelected ? "Show all wallpapers" : "Show only selected wallpapers"}
                    aria-label={showOnlySelected ? "Show all wallpapers" : "Show only selected wallpapers"}
                  >
                    {showOnlySelected 
                      ? `Back to all (${selectedCount})` 
                      : `Selected (${selectedCount})`}
                  </button>
                )}
                {!showOnlySelected && !showOnlyDownloaded && (
                  <button
                    type="button"
                    className="show-selected-button"
                    onClick={toggleShowOnlyFavorites}
                    disabled={!showOnlyFavorites && favorites.length === 0}
                    title={showOnlyFavorites ? "Return to browsing" : `View your ${favorites.length} favorites`}
                    aria-label={showOnlyFavorites ? "Return to browsing" : `View ${favorites.length} favorites`}
                  >
                    {showOnlyFavorites ? 'Back to all' : `Favorites (${favorites.length})`}
                  </button>
                )}
                {!showOnlySelected && !showOnlyFavorites && (
                  <button
                    type="button"
                    className="show-selected-button"
                    onClick={toggleShowOnlyDownloaded}
                    disabled={!showOnlyDownloaded && downloadedIds.length === 0}
                    title={showOnlyDownloaded ? "Return to browsing" : `View your ${downloadedIds.length} downloaded wallpapers`}
                    aria-label={showOnlyDownloaded ? "Return to browsing" : `View ${downloadedIds.length} downloaded wallpapers`}
                  >
                    {showOnlyDownloaded 
                      ? 'Back to all' 
                      : `Downloaded (${downloadedIds.length})`}
                  </button>
                )}
              </div>
              <div className="results-actions">
                {!showOnlySelected && (
                  <button
                    type="button"
                    className="secondary-button select-button"
                    onClick={selectAllVisible}
                    disabled={!wallpapers.length}
                    aria-label="Select all visible wallpapers on current page"
                    title="Select all visible wallpapers"
                  >
                    Select all visible
                  </button>
                )}

                <button
                  type="button"
                  className="secondary-button deselect-button"
                  onClick={deselectAllVisible}
                  disabled={
                    !displayedWallpapers.length ||
                    (!showOnlySelected && !showOnlyFavorites && !showOnlyDownloaded && !selectedCount)
                  }
                  aria-label={showOnlySelected ? "Clear all selections and return to browsing" : "Deselect all visible wallpapers on current page"}
                  title={showOnlySelected ? "Clear all selections and return to browsing" : "Deselect all visible wallpapers"}
                >
                  Deselect all visible
                </button>

                {showOnlyFavorites && (
                  <button
                    type="button"
                    className="secondary-button unfavorite-button"
                    onClick={handleUnfavoriteSelected}
                    disabled={!selectedCount}
                    aria-label={selectedCount
                      ? `Remove ${selectedCount} selected wallpaper${selectedCount !== 1 ? 's' : ''} from favorites`
                      : 'No favorites selected to remove'}
                    title={selectedCount
                      ? `Unfavorite ${selectedCount} selected wallpaper${selectedCount !== 1 ? 's' : ''}`
                      : 'Select one or more favorites to unfavorite'}
                  >
                    Unfavorite selected
                  </button>
                )}

                {showOnlyDownloaded && (
                  <button
                    type="button"
                    className="secondary-button unfavorite-button"
                    onClick={handleRemoveDownloadedSelected}
                    disabled={!selectedCount}
                    aria-label={selectedCount
                      ? `Remove ${selectedCount} selected wallpaper${selectedCount !== 1 ? 's' : ''} from download history`
                      : 'No downloaded wallpapers selected to remove from history'}
                    title={selectedCount
                      ? `Remove ${selectedCount} selected wallpaper${selectedCount !== 1 ? 's' : ''} from download history`
                      : 'Select one or more downloaded wallpapers to remove from history'}
                  >
                    Remove from history
                  </button>
                )}

                <button
                  type="button"
                  className={`primary-button download-button ${downloadStatus === 'success' ? 'download-success' : ''} ${downloadStatus === 'error' ? 'download-error' : ''}`}
                  onClick={handleDownloadSelected}
                  disabled={!selectedCount || downloadStatus === 'downloading' || downloadStatus === 'zipping'}
                  aria-label={`Download ${selectedCount} selected wallpaper${selectedCount !== 1 ? 's' : ''}`}
                  title={`Download ${selectedCount} selected wallpaper${selectedCount !== 1 ? 's' : ''}`}
                >
                  {getDownloadButtonLabel(downloadStatus, selectedCount)}
                </button>
              </div>
            </div>
          )}

          <WallpaperGrid
            wallpapers={displayedWallpapers}
            selectedIds={selectedIds}
            favorites={favorites}
            downloadedIds={downloadedIds}
            onToggleSelect={toggleSelect}
            onToggleFavorite={toggleFavorite}
            onWallpaperClick={handleWallpaperClick}
            onColorClick={handleColorClick}
            onResolutionClick={handleResolutionClick}
            onSearchSimilar={handleSearchSimilar}
            isDownloaded={isDownloaded}
            onMarkDownloaded={markDownloaded}
            viewMode={viewMode}
            isLoading={isLoading}
            loadFailed={searchFailed && !showOnlyFavorites && !showOnlySelected && !showOnlyDownloaded}
            loadFailedMessage={searchFailure}
          />

          {wallpapers.length > 0 && (
            <PaginationBar
              currentPage={effectiveCurrentPage}
              totalPages={effectiveTotalPages}
              totalResults={totalResults}
              onPageChange={goToPage}
              onNext={goToNextPage}
              onPrevious={goToPreviousPage}
              isLoading={isLoading || showOnlySelected || showOnlyFavorites || showOnlyDownloaded}
              canGoNext={canGoNext && !showOnlySelected && !showOnlyFavorites && !showOnlyDownloaded}
              canGoPrevious={canGoPrevious && !showOnlySelected && !showOnlyFavorites && !showOnlyDownloaded}
            />
          )}
        </section>
      </main>

      <footer className="app-footer">
        <div className="app-footer-content">
          <div className="footer-left">
            <p>
              Powered by <a href="https://wallhaven.cc" target="_blank" rel="noopener noreferrer">Wallhaven</a> API
            </p>
          </div>
          <div className="footer-center">
            <p className="footer-copyright">
              © {new Date().getFullYear()} WallBrowser by Bryant Welch
            </p>
          </div>
          <div className="footer-right">
            <p className="footer-links">
              <a href="https://wallhaven.cc/help/api" target="_blank" rel="noopener noreferrer">API Docs</a>
              <span>·</span>
              <a href="https://github.com/BryantWelch/WallBrowser" target="_blank" rel="noopener noreferrer">GitHub</a>
              <span>·</span>
              <button type="button" className="footer-link-button" onClick={() => setIsAboutOpen(true)}>About</button>
              <span>·</span>
              <button type="button" className="footer-link-button" onClick={() => setIsPrivacyOpen(true)}>Privacy</button>
            </p>
          </div>
        </div>
      </footer>
      
      {previewWallpaper && (
        <PreviewModal
          wallpaper={previewWallpaper}
          onClose={handlePreviewClose}
          onNext={handlePreviewNext}
          onPrevious={handlePreviewPrevious}
          hasNext={hasNextPreview}
          hasPrevious={hasPreviousPreview}
          isFavorite={isFavorite(previewWallpaper.id)}
          onToggleFavorite={toggleFavorite}
          isDownloaded={isDownloaded(previewWallpaper.id)}
          onMarkDownloaded={markDownloaded}
          onColorClick={handleColorClick}
          onTagClick={handleTagClick}
          onUploaderClick={handleUploaderClick}
          onResolutionClick={handleResolutionClick}
          onCategoryClick={handleCategoryClick}
          onSearchSimilar={handleSearchSimilar}
          fetchWallpaperDetails={fetchWallpaperDetails}
          previewPosition={previewPosition}
          isLoadingPage={isLoading}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
      />

      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />
      
      <ToastContainer />
    </div>
  );
}

export default App;
