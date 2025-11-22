import React, { useEffect } from 'react';
import { formatFileSize } from '../utils';
import { getColorName } from '../constants';

export function PreviewModal({ 
  wallpaper, 
  onClose, 
  onNext, 
  onPrevious,
  hasNext,
  hasPrevious,
  isFavorite,
  onToggleFavorite,
  onColorClick,
  onTagClick,
  fetchWallpaperDetails,
  isLoadingPage = false
}) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const [tags, setTags] = React.useState([]);
  const [loadingTags, setLoadingTags] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState('');
  const [useProxy, setUseProxy] = React.useState(true);
  const [showAllTags, setShowAllTags] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);
  const modalRef = React.useRef(null);
  
  // Set image URL when wallpaper changes
  React.useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setUseProxy(true);
    
    // Use full-size image for preview (proxied for speed)
    let url = wallpaper.url;
    
    // Proxy full-size images from w.wallhaven.cc
    if (url.includes('w.wallhaven.cc')) {
      url = url.replace('https://w.wallhaven.cc', '/proxy/image');
    }
    
    setImageUrl(url);
    
    // Preload current image immediately
    const img = new Image();
    img.src = url;
  }, [wallpaper.id, wallpaper.url]);
  
  // Fetch full wallpaper details to get tags
  React.useEffect(() => {
    const loadTags = async () => {
      setLoadingTags(true);
      setTags([]); // Clear previous tags
      
      // Retry up to 3 times with exponential backoff
      let retries = 3;
      let delay = 1000;
      
      for (let i = 0; i < retries; i++) {
        const details = await fetchWallpaperDetails(wallpaper.id);
        if (details && details.tags) {
          setTags(details.tags);
          setLoadingTags(false);
          return;
        }
        
        // Wait before retry (except on last attempt)
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
      
      // All retries failed
      setLoadingTags(false);
    };
    
    loadTags();
  }, [wallpaper.id, fetchWallpaperDetails]);

  // Handle image error with retry logic
  const handleImageError = React.useCallback(() => {
    if (retryCount < MAX_RETRIES) {
      // Retry with a small delay and cache-busting parameter
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        // Check if URL already has params
        const separator = imageUrl.includes('?') ? '&' : '?';
        // Remove existing retry param if present
        const cleanUrl = imageUrl.replace(/[?&]retry=\d+/, '');
        const newUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}retry=${retryCount + 1}`;
        
        setImageUrl(newUrl);
      }, 250 * (retryCount + 1)); // Exponential backoff: 250ms, 500ms...
    } else {
      setImageError(true);
    }
  }, [retryCount, imageUrl]);

  // Focus trap and keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrevious) onPrevious();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };

    // Focus the modal on mount for keyboard accessibility
    if (modalRef.current) {
      modalRef.current.focus();
    }
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, onNext, onPrevious, hasNext, hasPrevious]);

  // Handle download
  const handleDownload = async () => {
    try {
      // Convert Wallhaven URL to use our proxy
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
      
      // Create download link
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `wallhaven-${wallpaper.id}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download wallpaper. Please try again.');
    }
  };

  if (!wallpaper) return null;

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div 
        className="preview-modal" 
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="preview-close"
          onClick={onClose}
          aria-label="Close preview"
        >
          ×
        </button>

        <div className="preview-content">
          {hasPrevious && (
            <button
              type="button"
              className="preview-nav preview-nav-left"
              onClick={onPrevious}
              aria-label="Previous wallpaper"
            >
              ‹
            </button>
          )}

          <div 
            className="preview-image-container"
            style={{
              aspectRatio: `${wallpaper.width} / ${wallpaper.height}`,
            }}
          >
            {!imageLoaded && !imageError && (
              <div className="preview-skeleton" aria-label="Loading image..." />
            )}
            {imageError && (
              <div className="preview-image-error">
                Failed to load image. <a href={wallpaper.url} target="_blank" rel="noopener noreferrer">Open in new tab</a>
              </div>
            )}
            <img
              key={imageUrl} // Force re-render when URL changes
              src={imageUrl}
              alt={wallpaper.title}
              className="preview-image"
              style={{ opacity: imageLoaded ? 1 : 0 }}
              onLoad={() => setImageLoaded(true)}
              onError={handleImageError}
            />
          </div>

          {hasNext && (
            <button
              type="button"
              className="preview-nav preview-nav-right"
              onClick={onNext}
              aria-label="Next wallpaper"
            >
              ›
            </button>
          )}
          
          {/* Loading overlay for page transitions */}
          {isLoadingPage && (
            <div className="preview-loading-overlay">
              <div className="preview-spinner"></div>
            </div>
          )}
        </div>

        <div className="preview-info">
          <div className="preview-info-row">
            <div className="preview-title-section">
              <a 
                href={wallpaper.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="preview-title-link"
                title="View on Wallhaven"
              >
                <h3 className="preview-title">{wallpaper.id}</h3>
              </a>
              {/* Tags inline with title */}
              {tags.length > 0 && (
                <div className="preview-tags-inline">
                  {(showAllTags ? tags : tags.slice(0, 10)).map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      className="preview-tag-inline"
                      onClick={() => onTagClick?.(tag.name)}
                      title={`Search for "${tag.name}"`}
                    >
                      {tag.name}
                    </button>
                  ))}
                  {tags.length > 10 && (
                    <button
                      type="button"
                      className="preview-tag-expand"
                      onClick={() => setShowAllTags(!showAllTags)}
                      title={showAllTags ? 'Show less tags' : `Show ${tags.length - 10} more tags`}
                    >
                      {showAllTags ? '← Less' : `+${tags.length - 10} more`}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="preview-actions">
              <button
                type="button"
                className="preview-action-button preview-action-favorite"
                onClick={() => onToggleFavorite(wallpaper)}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <span className={isFavorite ? 'action-icon heart-filled' : 'action-icon'}>
                  {isFavorite ? '♥' : '♡'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="preview-action-button preview-action-download"
                aria-label="Download wallpaper"
                title="Download wallpaper"
              >
                <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <a
                href={wallpaper.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="preview-action-button preview-action-link"
                aria-label="View on Wallhaven"
                title="View on Wallhaven"
              >
                <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>
          </div>

          <div className="preview-metadata">
            <div className="preview-meta-item">
              <span className="preview-meta-label">Resolution</span>
              <span className="preview-meta-value">
                {wallpaper.width} × {wallpaper.height}
                {wallpaper.ratio && <span className="preview-meta-secondary"> ({wallpaper.ratio}:1)</span>}
              </span>
            </div>
            
            {wallpaper.fileSize > 0 && (
              <div className="preview-meta-item">
                <span className="preview-meta-label">File Size</span>
                <span className="preview-meta-value">
                  {formatFileSize(wallpaper.fileSize)}
                  {wallpaper.fileType && (
                    <span className="preview-meta-secondary">
                      {' '}· {wallpaper.fileType === 'image/png' ? 'PNG' : 'JPEG'}
                    </span>
                  )}
                </span>
              </div>
            )}
            
            <div className="preview-meta-item">
              <span className="preview-meta-label">Author</span>
              <span className="preview-meta-value">
                {wallpaper.authorAvatar && (
                  <img 
                    src={wallpaper.authorAvatar} 
                    alt={wallpaper.author}
                    className="preview-author-avatar"
                  />
                )}
                {wallpaper.author}
                {wallpaper.authorGroup && (
                  <span className="preview-meta-secondary"> · {wallpaper.authorGroup}</span>
                )}
                {wallpaper.author === 'Anonymous' && (
                  <span 
                    className="preview-meta-hint" 
                    title="Add a Wallhaven API key in src/constants.js to see uploader names"
                  >
                    {' '}(add API key to see)
                  </span>
                )}
              </span>
            </div>
            
            <div className="preview-meta-item">
              <span className="preview-meta-label">Favorites</span>
              <span className="preview-meta-value">{wallpaper.ups}</span>
            </div>
            
            {wallpaper.views > 0 && (
              <div className="preview-meta-item">
                <span className="preview-meta-label">Views</span>
                <span className="preview-meta-value">{wallpaper.views.toLocaleString()}</span>
              </div>
            )}
            
            <div className="preview-meta-item">
              <span className="preview-meta-label">Category</span>
              <span className="preview-meta-value">{wallpaper.category}</span>
            </div>
            
            {wallpaper.colors && wallpaper.colors.length > 0 && (
              <div className="preview-meta-item preview-meta-item-colors">
                <span className="preview-meta-label">Colors</span>
                <div className="preview-colors">
                  {wallpaper.colors.map((color, index) => (
                    <button
                      type="button"
                      key={index}
                      className="preview-color-swatch"
                      style={{ backgroundColor: color }}
                      title={`${getColorName(color)} (${color}) - Click to search`}
                      onClick={() => onColorClick?.(color)}
                      aria-label={`Filter by color ${color}`}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {wallpaper.source && (
              <div className="preview-meta-item preview-meta-item-full">
                <span className="preview-meta-label">Source</span>
                <a 
                  href={wallpaper.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preview-source-link"
                >
                  {wallpaper.source.length > 50 
                    ? wallpaper.source.substring(0, 47) + '...'
                    : wallpaper.source
                  } →
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
