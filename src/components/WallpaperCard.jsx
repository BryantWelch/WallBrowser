import React, { useState, useMemo, useCallback } from 'react';
import { formatFileSize } from '../utils';
import { getColorName } from '../constants';
import { useToast } from '../context/ToastContext';
import { useImageWithRetry } from '../hooks/useImageWithRetry';
import { IMAGE_RETRY_CONFIG, toProxiedDownloadUrl } from '../utils/imageUtils';

export const WallpaperCard = React.memo(function WallpaperCard({ 
  wallpaper,
  index,
  isSelected, 
  isFavorite,
  onToggleSelect, 
  onToggleFavorite,
  onClick,
  onColorClick,
  onSearchSimilar,
  viewMode = 'comfortable'
}) {
  const { addToast } = useToast();

  const {
    imageUrl,
    imageLoaded,
    imageError,
    handleLoad,
    handleError,
  } = useImageWithRetry(wallpaper.thumbUrl, IMAGE_RETRY_CONFIG);

  const label = useMemo(() => `${wallpaper.width}×${wallpaper.height}`, [wallpaper.width, wallpaper.height]);
  const formattedFileSize = useMemo(() => wallpaper.fileSize > 0 ? formatFileSize(wallpaper.fileSize) : null, [wallpaper.fileSize]);
  const formattedViews = useMemo(() => (wallpaper.views || 0).toLocaleString(), [wallpaper.views]);
  const formattedFavorites = useMemo(() => (wallpaper.ups || 0).toLocaleString(), [wallpaper.ups]);
  const fileTypeLabel = useMemo(() => wallpaper.fileType === 'image/png' ? 'PNG' : 'JPEG', [wallpaper.fileType]);

  const handleSelect = useCallback((e) => {
    e.stopPropagation();
    onToggleSelect(wallpaper.id, index, e.shiftKey);
  }, [onToggleSelect, wallpaper.id, index]);

  const handleFavorite = useCallback((e) => {
    e.stopPropagation();
    onToggleFavorite(wallpaper);
    if (!isFavorite) {
      addToast('Added to favorites', 'success', 2000);
    } else {
      addToast('Removed from favorites', 'info', 2000);
    }
  }, [onToggleFavorite, wallpaper, isFavorite, addToast]);

  const handleDownload = useCallback(async (e) => {
    e.stopPropagation();
    try {
      const downloadUrl = toProxiedDownloadUrl(wallpaper.url);
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const ext = wallpaper.url.split('.').pop() || 'jpg';
      
      // Create download link
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `wallhaven-${wallpaper.id}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      addToast('Download complete!', 'success');
    } catch (err) {
      console.error('Download failed:', err);
      addToast('Failed to download wallpaper. Please try again.', 'error');
    }
  }, [wallpaper, addToast]);

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
        className="wallpaper-download-toggle"
        onClick={handleDownload}
        title="Download wallpaper"
        aria-label="Download wallpaper"
      >
        <svg className="action-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
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
            src={imageUrl}
            alt={wallpaper.title}
            style={{ opacity: imageLoaded ? 1 : 0 }}
            onLoad={handleLoad}
            onError={handleError}
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
            <svg className="wallpaper-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            {formattedViews}
          </span>
          <span className="wallpaper-pill" title={`${formattedFavorites} favorites`}>
            <svg className="wallpaper-icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
            </svg>
            {formattedFavorites}
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
                  title={`${getColorName(color)} (${color}) - Click to search`}
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
            <svg className="similar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            Similar
          </button>
        </div>
      </div>
    </article>
  );
});
