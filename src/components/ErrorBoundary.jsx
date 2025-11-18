import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // Clear localStorage cache to prevent persistent errors
    try {
      localStorage.removeItem('wallhaven-api-cache');
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
    // Reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h1 className="error-boundary-title">Something went wrong</h1>
            <p className="error-boundary-message">
              The application encountered an unexpected error. Don't worry, your
              favorites and settings are safe.
            </p>
            
            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Error details</summary>
                <pre className="error-boundary-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="error-boundary-actions">
              <button
                type="button"
                onClick={this.handleReset}
                className="primary-button"
              >
                Reload Application
              </button>
              <a
                href="https://github.com/BryantWelch/WallBrowser/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="secondary-button"
              >
                Report Issue
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
