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
  
  const downloadUrl = toProxiedDownloadUrl(url);

  let lastError;
  const maxRetries = 3;
  const baseDelay = 400;

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
}

export async function createWallpapersZip(wallpapers) {
  if (!wallpapers || wallpapers.length === 0) {
    throw new Error('No wallpapers to zip');
  }

  const zip = new JSZip();
  const folder = zip.folder('wallpapers');

  await Promise.all(wallpapers.map(async (wallpaper) => {
    try {
      const { blob, ext } = await downloadWallpaperBlob(wallpaper.url);
      folder.file(`wallbrowser-${wallpaper.id}.${ext}`, blob);
    } catch (err) {
      console.error(`Failed to download ${wallpaper.id}:`, err);
    }
  }));

  const content = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return content;
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
