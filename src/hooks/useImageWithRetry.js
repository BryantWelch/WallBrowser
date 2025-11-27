import { useState, useEffect, useCallback } from 'react';
import { IMAGE_RETRY_CONFIG } from '../utils/imageUtils';

// Shared hook for images that need retry + watchdog behavior
export function useImageWithRetry(baseUrl, config = {}) {
  const {
    maxRetries = IMAGE_RETRY_CONFIG.maxRetries,
    retryDelayBase = IMAGE_RETRY_CONFIG.retryDelayBase,
    watchdogTimeout = IMAGE_RETRY_CONFIG.watchdogTimeout,
  } = config;
  const [imageUrl, setImageUrl] = useState(baseUrl || '');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Reset state when base URL changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setRetryCount(0);
    setImageUrl(baseUrl || '');
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
    if (retryCount < maxRetries) {
      setTimeout(() => {
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
      }, retryDelayBase * (retryCount + 1));
    } else {
      setImageError(true);
    }
  }, [retryCount, maxRetries, retryDelayBase, baseUrl, imageUrl, buildRetryUrl]);

  const reset = useCallback(() => {
    setImageLoaded(false);
    setImageError(false);
    setRetryCount(0);
    setImageUrl(baseUrl || '');
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
