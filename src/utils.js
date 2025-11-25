/**
 * Debounce function calls
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Download a file from URL
 */
export async function downloadFile(url, filename) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch (error) {
    console.error('Download failed:', error);
    return false;
  }
}

/**
 * Create and download a ZIP file (requires jszip)
 */
export async function downloadAsZip(files, zipName = 'wallpapers.zip') {
  // This will be implemented when JSZip is added
  const JSZip = window.JSZip;
  
  if (!JSZip) {
    console.error('JSZip not loaded');
    return false;
  }
  
  try {
    const zip = new JSZip();
    
    // Download all files and add to zip
    const promises = files.map(async ({ url, filename }) => {
      const response = await fetch(url);
      const blob = await response.blob();
      zip.file(filename, blob);
    });
    
    await Promise.all(promises);
    
    // Generate and download zip
    const content = await zip.generateAsync({ type: 'blob' });
    const blobUrl = URL.createObjectURL(content);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = zipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch (error) {
    console.error('ZIP creation failed:', error);
    return false;
  }
}

/**
 * Get cached data from memory cache
 */
const cache = new Map();

export function getCachedData(key, maxAge = 5 * 60 * 1000) {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > maxAge) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

export function setCachedData(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function clearCache() {
  cache.clear();
}

/**
 * Retry async function with exponential backoff
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
}

/**
 * Format a date string as relative time (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
}

/**
 * Generate a cache key from filters
 */
export function generateCacheKey(filters) {
  return JSON.stringify(filters);
}

/**
 * Parse Wallhaven API response
 */
export function parseWallhavenResponse(json) {
  const results = json?.data ?? [];
  const meta = json?.meta;
  const lastPage =
    typeof meta?.last_page === 'number'
      ? meta.last_page
      : typeof meta?.lastPage === 'number'
      ? meta.lastPage
      : null;

  const wallpapers = results
    .map((item) => {
      const width = item?.dimension_x ?? 0;
      const height = item?.dimension_y ?? 0;
      const fullUrl = item?.path;
      const originalThumbUrl = item?.thumbs?.large || item?.thumbs?.original || fullUrl;
      
      // Route thumbnails through proxy to avoid CORS issues
      const thumbUrl = originalThumbUrl.includes('th.wallhaven.cc')
        ? originalThumbUrl.replace('https://th.wallhaven.cc', '/proxy/thumb')
        : originalThumbUrl;

      return {
        id: item.id,
        title: item?.tags?.map((t) => t.name).join(', ') || item.id,
        author: item?.uploader?.username ?? 'Anonymous',
        authorGroup: item?.uploader?.group,
        authorAvatar: item?.uploader?.avatar?.['128px'],
        ups: item?.favorites ?? 0,
        permalink: item?.url,
        shortUrl: item?.short_url,
        width,
        height,
        resolution: item?.resolution || `${width}x${height}`,
        ratio: item?.ratio,
        url: fullUrl,
        thumbUrl,
        fileSize: item?.file_size ?? 0,
        fileType: item?.file_type,
        source: item?.source,
        colors: item?.colors || [],
        tags: item?.tags || [],
        category: item?.category || 'general',
        purity: item?.purity || 'sfw',
        views: item?.views ?? 0,
        createdAt: item?.created_at,
      };
    })
    .filter((item) => item.url && item.thumbUrl);

  return { 
    wallpapers, 
    lastPage, 
    total: meta?.total,
    seed: meta?.seed, // For random pagination
  };
}
