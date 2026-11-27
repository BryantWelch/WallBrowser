import { useState, useCallback, useRef } from 'react';
import { API_CONFIG } from '../constants';
import { getCachedData, setCachedData, generateCacheKey, parseWallhavenResponse, retryWithBackoff, pickAvatarUrl } from '../utils';
import { prefetchAvatar, prefetchImage } from '../utils/imageUtils';
import { getStoredApiKey } from '../utils/apiKeyStorage';

const detailsCache = new Map();
const detailsInflight = new Map();

export function getCachedWallpaperDetails(wallpaperId) {
  return detailsCache.get(wallpaperId) || null;
}

function searchCacheKey(filters, page, seedValue) {
  if (filters.sort === 'random' && seedValue) {
    return generateCacheKey({ ...filters, page, seed: seedValue });
  }
  return generateCacheKey({ ...filters, page });
}

/**
 * Custom hook for Wallhaven API calls
 */
export function useWallhavenAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [wallpapers, setWallpapers] = useState([]);
  const [totalPages, setTotalPages] = useState(null);
  const [totalResults, setTotalResults] = useState(null);
  // Wallhaven returns a seed with random results. Later pages must send it
  // or each page is a new shuffle. A ref keeps the latest seed available
  // to pagination and prefetch without waiting on another render.
  const seedRef = useRef(null);
  const abortControllerRef = useState(() => ({ current: null }))[0]; // Persists across renders

  // Shared function to build search URL consistently
  const buildSearchUrl = useCallback((filters, page, seedValue) => {
    const url = new URL(`${API_CONFIG.BASE_URL}/search`, window.location.origin);

    // Sort
    if (filters.sort) {
      url.searchParams.set('sorting', filters.sort);
    }

    // Categories
    const categoriesString = `${filters.categories.general ? '1' : '0'}${
      filters.categories.anime ? '1' : '0'
    }${filters.categories.people ? '1' : '0'}`;
    url.searchParams.set('categories', categoriesString);

    // Purity
    const purity = filters.includeNsfw ? '111' : '100';
    url.searchParams.set('purity', purity);
    url.searchParams.set('page', String(page));

    // Query with file type
    let queryString = filters.query.trim();
    if (filters.fileType) {
      const typeFilter = `type:${filters.fileType}`;
      queryString = queryString ? `${typeFilter} ${queryString}` : typeFilter;
    }
    if (queryString) {
      url.searchParams.set('q', queryString);
    }

    // Resolution
    if (filters.resolution) {
      if (filters.exactResolution) {
        url.searchParams.set('resolutions', filters.resolution);
      } else {
        const [w, h] = filters.resolution
          .split('x')
          .map((v) => Number.parseInt(v, 10));
        if (w && h) {
          url.searchParams.set('atleast', `${w}x${h}`);
        }
      }
    }

    // Other filters
    if (filters.ratio) url.searchParams.set('ratios', filters.ratio);
    if (filters.color) url.searchParams.set('colors', filters.color);
    if (filters.sort === 'toplist') url.searchParams.set('topRange', filters.timeRange);

    // Keep one shuffle for every page of this search, including a return to page 1.
    // A new Fetch clears the seed before calling this.
    if (filters.sort === 'random' && seedValue) {
      url.searchParams.set('seed', seedValue);
    }

    // API key
    const apiKey = getStoredApiKey();
    if (apiKey) url.searchParams.set('apikey', apiKey);

    return { url, apiKey };
  }, []);

  const fetchWallpapers = useCallback(async (filters, page = 1, options = {}) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setIsLoading(true);
    setError('');

    // Validate filters object
    if (!filters || typeof filters !== 'object') {
      const errorMessage = 'Invalid filters configuration. Resetting...';
      setError(errorMessage);
      setWallpapers([]);
      setTotalPages(null);
      setTotalResults(null);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }

    // Fetch asks for a new shuffle. Paging, including back to page 1, keeps
    // the seed from the last shuffle. Other sorts drop it.
    if (options.renewSeed || filters.sort !== 'random') {
      seedRef.current = null;
    }
    const seedToUse = filters.sort === 'random' ? seedRef.current : null;
    const cacheKey = searchCacheKey(filters, page, seedToUse);
    const skipCache = filters.sort === 'random' && !seedToUse;
    
    // Check cache first (unless this is a new random shuffle)
    if (!skipCache) {
      try {
        const cached = getCachedData(cacheKey, API_CONFIG.CACHE_DURATION);
        if (cached) {
          setWallpapers(cached.wallpapers);
          setTotalPages(cached.lastPage);
          setTotalResults(cached.total);
          setIsLoading(false);
          return { success: true, data: cached };
        }
      } catch (cacheError) {
        // Continue with fetch if cache fails - no logging needed
      }
    }

    try {
      const result = await retryWithBackoff(async () => {
        const { url, apiKey } = buildSearchUrl(filters, page, seedToUse);

        // Build headers with API key (using standard X-API-Key header)
        const headers = {
          'User-Agent': API_CONFIG.USER_AGENT,
        };
        
        if (apiKey) {
          headers['X-API-Key'] = apiKey;
        }

        const response = await fetch(url.toString(), { 
          headers,
          signal: abortController.signal 
        });

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Rate limited. Please wait a moment and try again.');
          }
          if (response.status === 401) {
            throw new Error('Invalid API key or unauthorized access. Check your API key in Settings');
          }
          if (response.status === 500) {
            throw new Error(`Wallhaven's servers cannot load page ${page}. Try navigating sequentially with Prev/Next, or use filters to narrow your search.`);
          }
          // Try to get error details
          const text = await response.text();
          throw new Error(`API error ${response.status}: ${text.substring(0, 100)}`);
        }

        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          throw new Error(`Expected JSON but got: ${text.substring(0, 200)}`);
        }

        return response.json();
      }, API_CONFIG.MAX_RETRIES, API_CONFIG.RETRY_DELAY);

      const { wallpapers: parsedWallpapers, lastPage, total, seed: newSeed } = parseWallhavenResponse(result);

      setWallpapers(parsedWallpapers);
      setTotalPages(lastPage && lastPage > 0 ? lastPage : null);
      setTotalResults(total);

      // Keep the first seed for this shuffle. Later pages also return a seed,
      // and replacing ours would make the next page a different random set.
      if (filters.sort === 'random' && newSeed && !seedRef.current) {
        seedRef.current = newSeed;
      } else if (filters.sort !== 'random') {
        seedRef.current = null;
      }

      const storedSeed = filters.sort === 'random' ? seedRef.current : null;
      if (filters.sort !== 'random' || storedSeed) {
        setCachedData(searchCacheKey(filters, page, storedSeed), {
          wallpapers: parsedWallpapers,
          lastPage,
          total,
          seed: storedSeed,
        });
      }

      return {
        success: true,
        data: { wallpapers: parsedWallpapers, lastPage, total, seed: seedRef.current },
      };
    } catch (err) {
      // Ignore abort errors (request was cancelled by user action)
      if (err.name === 'AbortError') {
        return { success: false, error: 'Request cancelled' };
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setWallpapers([]);
      setTotalPages(null);
      setTotalResults(null);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [buildSearchUrl, abortControllerRef]);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  // Prefetch adjacent pages in the background (doesn't update UI)
  const prefetchPages = useCallback(async (filters, currentPage, totalPages) => {
    const pagesToPrefetch = [];
    
    // Only prefetch the next page to reduce upstream load
    if (currentPage < totalPages) {
      pagesToPrefetch.push(currentPage + 1);
    }
    
    if (pagesToPrefetch.length === 0) {
      return;
    }
    
    // Prefetch in parallel without blocking
    pagesToPrefetch.forEach(async (page) => {
      const seedToUse = filters.sort === 'random' ? seedRef.current : null;
      const cacheKey = searchCacheKey(filters, page, seedToUse);
      
      // Skip if already cached
      const cached = getCachedData(cacheKey, API_CONFIG.CACHE_DURATION);
      if (cached) {
        return;
      }
      
      // Fetch and cache silently (don't update state)
      try {
        const { url, apiKey } = buildSearchUrl(filters, page, seedToUse);
        
        const res = await fetch(url.toString(), {
          headers: {
            'User-Agent': API_CONFIG.USER_AGENT,
            ...(apiKey && { 'X-API-Key': apiKey }),
          },
        });
        
        if (res.ok) {
          const json = await res.json();
          const { wallpapers, lastPage, total } = parseWallhavenResponse(json);

          // Cache the result
          setCachedData(cacheKey, { wallpapers, lastPage, total }, API_CONFIG.CACHE_DURATION);

          // Preload thumbnails only for smoother grid navigation.
          // Full-size images are loaded on demand in the preview modal.
          wallpapers.forEach(wallpaper => {
            prefetchImage(wallpaper.thumbUrl);
          });
        }
      } catch (err) {
        // Silently fail prefetch - don't show errors to avoid console spam
      }
    });
  }, [buildSearchUrl]);

  // Fetch individual wallpaper details (includes tags)
  const fetchWallpaperDetails = useCallback(async (wallpaperId, { silent = false } = {}) => {
    if (detailsCache.has(wallpaperId)) {
      return detailsCache.get(wallpaperId);
    }
    if (detailsInflight.has(wallpaperId)) {
      return detailsInflight.get(wallpaperId);
    }

    const request = (async () => {
    try {
      const apiKey = getStoredApiKey();
      const url = `${API_CONFIG.BASE_URL}/w/${wallpaperId}${apiKey ? `?apikey=${apiKey}` : ''}`;

      const response = await retryWithBackoff(async () => {
        const res = await fetch(url, {
          headers: {
            'User-Agent': API_CONFIG.USER_AGENT,
            ...(apiKey && { 'X-API-Key': apiKey }),
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        return res;
      });

      const json = await response.json();
      const details = json.data; // Returns full wallpaper object with tags
      detailsCache.set(wallpaperId, details);
      const avatar = pickAvatarUrl(details?.uploader?.avatar);
      if (avatar) prefetchAvatar(avatar);
      return details;
    } catch (err) {
      if (!silent) console.error('Failed to fetch wallpaper details:', err);
      return null;
    }
    })();

    detailsInflight.set(wallpaperId, request);
    try {
      return await request;
    } finally {
      detailsInflight.delete(wallpaperId);
    }
  }, []);

  return {
    isLoading,
    error,
    wallpapers,
    totalPages,
    totalResults,
    fetchWallpapers,
    fetchWallpaperDetails,
    prefetchPages,
    clearError,
  };
}
