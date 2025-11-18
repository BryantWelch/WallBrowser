import { useState, useEffect } from 'react';

/**
 * Custom hook for localStorage with JSON serialization
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      
      const parsed = JSON.parse(item);
      
      // Validate the parsed data has the expected structure
      if (typeof parsed !== typeof initialValue) {
        console.warn(`Invalid data type for ${key}, resetting to default`);
        window.localStorage.removeItem(key);
        return initialValue;
      }
      
      return parsed;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      // Clear corrupted data
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        console.error('Failed to clear corrupted localStorage:', e);
      }
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  return [storedValue, setValue];
}
