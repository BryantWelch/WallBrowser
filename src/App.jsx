import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { ControlsPanel } from './components/ControlsPanel';
import { WallpaperGrid } from './components/WallpaperGrid';
import { PaginationBar } from './components/PaginationBar';
import { PreviewModal } from './components/PreviewModal';
import { SettingsModal } from './components/SettingsModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useWallhavenAPI } from './hooks/useWallhavenAPI';
import { usePagination } from './hooks/usePagination';
import { useFavorites } from './hooks/useFavorites';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { DEFAULT_FILTERS, STORAGE_KEYS, VIEW_MODES, API_CONFIG } from './constants';

function App() {
  // Show helpful message about API key on first load
  useEffect(() => {
    if (!API_CONFIG.API_KEY) {
      console.info(
        '%c💡 Wallhaven API Key Not Configured',
        'color: #3b82f6; font-size: 14px; font-weight: bold;',
        '\n\nYou\'re using the public API.\n\n' +
        'To unlock NSFW/Sketchy content and higher rate limits:\n' +
        '1. Click the ⚙️ Settings button in the controls panel\n' +
        '2. Get a free API key: https://wallhaven.cc/settings/account\n' +
        '3. Enter it in the settings modal\n\n' +
        'Your key is stored locally and never sent to any server except Wallhaven.'
      );
    }
  }, []);

  // Persist filters to localStorage
  const [filters, setFilters] = useLocalStorage(STORAGE_KEYS.FILTERS, DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useLocalStorage(STORAGE_KEYS.VIEW_MODE, VIEW_MODES.COMFORTABLE);
  
  // API and data management
  const { isLoading, error, wallpapers, totalPages: apiTotalPages, fetchWallpapers, clearError } = useWallhavenAPI();
  
  // Pagination
  const { page, totalPages, setTotalPages, goToPage, goToNextPage, goToPreviousPage, resetPage, canGoNext, canGoPrevious } = usePagination();
  
  // Selection state - store full wallpaper objects to persist across pages
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedWallpapers, setSelectedWallpapers] = useState(new Map()); // Map<id, wallpaper>
  
  // Favorites management
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  
  // Preview modal state
  const [previewWallpaper, setPreviewWallpaper] = useState(null);
  
  // Show only selected wallpapers toggle
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [pageBeforeShowingSelected, setPageBeforeShowingSelected] = useState(1);
  
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Track initial mount to avoid double-fetching
  const isInitialMount = useRef(true);
  
  // Sync API total pages with pagination
  useEffect(() => {
    if (apiTotalPages) {
      setTotalPages(apiTotalPages);
    }
  }, [apiTotalPages, setTotalPages]);
  
  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
    resetPage();
  }, [setFilters, resetPage]);

  // Handle multiple filter changes at once
  const handleMultipleFilterChanges = useCallback((updates) => {
    setFilters(prev => ({
      ...prev,
      ...updates
    }));
    resetPage();
  }, [setFilters, resetPage]);

  // Handle search for similar wallpapers
  const handleSearchSimilar = useCallback(async (wallpaperId) => {
    setFilters(prev => ({
      ...prev,
      query: `like:${wallpaperId}`
    }));
    resetPage();
    // Clear selections when starting a new search
    setSelectedIds(new Set());
    setSelectedWallpapers(new Map());
    await fetchWallpapers({ ...filters, query: `like:${wallpaperId}` }, 1);
  }, [setFilters, resetPage, fetchWallpapers, filters]);
  
  // Fetch wallpapers (manual fetch via button)
  const handleFetch = useCallback(async () => {
    // Clear selections when user manually fetches (new search)
    setSelectedIds(new Set());
    setSelectedWallpapers(new Map());
    await fetchWallpapers(filters, page);
  }, [filters, page, fetchWallpapers]);
  
  // Fetch on page change
  useEffect(() => {
    if (isInitialMount.current) {
      // Skip fetch on initial mount (handleFetch is called manually)
      isInitialMount.current = false;
    } else {
      // Fetch on all subsequent page changes (including back to page 1)
      // Don't clear selections - preserve multi-page selections
      fetchWallpapers(filters, page);
    }
  }, [page, filters, fetchWallpapers]); // Trigger on page change
  
  // Toggle selection
  const toggleSelect = useCallback((id) => {
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
        const wallpaper = wallpapers.find(w => w.id === id);
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
  }, [wallpapers]);
  
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
    
    if (selected.length === 1) {
      // Single file - direct download
      const wallpaper = selected[0];
      const link = document.createElement('a');
      link.href = wallpaper.url;
      link.download = `wallpaper-${wallpaper.id}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    
    // Multiple files - create ZIP
    try {
      const zip = new JSZip();
      const folder = zip.folder('wallpapers');
      
      // Show loading state
      const downloadBtn = document.querySelector('[data-download-btn]');
      if (downloadBtn) {
        downloadBtn.textContent = 'Creating ZIP...';
        downloadBtn.disabled = true;
      }
      
      // Fetch and add files to ZIP
      await Promise.all(selected.map(async (wallpaper, index) => {
        try {
          // Convert Wallhaven URL to use our proxy
          // e.g., https://w.wallhaven.cc/full/abc/wallhaven-123.jpg
          // becomes /proxy/image/full/abc/wallhaven-123.jpg
          let proxyUrl = wallpaper.url;
          if (proxyUrl.includes('w.wallhaven.cc')) {
            proxyUrl = proxyUrl.replace('https://w.wallhaven.cc', '/proxy/image');
          } else if (proxyUrl.includes('wallhaven.cc')) {
            proxyUrl = proxyUrl.replace('https://wallhaven.cc', '/proxy/image');
          }
          
          const response = await fetch(proxyUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const blob = await response.blob();
          const ext = wallpaper.url.split('.').pop() || 'jpg';
          folder.file(`wallpaper-${wallpaper.id}.${ext}`, blob);
        } catch (err) {
          console.error(`Failed to download ${wallpaper.id}:`, err);
        }
      }));
      
      // Generate and download ZIP
      const content = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      const blobUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `wallpapers-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      if (downloadBtn) {
        downloadBtn.textContent = `Download selected (${selected.length})`;
        downloadBtn.disabled = false;
      }
    } catch (err) {
      console.error('ZIP creation failed:', err);
      alert('Failed to create ZIP file. Please try again.');
    }
  }, [selectedWallpapers]);
  
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
  
  const handlePreviewNext = useCallback(() => {
    const currentIndex = wallpapers.findIndex(w => w.id === previewWallpaper?.id);
    if (currentIndex < wallpapers.length - 1) {
      setPreviewWallpaper(wallpapers[currentIndex + 1]);
    }
  }, [wallpapers, previewWallpaper]);
  
  const handlePreviewPrevious = useCallback(() => {
    const currentIndex = wallpapers.findIndex(w => w.id === previewWallpaper?.id);
    if (currentIndex > 0) {
      setPreviewWallpaper(wallpapers[currentIndex - 1]);
    }
  }, [wallpapers, previewWallpaper]);
  
  const previewIndex = wallpapers.findIndex(w => w.id === previewWallpaper?.id);
  const hasNextPreview = previewIndex < wallpapers.length - 1;
  const hasPreviousPreview = previewIndex > 0;
  
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
        // Entering show-selected mode: save current page
        setPageBeforeShowingSelected(page);
      } else {
        // Exiting show-selected mode: return to saved page
        goToPage(pageBeforeShowingSelected);
      }
      return !prev;
    });
  }, [page, pageBeforeShowingSelected, goToPage]);
  
  // Filter wallpapers based on showOnlySelected
  const displayedWallpapers = showOnlySelected 
    ? Array.from(selectedWallpapers.values())
    : wallpapers;
  
  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-content">
          <div className="app-header-left">
            <h1>Wallhaven Browser</h1>
            <p className="app-subtitle">Browse and bulk-download wallpapers from Wallhaven</p>
          </div>
          <div className="app-header-right">
            {favorites.length > 0 && (
              <button
                type="button"
                className="secondary-button favorites-button"
                onClick={() => {
                  alert(`You have ${favorites.length} favorites!`);
                }}
                aria-label={`View ${favorites.length} favorites`}
              >
                ♥ Favorites ({favorites.length})
              </button>
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
        />

        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          onPageChange={goToPage}
          onPrevious={goToPreviousPage}
          onNext={goToNextPage}
          isLoading={isLoading || showOnlySelected}
          canGoNext={canGoNext && !showOnlySelected}
          canGoPrevious={canGoPrevious && !showOnlySelected}
        />

        <section className="grid-section">
          {wallpapers.length > 0 && (
            <div className="results-bar">
              <div className="results-info">
                <span className="results-count">
                  {showOnlySelected ? `${displayedWallpapers.length} selected` : `${wallpapers.length} wallpapers`}
                </span>
                {!showOnlySelected && (
                  <>
                    <span className="results-separator">·</span>
                    <span className="results-selected">
                      {selectedCount} selected
                    </span>
                  </>
                )}
                {selectedCount > 0 && (
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
                  disabled={!displayedWallpapers.length}
                  aria-label={showOnlySelected ? "Clear all selections and return to browsing" : "Deselect all visible wallpapers on current page"}
                  title={showOnlySelected ? "Clear all selections and return to browsing" : "Deselect all visible wallpapers"}
                >
                  Deselect all visible
                </button>

                <button
                  type="button"
                  className="primary-button download-button"
                  onClick={handleDownloadSelected}
                  disabled={!selectedCount}
                  data-download-btn
                  aria-label={`Download ${selectedCount} selected wallpaper${selectedCount !== 1 ? 's' : ''}`}
                  title={`Download ${selectedCount} selected wallpaper${selectedCount !== 1 ? 's' : ''}`}
                >
                  Download selected ({selectedCount})
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
          <p>
            Powered by <a href="https://wallhaven.cc" target="_blank" rel="noopener noreferrer">Wallhaven</a> API
          </p>
          <p className="footer-links">
            <a href="https://wallhaven.cc/help/api" target="_blank" rel="noopener noreferrer">API Docs</a>
            <span>·</span>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
          </p>
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
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
      />
    </div>
  );
}

export default App;
