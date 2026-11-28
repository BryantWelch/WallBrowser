import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_FILTERS } from '../constants';
import { formatHistoryTime } from '../hooks/useSearchHistory';
import {
  AspectRatioMenu,
  CategoryMenu,
  ColorMenu,
  FileTypeMenu,
  FilterMenuProvider,
  ResolutionMenu,
  SortMenu,
  ViewMenu,
} from './FilterMenu';

export function ControlsPanel({
  filters,
  onFilterChange,
  onMultipleFilterChanges,
  onClearFilters,
  isClearDisabled,
  hasPendingFilterChanges,
  onFetch,
  isLoading,
  error,
  onClearError,
  onRetry,
  viewMode,
  onViewModeChange,
  onOpenSettings,
  searchHistory = [],
  onSelectHistory,
  onRemoveHistory,
  onClearHistory,
}) {
  const [showSearchHints, setShowSearchHints] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const searchHintsRef = useRef(null);
  const searchButtonRef = useRef(null);
  
  const historyRef = useRef(null);
  const historyButtonRef = useRef(null);

  const isSearchActive = !!filters.query;
  const isRatioActive = filters.ratio !== DEFAULT_FILTERS.ratio;
  const isResolutionActive =
    filters.resolution !== DEFAULT_FILTERS.resolution ||
    filters.exactResolution !== DEFAULT_FILTERS.exactResolution;
  const isSortActive = filters.sort !== DEFAULT_FILTERS.sort;
  const isColorActive = filters.color !== DEFAULT_FILTERS.color;
  const isFileTypeActive = filters.fileType !== DEFAULT_FILTERS.fileType;
  const isCategoriesActive =
    filters.categories.general !== DEFAULT_FILTERS.categories.general ||
    filters.categories.anime !== DEFAULT_FILTERS.categories.anime ||
    filters.categories.people !== DEFAULT_FILTERS.categories.people;

  // Close search hints when clicking outside
  useEffect(() => {
    if (!showSearchHints) return;

    const handleClickOutside = (event) => {
      // Check if click is outside both the hints box and the button
      const clickedButton = searchButtonRef.current && searchButtonRef.current.contains(event.target);
      const clickedHints = searchHintsRef.current && searchHintsRef.current.contains(event.target);
      
      if (!clickedButton && !clickedHints) {
        setShowSearchHints(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchHints]);

  // Close history dropdown when clicking outside
  useEffect(() => {
    if (!showHistory) return;

    const handleClickOutside = (event) => {
      const clickedButton = historyButtonRef.current && historyButtonRef.current.contains(event.target);
      const clickedDropdown = historyRef.current && historyRef.current.contains(event.target);
      
      if (!clickedButton && !clickedDropdown) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHistory]);

  const handleSelectHistory = (entry) => {
    onSelectHistory?.(entry.filters);
    setShowHistory(false);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onFetch();
    }
  };

  return (
    <section className="controls-panel">
      {/* Search and action row */}
      <div className="controls-search-row">
        <div className="control-item control-item-search">
          <label htmlFor="query">
            Search
            <button
              type="button"
              ref={searchButtonRef}
              className="search-hint-toggle"
              title="Show advanced search syntax"
              onClick={() => setShowSearchHints(!showSearchHints)}
            >
              ?
            </button>
          </label>
          <div className="search-input-wrapper">
            <div className="search-input-prefix">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <span className="search-input-divider">|</span>
            </div>
            <input
              id="query"
              type="text"
              placeholder="e.g. cyberpunk city, @username, +tag -tag"
              value={filters.query}
              onChange={(e) => onFilterChange('query', e.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search wallpapers"
            />
            <div className="search-input-suffix">
              {filters.query && (
                <button
                  type="button"
                  className="search-clear-button"
                  onClick={() => onFilterChange('query', '')}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
              <span className="search-input-divider search-input-divider-right">|</span>
              <button
                ref={historyButtonRef}
                type="button"
                className={`search-history-button ${showHistory ? 'active' : ''}`}
                onClick={() => setShowHistory(!showHistory)}
                title="Search history"
                aria-label="Search history"
                aria-expanded={showHistory}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </button>
            </div>
            {showHistory && (
              <div className="history-dropdown" ref={historyRef}>
                <div className="history-header">
                  <span>Recent Searches</span>
                  {searchHistory.length > 0 && (
                    <button
                      type="button"
                      className="history-clear-all"
                      onClick={() => {
                        onClearHistory?.();
                        setShowHistory(false);
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {searchHistory.length === 0 ? (
                  <div className="history-empty">
                    <span>No recent searches</span>
                  </div>
                ) : (
                  <ul className="history-list">
                    {searchHistory.map((entry) => (
                      <li key={entry.id} className="history-item">
                        <button
                          type="button"
                          className="history-item-button"
                          onClick={() => handleSelectHistory(entry)}
                        >
                          <span className="history-item-summary">{entry.summary}</span>
                          <span className="history-item-time">{formatHistoryTime(entry.timestamp)}</span>
                        </button>
                        <button
                          type="button"
                          className="history-item-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveHistory?.(entry.id);
                          }}
                          title="Remove from history"
                          aria-label="Remove from history"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          {showSearchHints && (
            <div className="search-hints visible" ref={searchHintsRef}>
              <strong>Advanced Search:</strong>
              <ul>
                <li><code>+tag</code> - must include</li>
                <li><code>-tag</code> - exclude</li>
                <li><code>@username</code> - by uploader</li>
                <li><code>id:123</code> - exact tag ID</li>
                <li><code>like:8ggez2</code> - similar wallpapers</li>
              </ul>
              <small>Example: <code>+cyberpunk +neon -cars @Leonid428</code></small>
            </div>
          )}
        </div>
        
        <div className="search-actions">
          <button
            className={`primary-button ${
              hasPendingFilterChanges && !isLoading ? 'primary-button-pending' : ''
            }`}
            type="button"
            onClick={onFetch}
            disabled={isLoading}
            aria-label={isLoading ? 'Loading wallpapers' : 'Fetch wallpapers'}
          >
            {isLoading ? 'Loading…' : 'Fetch wallpapers'}
          </button>
          <button
            type="button"
            className="secondary-button settings-button"
            onClick={onOpenSettings}
            aria-label="Open API key and content settings"
            title="API Key & Content Settings"
          >
            <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Settings
          </button>
        </div>
      </div>

      {/* Filters row */}
      <FilterMenuProvider>
      <div className="controls-filters-row">
        {/* Aspect ratio */}
        <div className="control-item control-item-ratio">
          <label htmlFor="ratio">
            Aspect ratio
            {isRatioActive && <span className="filter-active-indicator">*</span>}
          </label>
          <AspectRatioMenu
            value={filters.ratio}
            onChange={(nextRatio) => {
              if (nextRatio === '') onFilterChange('ratio', '');
              else onMultipleFilterChanges?.({ ratio: nextRatio, resolution: '' });
            }}
          />
        </div>

        {/* Resolution */}
        <div className="control-item control-item-resolution">
          <label htmlFor="resolution">
            Resolution
            {isResolutionActive && <span className="filter-active-indicator">*</span>}
          </label>
          <ResolutionMenu
            value={filters.resolution}
            ratio={filters.ratio}
            exact={filters.exactResolution}
            onExactChange={(nextExact) => onFilterChange('exactResolution', nextExact)}
            onChange={(nextResolution, nextRatio) => {
              if (!nextResolution) {
                if (nextRatio) onMultipleFilterChanges?.({ resolution: '', ratio: nextRatio });
                else onFilterChange('resolution', '');
                return;
              }
              if (nextRatio !== undefined) {
                onMultipleFilterChanges?.({ resolution: nextResolution, ratio: nextRatio || '' });
                return;
              }
              onFilterChange('resolution', nextResolution);
            }}
          />
        </div>

        {/* Sort */}
        <div className="control-item control-item-sort">
          <label htmlFor="sort">
            Sort
            {isSortActive && <span className="filter-active-indicator">*</span>}
          </label>
          <SortMenu
            value={filters.sort}
            timeRange={filters.timeRange}
            onChange={(nextSort) => onFilterChange('sort', nextSort)}
            onTimeRangeChange={(nextRange) =>
              onMultipleFilterChanges?.({ sort: 'toplist', timeRange: nextRange })
            }
          />
        </div>

        {/* Color */}
        <div className="control-item control-item-color">
          <label htmlFor="color">
            Color
            {isColorActive && <span className="filter-active-indicator">*</span>}
          </label>
          <ColorMenu value={filters.color} onChange={(nextColor) => onFilterChange('color', nextColor)} />
        </div>

        {/* File Type */}
        <div className="control-item control-item-filetype">
          <label htmlFor="fileType">
            File type
            {isFileTypeActive && <span className="filter-active-indicator">*</span>}
          </label>
          <FileTypeMenu
            value={filters.fileType}
            onChange={(nextType) => onFilterChange('fileType', nextType)}
          />
        </div>

        <div className="control-item control-item-categories">
          <label htmlFor="categories">
            Categories
            {isCategoriesActive && <span className="filter-active-indicator">*</span>}
          </label>
          <CategoryMenu
            categories={filters.categories}
            onChange={(updateCategories) => onFilterChange('categories', updateCategories)}
          />
        </div>

        {/* View Mode (layout preference, not part of filter asterisk logic) */}
        <div className="control-item control-item-view">
          <label htmlFor="viewMode">View</label>
          <ViewMenu value={viewMode} onChange={onViewModeChange} />
        </div>

        <div className="control-item control-item-clear">
          <button
            type="button"
            className="secondary-button clear-filters-button"
            onClick={onClearFilters}
            aria-label="Clear all filters"
            disabled={isClearDisabled}
          >
            Clear
          </button>
        </div>

      </div>
      </FilterMenuProvider>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <div className="error-banner-actions">
            <button
              type="button"
              className="error-retry"
              onClick={onRetry}
            >
              Retry
            </button>
            <button
              type="button"
              className="error-dismiss"
              onClick={onClearError}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
