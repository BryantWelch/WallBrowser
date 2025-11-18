import React from 'react';

export function PrivacyModal({ isOpen, onClose }) {
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
          <h2>Privacy Policy</h2>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close privacy policy"
          >
            ✕
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <p style={{ fontSize: '0.95rem', lineHeight: '1.7', marginBottom: '1.5rem' }}>
              <strong>Last updated:</strong> November 18, 2025
            </p>
            
            <h3>Data Storage</h3>
            <p>
              WallBrowser stores the following data <strong>locally in your browser</strong> using localStorage:
            </p>
            <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
              <li><strong>Wallhaven API Key:</strong> If you provide one, it's stored encrypted in your browser</li>
              <li><strong>Favorites:</strong> Wallpapers you mark as favorites</li>
              <li><strong>View Preferences:</strong> Your selected view mode (compact/comfortable/cozy)</li>
              <li><strong>Cache Data:</strong> Temporary wallpaper metadata for faster browsing</li>
            </ul>
          </div>

          <div className="settings-section">
            <h3>Data Collection</h3>
            <p>
              WallBrowser <strong>does not collect, store, or transmit</strong> any of your personal data to our servers. 
              We don't have servers—this is a client-side application.
            </p>
          </div>

          <div className="settings-section">
            <h3>Third-Party Services</h3>
            <p>
              WallBrowser connects to the following third-party services:
            </p>
            <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
              <li>
                <strong>Wallhaven API:</strong> All wallpaper searches and downloads are handled by 
                <a href="https://wallhaven.cc" target="_blank" rel="noopener noreferrer"> Wallhaven.cc</a>. 
                Your API key (if provided) is sent directly to Wallhaven. See their 
                <a href="https://wallhaven.cc/privacy" target="_blank" rel="noopener noreferrer"> privacy policy</a>.
              </li>
            </ul>
          </div>

          <div className="settings-section">
            <h3>Cookies</h3>
            <p>
              WallBrowser does not use cookies. All preferences are stored using browser localStorage.
            </p>
          </div>

          <div className="settings-section">
            <h3>Analytics</h3>
            <p>
              WallBrowser does not use any analytics or tracking tools. We don't know who uses the app 
              or how it's being used.
            </p>
          </div>

          <div className="settings-section">
            <h3>Data Control</h3>
            <p>
              You have complete control over your data:
            </p>
            <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
              <li>Clear your API key anytime in Settings</li>
              <li>Remove favorites individually or clear all</li>
              <li>Clear all stored data by clearing your browser's localStorage for this site</li>
            </ul>
          </div>

          <div className="settings-section">
            <h3>Security</h3>
            <p>
              Your data is stored locally in your browser and never leaves your device except when making 
              API requests to Wallhaven (which are required for the app to function).
            </p>
          </div>

          <div className="settings-section">
            <h3>Changes to Privacy Policy</h3>
            <p>
              We may update this privacy policy from time to time. Continued use of WallBrowser after 
              changes indicates acceptance of the updated policy.
            </p>
          </div>

          <div className="settings-section">
            <h3>Contact</h3>
            <p>
              Questions about privacy? Open an issue on 
              <a href="https://github.com/BryantWelch/WallBrowser/issues" target="_blank" rel="noopener noreferrer"> GitHub</a>.
            </p>
          </div>

          <div className="settings-info" style={{ marginTop: '2rem' }}>
            <p style={{ fontSize: '0.85rem', marginBottom: '0' }}>
              <strong>TL;DR:</strong> Your data stays on your device. We don't collect anything. 
              The only external service is Wallhaven's API for fetching wallpapers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
