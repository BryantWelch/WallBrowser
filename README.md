# Wallhaven Browser

A modern web application for browsing and downloading wallpapers from Wallhaven. Built with React, featuring advanced search, bulk downloads, and a beautiful interface.

## ✨ Key Features

- **Zero Setup** - Works immediately with public API, no configuration required
- **Advanced Filtering** - Search by keywords, resolution (720p-8K), aspect ratio (13 options), color, categories
- **Cross-Page Selection** - Select wallpapers across multiple pages, view only selected, download all as ZIP
- **Random Discovery** - Dedicated 🎲 button with animated dice for instant random wallpapers
- **Quick Preview** - Full-screen modal with keyboard navigation (arrow keys)
- **Favorites System** - Save wallpapers locally for quick access
- **API Key Support** - Optional: Add your API key via ⚙️ Settings for NSFW/Sketchy content
- **View Modes** - Switch between Compact, Comfortable, and Cozy grid layouts
- **Keyboard Shortcuts** - Enter to search, Escape to close, Ctrl+A to select all, arrow keys to navigate
- **Smart Caching** - 5-minute API cache with auto-retry on failures
- **Responsive Design** - Works beautifully on desktop, tablet, and mobile

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **JSZip** - ZIP file creation for bulk downloads
- **Wallhaven API** - Wallpaper source

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd Widescreen-Wallpapers

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

**That's it!** No API key setup required - the app works immediately.

### Build for Production

```bash
npm run build
# Output: dist/
```

## ⚙️ API Key Setup (Optional)

Adding your own API key unlocks NSFW/Sketchy content and higher rate limits:

1. Click the **⚙️ Settings** button in the app
2. Get a free API key from [Wallhaven Settings](https://wallhaven.cc/settings/account) (requires account)
3. Paste it into the modal and click **Save Key**

Your API key is stored locally in your browser (localStorage) and never sent anywhere except Wallhaven.

## 💡 Usage Tips

- **Random Search** - Click the 🎲 dice button for instant random wallpapers
- **Cross-Page Selection** - Select wallpapers on multiple pages, click "Show selected →" to review all at once
- **Bulk Download** - Select wallpapers → "Download selected" → Get a ZIP with all images
- **Keyboard Navigation** - Use arrow keys in preview modal, Ctrl+A to select all visible
- **Favorites** - Save wallpapers with ♥ for quick access later (stored locally)
- **Search Similar** - Click "🔍 Similar" on any wallpaper to find visually similar ones

## License

MIT

## 🙏 Credits

Wallpapers provided by [Wallhaven](https://wallhaven.cc) • Built with React + Vite
