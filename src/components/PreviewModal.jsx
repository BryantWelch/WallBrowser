import React, { useEffect, useLayoutEffect } from 'react';
import { formatFileSize, formatRelativeDate, getFavoriteToast } from '../utils';
import { getColorName } from '../constants';
import { useToast } from '../context/ToastContext';
import { useImageWithRetry } from '../hooks/useImageWithRetry';
import { IMAGE_RETRY_CONFIG, toProxiedFullUrl, toProxiedDownloadUrl, toWorkerFullUrl, downloadWallpaperBlob } from '../utils/imageUtils';

function useNarrowPreview() {
  const query = '(max-width: 768px)';
  const [matches, setMatches] = React.useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return matches;
}

const NAMED_ASPECTS = [
  [48, 9], [32, 9], [21, 9], [16, 9], [16, 10], [3, 2], [4, 3], [5, 4],
  [1, 1], [4, 5], [3, 4], [2, 3], [10, 16], [9, 16], [9, 18], [9, 21],
];

function greatestCommonDivisor(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function describeAspect(width, height, ratioValue) {
  const numericWidth = Number(width);
  const numericHeight = Number(height);
  const value = numericWidth > 0 && numericHeight > 0
    ? numericWidth / numericHeight
    : Number(ratioValue);
  if (!Number.isFinite(value) || value <= 0) return null;

  const exact = Number.isFinite(Number(ratioValue))
    ? String(ratioValue)
    : value.toFixed(2);

  let match = null;
  for (const [ratioWidth, ratioHeight] of NAMED_ASPECTS) {
    const target = ratioWidth / ratioHeight;
    const diff = Math.abs(value - target) / target;
    if (diff <= 0.025 && (!match || diff < match.diff)) {
      match = { label: `${ratioWidth}:${ratioHeight}`, diff };
    }
  }
  if (match) return { label: match.label, exact };

  const roundedWidth = Math.round(numericWidth);
  const roundedHeight = Math.round(numericHeight);
  if (roundedWidth > 0 && roundedHeight > 0) {
    const divisor = greatestCommonDivisor(roundedWidth, roundedHeight);
    const ratioWidth = roundedWidth / divisor;
    const ratioHeight = roundedHeight / divisor;
    if (ratioWidth <= 48 && ratioHeight <= 48) {
      return { label: `${ratioWidth}:${ratioHeight}`, exact };
    }
  }

  let closest = NAMED_ASPECTS[0];
  let closestDiff = Infinity;
  for (const [ratioWidth, ratioHeight] of NAMED_ASPECTS) {
    const diff = Math.abs(value - (ratioWidth / ratioHeight));
    if (diff < closestDiff) {
      closest = [ratioWidth, ratioHeight];
      closestDiff = diff;
    }
  }
  return { label: `${closest[0]}:${closest[1]}`, exact };
}

function PreviewTags({ tags, onTagClick }) {
  const [expanded, setExpanded] = React.useState(false);
  const containerRef = React.useRef(null);
  const [visibleCount, setVisibleCount] = React.useState(tags.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || tags.length === 0) return;

    const measure = () => {
      const tagEls = container.querySelectorAll('[data-measure-tag]');
      const moreEl = container.querySelector('[data-measure-more]');
      if (!tagEls.length) return;

      const maxWidth = container.clientWidth;
      if (maxWidth <= 0) return;

      const style = getComputedStyle(container);
      const gap = Number.parseFloat(style.columnGap || style.gap) || 0;
      const moreWidth = (moreEl?.offsetWidth ?? 0) + 4;
      let used = 0;
      let count = 0;

      for (let i = 0; i < tagEls.length; i += 1) {
        const gapBefore = count > 0 ? gap : 0;
        const reserve = i < tagEls.length - 1 ? gap + moreWidth : 0;
        if (used + gapBefore + tagEls[i].offsetWidth + reserve > maxWidth + 1) break;
        used += gapBefore + tagEls[i].offsetWidth;
        count += 1;
      }

      const next = Math.max(count, 1);
      setVisibleCount((prev) => (prev === next ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [tags]);

  if (tags.length === 0) return null;

  const shown = expanded ? tags : tags.slice(0, visibleCount);
  const hiddenCount = tags.length - shown.length;

  return (
    <div className="preview-tags-inline" ref={containerRef}>
      <div className="preview-tags-measure" aria-hidden="true">
        {tags.map((tag) => (
          <span key={tag.id} className="preview-tag-inline" data-measure-tag>
            {tag.name}
          </span>
        ))}
        <span className="preview-tag-expand" data-measure-more>
          +{Math.max(tags.length - 1, 1)} more
        </span>
      </div>
      {shown.map((tag) => (
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
      {hiddenCount > 0 && (
        <button
          type="button"
          className="preview-tag-expand"
          aria-expanded="false"
          onClick={() => setExpanded(true)}
          title={`Show ${hiddenCount} more tags`}
        >
          +{hiddenCount} more
        </button>
      )}
      {expanded && tags.length > visibleCount && (
        <button
          type="button"
          className="preview-tag-expand"
          aria-expanded="true"
          onClick={() => setExpanded(false)}
          title="Show fewer tags"
        >
          Show less
        </button>
      )}
    </div>
  );
}

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
  onUploaderClick,
  onResolutionClick,
  onCategoryClick,
  onSearchSimilar,
  fetchWallpaperDetails,
  previewPosition = null,
  isLoadingPage = false
}) {
  const { addToast } = useToast();
  const [tags, setTags] = React.useState([]);
  const [loadingTags, setLoadingTags] = React.useState(false);
  const [useProxy, setUseProxy] = React.useState(true);
  const [uploaderName, setUploaderName] = React.useState(null);
  const [uploaderAvatar, setUploaderAvatar] = React.useState(null);
  const [detailSource, setDetailSource] = React.useState('');
  const [detailSourceId, setDetailSourceId] = React.useState(wallpaper?.id ?? null);
  const narrowPreview = useNarrowPreview();
  const [downloadStatus, setDownloadStatus] = React.useState('idle'); // 'idle', 'downloading', 'error'
  const [positionFaded, setPositionFaded] = React.useState(false);
  const [fullscreenChromeFaded, setFullscreenChromeFaded] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const modalRef = React.useRef(null);
  const imageContainerRef = React.useRef(null);
  const hoveringContentRef = React.useRef(false);
  const dragRef = React.useRef(null);
  const chromeTimerRef = React.useRef(null);
  const chromeHoverRef = React.useRef(false);
  const revealFullscreenChromeRef = React.useRef(() => {});
  
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
  
  // Fetch full wallpaper details to get tags and the source URL search rows often omit.
  React.useEffect(() => {
    let cancelled = false;
    const loadTags = async () => {
      setLoadingTags(true);
      setTags([]);
      setUploaderName(null);
      setUploaderAvatar(null);

      const details = await fetchWallpaperDetails(wallpaper.id);
      if (cancelled) return;
      if (details && details.tags) {
        setTags(details.tags);
      }
      const nextSource = typeof details?.source === 'string' ? details.source.trim() : '';
      setDetailSource(nextSource);

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
    return () => {
      cancelled = true;
    };
  }, [wallpaper.id, fetchWallpaperDetails]);

  useEffect(() => {
    setPositionFaded(false);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;
    const timer = window.setTimeout(() => {
      if (!hoveringContentRef.current) setPositionFaded(true);
    }, 1150);
    return () => window.clearTimeout(timer);
  }, [wallpaper.id, previewPosition?.current, previewPosition?.total]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [wallpaper.id]);

  revealFullscreenChromeRef.current = () => {
    setFullscreenChromeFaded(false);
    window.clearTimeout(chromeTimerRef.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    chromeTimerRef.current = window.setTimeout(() => {
      if (!chromeHoverRef.current) setFullscreenChromeFaded(true);
    }, coarsePointer ? 3500 : 1150);
  };

  const isCoarsePointer = () =>
    window.matchMedia('(hover: none), (pointer: coarse)').matches;

  const holdFullscreenChrome = () => {
    // A tap on a phone fires mouseenter and focus, then never mouseleave,
    // which would leave the controls stuck on screen.
    if (isCoarsePointer()) return;
    chromeHoverRef.current = true;
    window.clearTimeout(chromeTimerRef.current);
    setFullscreenChromeFaded(false);
  };

  const releaseFullscreenChrome = () => {
    if (isCoarsePointer()) return;
    chromeHoverRef.current = false;
    revealFullscreenChromeRef.current();
  };

  const releaseFullscreenChromeAfterTouch = () => {
    if (!isCoarsePointer()) return;
    chromeHoverRef.current = false;
    revealFullscreenChromeRef.current();
  };

  useEffect(() => {
    if (!isFullscreen) {
      setFullscreenChromeFaded(false);
      chromeHoverRef.current = false;
      window.clearTimeout(chromeTimerRef.current);
      return undefined;
    }
    revealFullscreenChromeRef.current();
    return () => window.clearTimeout(chromeTimerRef.current);
  }, [isFullscreen, wallpaper.id]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === imageContainerRef.current;
      setIsFullscreen(active);
      if (!active) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return undefined;
    const handleWheel = (event) => {
      if (document.fullscreenElement !== container) return;
      event.preventDefault();
      setZoom((current) => {
        const next = Math.min(8, Math.max(1, current * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Escape leaves fullscreen first, then closes the preview on the next press.
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [onClose]);

  // Focus trap and keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
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
      link.download = `wallbrowser-${wallpaper.id}.${ext}`;
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

  const handleContentEnter = () => {
    hoveringContentRef.current = true;
    setPositionFaded(false);
  };

  const handleContentLeave = () => {
    hoveringContentRef.current = false;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) setPositionFaded(true);
  };

  const handleFullscreen = async () => {
    const container = imageContainerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch {
      addToast('Could not enter fullscreen', 'error', 2000);
    }
  };

  const handleFullscreenSurfacePointerDown = (event) => {
    if (document.fullscreenElement !== imageContainerRef.current) return;
    if (event.target.closest('button')) return;
    revealFullscreenChromeRef.current();
  };

  const handleImagePointerDown = (event) => {
    if (!isFullscreen || zoom <= 1 || fullscreenChromeFaded) return;
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleImagePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({
      x: drag.panX + (event.clientX - drag.x),
      y: drag.panY + (event.clientY - drag.y),
    });
  };

  const handleImagePointerUp = () => {
    dragRef.current = null;
  };

  const handleImageDoubleClick = () => {
    if (!isFullscreen) return;
    if (zoom === 1) {
      setZoom(2);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const changeZoom = (factor) => {
    setZoom((current) => {
      const next = Math.min(8, Math.max(1, Math.round(current * factor * 100) / 100));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCopyId = async () => {
    const value = wallpaper.id;
    let copied = false;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);
      input.select();
      copied = document.execCommand('copy');
      document.body.removeChild(input);
    }

    addToast(copied ? `Copied ${value}` : 'Could not copy the id', copied ? 'success' : 'error', 2000);
  };

  // Handle favorite toggle with toast
  const handleFavoriteClick = () => {
    onToggleFavorite(wallpaper);
    const { message, type } = getFavoriteToast(isFavorite);
    addToast(message, type, 2000);
  };

  // Drop the previous wallpaper's source before paint so the button never
  // flashes lit for a wallpaper that has no source.
  if (wallpaper?.id && detailSourceId !== wallpaper.id) {
    setDetailSourceId(wallpaper.id);
    setDetailSource('');
  }

  if (!wallpaper) return null;

  const uploaderLabel = uploaderName || wallpaper.author;
  const listingSource = typeof wallpaper.source === 'string' ? wallpaper.source.trim() : '';
  const sourceUrl = (detailSourceId === wallpaper.id ? detailSource : '') || listingSource;
  const sourceIcon = (
    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
  );
  const aspect = describeAspect(wallpaper.width, wallpaper.height, wallpaper.ratio);
  const canSearchUploader = Boolean(uploaderLabel && uploaderLabel !== 'Anonymous');
  const uploaderContent = (
    <>
      {(uploaderAvatar || wallpaper.authorAvatar) && (
        <img
          src={uploaderAvatar || wallpaper.authorAvatar}
          alt=""
          className="preview-author-avatar"
        />
      )}
      {uploaderLabel}
    </>
  );

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

        <div
          className="preview-content"
          onMouseEnter={handleContentEnter}
          onMouseLeave={handleContentLeave}
        >
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
            className={`preview-image-container${isFullscreen && fullscreenChromeFaded ? ' is-chrome-faded' : ''}`}
            ref={imageContainerRef}
            style={wallpaper.width && wallpaper.height ? { aspectRatio: `${wallpaper.width} / ${wallpaper.height}` } : undefined}
            onMouseMove={() => {
              if (document.fullscreenElement === imageContainerRef.current) {
                revealFullscreenChromeRef.current();
              }
            }}
            onPointerDown={handleFullscreenSurfacePointerDown}
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
              className={`preview-image${isFullscreen && zoom > 1 ? ' preview-image-pannable' : ''}`}
              style={{
                opacity: imageLoaded ? 1 : 0,
                transform: isFullscreen ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : undefined,
              }}
              onLoad={handleLoad}
              onError={handleError}
              onPointerDown={handleImagePointerDown}
              onPointerMove={handleImagePointerMove}
              onPointerUp={handleImagePointerUp}
              onPointerCancel={handleImagePointerUp}
              onDoubleClick={handleImageDoubleClick}
            />
            {previewPosition && (
              <p
                className={`preview-position${!isFullscreen && positionFaded ? ' is-faded' : ''}`}
                aria-live="polite"
              >
                {previewPosition.current.toLocaleString()} of {previewPosition.total.toLocaleString()}
              </p>
            )}
            {isFullscreen && (
              <>
                <div
                  className="preview-fullscreen-toolbar"
                  onMouseEnter={holdFullscreenChrome}
                  onMouseLeave={releaseFullscreenChrome}
                  onFocus={holdFullscreenChrome}
                  onBlur={releaseFullscreenChrome}
                  onPointerUp={releaseFullscreenChromeAfterTouch}
                  onPointerCancel={releaseFullscreenChromeAfterTouch}
                >
                {hasPrevious && (
                  <button
                    type="button"
                    className="preview-fullscreen-nav preview-fullscreen-nav-prev"
                    onClick={onPrevious}
                    disabled={isLoadingPage}
                    aria-label="Previous wallpaper"
                    title="Previous wallpaper"
                  >
                    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                )}
                {hasNext && (
                  <button
                    type="button"
                    className="preview-fullscreen-nav preview-fullscreen-nav-next"
                    onClick={onNext}
                    disabled={isLoadingPage}
                    aria-label="Next wallpaper"
                    title="Next wallpaper"
                  >
                    <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                )}
                <div
                  className="preview-zoom-controls"
                  role="group"
                  aria-label="Zoom"
                >
                  <button
                    type="button"
                    className="preview-zoom-button"
                    onClick={() => changeZoom(1 / 1.25)}
                    disabled={zoom <= 1}
                    aria-label="Zoom out"
                    title="Zoom out"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="preview-zoom-button preview-zoom-reset"
                    onClick={resetZoom}
                    disabled={zoom <= 1}
                    aria-label="Reset zoom"
                    title="Reset zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    className="preview-zoom-button"
                    onClick={() => changeZoom(1.25)}
                    disabled={zoom >= 8}
                    aria-label="Zoom in"
                    title="Zoom in"
                  >
                    +
                  </button>
                </div>
                </div>
                <button
                  type="button"
                  className="preview-fullscreen-exit"
                  onClick={() => {
                    document.exitFullscreen().catch(() => {});
                  }}
                  onMouseEnter={holdFullscreenChrome}
                  onMouseLeave={releaseFullscreenChrome}
                  onFocus={holdFullscreenChrome}
                  onBlur={releaseFullscreenChrome}
                  onPointerUp={releaseFullscreenChromeAfterTouch}
                  onPointerCancel={releaseFullscreenChromeAfterTouch}
                >
                  Exit fullscreen
                </button>
              </>
            )}
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
              <div className="preview-title-line">
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
                <button
                  type="button"
                  className="preview-id-copy"
                  onClick={handleCopyId}
                  aria-label={`Copy wallpaper id ${wallpaper.id}`}
                  title="Copy id"
                >
                  <svg className="preview-id-copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
              {(loadingTags || tags.length > 0) && (
                <div className="preview-tags-section">
                  <h4 className="preview-section-label">Tags</h4>
                  {loadingTags && tags.length === 0 ? (
                    <div className="preview-tags-inline preview-tags-loading" aria-hidden="true">
                      <span className="preview-tag-placeholder" />
                      <span className="preview-tag-placeholder" />
                      <span className="preview-tag-placeholder" />
                      <span className="preview-tag-placeholder" />
                    </div>
                  ) : (
                    <PreviewTags key={wallpaper.id} tags={tags} onTagClick={onTagClick} />
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
              <button
                type="button"
                className="preview-action-button preview-action-fullscreen"
                onClick={handleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
                title={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
              >
                <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isFullscreen ? (
                    <>
                      <polyline points="4 14 10 14 10 20"></polyline>
                      <polyline points="20 10 14 10 14 4"></polyline>
                      <line x1="14" y1="10" x2="21" y2="3"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </>
                  ) : (
                    <>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <polyline points="9 21 3 21 3 15"></polyline>
                      <line x1="21" y1="3" x2="14" y2="10"></line>
                      <line x1="3" y1="21" x2="10" y2="14"></line>
                    </>
                  )}
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
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preview-action-button preview-action-source"
                  aria-label="View original source"
                  title={`View source: ${sourceUrl}`}
                >
                  {sourceIcon}
                </a>
              ) : (
                <button
                  type="button"
                  className="preview-action-button preview-action-source is-unavailable"
                  disabled
                  aria-label="No original source"
                  title="No original source"
                >
                  {sourceIcon}
                </button>
              )}
            </div>
          </div>

          <div className="preview-properties">
            <h4 className="preview-section-label">Properties</h4>
            <div className="preview-metadata">
            <div className="preview-meta-item">
              <span className="preview-meta-label">Resolution</span>
              <button
                type="button"
                className="preview-meta-value preview-meta-button"
                onClick={() => onResolutionClick?.(wallpaper.width, wallpaper.height)}
                title={`Filter by ${wallpaper.width} × ${wallpaper.height}`}
              >
                {wallpaper.width} × {wallpaper.height}
              </button>
              {aspect && (
                <span className="preview-meta-secondary" title={`${aspect.exact}:1`}>
                  ({aspect.label})
                </span>
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
              {canSearchUploader ? (
                <button
                  type="button"
                  className="preview-meta-value preview-meta-button preview-meta-button-uploader"
                  onClick={() => onUploaderClick?.(uploaderLabel)}
                  title={`Search for @${uploaderLabel}`}
                >
                  {uploaderContent}
                </button>
              ) : (
                <span className="preview-meta-value preview-meta-uploader">{uploaderContent}</span>
              )}
            </div>
            
            <div className="preview-meta-item">
              <span className="preview-meta-label">Category</span>
              <button
                type="button"
                className="preview-meta-value preview-meta-button"
                onClick={() => onCategoryClick?.(wallpaper.category)}
                title={`Show ${wallpaper.category} wallpapers`}
              >
                {wallpaper.category}
              </button>
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
            
            <div className="preview-meta-trailing">
            {wallpaper.createdAt && (
              <div className="preview-meta-item">
                <span className="preview-meta-label">Uploaded</span>
                <span
                  className="preview-meta-value"
                  title={narrowPreview ? formatRelativeDate(wallpaper.createdAt) : undefined}
                >
                  {formatRelativeDate(wallpaper.createdAt, { compact: narrowPreview })}
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
      </div>
    </div>
  );
}
