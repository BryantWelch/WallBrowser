import { useState, useEffect, useCallback, useRef } from 'react';
import { IMAGE_RETRY_CONFIG, imageResponseStatus, rememberRefusedImage, wasImageRefused } from '../utils/imageUtils';

// A refusal or a missing file will not succeed on the next try.
const PERMANENT_FAILURE = new Set([403, 404]);

// Shared hook for images that need retry + watchdog behavior
// config can include an optional onHardFailure({ lastUrl }) callback that returns a fallback URL.
export function useImageWithRetry(baseUrl, config = {}) {
  const {
    maxRetries = IMAGE_RETRY_CONFIG.maxRetries,
    retryDelayBase = IMAGE_RETRY_CONFIG.retryDelayBase,
    watchdogTimeout = IMAGE_RETRY_CONFIG.watchdogTimeout,
    onHardFailure,
  } = config;
  // How many times a silent attempt may be replaced. Real errors use maxRetries.
  // Thumbnails keep the old budget. The preview passes 1 so a slow download
  // is not restarted over and over.
  const stallRetries = config.stallRetries ?? maxRetries;
  const onHardFailureRef = useRef(onHardFailure);
  onHardFailureRef.current = onHardFailure;

  // A look-ahead may already have seen a 403 for this address. Start on the
  // backup so the preview does not request the proxy again.
  const pickStart = (url) => {
    if (url && wasImageRefused(url)) {
      const fallback = onHardFailureRef.current?.({ lastUrl: url });
      if (fallback && fallback !== url) {
        return { url: fallback, usedFallback: true };
      }
    }
    return { url: url || '', usedFallback: false };
  };

  const [imageUrl, setImageUrl] = useState(() => pickStart(baseUrl).url);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentBaseUrl, setCurrentBaseUrl] = useState(() => pickStart(baseUrl).url);
  const [hasUsedFallback, setHasUsedFallback] = useState(() => pickStart(baseUrl).usedFallback);
  const [attempt, setAttempt] = useState(0);
  const imageUrlRef = useRef(imageUrl);
  const currentBaseUrlRef = useRef(currentBaseUrl);
  const hasUsedFallbackRef = useRef(hasUsedFallback);
  const retryCountRef = useRef(0);
  const attemptRef = useRef(0);
  const retryTimerRef = useRef(null);
  const skipResetRef = useRef(true);

  useEffect(() => () => clearTimeout(retryTimerRef.current), []);

  const buildRetryUrl = useCallback((url, attempt) => {
    if (!url) return url;
    const cleanUrl = url.replace(/[?&]retry=\d+/, '');
    const separator = cleanUrl.includes('?') ? '&' : '?';
    return `${cleanUrl}${separator}retry=${attempt}`;
  }, []);

  // A new address is a new attempt. An error from the image we just replaced
  // belongs to the old attempt and must not start yet another download.
  const beginAttempt = useCallback((url) => {
    if (!url || url === imageUrlRef.current) {
      if (url) setImageUrl(url);
      return;
    }
    imageUrlRef.current = url;
    attemptRef.current += 1;
    setAttempt(attemptRef.current);
    setImageUrl(url);
  }, []);

  // Reset state when the wallpaper address changes. Bump the attempt so an
  // error from the image we just left cannot start a download of the new one.
  useEffect(() => {
    // The first run matches the initial state. Clearing a load here restarts
    // an image that already arrived from cache.
    if (skipResetRef.current) {
      skipResetRef.current = false;
      return;
    }
    clearTimeout(retryTimerRef.current);
    const start = pickStart(baseUrl);
    setImageLoaded(false);
    setImageError(false);
    retryCountRef.current = 0;
    setRetryCount(0);
    hasUsedFallbackRef.current = start.usedFallback;
    setHasUsedFallback(start.usedFallback);
    currentBaseUrlRef.current = start.url;
    setCurrentBaseUrl(start.url);
    beginAttempt(start.url);
  }, [baseUrl, beginAttempt]);

  const sameAttempt = (event) => {
    const marked = event?.currentTarget?.dataset?.attempt;
    if (marked === undefined) return true;
    return Number(marked) === attemptRef.current;
  };

  const handleLoad = useCallback((event) => {
    if (!sameAttempt(event)) return;
    clearTimeout(retryTimerRef.current);
    setImageLoaded(true);
  }, []);

  const useFallback = useCallback((sourceUrl) => {
    clearTimeout(retryTimerRef.current);
    if (!hasUsedFallbackRef.current && onHardFailureRef.current) {
      const fallbackUrl = onHardFailureRef.current({ lastUrl: sourceUrl });
      if (fallbackUrl && fallbackUrl !== imageUrlRef.current) {
        hasUsedFallbackRef.current = true;
        setHasUsedFallback(true);
        setImageLoaded(false);
        setImageError(false);
        retryCountRef.current = 0;
        setRetryCount(0);
        currentBaseUrlRef.current = fallbackUrl;
        setCurrentBaseUrl(fallbackUrl);
        beginAttempt(fallbackUrl);
        return;
      }
    }
    setImageError(true);
  }, [beginAttempt]);

  const scheduleRetry = useCallback((sourceUrl) => {
    if (retryCountRef.current >= maxRetries) {
      useFallback(sourceUrl);
      return;
    }
    clearTimeout(retryTimerRef.current);
    const delay = retryDelayBase * (retryCountRef.current + 1);
    retryTimerRef.current = setTimeout(() => {
      const next = retryCountRef.current + 1;
      if (next > maxRetries) return;
      retryCountRef.current = next;
      setRetryCount(next);
      beginAttempt(buildRetryUrl(sourceUrl, next));
    }, delay);
  }, [maxRetries, retryDelayBase, buildRetryUrl, useFallback, beginAttempt]);

  const handleError = useCallback((event) => {
    if (!sameAttempt(event)) return;
    const sourceUrl = currentBaseUrlRef.current || imageUrlRef.current;
    const status = imageResponseStatus(imageUrlRef.current) || imageResponseStatus(sourceUrl);
    // A 403 or 404 will not change on the next attempt. Switch to the backup host
    // and remember the refusal so a later look-ahead skips this address.
    if (PERMANENT_FAILURE.has(status)) {
      rememberRefusedImage(sourceUrl);
      useFallback(sourceUrl);
      return;
    }
    scheduleRetry(sourceUrl);
  }, [useFallback, scheduleRetry]);

  const reset = useCallback(() => {
    clearTimeout(retryTimerRef.current);
    setImageLoaded(false);
    setImageError(false);
    retryCountRef.current = 0;
    setRetryCount(0);
    hasUsedFallbackRef.current = false;
    setHasUsedFallback(false);
    const start = baseUrl || '';
    currentBaseUrlRef.current = start;
    setCurrentBaseUrl(start);
    beginAttempt(start);
  }, [baseUrl, beginAttempt]);

  // Last resort for a request that never loads and never errors. The wait is
  // long so a slow download is not abandoned, and a replacement happens once.
  useEffect(() => {
    if (imageLoaded || imageError || !imageUrl) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const activeUrl = currentBaseUrlRef.current || imageUrlRef.current || baseUrl;
      if (!activeUrl) return;
      // Still on the first host: switch to the backup once, instead of
      // downloading this same address again.
      if (!hasUsedFallbackRef.current && onHardFailureRef.current) {
        useFallback(activeUrl);
        return;
      }
      if (retryCountRef.current >= stallRetries) {
        useFallback(activeUrl);
        return;
      }
      const next = retryCountRef.current + 1;
      retryCountRef.current = next;
      setRetryCount(next);
      beginAttempt(buildRetryUrl(activeUrl, next));
    }, watchdogTimeout);

    return () => clearTimeout(timeoutId);
  }, [imageLoaded, imageError, imageUrl, watchdogTimeout, stallRetries, baseUrl, buildRetryUrl, useFallback, beginAttempt]);

  return {
    imageUrl,
    imageLoaded,
    imageError,
    retryCount,
    attempt,
    handleLoad,
    handleError,
    reset,
  };
}
