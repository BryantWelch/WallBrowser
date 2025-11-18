import React, { useMemo } from 'react';
import {
  RESOLUTION_PRESETS,
  COLOR_OPTIONS,
  SORT_OPTIONS,
  TIME_RANGE_OPTIONS,
  ASPECT_RATIO_OPTIONS,
  VIEW_MODES,
  FILE_TYPE_OPTIONS,
} from '../constants';

export function ControlsPanel({
  filters,
  onFilterChange,
  onMultipleFilterChanges,
  onFetch,
  isLoading,
  error,
  onClearError,
  viewMode,
  onViewModeChange,
  onOpenSettings,
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

  const [isRolling, setIsRolling] = React.useState(false);
  const [currentDice, setCurrentDice] = React.useState(6); // Start with dice showing 6
  const [showSearchHints, setShowSearchHints] = React.useState(false);
  const searchHintsRef = React.useRef(null);
  const searchButtonRef = React.useRef(null);

  // Close search hints when clicking outside
  React.useEffect(() => {
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

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      onFetch();
    }
  };

  const handleRandomSearch = () => {
    if (isLoading || isRolling) return;
    
    // Start rolling animation
    setIsRolling(true);
    
    // Cycle through dice faces quickly
    let cycles = 0;
    const maxCycles = 8; // Number of times to change the dice
    const interval = setInterval(() => {
      setCurrentDice(Math.floor(Math.random() * 6) + 1); // 1-6
      cycles++;
      
      if (cycles >= maxCycles) {
        clearInterval(interval);
        setIsRolling(false);
        // Set final random dice face
        setCurrentDice(Math.floor(Math.random() * 6) + 1);
      }
    }, 50); // Change every 50ms
    
    // Set sort to random and trigger fetch
    onMultipleFilterChanges({ sort: 'random' });
    // Trigger fetch immediately - force new results each time
    setTimeout(() => onFetch(), 0);
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
            <input
              id="query"
              type="text"
              placeholder="e.g. cyberpunk city, @username, +tag -tag"
              value={filters.query}
              onChange={(e) => onFilterChange('query', e.target.value)}
              onKeyPress={handleSearchKeyPress}
              aria-label="Search wallpapers"
            />
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
        <div className="control-item control-item-random">
          <button
            className="random-button"
            type="button"
            onClick={handleRandomSearch}
            disabled={isLoading || isRolling}
            title="Get random wallpapers"
            aria-label="Get random wallpapers"
          >
            {currentDice === 1 && (
              <svg viewBox="0 0 24 24" fill="currentColor" className="dice-icon">
                <circle cx="12" cy="12" r="2.5"/>
              </svg>
            )}
            {currentDice === 2 && (
              <svg viewBox="0 0 24 24" fill="currentColor" className="dice-icon">
                <circle cx="7" cy="7" r="2.5"/>
                <circle cx="17" cy="17" r="2.5"/>
              </svg>
            )}
            {currentDice === 3 && (
              <svg viewBox="0 0 24 24" fill="currentColor" className="dice-icon">
                <circle cx="7" cy="7" r="2.5"/>
                <circle cx="12" cy="12" r="2.5"/>
                <circle cx="17" cy="17" r="2.5"/>
              </svg>
            )}
            {currentDice === 4 && (
              <svg viewBox="0 0 24 24" fill="currentColor" className="dice-icon">
                <circle cx="7" cy="7" r="2.5"/>
                <circle cx="17" cy="7" r="2.5"/>
                <circle cx="7" cy="17" r="2.5"/>
                <circle cx="17" cy="17" r="2.5"/>
              </svg>
            )}
            {currentDice === 5 && (
              <svg viewBox="0 0 24 24" fill="currentColor" className="dice-icon">
                <circle cx="7" cy="7" r="2.5"/>
                <circle cx="17" cy="7" r="2.5"/>
                <circle cx="12" cy="12" r="2.5"/>
                <circle cx="7" cy="17" r="2.5"/>
                <circle cx="17" cy="17" r="2.5"/>
              </svg>
            )}
            {currentDice === 6 && (
              <svg viewBox="0 0 24 24" fill="currentColor" className="dice-icon">
                <circle cx="7" cy="6" r="2.5"/>
                <circle cx="7" cy="12" r="2.5"/>
                <circle cx="7" cy="18" r="2.5"/>
                <circle cx="17" cy="6" r="2.5"/>
                <circle cx="17" cy="12" r="2.5"/>
                <circle cx="17" cy="18" r="2.5"/>
              </svg>
            )}
          </button>
        </div>
        <div className="control-item control-item-button">
          <button
            className="primary-button"
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
          <label htmlFor="ratio">Aspect ratio</label>
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
          <label htmlFor="resolution">Resolution</label>
          <div className="control-with-addon">
            <select
              id="resolution"
              value={filters.resolution}
              onChange={(e) => {
                const selectedResolution = e.target.value;
                if (selectedResolution) {
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
                } else {
                  // Clearing resolution
                  onFilterChange('resolution', '');
                }
              }}
              aria-label="Minimum resolution"
            >
              <option value="">Any</option>
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
          <label htmlFor="sort">Sort</label>
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

        {/* Top range - conditional */}
        {filters.sort === 'toplist' && (
          <div className="control-item control-item-animated">
            <label htmlFor="timeRange">Top range</label>
            <select
              id="timeRange"
              value={filters.timeRange}
              onChange={(e) => onFilterChange('timeRange', e.target.value)}
              aria-label="Time range for top wallpapers"
            >
              {TIME_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Color */}
        <div className="control-item control-item-color">
          <label htmlFor="color">Color</label>
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
          <label htmlFor="fileType">File type</label>
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

        {/* View Mode */}
        <div className="control-item control-item-view">
          <label htmlFor="viewMode">View</label>
          <select
            id="viewMode"
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value)}
            aria-label="Grid view mode"
          >
            <option value={VIEW_MODES.COMPACT}>Compact</option>
            <option value={VIEW_MODES.COMFORTABLE}>Comfortable</option>
            <option value={VIEW_MODES.COZY}>Cozy</option>
          </select>
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
          ⚙️ Settings
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
