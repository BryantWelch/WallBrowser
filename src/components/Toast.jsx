import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';

export function Toast({ id, message, type, duration }) {
  const { removeToast } = useToast();
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true); // Trigger exit animation
      setTimeout(() => removeToast(id), 300); // Remove after animation
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, removeToast]);

  // Icon based on type
  const getIcon = () => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'loading': return '⏳';
      default: return 'ℹ';
    }
  };

  return (
    <div className={`toast toast-${type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}>
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-message">{message}</div>
      <button 
        className="toast-close" 
        onClick={() => { setIsExiting(true); setTimeout(() => removeToast(id), 300); }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
}
