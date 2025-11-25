import React, { useState, useEffect } from 'react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, hasStoredApiKey } from '../utils/apiKeyStorage';

export function SettingsModal({ isOpen, onClose, filters, onFilterChange }) {
  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const [apiKey, setApiKey] = useState('');
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredApiKey();
      if (stored) {
        setApiKey(stored);
        setHasCustomKey(true);
      } else {
        setApiKey('');
        setHasCustomKey(false);
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
      setStoredApiKey(apiKey.trim());
      setHasCustomKey(true);
      // Reload to apply new API key
      window.location.reload();
    }
  };

  const handleClear = () => {
    clearStoredApiKey();
    setApiKey('');
    setHasCustomKey(false);
    // Reset NSFW filters since they require API key
    onFilterChange('includeNsfw', false);
    // Reload to apply cleared API key
    window.location.reload();
  };

  const handleClose = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const hasAnyKey = hasCustomKey;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="settings-modal">
        <div className="settings-header">
          <h2>API Key Settings</h2>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <label htmlFor="api-key-input">
              Wallhaven API Key (Optional)
            </label>
            <div className="api-key-input-group">
              <input
                id="api-key-input"
                type={showKey ? "text" : "password"}
                placeholder="Enter your API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="api-key-input"
              />
              <button
                type="button"
                className="toggle-visibility-button"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                )}
              </button>
            </div>
            
            <div className="settings-actions">
              <button
                type="button"
                className="primary-button save-button"
                onClick={handleSave}
                disabled={!apiKey.trim()}
              >
                Save Key
              </button>
              <button
                type="button"
                className="secondary-button clear-button"
                onClick={handleClear}
                disabled={!hasCustomKey}
              >
                Clear Key
              </button>
            </div>

            <div className={`api-status ${hasAnyKey ? 'active' : 'inactive'}`}>
              {hasCustomKey ? (
                <>
                  <span className="status-indicator">🟢</span>
                  <span>Using your API key</span>
                </>
              ) : (
                <>
                  <span className="status-indicator">🟡</span>
                  <span>Using public API</span>
                </>
              )}
            </div>
          </div>

          <div className="settings-divider"></div>

          <div className="settings-section">
            <h3>Content Filters {!hasAnyKey && <span className="requires-key">(Requires API Key)</span>}</h3>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.includeNsfw || false}
                onChange={(e) => {
                  if (!hasAnyKey) return;
                  onFilterChange('includeNsfw', e.target.checked);
                }}
                disabled={!hasAnyKey}
                aria-label="Include NSFW and Sketchy content"
              />
              <span>Include NSFW/Sketchy content</span>
            </label>
            
            {!hasAnyKey && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem', marginLeft: '0.75rem' }}>
                Add an API key to access Sketchy and NSFW content
              </p>
            )}
          </div>

          <div className="settings-info">
            <p>
              ℹ️ Get your free API key at{' '}
              <a
                href="https://wallhaven.cc/settings/account"
                target="_blank"
                rel="noopener noreferrer"
              >
                wallhaven.cc/settings/account
              </a>
            </p>
            <p className="info-note">
              Your API key is stored locally in your browser and never sent to any server except Wallhaven.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
