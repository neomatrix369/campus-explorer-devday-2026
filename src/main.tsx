import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ViewportErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="recovery"><h1>CampusExplorer needs a refresh</h1><p>{this.state.error.message}</p><button className="primary-button" onClick={() => window.location.reload()}>Reload 3D view</button></main>;
  }
}

createRoot(document.getElementById('root')!).render(<ViewportErrorBoundary><App /></ViewportErrorBoundary>);
