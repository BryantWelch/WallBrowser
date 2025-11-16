import { useState, useCallback } from 'react';
import { API_CONFIG } from '../constants';
import { getCachedData, setCachedData, generateCacheKey, parseWallhavenResponse, retryWithBackoff } from '../utils';

/**
 * Custom hook for Wallhaven API calls
 */
export function useWallhavenAPI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [wallpapers, setWallpapers] = useState([]);
  const [totalPages, setTotalPages] = useState(null);
  const [totalResults, setTotalResults] = useState(null);
  const [seed, setSeed] = useState(null); // For random pagination

  const fetchWallpapers = useCallback(async (filters, page = 1) => {
    setIsLoading(true);
    setError('');

    const cacheKey = generateCacheKey({ ...filters, page });
    
    // Skip cache for random searches to get new results every time
    const skipCache = filters.sort === 'random';
    
    // Check cache first (unless random)
    if (!skipCache) {
      const cached = getCachedData(cacheKey, API_CONFIG.CACHE_DURATION);
      if (cached) {
        setWallpapers(cached.wallpapers);
        setTotalPages(cached.lastPage);
        setTotalResults(cached.total);
        setIsLoading(false);
        return { success: true, data: cached };
      }
    }

    try {
      const result = await retryWithBackoff(async () => {
        const url = new URL(`${API_CONFIG.BASE_URL}/search`, window.location.origin);

        // Build query params
        if (filters.sort) {
          url.searchParams.set('sorting', filters.sort);
        }

        const categoriesString = `${filters.categories.general ? '1' : '0'}${
          filters.categories.anime ? '1' : '0'
        }${filters.categories.people ? '1' : '0'}`;
        url.searchParams.set('categories', categoriesString);

        // Purity: 3-digit string where each position is a flag (1=include, 0=exclude)
        // Position 1: SFW, Position 2: Sketchy, Position 3: NSFW
        // '100' = SFW only (~200k results, safe for work)
        // '110' = SFW + Sketchy (~600k results, Wallhaven's default)
        // '111' = All content (~900k+ results, requires API key)
        // 
        // Our checkbox controls both Sketchy AND NSFW:
        // - Unchecked = SFW only ('100')
        // - Checked = SFW + Sketchy + NSFW ('111')
        const purity = filters.includeNsfw ? '111' : '100';
        url.searchParams.set('purity', purity);
        url.searchParams.set('page', String(page));

        // Build query with file type if specified
        let queryString = filters.query.trim();
        if (filters.fileType) {
          // Add file type to query (e.g., "type:png landscape" or just "type:jpg")
          const typeFilter = `type:${filters.fileType}`;
          queryString = queryString ? `${typeFilter} ${queryString}` : typeFilter;
        }
        if (queryString) {
          url.searchParams.set('q', queryString);
        }

        // Resolution filter
        if (filters.resolution) {
          if (filters.exactResolution) {
            url.searchParams.set('resolutions', filters.resolution);
          } else {
            const [w, h] = filters.resolution
              .split('x')
              .map((v) => Number.parseInt(v, 10));
            if (w && h) {
              url.searchParams.set('at_least', `${w}x${h}`);
            }
          }
        }

        if (filters.ratio) {
          url.searchParams.set('ratios', filters.ratio);
        }

        if (filters.color) {
          url.searchParams.set('colors', filters.color);
        }

        if (filters.sort === 'toplist') {
          url.searchParams.set('topRange', filters.timeRange);
        }

        // Add seed for random pagination (prevents duplicates across pages)
        if (filters.sort === 'random' && seed && page > 1) {
          url.searchParams.set('seed', seed);
        }

        // Build headers with API key (using standard X-API-Key header)
        const headers = {
          'User-Agent': API_CONFIG.USER_AGENT,
        };
        
        if (API_CONFIG.API_KEY) {
          headers['X-API-Key'] = API_CONFIG.API_KEY;
        }

        const response = await fetch(url.toString(), { headers });

        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Rate limited. Please wait a moment and try again.');
          }
          if (response.status === 401) {
            throw new Error('Invalid API key or unauthorized access. Check your API key in .env file');
          }
          // Try to get error details
          const text = await response.text();
          throw new Error(`API error ${response.status}: ${text.substring(0, 200)}`);
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

      // Cache the result (skip for random to get fresh results each time)
      if (!skipCache) {
        setCachedData(cacheKey, {
          wallpapers: parsedWallpapers,
          lastPage,
          total,
          seed: newSeed,
        });
      }

      setWallpapers(parsedWallpapers);
      setTotalPages(lastPage && lastPage > 0 ? lastPage : null);
      setTotalResults(total);
      
      // Save seed for random pagination (page 1 gets a new seed, subsequent pages use it)
      if (newSeed) {
        setSeed(newSeed);
      } else if (page === 1) {
        // Reset seed when starting a new search
        setSeed(null);
      }

      return {
        success: true,
        data: { wallpapers: parsedWallpapers, lastPage, total, seed: newSeed },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setWallpapers([]);
      setTotalPages(null);
      setTotalResults(null);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [seed]);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  return {
    isLoading,
    error,
    wallpapers,
    totalPages,
    totalResults,
    fetchWallpapers,
    clearError,
  };
}
