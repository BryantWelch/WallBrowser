import React from 'react';
import { WallpaperCard } from './WallpaperCard';

export function WallpaperGrid({ 
  wallpapers, 
  selectedIds, 
  favorites,
  onToggleSelect,
  onToggleFavorite,
  onWallpaperClick,
  onColorClick,
  onSearchSimilar,
  viewMode = 'comfortable',
  isLoading
}) {
  if (wallpapers.length === 0 && !isLoading) {
    return (
      <div className="wallpaper-grid empty-state" role="status">
        <p>
          Use the controls above to fetch wallpapers from Wallhaven. Results
          that match your filters will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={`wallpaper-grid wallpaper-grid-${viewMode}`}>
      {wallpapers.map((wallpaper) => (
        <WallpaperCard
          key={wallpaper.id}
          wallpaper={wallpaper}
          isSelected={selectedIds.has(wallpaper.id)}
          isFavorite={favorites.some((fav) => fav.id === wallpaper.id)}
          onToggleSelect={onToggleSelect}
          onToggleFavorite={onToggleFavorite}
          onClick={onWallpaperClick}
          onColorClick={onColorClick}
          onSearchSimilar={onSearchSimilar}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}
