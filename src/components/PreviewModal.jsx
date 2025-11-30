import React, { useEffect } from 'react';
import { formatFileSize, formatRelativeDate, getFavoriteToast } from '../utils';
import { getColorName } from '../constants';
import { useToast } from '../context/ToastContext';
import { useImageWithRetry } from '../hooks/useImageWithRetry';
import { IMAGE_RETRY_CONFIG, toProxiedFullUrl, toProxiedDownloadUrl, toWorkerFullUrl, downloadWallpaperBlob } from '../utils/imageUtils';

export function PreviewModal({ 
  wallpaper, 
  onClose, 
  onNext, 
  onPrevious,
  hasNext,
  hasPrevious,
  isFavorite,
  onToggleFavorite,
  isDownloaded,
  onMarkDownloaded,
  onColorClick,
  onTagClick,
  onSearchSimilar,
  fetchWallpaperDetails,
  isLoadingPage = false
}) {
  const { addToast } = useToast();
  const [tags, setTags] = React.useState([]);
  const [loadingTags, setLoadingTags] = React.useState(false);
  const [useProxy, setUseProxy] = React.useState(true);
  const [showAllTags, setShowAllTags] = React.useState(false);
  const [uploaderName, setUploaderName] = React.useState(null);
  const [uploaderAvatar, setUploaderAvatar] = React.useState(null);
  const [downloadStatus, setDownloadStatus] = React.useState('idle'); // 'idle', 'downloading', 'error'
  const modalRef = React.useRef(null);
  
  const fullImageUrl = React.useMemo(() => toProxiedFullUrl(wallpaper.url), [wallpaper.url]);

  const {
    imageUrl,
    imageLoaded,
    imageError,
    handleLoad,
    handleError,
    reset,
  } = useImageWithRetry(fullImageUrl, {
    ...IMAGE_RETRY_CONFIG,
    maxRetries: 3,
    // On hard failure, fall back once to the Cloudflare Worker URL for this full image.
    onHardFailure: ({ lastUrl }) => {
      // If we're already using the worker URL, don't loop.
      if (lastUrl.startsWith('https://images.wallbrowser.com')) {
        return null;
      }
      return toWorkerFullUrl(wallpaper.url);
    },
  });

  // Reset proxy flag when wallpaper changes
  React.useEffect(() => {
    setUseProxy(true);
  }, [wallpaper.id, wallpaper.url]);
  
  // Fetch full wallpaper details to get tags
  React.useEffect(() => {
    const loadTags = async () => {
      setLoadingTags(true);
      setTags([]); // Clear previous tags

      const details = await fetchWallpaperDetails(wallpaper.id);
      if (details && details.tags) {
        setTags(details.tags);
      }

      // If detailed uploader info is available (with API key), use it in the modal
      if (details && details.uploader) {
        const name = details.uploader.username || null;
        const avatar = details.uploader.avatar?.['128px'] || null;

        if (name) {
          setUploaderName(name);
        }
        if (avatar) {
          setUploaderAvatar(avatar);
        }
      }

      setLoadingTags(false);
    };

    loadTags();
  }, [wallpaper.id, fetchWallpaperDetails]);

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
      setDownloadStatus('downloading');
      const { blob, ext } = await downloadWallpaperBlob(wallpaper.url);
      
      // Create download link
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `wallhaven-${wallpaper.id}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      
      // Mark as downloaded
      onMarkDownloaded?.(wallpaper);

      addToast('Download complete!', 'success');
      setDownloadStatus('idle');
    } catch (err) {
      console.error('Download failed:', err);
      addToast('Failed to download wallpaper. Please try again.', 'error');
      setDownloadStatus('error');
      setTimeout(() => setDownloadStatus('idle'), 2000);
    }
  };

  // Handle favorite toggle with toast
  const handleFavoriteClick = () => {
    onToggleFavorite(wallpaper);
    const { message, type } = getFavoriteToast(isFavorite);
    addToast(message, type, 2000);
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
          <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="preview-content">
          {hasPrevious && (
            <button
              type="button"
              className="preview-nav preview-nav-left"
              onClick={onPrevious}
              aria-label="Previous wallpaper"
            >
              <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}

          <div 
            className="preview-image-container"
            style={wallpaper.width && wallpaper.height ? { aspectRatio: `${wallpaper.width} / ${wallpaper.height}` } : undefined}
          >
            {!imageLoaded && !imageError && (
              <div className="preview-skeleton" aria-label="Loading image..." />
            )}
            {imageError && (
              <div className="preview-image-error">
                <p className="preview-image-error-title">
                  Failed to load image.
                  {' '}
                  <a
                    href={wallpaper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="preview-image-error-link"
                  >
                    Open in new tab
                  </a>
                </p>
                <div className="preview-image-error-actions">
                  <button
                    type="button"
                    className="preview-action-button preview-action-retry"
                    onClick={reset}
                  >
                    Retry image
                  </button>
                </div>
              </div>
            )}
            <img
              key={imageUrl} // Force re-render when URL changes
              src={imageUrl}
              alt={wallpaper.title}
              className="preview-image"
              style={{ opacity: imageLoaded ? 1 : 0 }}
              onLoad={handleLoad}
              onError={handleError}
            />
          </div>

          {hasNext && (
            <button
              type="button"
              className="preview-nav preview-nav-right"
              onClick={onNext}
              aria-label="Next wallpaper"
            >
              <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
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
                <h3 className="preview-title">
                  <span className="preview-id-prefix">#</span>
                  {wallpaper.id}
                </h3>
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
                onClick={handleFavoriteClick}
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <span className={isFavorite ? 'action-icon heart-filled' : 'action-icon'}>
                  {isFavorite ? '♥' : '♡'}
                </span>
              </button>
              <button
                type="button"
                className="preview-action-button preview-action-similar"
                onClick={() => {
                  onSearchSimilar?.(wallpaper.id);
                  onClose();
                }}
                aria-label="Find similar wallpapers"
                title="Find similar wallpapers"
              >
                <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className={`preview-action-button preview-action-download ${isDownloaded ? 'preview-download-downloaded' : ''} ${downloadStatus === 'error' ? 'preview-download-error' : ''}`}
                aria-label={isDownloaded ? 'Already downloaded. Download again' : 'Download wallpaper'}
                title={isDownloaded ? 'Already downloaded (click to download again)' : 'Download wallpaper'}
              >
                {downloadStatus === 'error' ? (
                  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                ) : isDownloaded ? (
                  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                )}
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
              {wallpaper.source && (
                <a
                  href={wallpaper.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preview-action-button preview-action-source"
                  aria-label="View original source"
                  title={`View source: ${wallpaper.source}`}
                >
                  <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                  </svg>
                </a>
              )}
            </div>
          </div>

          <div className="preview-metadata">
            <div className="preview-meta-item">
              <span className="preview-meta-label">Resolution</span>
              <span className="preview-meta-value">
                {wallpaper.width} × {wallpaper.height}
              </span>
              {wallpaper.ratio && (
                <span className="preview-meta-secondary">({wallpaper.ratio}:1)</span>
              )}
            </div>
            
            {wallpaper.fileSize > 0 && (
              <div className="preview-meta-item">
                <span className="preview-meta-label">File Size</span>
                <span className="preview-meta-value">
                  {formatFileSize(wallpaper.fileSize)}
                </span>
                {wallpaper.fileType && (
                  <span className="preview-meta-secondary">
                    {wallpaper.fileType === 'image/png' ? 'PNG' : 'JPEG'}
                  </span>
                )}
              </div>
            )}
            
            <div className="preview-meta-item">
              <span className="preview-meta-label">Uploader</span>
              <span className="preview-meta-value">
                {(uploaderAvatar || wallpaper.authorAvatar) && (
                  <img 
                    src={uploaderAvatar || wallpaper.authorAvatar} 
                    alt={uploaderName || wallpaper.author}
                    className="preview-author-avatar"
                  />
                )}
                {uploaderName || wallpaper.author}
              </span>
            </div>
            
            <div className="preview-meta-item">
              <span className="preview-meta-label">Category</span>
              <span className="preview-meta-value">{wallpaper.category}</span>
            </div>
            
            <div className="preview-meta-item">
              <span className="preview-meta-label">Purity</span>
              <span className={`preview-meta-value preview-purity preview-purity-${wallpaper.purity || 'sfw'}`}>
                {(wallpaper.purity || 'sfw').toUpperCase()}
              </span>
            </div>
            
            <div className="preview-meta-item">
              <span className="preview-meta-label">Views</span>
              <span className="preview-meta-value">{(wallpaper.views || 0).toLocaleString()}</span>
            </div>
            
            <div className="preview-meta-item">
              <span className="preview-meta-label">Favorites</span>
              <span className="preview-meta-value">{(wallpaper.ups || 0).toLocaleString()}</span>
            </div>
            
            {wallpaper.createdAt && (
              <div className="preview-meta-item">
                <span className="preview-meta-label">Uploaded</span>
                <span className="preview-meta-value">
                  {formatRelativeDate(wallpaper.createdAt)}
                </span>
              </div>
            )}
            
            {wallpaper.colors && wallpaper.colors.length > 0 && (
              <div className="preview-meta-item preview-meta-item-colors">
                <span className="preview-meta-label">Colors</span>
                <div className="preview-colors">
                  {wallpaper.colors.slice(0, 5).map((color, index) => (
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
          </div>
        </div>
      </div>
    </div>
  );
}
