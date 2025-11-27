import { useState, useEffect, useCallback } from 'react';
import { IMAGE_RETRY_CONFIG } from '../utils/imageUtils';

// Shared hook for images that need retry + watchdog behavior
// config can include an optional onHardFailure({ lastUrl }) callback that returns a fallback URL.
export function useImageWithRetry(baseUrl, config = {}) {
  const {
    maxRetries = IMAGE_RETRY_CONFIG.maxRetries,
    retryDelayBase = IMAGE_RETRY_CONFIG.retryDelayBase,
    watchdogTimeout = IMAGE_RETRY_CONFIG.watchdogTimeout,
    onHardFailure,
  } = config;
  const [imageUrl, setImageUrl] = useState(baseUrl || '');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentBaseUrl, setCurrentBaseUrl] = useState(baseUrl || '');
  const [hasUsedFallback, setHasUsedFallback] = useState(false);

  // Reset state when base URL changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setRetryCount(0);
    setImageUrl(baseUrl || '');
    setCurrentBaseUrl(baseUrl || '');
    setHasUsedFallback(false);
  }, [baseUrl]);

  const buildRetryUrl = useCallback((url, attempt) => {
    if (!url) return url;
    const cleanUrl = url.replace(/[?&]retry=\d+/, '');
    const separator = cleanUrl.includes('?') ? '&' : '?';
    return `${cleanUrl}${separator}retry=${attempt}`;
  }, []);

  const handleLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    const sourceUrl = currentBaseUrl || imageUrl;

    if (retryCount < maxRetries) {
      setTimeout(() => {
        setRetryCount((prev) => {
          const next = prev + 1;
          if (next > maxRetries) {
            // Give caller a chance to provide a fallback URL (e.g., Worker proxy)
            if (!hasUsedFallback && onHardFailure) {
              const fallbackUrl = onHardFailure({ lastUrl: sourceUrl });
              if (fallbackUrl && fallbackUrl !== imageUrl) {
                setImageLoaded(false);
                setImageError(false);
                setRetryCount(0);
                setHasUsedFallback(true);
                setCurrentBaseUrl(fallbackUrl);
                setImageUrl(fallbackUrl);
                return 0;
              }
            }
            setImageError(true);
            return prev;
          }
          const newUrl = buildRetryUrl(sourceUrl, next);
          setImageUrl(newUrl);
          return next;
        });
      }, retryDelayBase * (retryCount + 1));
    } else {
      if (!hasUsedFallback && onHardFailure) {
        const fallbackUrl = onHardFailure({ lastUrl: sourceUrl });
        if (fallbackUrl && fallbackUrl !== imageUrl) {
          setImageLoaded(false);
          setImageError(false);
          setRetryCount(0);
          setHasUsedFallback(true);
          setCurrentBaseUrl(fallbackUrl);
          setImageUrl(fallbackUrl);
          return;
        }
      }
      setImageError(true);
    }
  }, [retryCount, maxRetries, retryDelayBase, currentBaseUrl, imageUrl, buildRetryUrl, onHardFailure, hasUsedFallback]);

  const reset = useCallback(() => {
    setImageLoaded(false);
    setImageError(false);
    setRetryCount(0);
    setImageUrl(baseUrl || '');
    setCurrentBaseUrl(baseUrl || '');
    setHasUsedFallback(false);
  }, [baseUrl]);

  // Watchdog: if the image stays in loading state too long without load/error,
  // force a retry so we don't get stuck on the skeleton indefinitely.
  useEffect(() => {
    if (imageLoaded || imageError || retryCount >= maxRetries) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRetryCount((prev) => {
        const next = prev + 1;
        if (next > maxRetries) {
          setImageError(true);
          return prev;
        }
        const newUrl = buildRetryUrl(baseUrl || imageUrl, next);
        setImageUrl(newUrl);
        return next;
      });
    }, watchdogTimeout);

    return () => clearTimeout(timeoutId);
  }, [imageLoaded, imageError, retryCount, maxRetries, watchdogTimeout, baseUrl, imageUrl, buildRetryUrl]);

  return {
    imageUrl,
    imageLoaded,
    imageError,
    retryCount,
    handleLoad,
    handleError,
    reset,
  };
}
