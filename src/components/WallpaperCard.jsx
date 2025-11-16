import React, { useState, useMemo, useCallback } from 'react';
import { formatFileSize } from '../utils';

export const WallpaperCard = React.memo(function WallpaperCard({ 
  wallpaper, 
  isSelected, 
  isFavorite,
  onToggleSelect, 
  onToggleFavorite,
  onClick,
  onColorClick,
  onSearchSimilar,
  viewMode = 'comfortable'
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const label = useMemo(() => `${wallpaper.width}×${wallpaper.height}`, [wallpaper.width, wallpaper.height]);
  const formattedFileSize = useMemo(() => wallpaper.fileSize > 0 ? formatFileSize(wallpaper.fileSize) : null, [wallpaper.fileSize]);
  const formattedViews = useMemo(() => (wallpaper.views || 0).toLocaleString(), [wallpaper.views]);
  const formattedFavorites = useMemo(() => (wallpaper.ups || 0).toLocaleString(), [wallpaper.ups]);
  const fileTypeLabel = useMemo(() => wallpaper.fileType === 'image/png' ? 'PNG' : 'JPEG', [wallpaper.fileType]);

  const handleSelect = useCallback((e) => {
    e.stopPropagation();
    onToggleSelect(wallpaper.id);
  }, [onToggleSelect, wallpaper.id]);

  const handleFavorite = useCallback((e) => {
    e.stopPropagation();
    onToggleFavorite(wallpaper);
  }, [onToggleFavorite, wallpaper]);

  const handleClick = useCallback(() => {
    onClick(wallpaper);
  }, [onClick, wallpaper]);

  const handleSearchSimilar = useCallback((e) => {
    e.stopPropagation();
    onSearchSimilar?.(wallpaper.id);
  }, [onSearchSimilar, wallpaper.id]);

  return (
    <article
      className={`wallpaper-card wallpaper-card-${viewMode} ${
        isSelected ? 'wallpaper-card-selected' : ''
      }`}
    >
      <button
        type="button"
        className="wallpaper-select-toggle"
        onClick={handleSelect}
        title={isSelected ? 'Deselect wallpaper' : 'Select wallpaper'}
        aria-label={isSelected ? 'Deselect wallpaper' : 'Select wallpaper'}
      >
        <span
          className={isSelected ? 'checkbox checkbox-checked' : 'checkbox'}
        />
      </button>

      <button
        type="button"
        className="wallpaper-favorite-toggle"
        onClick={handleFavorite}
        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <span className={isFavorite ? 'heart heart-filled' : 'heart'}>
          {isFavorite ? '♥' : '♡'}
        </span>
      </button>

      <button
        type="button"
        className="wallpaper-thumbnail-button"
        onClick={handleClick}
        aria-label="View wallpaper details"
      >
        {!imageLoaded && !imageError && (
          <div className="wallpaper-skeleton" aria-label="Loading..." />
        )}
        {imageError ? (
          <div className="wallpaper-error">Failed to load</div>
        ) : (
          <img
            className="wallpaper-thumbnail"
            src={wallpaper.thumbUrl}
            alt={wallpaper.title}
            loading="lazy"
            style={{ opacity: imageLoaded ? 1 : 0 }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}
      </button>

      <div className="wallpaper-meta">
        {/* Row 1: Image info (resolution, file size, file type) */}
        <div className="wallpaper-pills wallpaper-pills-info">
          <span className="wallpaper-pill" title={`Resolution: ${label}`}>
            {label}
          </span>
          {formattedFileSize && (
            <span className="wallpaper-pill" title={`File size: ${formattedFileSize}`}>
              {formattedFileSize}
            </span>
          )}
          {wallpaper.fileType && (
            <span className="wallpaper-pill" title={`Image format: ${fileTypeLabel}`}>
              {fileTypeLabel}
            </span>
          )}
        </div>

        {/* Row 2: Stats (views and favorites - always shown) */}
        <div className="wallpaper-pills wallpaper-pills-stats">
          <span className="wallpaper-pill" title={`${formattedViews} views`}>
            <span className="wallpaper-icon">👁</span> {formattedViews}
          </span>
          <span className="wallpaper-pill" title={`${formattedFavorites} favorites`}>
            <span className="wallpaper-icon">♥</span> {formattedFavorites}
          </span>
        </div>

        {/* Row 3: Colors and similar button */}
        <div className="wallpaper-colors-row">
          {wallpaper.colors && wallpaper.colors.length > 0 && (
            <div className="wallpaper-colors">
              {wallpaper.colors.map((color, index) => (
                <button
                  type="button"
                  key={index}
                  className="wallpaper-color-swatch"
                  style={{ backgroundColor: color }}
                  title={`${color} - Click to search`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onColorClick?.(color);
                  }}
                  aria-label={`Filter by color ${color}`}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            className="wallpaper-similar-button"
            onClick={handleSearchSimilar}
            title="Search for similar wallpapers"
            aria-label="Search for similar wallpapers"
          >
            🔍 Similar
          </button>
        </div>
      </div>
    </article>
  );
});
