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
