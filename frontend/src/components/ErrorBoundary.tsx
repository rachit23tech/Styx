import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: '40px 20px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <AlertTriangle size={28} color="#f43f5e" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', maxWidth: '400px' }}>
            An unexpected error occurred. Please try refreshing the page. If the issue persists, contact support.
          </p>
          <details
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              marginBottom: '24px',
              maxWidth: '500px',
              textAlign: 'left',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Error Details</summary>
            <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {this.state.error?.message || 'Unknown error'}
            </pre>
          </details>
          <button
            className="btn btn-teal"
            onClick={this.handleReload}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} /> Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
