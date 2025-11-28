import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ControlsPanel } from './components/ControlsPanel';
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
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSearchHistory } from './hooks/useSearchHistory';
import { DEFAULT_FILTERS, STORAGE_KEYS, VIEW_MODES } from './constants';
import { clearCache, buildSimilarFilters } from './utils';
import { prefetchImage, toProxiedFullUrl, downloadWallpaperBlob, createWallpapersZip } from './utils/imageUtils';
import { getStoredApiKey } from './utils/apiKeyStorage';
import { ToastContainer } from './components/Toast';
import { useToast } from './context/ToastContext';

function App() {
  const { addToast } = useToast();
  // Always start with default filters - no persistence
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useLocalStorage(STORAGE_KEYS.VIEW_MODE, VIEW_MODES.COMFORTABLE);
  
  // Clear cache on mount and fetch total wallpapers count
  useEffect(() => {
    clearCache();
    
    // Fetch total wallpapers count from Wallhaven
    const fetchTotalCount = async () => {
      try {
        // Get API key if available (needed for Sketchy/NSFW content)
        const apiKey = getStoredApiKey();
        
        // Query ALL wallpapers: all categories (111) and all purity levels (111)
        // categories: general=1, anime=1, people=1 (binary: 111)
        // purity: SFW=1, Sketchy=1, NSFW=1 (binary: 111)
        // Note: Sketchy/NSFW require API key
        let url = '/api/wallhaven/api/v1/search?categories=111&purity=111&page=1';
        if (apiKey) {
          url += `&apikey=${apiKey}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data.meta?.total) {
            setTotalWallpapers(data.meta.total);
          }
        }
      } catch (error) {
        console.error('Failed to fetch total wallpapers:', error);
        // Don't show count if API call fails
      }
    };
    
    fetchTotalCount();
  }, []);
  
  // API and data management
  const { isLoading, error, wallpapers, totalPages: apiTotalPages, totalResults, fetchWallpapers, fetchWallpaperDetails, prefetchPages, clearError } = useWallhavenAPI();
  
  // Pagination
  const { page, totalPages, setTotalPages, goToPage, goToNextPage, goToPreviousPage, resetPage, canGoNext, canGoPrevious } = usePagination();
  
  // Selection state - store full wallpaper objects to persist across pages
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedWallpapers, setSelectedWallpapers] = useState(new Map()); // Map<id, wallpaper>
  
  // Favorites management
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  
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
  
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Footer modal states
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  // Total wallpapers in Wallhaven database
  const [totalWallpapers, setTotalWallpapers] = useState(null);

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
  
  // Handle filter changes (no auto-fetch, just update state)
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    // Reset to page 1, but don't fetch (user must click Fetch button)
    if (page !== 1) {
      resetPage();
    }
  }, [page, resetPage]);

  // Handle multiple filter changes at once (no auto-fetch)
  const handleMultipleFilterChanges = useCallback((updates) => {
    setFilters(prev => ({
      ...prev,
      ...updates
    }));
    // Reset to page 1, but don't fetch (user must click Fetch button)
    if (page !== 1) {
      resetPage();
    }
  }, [page, resetPage]);

  // Handle search for similar wallpapers
  const handleSearchSimilar = useCallback(async (wallpaperId) => {
    const newFilters = buildSimilarFilters(filters, wallpaperId);
    setFilters(newFilters);
    resetPage();
    // Clear selections when starting a new search
    setSelectedIds(new Set());
    setSelectedWallpapers(new Map());
    await fetchWallpapers(newFilters, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, setFilters, resetPage, fetchWallpapers]);
  
  // Fetch wallpapers (manual fetch via button)
  const handleFetch = useCallback(async () => {
    // Clear cache to ensure fresh results
    clearCache();
    // Clear selections when user manually fetches (new search)
    setSelectedIds(new Set());
    setSelectedWallpapers(new Map());
    
    // Add to search history
    addToHistory(filters);
    
    // If already on page 1, just fetch. If not, reset to page 1 (which triggers auto-fetch via useEffect)
    if (page === 1) {
      await fetchWallpapers(filters, 1);
    } else {
      resetPage(); // This will trigger the page change useEffect which handles the fetch
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, resetPage, addToHistory]);
  
  // Handle selecting a search from history
  const handleSelectHistory = useCallback((historyFilters) => {
    // Apply the filters from history
    setFilters(historyFilters);
    // Clear selections
    setSelectedIds(new Set());
    setSelectedWallpapers(new Map());
    // Reset to page 1 and fetch
    clearCache();
    resetPage();
    fetchWallpapers(historyFilters, 1);
  }, [resetPage, fetchWallpapers]);
  
  // Keep latest filters in a ref so page navigation always uses current filters
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  
  // Initial load - fetch with default filters
  const hasInitialFetchRef = useRef(false);
  useEffect(() => {
    if (!hasInitialFetchRef.current) {
      hasInitialFetchRef.current = true;
      fetchWallpapers(filters, 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Auto-fetch ONLY on page changes (not filter changes)
  // Note: Only 'page' in dependency array - filters handled via ref
  // fetchWallpapers is NOT in deps to prevent loops when seed changes
  const prevPageRef = useRef(page);
  useEffect(() => {
    // Skip if this is just the initial page value
    if (prevPageRef.current === page) {
      return;
    }
    prevPageRef.current = page;
    
    // Page changed - fetch with current filters
    if (!filtersRef.current || !filtersRef.current.categories) {
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

    fetchWallpapers(filtersRef.current, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
  
  // Prefetch next page thumbnails (full-size images are loaded on demand in preview)
  useEffect(() => {
    if (wallpapers.length > 0 && totalPages && !isLoading) {
      const timer = setTimeout(() => {
        prefetchPages(filters, page, totalPages);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [wallpapers, page, totalPages, filters, isLoading, prefetchPages]);
  
  // Filter wallpapers based on showOnlySelected or showOnlyFavorites (needed for range selection)
  const displayedWallpapers = showOnlySelected 
    ? Array.from(selectedWallpapers.values())
    : showOnlyFavorites
    ? favorites
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
      // Normal toggle
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          // Also remove from wallpapers map
          setSelectedWallpapers(prevMap => {
            const nextMap = new Map(prevMap);
            nextMap.delete(id);
            return nextMap;
          });
        } else {
          next.add(id);
          // Also add to wallpapers map
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
    }
    
    // Update last clicked index
    if (index !== null) {
      lastClickedIndexRef.current = index;
    }
  }, [displayedWallpapers]);
  
  // Select all visible (current page only)
  const selectAllVisible = useCallback(() => {
    const currentPageIds = wallpapers.map(w => w.id);
    
    // Select all on current page
    setSelectedIds(prev => {
      const next = new Set(prev);
      currentPageIds.forEach(id => next.add(id));
      return next;
    });
    setSelectedWallpapers(prevMap => {
      const nextMap = new Map(prevMap);
      wallpapers.forEach(w => nextMap.set(w.id, w));
      return nextMap;
    });
  }, [wallpapers]);

  // Deselect all visible (current page only, or all if in show-selected mode)
  const deselectAllVisible = useCallback(() => {
    if (showOnlySelected) {
      // In show-selected mode: clear all selections and return to previous page
      setSelectedIds(new Set());
      setSelectedWallpapers(new Map());
      setShowOnlySelected(false);
      goToPage(pageBeforeShowingSelected);
    } else {
      // Normal mode: deselect only current page
      const currentPageIds = wallpapers.map(w => w.id);
      
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
  }, [wallpapers, showOnlySelected, pageBeforeShowingSelected, goToPage]);
  
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
        link.download = `wallhaven-${wallpaper.id}.${ext}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        
        setDownloadStatus('success');
        addToast('Download complete!', 'success');
        setTimeout(() => setDownloadStatus('idle'), 2000);
        return;
      }
      
      // Multiple files - create ZIP via shared helper
      setDownloadStatus('zipping');
      addToast(`Preparing ZIP for ${selected.length} wallpapers...`, 'loading', 3000);

      const content = await createWallpapersZip(selected);
      
      const blobUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `wallpapers-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      setDownloadStatus('success');
      addToast('ZIP download ready!', 'success');
      setTimeout(() => setDownloadStatus('idle'), 2000);
      
    } catch (err) {
      console.error('Download failed:', err);
      setDownloadStatus('error');
      addToast('Download failed. Please try again.', 'error');
      setTimeout(() => setDownloadStatus('idle'), 2000);
    }
  }, [selectedWallpapers, addToast]);
  
  // Preview navigation
  const handleWallpaperClick = useCallback((wallpaper) => {
    setPreviewWallpaper(wallpaper);
  }, []);
  
  const handlePreviewClose = useCallback(() => {
    setPreviewWallpaper(null);
  }, []);
  
  // Handle color click in preview modal
  const handleColorClick = useCallback(async (colorHex) => {
    // Remove the # from the hex color
    const colorValue = colorHex.replace('#', '');
    
    // Update filters with the new color
    const updatedFilters = {
      ...filters,
      color: colorValue
    };
    setFilters(updatedFilters);
    
    // Close preview modal
    setPreviewWallpaper(null);
    
    // Reset to page 1
    resetPage();
    
    // Clear selections when starting a new search
    setSelectedIds(new Set());
    setSelectedWallpapers(new Map());
    
    // Fetch with the new color filter
    await fetchWallpapers(updatedFilters, 1);
  }, [filters, setFilters, resetPage, fetchWallpapers]);

  // Handle tag click in preview modal
  const handleTagClick = useCallback(async (tagName) => {
    // Update filters with the tag search
    const updatedFilters = {
      ...filters,
      query: tagName
    };
    setFilters(updatedFilters);
    
    // Close preview modal
    setPreviewWallpaper(null);
    
    // Reset to page 1
    resetPage();
    
    // Clear selections when starting a new search
    setSelectedIds(new Set());
    setSelectedWallpapers(new Map());
    
    // Fetch with the new tag search
    await fetchWallpapers(updatedFilters, 1);
  }, [filters, setFilters, resetPage, fetchWallpapers]);
  
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

  const handlePreviewNext = useCallback(() => {
    const currentIndex = wallpapers.findIndex(w => w.id === previewWallpaper?.id);
    if (currentIndex < wallpapers.length - 1) {
      setPreviewWallpaper(wallpapers[currentIndex + 1]);
    } else if (canGoNext && !showOnlySelected && !showOnlyFavorites) {
      // Go to next page
      shouldReopenPreviewRef.current = 'next';
      // Keep preview open with loading state
      goToNextPage();
    }
  }, [wallpapers, previewWallpaper, canGoNext, showOnlySelected, showOnlyFavorites, goToNextPage]);
  
  const handlePreviewPrevious = useCallback(() => {
    const currentIndex = wallpapers.findIndex(w => w.id === previewWallpaper?.id);
    if (currentIndex > 0) {
      setPreviewWallpaper(wallpapers[currentIndex - 1]);
    } else if (canGoPrevious && !showOnlySelected && !showOnlyFavorites) {
      // Go to previous page
      shouldReopenPreviewRef.current = 'prev';
      // Keep preview open with loading state
      goToPreviousPage();
    }
  }, [wallpapers, previewWallpaper, canGoPrevious, showOnlySelected, showOnlyFavorites, goToPreviousPage]);
  
  const previewIndex = wallpapers.findIndex(w => w.id === previewWallpaper?.id);
  const hasNextPreview = previewIndex < wallpapers.length - 1 || (canGoNext && !showOnlySelected && !showOnlyFavorites);
  const hasPreviousPreview = previewIndex > 0 || (canGoPrevious && !showOnlySelected && !showOnlyFavorites);

  // While preview is open, prefetch the next full image within the current page
  // so navigation feels snappier without globally preloading all full images.
  useEffect(() => {
    if (!previewWallpaper) return;

    const currentIndex = wallpapers.findIndex(w => w.id === previewWallpaper.id);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < wallpapers.length) {
      const nextWallpaper = wallpapers[nextIndex];
      if (nextWallpaper && nextWallpaper.url) {
        const url = toProxiedFullUrl(nextWallpaper.url);
        prefetchImage(url);
      }
    }
  }, [previewWallpaper, wallpapers]);
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    onEnter: handleFetch,
    onEscape: () => {
      if (previewWallpaper) {
        handlePreviewClose();
      }
      // Don't clear selections on Escape - let users keep their multi-page selections
    },
    onArrowLeft: () => {
      if (previewWallpaper && hasPreviousPreview) {
        handlePreviewPrevious();
      } else {
        goToPreviousPage();
      }
    },
    onArrowRight: () => {
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
      } else {
        // Exiting show-selected mode: return to saved page
        goToPage(pageBeforeShowingSelected);
      }
      return !prev;
    });
  }, [page, pageBeforeShowingSelected, goToPage]);
  
  // Toggle showing only favorites
  const toggleShowOnlyFavorites = useCallback(() => {
    setShowOnlyFavorites(prev => {
      if (!prev) {
        // Entering favorites mode: save current page and exit selected mode
        setPageBeforeShowingFavorites(page);
        setShowOnlySelected(false);
      } else {
        // Exiting favorites mode: return to saved page
        goToPage(pageBeforeShowingFavorites);
      }
      return !prev;
    });
  }, [page, pageBeforeShowingFavorites, goToPage]);
  
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
              <h1>WallBrowser</h1>
            </div>
            <p className="app-subtitle">A modern wallpaper browser for Wallhaven</p>
          </div>
          <div className="app-header-right">
            {totalWallpapers && (
              <div 
                className="header-stats header-stats-total"
                title="Total wallpapers in Wallhaven's database. Add API key in Settings for full access."
              >
                <span className="header-stat-number">{totalWallpapers.toLocaleString()}</span>
                <span className="header-stat-label">Wallpapers</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        <ControlsPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onMultipleFilterChanges={handleMultipleFilterChanges}
          onFetch={handleFetch}
          isLoading={isLoading}
          error={error}
          onClearError={clearError}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          searchHistory={searchHistory}
          onSelectHistory={handleSelectHistory}
          onRemoveHistory={removeFromHistory}
          onClearHistory={clearHistory}
        />

        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          totalResults={totalResults}
          onPageChange={goToPage}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
          isLoading={isLoading || showOnlySelected || showOnlyFavorites}
          canGoNext={canGoNext && !showOnlySelected && !showOnlyFavorites}
          canGoPrevious={canGoPrevious && !showOnlySelected && !showOnlyFavorites}
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
                    : `${wallpapers.length} wallpapers`}
                </span>
                {!showOnlySelected && !showOnlyFavorites && (
                  <>
                    <span className="results-separator">·</span>
                    <span className="results-selected">
                      {selectedCount} selected
                    </span>
                  </>
                )}
                {selectedCount > 0 && !showOnlyFavorites && (
                  <button
                    type="button"
                    className="show-selected-button"
                    onClick={toggleShowOnlySelected}
                    title={showOnlySelected ? "Show all wallpapers" : "Show only selected wallpapers"}
                    aria-label={showOnlySelected ? "Show all wallpapers" : "Show only selected wallpapers"}
                  >
                    {showOnlySelected ? '← Back to all' : 'Show selected →'}
                  </button>
                )}
                {(favorites.length > 0 || showOnlyFavorites) && !showOnlySelected && (
                  <button
                    type="button"
                    className="show-selected-button"
                    onClick={toggleShowOnlyFavorites}
                    title={showOnlyFavorites ? "Return to browsing" : `View your ${favorites.length} favorites`}
                    aria-label={showOnlyFavorites ? "Return to browsing" : `View ${favorites.length} favorites`}
                  >
                    {showOnlyFavorites ? '← Back to all' : `♥ View favorites (${favorites.length}) →`}
                  </button>
                )}
              </div>
              <div className="results-actions">
                {!showOnlySelected && !showOnlyFavorites && (
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

                {!showOnlyFavorites && (
                  <button
                    type="button"
                    className="secondary-button deselect-button"
                    onClick={deselectAllVisible}
                    disabled={!displayedWallpapers.length}
                    aria-label={showOnlySelected ? "Clear all selections and return to browsing" : "Deselect all visible wallpapers on current page"}
                    title={showOnlySelected ? "Clear all selections and return to browsing" : "Deselect all visible wallpapers"}
                  >
                    Deselect all visible
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
            onToggleSelect={toggleSelect}
            onToggleFavorite={toggleFavorite}
            onWallpaperClick={handleWallpaperClick}
            onColorClick={handleColorClick}
            onSearchSimilar={handleSearchSimilar}
            viewMode={viewMode}
            isLoading={isLoading}
          />

          {wallpapers.length > 0 && (
            <PaginationBar
              currentPage={page}
              totalPages={totalPages}
              totalResults={totalResults}
              onPageChange={goToPage}
              onNext={goToNextPage}
              onPrevious={goToPreviousPage}
              isLoading={isLoading || showOnlySelected}
              canGoNext={canGoNext && !showOnlySelected}
              canGoPrevious={canGoPrevious && !showOnlySelected}
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
          onColorClick={handleColorClick}
          onTagClick={handleTagClick}
          onSearchSimilar={handleSearchSimilar}
          fetchWallpaperDetails={fetchWallpaperDetails}
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
