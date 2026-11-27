import JSZip from 'jszip';

// A refusal or a missing file will not succeed on the next try.
const PERMANENT_FAILURE = new Set([403, 404]);
// Proxy addresses that already came back 403 or 404. The look-ahead and the
// preview share this so a refused file is not requested a second time.
const refusedImageUrls = new Set();
// Keep prefetch elements alive until they settle, or the error handler can be
// collected before the response arrives.
const pendingPrefetches = new Set();

function imageCacheKey(url) {
  if (!url) return '';
  try {
    const resolved = new URL(url, window.location.href);
    resolved.searchParams.delete('retry');
    resolved.hash = '';
    return resolved.href;
  } catch {
    return String(url).replace(/[?&]retry=\d+/, '').split('#')[0];
  }
}

export function rememberRefusedImage(url) {
  const key = imageCacheKey(url);
  if (key) refusedImageUrls.add(key);
}

export function wasImageRefused(url) {
  return refusedImageUrls.has(imageCacheKey(url));
}

export function imageResponseStatus(url) {
  if (!url || typeof performance === 'undefined' || !performance.getEntriesByName) return 0;
  const names = [url];
  try {
    names.push(new URL(url, window.location.href).href);
  } catch {
    // The image address could not be resolved.
  }
  for (const name of names) {
    const entries = performance.getEntriesByName(name);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const status = entries[index].responseStatus;
      if (typeof status === 'number' && status > 0) return status;
    }
  }
  return 0;
}

function prefetchUrl(url) {
  const img = new Image();
  const release = () => pendingPrefetches.delete(img);
  img.onload = release;
  img.onerror = release;
  pendingPrefetches.add(img);
  img.src = url;
  return img;
}

// Avatar files are cross-origin, so a failed load has no readable status.
// Any error is final for that address. The preview then tries the next size
// without requesting this one again.
export function prefetchAvatar(url) {
  if (!url || wasImageRefused(url)) return;

  const img = new Image();
  const release = () => pendingPrefetches.delete(img);
  img.onload = release;
  img.onerror = () => {
    rememberRefusedImage(url);
    release();
  };
  pendingPrefetches.add(img);
  img.src = url;
}

export function prefetchImage(url, fallbackUrl) {
  if (!url) return;

  // Already refused: warm the backup only. Another proxy request cannot succeed.
  if (wasImageRefused(url)) {
    if (fallbackUrl) prefetchUrl(fallbackUrl);
    return;
  }

  const img = new Image();
  const release = () => pendingPrefetches.delete(img);
  img.onload = release;
  img.onerror = () => {
    const readStatus = (attempt) => {
      const status = imageResponseStatus(img.src) || imageResponseStatus(url);
      if (PERMANENT_FAILURE.has(status)) {
        rememberRefusedImage(url);
        if (fallbackUrl) prefetchUrl(fallbackUrl);
        release();
        return;
      }
      // The status entry can land just after the error event.
      if (!status && attempt < 4) {
        setTimeout(() => readStatus(attempt + 1), 40);
        return;
      }
      release();
    };
    readStatus(0);
  };
  pendingPrefetches.add(img);
  img.src = url;
}

export async function downloadWallpaperBlob(url) {
  if (!url) {
    throw new Error('Missing wallpaper URL');
  }
  
  const proxiedUrl = toProxiedDownloadUrl(url);
  const workerUrl = toWorkerFullUrl(url);

  const maxRetries = 3;
  const baseDelay = 400;

  const attemptDownload = async (downloadUrl) => {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        const response = await fetch(downloadUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const ext = url.split('.').pop() || 'jpg';

        return { blob, ext };
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * (attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to download wallpaper');
  };

  try {
    return await attemptDownload(proxiedUrl);
  } catch (primaryError) {
    // If we don't have a distinct worker URL to fall back to, rethrow
    if (!workerUrl || workerUrl === proxiedUrl) {
      throw primaryError;
    }

    // Try again via the Cloudflare worker URL
    return attemptDownload(workerUrl);
  }
}

export async function createWallpapersZip(wallpapers) {
  if (!wallpapers || wallpapers.length === 0) {
    throw new Error('No wallpapers to zip');
  }

  const zip = new JSZip();
  const folder = zip.folder('wallpapers');

  const successfulIds = [];
  const failed = [];
  const maxRetries = 2; // total attempts per phase
  const baseDelay = 400;

  const downloadWithRetries = async (downloadUrl, originalUrl) => {
    if (!downloadUrl) {
      throw new Error('Missing download URL');
    }

    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
        const response = await fetch(downloadUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const ext = originalUrl.split('.').pop() || 'jpg';

        return { blob, ext };
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * (attempt + 1);
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to download wallpaper');
  };

  // Phase 1: fast path via proxied URL, with higher concurrency, limited retries.
  const phase1Failures = [];
  const FAST_CONCURRENCY = 25;
  let phase1Index = 0;

  const phase1Worker = async () => {
    while (phase1Index < wallpapers.length) {
      const currentIndex = phase1Index;
      phase1Index += 1;
      const wallpaper = wallpapers[currentIndex];
      const proxiedUrl = toProxiedDownloadUrl(wallpaper.url);
      try {
        const { blob, ext } = await downloadWithRetries(proxiedUrl, wallpaper.url);
        folder.file(`wallbrowser-${wallpaper.id}.${ext}`, blob);
        successfulIds.push(wallpaper.id);
      } catch (err) {
        phase1Failures.push({ wallpaper, error: err });
      }
    }
  };

  const phase1Workers = Array.from(
    { length: Math.min(FAST_CONCURRENCY, wallpapers.length) },
    () => phase1Worker(),
  );
  await Promise.all(phase1Workers);

  // Phase 2: slow path via Cloudflare worker, only for failures, with limited concurrency.
  if (phase1Failures.length > 0) {
    const CONCURRENCY = 5;
    let index = 0;

    const worker = async () => {
      while (index < phase1Failures.length) {
        const currentIndex = index;
        index += 1;
        const { wallpaper } = phase1Failures[currentIndex];

        const proxiedUrl = toProxiedDownloadUrl(wallpaper.url);
        const workerUrl = toWorkerFullUrl(wallpaper.url);

        // If we don't have a distinct worker URL to fall back to, consider this a hard failure.
        if (!workerUrl || workerUrl === proxiedUrl) {
          failed.push({
            id: wallpaper.id,
            error: 'No distinct worker URL available for fallback',
          });
          // eslint-disable-next-line no-continue
          continue;
        }

        try {
          const { blob, ext } = await downloadWithRetries(workerUrl, wallpaper.url);
          folder.file(`wallbrowser-${wallpaper.id}.${ext}`, blob);
          successfulIds.push(wallpaper.id);
        } catch (err) {
          failed.push({ id: wallpaper.id, error: err instanceof Error ? err.message : String(err) });
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, phase1Failures.length) },
      () => worker(),
    );
    await Promise.all(workers);
  }

  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { content, successfulIds, failed };
}

export function toProxiedFullUrl(url) {
  if (!url) return url;
  if (url.includes('w.wallhaven.cc')) {
    return url.replace('https://w.wallhaven.cc', '/proxy/image');
  }
  return url;
}

export function toProxiedDownloadUrl(url) {
  if (!url) return url;
  if (url.includes('w.wallhaven.cc')) {
    return url.replace('https://w.wallhaven.cc', '/proxy/image');
  }
  if (url.includes('wallhaven.cc')) {
    return url.replace('https://wallhaven.cc', '/proxy/image');
  }
  return url;
}

export const IMAGE_RETRY_CONFIG = {
  maxRetries: 9,
  retryDelayBase: 250,
  watchdogTimeout: 1000,
};

const WORKER_ORIGIN = 'https://images.wallbrowser.com';

export function toWorkerFullUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    // e.g. /full/e8/wallhaven-e8z2dk.jpg -> /image/full/e8/wallhaven-e8z2dk.jpg
    return `${WORKER_ORIGIN}/image${u.pathname}`;
  } catch {
    return url;
  }
}
