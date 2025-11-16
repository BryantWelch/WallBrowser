export const RESOLUTION_PRESETS = [
  // 16:9 (Widescreen)
  { label: '1280×720 (720p)', value: '1280x720', ratio: '16x9' },
  { label: '1600×900', value: '1600x900', ratio: '16x9' },
  { label: '1920×1080 (1080p)', value: '1920x1080', ratio: '16x9' },
  { label: '2560×1440 (1440p)', value: '2560x1440', ratio: '16x9' },
  { label: '3840×2160 (4K)', value: '3840x2160', ratio: '16x9' },
  { label: '5120×2880 (5K)', value: '5120x2880', ratio: '16x9' },
  { label: '7680×4320 (8K)', value: '7680x4320', ratio: '16x9' },
  
  // 16:10
  { label: '1280×800', value: '1280x800', ratio: '16x10' },
  { label: '1440×900', value: '1440x900', ratio: '16x10' },
  { label: '1680×1050', value: '1680x1050', ratio: '16x10' },
  { label: '1920×1200', value: '1920x1200', ratio: '16x10' },
  { label: '2560×1600', value: '2560x1600', ratio: '16x10' },
  { label: '3840×2400', value: '3840x2400', ratio: '16x10' },
  
  // 21:9 (Ultrawide)
  { label: '2560×1080', value: '2560x1080', ratio: '21x9' },
  { label: '3440×1440', value: '3440x1440', ratio: '21x9' },
  { label: '3840×1600', value: '3840x1600', ratio: '21x9' },
  { label: '5120×2160', value: '5120x2160', ratio: '21x9' },
  
  // 32:9 (Super Ultrawide)
  { label: '3840×1080', value: '3840x1080', ratio: '32x9' },
  { label: '5120×1440', value: '5120x1440', ratio: '32x9' },
  { label: '7680×2160', value: '7680x2160', ratio: '32x9' },
  
  // 48:9
  { label: '5760×1080', value: '5760x1080', ratio: '48x9' },
  
  // 9:16 (Portrait)
  { label: '1080×1920', value: '1080x1920', ratio: '9x16' },
  { label: '1440×2560', value: '1440x2560', ratio: '9x16' },
  { label: '2160×3840', value: '2160x3840', ratio: '9x16' },
  
  // 10:16 (Portrait)
  { label: '1200×1920', value: '1200x1920', ratio: '10x16' },
  { label: '1600×2560', value: '1600x2560', ratio: '10x16' },
  
  // 9:18
  { label: '1080×2160', value: '1080x2160', ratio: '9x18' },
  { label: '1440×2880', value: '1440x2880', ratio: '9x18' },
  
  // 1:1 (Square)
  { label: '1080×1080', value: '1080x1080', ratio: '1x1' },
  { label: '2048×2048', value: '2048x2048', ratio: '1x1' },
  { label: '2160×2160', value: '2160x2160', ratio: '1x1' },
  
  // 3:2
  { label: '2160×1440', value: '2160x1440', ratio: '3x2' },
  { label: '3000×2000', value: '3000x2000', ratio: '3x2' },
  
  // 4:3
  { label: '1024×768', value: '1024x768', ratio: '4x3' },
  { label: '1280×960', value: '1280x960', ratio: '4x3' },
  { label: '1600×1200', value: '1600x1200', ratio: '4x3' },
  { label: '1920×1440', value: '1920x1440', ratio: '4x3' },
  { label: '2048×1536', value: '2048x1536', ratio: '4x3' },
  
  // 5:4
  { label: '1280×1024', value: '1280x1024', ratio: '5x4' },
  { label: '2560×2048', value: '2560x2048', ratio: '5x4' },
];

export const COLOR_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Black', value: '000000', hex: '#000000' },
  { label: 'White', value: 'ffffff', hex: '#ffffff' },
  { label: 'Red', value: 'ff0000', hex: '#ff0000' },
  { label: 'Green', value: '00ff00', hex: '#00ff00' },
  { label: 'Blue', value: '0000ff', hex: '#0000ff' },
  { label: 'Yellow', value: 'ffff00', hex: '#ffff00' },
  { label: 'Magenta', value: 'ff00ff', hex: '#ff00ff' },
  { label: 'Cyan', value: '00ffff', hex: '#00ffff' },
];

export const SORT_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'date_added', label: 'Date added' },
  { value: 'relevance', label: 'Relevance' },
  { value: 'views', label: 'Views' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'toplist', label: 'Top' },
];

export const TIME_RANGE_OPTIONS = [
  { label: 'Day', value: '1d' },
  { label: 'Week', value: '1w' },
  { label: 'Month', value: '1M' },
  { label: '3 months', value: '3M' },
  { label: '6 months', value: '6M' },
  { label: 'Year', value: '1y' },
];

export const FILE_TYPE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'jpg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
];

export const ASPECT_RATIO_OPTIONS = [
  { label: 'Any', value: '' },
  // Wide (sorted by aspect ratio)
  { label: '16:9', value: '16x9' },
  { label: '16:10', value: '16x10' },
  { label: '21:9', value: '21x9' },
  { label: '32:9', value: '32x9' },
  { label: '48:9', value: '48x9' },
  // Portrait
  { label: '9:16', value: '9x16' },
  { label: '10:16', value: '10x16' },
  { label: '9:18', value: '9x18' },
  // Square & Other
  { label: '1:1', value: '1x1' },
  { label: '3:2', value: '3x2' },
  { label: '4:3', value: '4x3' },
  { label: '5:4', value: '5x4' },
];

export const VIEW_MODES = {
  COMPACT: 'compact',
  COMFORTABLE: 'comfortable',
  COZY: 'cozy',
};

export const DEFAULT_FILTERS = {
  sort: '',
  timeRange: '1M',
  query: '',
  categories: {
    general: true,
    anime: true,
    people: true,
  },
  ratio: '',
  includeNsfw: false,
  color: '',
  resolution: '',
  exactResolution: false,
  fileType: '',
  viewMode: VIEW_MODES.COMFORTABLE,
};

export const STORAGE_KEYS = {
  FILTERS: 'wallhaven-filters',
  FAVORITES: 'wallhaven-favorites',
  VIEW_MODE: 'wallhaven-view-mode',
};

export const API_CONFIG = {
  BASE_URL: '/api/wallhaven/api/v1',
  USER_AGENT: 'wallhaven-browser/0.0.1',
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  // API key loaded from .env file (VITE_WALLHAVEN_API_KEY)
  // Get your API key from: https://wallhaven.cc/settings/account
  // Copy .env.example to .env and add your key there
  API_KEY: import.meta.env.VITE_WALLHAVEN_API_KEY || '',
};
