import React from 'react';

export function AboutModal({ isOpen, onClose }) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleClose = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2>About WallBrowser</h2>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close about"
          >
            ✕
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>What is WallBrowser?</h3>
            <p>
              WallBrowser is a modern, fast, and user-friendly web application for browsing and downloading 
              high-quality wallpapers from <a href="https://wallhaven.cc" target="_blank" rel="noopener noreferrer">Wallhaven</a>.
            </p>
          </div>

          <div className="settings-section">
            <h3>Features</h3>
            <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
              <li>🔍 Advanced search with filters (resolution, aspect ratio, colors, etc.)</li>
              <li>❤️ Save favorites locally in your browser</li>
              <li>📦 Bulk download wallpapers as ZIP files</li>
              <li>⚡ Lightning-fast browsing with smart prefetching</li>
              <li>🎨 Color palette extraction and filtering</li>
              <li>🔐 Optional API key support for additional content</li>
              <li>📱 Fully responsive mobile design</li>
              <li>⌨️ Keyboard shortcuts for power users</li>
            </ul>
          </div>

          <div className="settings-section">
            <h3>Technology</h3>
            <p>
              Built with React 18, Vite, and modern web standards. All data is stored locally 
              in your browser—no server-side storage or tracking.
            </p>
          </div>

          <div className="settings-section">
            <h3>Credits</h3>
            <p>
              Created by <strong>Bryant Welch</strong><br />
              Wallpaper data provided by <a href="https://wallhaven.cc" target="_blank" rel="noopener noreferrer">Wallhaven.cc</a><br />
              Open source on <a href="https://github.com/BryantWelch/WallBrowser" target="_blank" rel="noopener noreferrer">GitHub</a>
            </p>
          </div>

          <div className="settings-section">
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
              Version 1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
