import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../constants';

/**
 * Custom hook for managing favorites
 */
export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage(STORAGE_KEYS.FAVORITES, []);

  const addFavorite = (wallpaper) => {
    setFavorites((prev) => {
      if (prev.some((fav) => fav.id === wallpaper.id)) {
        return prev;
      }
      return [...prev, { ...wallpaper, favoritedAt: Date.now() }];
    });
  };

  const removeFavorite = (id) => {
    setFavorites((prev) => prev.filter((fav) => fav.id !== id));
  };

  const toggleFavorite = (wallpaper) => {
    if (isFavorite(wallpaper.id)) {
      removeFavorite(wallpaper.id);
    } else {
      addFavorite(wallpaper);
    }
  };

  const isFavorite = (id) => {
    return favorites.some((fav) => fav.id === id);
  };

  const clearFavorites = () => {
    setFavorites([]);
  };

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    clearFavorites,
  };
}
