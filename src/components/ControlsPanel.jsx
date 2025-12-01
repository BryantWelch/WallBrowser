import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  RESOLUTION_PRESETS,
  COLOR_OPTIONS,
  SORT_OPTIONS,
  TIME_RANGE_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  VIEW_MODES,
  FILE_TYPE_OPTIONS,
  DEFAULT_FILTERS,
} from '../constants';
import { formatHistoryTime } from '../hooks/useSearchHistory';

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
  viewMode,
  onViewModeChange,
  onOpenSettings,
  searchHistory = [],
  onSelectHistory,
  onRemoveHistory,
  onClearHistory,
}) {
  const filteredResolutionPresets = useMemo(() => {
    if (!filters.ratio) {
      // When showing all resolutions, add separators between aspect ratio groups
      const withSeparators = [];
      let lastRatio = null;
      
      const ratioLabels = {
        '16x9': '─── 16:9 Widescreen ───',
        '16x10': '─── 16:10 ───',
        '21x9': '─── 21:9 Ultrawide ───',
        '32x9': '─── 32:9 Super Ultrawide ───',
        '48x9': '─── 48:9 Triple Monitor ───',
        '9x16': '─── 9:16 Portrait ───',
        '10x16': '─── 10:16 Portrait ───',
        '9x18': '─── 9:18 Portrait ───',
        '1x1': '─── 1:1 Square ───',
        '3x2': '─── 3:2 ───',
        '4x3': '─── 4:3 ───',
        '5x4': '─── 5:4 ───',
      };
      
      RESOLUTION_PRESETS.forEach((preset) => {
        if (preset.ratio !== lastRatio) {
          withSeparators.push({ 
            isSeparator: true, 
            label: ratioLabels[preset.ratio] || preset.ratio,
            value: `sep-${preset.ratio}`
          });
          lastRatio = preset.ratio;
        }
        withSeparators.push(preset);
      });
      
      return withSeparators;
    }
    return RESOLUTION_PRESETS.filter((preset) => preset.ratio === filters.ratio);
  }, [filters.ratio]);

  const [showSearchHints, setShowSearchHints] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const searchHintsRef = useRef(null);
  const searchButtonRef = useRef(null);
  
  // Detect user's display resolution
  const userDisplay = useMemo(() => {
    if (typeof window === 'undefined') return null;
    
    const width = Math.round(window.screen.width * (window.devicePixelRatio || 1));
    const height = Math.round(window.screen.height * (window.devicePixelRatio || 1));
    
    // Calculate aspect ratio
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    const ratioW = width / divisor;
    const ratioH = height / divisor;
    
    // Map to common aspect ratio format for Wallhaven API
    let apiRatio = '';
    const ratio = width / height;
    if (Math.abs(ratio - 16/9) < 0.1) apiRatio = '16x9';
    else if (Math.abs(ratio - 16/10) < 0.1) apiRatio = '16x10';
    else if (Math.abs(ratio - 21/9) < 0.1) apiRatio = '21x9';
    else if (Math.abs(ratio - 32/9) < 0.1) apiRatio = '32x9';
    else if (Math.abs(ratio - 4/3) < 0.1) apiRatio = '4x3';
    else if (Math.abs(ratio - 5/4) < 0.1) apiRatio = '5x4';
    else if (Math.abs(ratio - 3/2) < 0.1) apiRatio = '3x2';
    
    return {
      width,
      height,
      value: `${width}x${height}`,
      label: `🖥 My Display (${width}×${height})`,
      ratioLabel: `${ratioW}:${ratioH}`,
      apiRatio
    };
  }, []);
  const historyRef = useRef(null);
  const historyButtonRef = useRef(null);

  const isSearchActive = !!filters.query;
  const isRatioActive = filters.ratio !== DEFAULT_FILTERS.ratio;
  const isResolutionActive =
    filters.resolution !== DEFAULT_FILTERS.resolution ||
    filters.exactResolution !== DEFAULT_FILTERS.exactResolution;
  const isSortActive = filters.sort !== DEFAULT_FILTERS.sort;
  const isTopRangeActive =
    filters.sort === 'toplist' && filters.timeRange !== DEFAULT_FILTERS.timeRange;
  const isColorActive = filters.color !== DEFAULT_FILTERS.color;
  const isFileTypeActive = filters.fileType !== DEFAULT_FILTERS.fileType;
  const isCategoriesActive =
    filters.categories.general !== DEFAULT_FILTERS.categories.general ||
    filters.categories.anime !== DEFAULT_FILTERS.categories.anime ||
    filters.categories.people !== DEFAULT_FILTERS.categories.people;

  const hasCustomResolution =
    !!filters.resolution && !RESOLUTION_PRESETS.some((p) => p.value === filters.resolution);

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

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
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
              onKeyPress={handleSearchKeyPress}
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
        
        <div className="control-item control-item-button">
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
        </div>
      </div>

      {/* Filters row */}
      <div className="controls-filters-row">
        {/* Aspect ratio */}
        <div className="control-item control-item-ratio">
          <label htmlFor="ratio">
            Aspect ratio
            {isRatioActive && <span className="filter-active-indicator">*</span>}
          </label>
          <select
            id="ratio"
            value={filters.ratio}
            onChange={(e) => {
              const newRatio = e.target.value;
              if (newRatio === '') {
                // When manually setting to "Any", keep current resolution
                onFilterChange('ratio', newRatio);
              } else {
                // When selecting a specific ratio, clear resolution so dropdown filters
                onMultipleFilterChanges?.({
                  ratio: newRatio,
                  resolution: ''
                });
              }
            }}
            aria-label="Aspect ratio"
          >
            {ASPECT_RATIO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Resolution */}
        <div className="control-item control-item-resolution">
          <label htmlFor="resolution">
            Resolution
            {isResolutionActive && <span className="filter-active-indicator">*</span>}
          </label>
          <div className="control-with-addon">
            <select
              id="resolution"
              value={filters.resolution}
              onChange={(e) => {
                const selectedResolution = e.target.value;
                if (selectedResolution) {
                  // Check if it's the user's display resolution
                  if (selectedResolution === userDisplay?.value) {
                    onMultipleFilterChanges?.({
                      resolution: selectedResolution,
                      ratio: userDisplay.apiRatio || ''
                    });
                  } else {
                    // Find the ratio for this resolution
                    const preset = RESOLUTION_PRESETS.find(p => p.value === selectedResolution);
                    if (preset && preset.ratio) {
                      // Auto-set aspect ratio based on resolution
                      onMultipleFilterChanges?.({
                        resolution: selectedResolution,
                        ratio: preset.ratio
                      });
                    } else {
                      onFilterChange('resolution', selectedResolution);
                    }
                  }
                } else {
                  // Clearing resolution
                  onFilterChange('resolution', '');
                }
              }}
              aria-label="Minimum resolution"
            >
              <option value="">Any</option>
              {userDisplay && (!filters.ratio || filters.ratio === userDisplay.apiRatio) && (
                <>
                  <option disabled className="resolution-separator">─── My Display ───</option>
                  <option value={userDisplay.value}>
                    {userDisplay.width}×{userDisplay.height}
                  </option>
                </>
              )}
              {hasCustomResolution && (
                <>
                  <option disabled className="resolution-separator">─── Custom ───</option>
                  <option value={filters.resolution}>{filters.resolution.replace('x', '×')}</option>
                </>
              )}
              {filteredResolutionPresets.map((preset) => (
                <option 
                  key={preset.value} 
                  value={preset.value}
                  disabled={preset.isSeparator}
                  className={preset.isSeparator ? 'resolution-separator' : ''}
                >
                  {preset.label}
                </option>
              ))}
            </select>
            <label className="checkbox-addon">
              <input
                type="checkbox"
                checked={filters.exactResolution}
                onChange={(e) =>
                  onFilterChange('exactResolution', e.target.checked)
                }
                aria-label="Exact resolution match"
              />
              <span>Exact</span>
            </label>
          </div>
        </div>

        {/* Sort */}
        <div className="control-item control-item-sort">
          <label htmlFor="sort">
            Sort
            {isSortActive && <span className="filter-active-indicator">*</span>}
          </label>
          <select
            id="sort"
            value={filters.sort}
            onChange={(e) => onFilterChange('sort', e.target.value)}
            aria-label="Sort order"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Top range - always visible, disabled unless sort is Top */}
        <div
          className={`control-item control-item-toprange ${
            filters.sort === 'toplist' ? 'control-item-toprange-active' : ''
          }`}
        >
          <label htmlFor="timeRange">
            Top range
            {isTopRangeActive && <span className="filter-active-indicator">*</span>}
          </label>
          <select
            id="timeRange"
            value={filters.timeRange}
            onChange={(e) => onFilterChange('timeRange', e.target.value)}
            aria-label="Time range for top wallpapers"
            disabled={filters.sort !== 'toplist'}
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div className="control-item control-item-color">
          <label htmlFor="color">
            Color
            {isColorActive && <span className="filter-active-indicator">*</span>}
          </label>
          <select
            id="color"
            value={filters.color}
            onChange={(e) => onFilterChange('color', e.target.value)}
            aria-label="Color filter"
          >
            {COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* File Type */}
        <div className="control-item control-item-filetype">
          <label htmlFor="fileType">
            File type
            {isFileTypeActive && <span className="filter-active-indicator">*</span>}
          </label>
          <select
            id="fileType"
            value={filters.fileType}
            onChange={(e) => onFilterChange('fileType', e.target.value)}
            aria-label="File type filter"
          >
            {FILE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* View Mode (layout preference, not part of filter asterisk logic) */}
        <div className="control-item control-item-view">
          <label htmlFor="viewMode">View</label>
          <select
            id="viewMode"
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value)}
            aria-label="Grid view mode"
          >
            <option value={VIEW_MODES.CRAMPED}>Cramped</option>
            <option value={VIEW_MODES.COMPACT}>Compact</option>
            <option value={VIEW_MODES.COMFORTABLE}>Comfortable</option>
            <option value={VIEW_MODES.COZY}>Cozy</option>
            <option value={VIEW_MODES.CINEMATIC}>Cinematic</option>
          </select>
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

      {/* Content filters row */}
      <div className="controls-content-row">
        <div className="content-filters-group">
          <label className="content-filters-label">Categories</label>
          <div className="categories-group">
            <label className="category-checkbox">
              <input
                type="checkbox"
                checked={filters.categories.general}
                onChange={(e) =>
                  onFilterChange('categories', {
                    ...filters.categories,
                    general: e.target.checked,
                  })
                }
                aria-label="General category"
              />
              <span>General</span>
            </label>
            <label className="category-checkbox">
              <input
                type="checkbox"
                checked={filters.categories.anime}
                onChange={(e) =>
                  onFilterChange('categories', {
                    ...filters.categories,
                    anime: e.target.checked,
                  })
                }
                aria-label="Anime category"
              />
              <span>Anime</span>
            </label>
            <label className="category-checkbox">
              <input
                type="checkbox"
                checked={filters.categories.people}
                onChange={(e) =>
                  onFilterChange('categories', {
                    ...filters.categories,
                    people: e.target.checked,
                  })
                }
                aria-label="People category"
              />
              <span>People</span>
            </label>
          </div>
        </div>

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

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="error-dismiss"
            onClick={onClearError}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
