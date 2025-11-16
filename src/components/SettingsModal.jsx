import React, { useState, useEffect } from 'react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, hasStoredApiKey } from '../utils/apiKeyStorage';

export function SettingsModal({ isOpen, onClose, filters, onFilterChange }) {
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
                {showKey ? '👁️' : '👁️‍🗨️'}
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
