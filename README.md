# Wallhaven Browser

A modern, feature-rich web application for browsing and downloading wallpapers from Wallhaven. Search, filter, preview, and bulk-download wallpapers with an intuitive interface.

## Features

### 🎨 Core Features
- **Advanced Search & Filters**: Search by keywords, resolution, aspect ratio, color, and sort options
- **Smart Resolution Filtering**: Filter by common resolutions (1080p to 8K) with exact match option
- **Aspect Ratio Presets**: Quick filters for 16:9, 21:9, 32:9, and 3:2 displays
- **Category Selection**: Filter by General, Anime, and People categories
- **NSFW Toggle**: Optional NSFW content filtering

### 🖼️ Viewing & Preview
- **Quick Preview Modal**: Click any wallpaper to view full resolution with metadata
- **Keyboard Navigation**: Arrow keys to navigate between wallpapers in preview
- **View Modes**: Toggle between Compact, Comfortable, and Cozy grid layouts
- **Loading Skeletons**: Smooth shimmer loading states for better UX

### 💾 Downloads & Selection
- **Bulk Download with ZIP**: Select multiple wallpapers and download as a single ZIP file
- **Individual Downloads**: Direct download for single wallpapers
- **Persistent Selection**: Selection state maintained while browsing
- **Favorites System**: Save wallpapers to favorites with local storage persistence

### ⌨️ Keyboard Shortcuts
- **Enter**: Fetch wallpapers / Search
- **Escape**: Close preview modal / Clear selection
- **Arrow Left/Right**: Navigate wallpapers in preview or change pages
- **Ctrl/Cmd + A**: Select all visible wallpapers

### 🔄 Performance & Reliability
- **Request Caching**: 5-minute cache for API responses to reduce load
- **Auto-Retry**: Failed requests automatically retry with exponential backoff
- **Filter Persistence**: All filters saved to localStorage
- **Progressive Image Loading**: Images load with fade-in animation

### ♿ Accessibility
- **ARIA Labels**: Comprehensive screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Indicators**: Clear focus states for all interactive elements
- **Semantic HTML**: Proper use of semantic elements

### 📱 Responsive Design
- **Mobile Optimized**: Responsive layouts for all screen sizes
- **Touch Friendly**: Larger hit targets on mobile devices
- **Adaptive Grid**: Grid automatically adjusts to screen width

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **JSZip** - ZIP file creation for bulk downloads
- **Wallhaven API** - Wallpaper source

## Project Structure

```
src/
├── components/           # React components
│   ├── ControlsPanel.jsx    # Search and filter controls
│   ├── WallpaperCard.jsx    # Individual wallpaper card
│   ├── WallpaperGrid.jsx    # Grid container
│   ├── PaginationBar.jsx    # Pagination controls
│   └── PreviewModal.jsx     # Full-size preview modal
├── hooks/               # Custom React hooks
│   ├── useLocalStorage.js   # localStorage wrapper
│   ├── useWallhavenAPI.js   # API calls with caching
│   ├── usePagination.js     # Pagination logic
│   ├── useFavorites.js      # Favorites management
│   └── useKeyboardShortcuts.js  # Keyboard shortcuts
├── constants.js         # App constants and config
├── utils.js            # Utility functions
├── App.jsx             # Main app component
├── main.jsx            # Entry point
└── styles.css          # Global styles
```

## Getting Started

### Prerequisites
- Node.js 16+ installed
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Widescreen-Wallpapers
```

2. Install dependencies:
```bash
npm install
```

3. **Set up your API key (Optional but Recommended)**:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Wallhaven API key
# Get your key from: https://wallhaven.cc/settings/account
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Configuration

### Wallhaven API Key (Optional but Recommended)

To access NSFW content and unlock higher rate limits, you'll need a Wallhaven API key:

1. **Get your API key**: Go to [Wallhaven Settings](https://wallhaven.cc/settings/account) (requires free account)
2. **Add it to `.env` file**:
   ```bash
   VITE_WALLHAVEN_API_KEY=your_actual_api_key_here
   ```

**Without an API key:**
- SFW content only (~200k wallpapers)
- Standard rate limits

**With an API key:**
- Full NSFW/Sketchy content access (~900k+ wallpapers)
- Higher rate limits (45 requests/minute vs 24/minute)
- Support for additional API features

**Security Note:** 
- ✅ `.env` files are git-ignored by default
- ✅ Your API key will NOT be committed to version control
- ✅ Share `.env.example` instead of `.env` with others
- ❌ Never hardcode API keys in source files

### API Configuration
All API settings can be modified in `src/constants.js`.

### Default Filters
Modify default filter values in `src/constants.js`:

```javascript
export const DEFAULT_FILTERS = {
  sort: '',
  timeRange: '1M',
  categories: {
    general: true,
    anime: true,
    people: true,
  },
  // ... more defaults
};
```

## Usage Tips

1. **Enter to Search**: Press Enter in the search field to fetch results
2. **Quick Preview**: Click any wallpaper to view full resolution
3. **Bulk Download**: Select multiple wallpapers and click "Download selected" to get a ZIP
4. **Save Favorites**: Click the heart icon to save wallpapers for later
5. **Persistent Filters**: Your filter preferences are automatically saved

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Performance

- Request caching reduces API calls
- Progressive image loading minimizes initial load time
- Lazy loading for images below the fold
- Optimized re-renders with React hooks

## License

MIT

## Credits

- Wallpapers provided by [Wallhaven](https://wallhaven.cc)
- Icons: Unicode characters
- Built with ❤️ using React and Vite
