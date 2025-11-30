import React from 'react';
import { WallpaperCard } from './WallpaperCard';

export function WallpaperGrid({ 
  wallpapers, 
  selectedIds, 
  favorites,
  downloadedIds,
  onToggleSelect,
  onToggleFavorite,
  onWallpaperClick,
  onColorClick,
  onSearchSimilar,
  isDownloaded,
  onMarkDownloaded,
  viewMode = 'comfortable',
  isLoading
}) {
  if (wallpapers.length === 0 && !isLoading) {
    return (
      <div className="wallpaper-grid empty-state" role="status">
        <div className="empty-state-content">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <h3>No wallpapers found</h3>
          <p>
            We couldn't find any wallpapers matching your current filters.
            Try adjusting your search terms or clearing some filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`wallpaper-grid wallpaper-grid-${viewMode}`}>
      {wallpapers.map((wallpaper, index) => (
        <WallpaperCard
          key={wallpaper.id}
          wallpaper={wallpaper}
          index={index}
          isSelected={selectedIds.has(wallpaper.id)}
          isFavorite={favorites.some((fav) => fav.id === wallpaper.id)}
          isDownloaded={isDownloaded ? isDownloaded(wallpaper.id) : downloadedIds?.includes(wallpaper.id)}
          onToggleSelect={onToggleSelect}
          onToggleFavorite={onToggleFavorite}
          onMarkDownloaded={onMarkDownloaded}
          onClick={onWallpaperClick}
          onColorClick={onColorClick}
          onSearchSimilar={onSearchSimilar}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}
