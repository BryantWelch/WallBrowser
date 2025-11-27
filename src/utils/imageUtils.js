export function prefetchImage(url) {
  if (!url) return;
  const img = new Image();
  img.src = url;
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
