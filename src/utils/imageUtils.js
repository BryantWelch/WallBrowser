import JSZip from 'jszip';

export function prefetchImage(url) {
  if (!url) return;
  const img = new Image();
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
