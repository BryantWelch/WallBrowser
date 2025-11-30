import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../constants';

/**
 * Track which wallpapers have been downloaded on this device.
 * Stored in localStorage as an array of ids.
 */
export function useDownloadedWallpapers() {
  const [downloadedIds, setDownloadedIds] = useLocalStorage(STORAGE_KEYS.DOWNLOADED, []);

  const markDownloaded = (idOrIds) => {
    setDownloadedIds((prev) => {
      const next = new Set(prev || []);
      if (Array.isArray(idOrIds)) {
        idOrIds.forEach((id) => {
          if (id) next.add(id);
        });
      } else if (idOrIds) {
        next.add(idOrIds);
      }
      return Array.from(next);
    });
  };

  const isDownloaded = (id) => {
    if (!id || !Array.isArray(downloadedIds)) return false;
    return downloadedIds.includes(id);
  };

  const clearDownloaded = () => {
    setDownloadedIds([]);
  };

  const removeDownloaded = (idOrIds) => {
    setDownloadedIds((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      if (Array.isArray(idOrIds)) {
        const idsToRemove = new Set(idOrIds.filter(Boolean));
        return current.filter((id) => !idsToRemove.has(id));
      }
      if (!idOrIds) return current;
      return current.filter((id) => id !== idOrIds);
    });
  };

  return {
    downloadedIds: Array.isArray(downloadedIds) ? downloadedIds : [],
    markDownloaded,
    isDownloaded,
    clearDownloaded,
    removeDownloaded,
  };
}
