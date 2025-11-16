// LocalStorage key for storing user's custom API key
const API_KEY_STORAGE_KEY = 'wallhaven_api_key';

/**
 * Get the stored API key from localStorage
 * @returns {string|null} The stored API key or null if not found
 */
export function getStoredApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to get stored API key:', error);
    return null;
  }
}

/**
 * Store an API key in localStorage
 * @param {string} apiKey - The API key to store
 */
export function setStoredApiKey(apiKey) {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
  } catch (error) {
    console.error('Failed to store API key:', error);
  }
}

/**
 * Clear the stored API key from localStorage
 */
export function clearStoredApiKey() {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear stored API key:', error);
  }
}

/**
 * Check if there is a stored API key
 * @returns {boolean} True if an API key is stored
 */
export function hasStoredApiKey() {
  return !!getStoredApiKey();
}

/**
 * Get the active API key from localStorage
 * @returns {string} The active API key or empty string
 */
export function getActiveApiKey() {
  return getStoredApiKey() || '';
}
