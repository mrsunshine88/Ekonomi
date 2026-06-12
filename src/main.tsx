import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './AuthContext'


class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null, componentStack: string | null, isReloading: boolean}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, isReloading: false };
  }

  static getDerivedStateFromError(error: Error) {
    const isChunkLoadFailed = error?.message?.includes('Failed to fetch dynamically imported module') || error?.message?.includes('Importing a module script failed');
    
    if (isChunkLoadFailed) {
      const reloaded = sessionStorage.getItem('chunk_failed_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_failed_reload', 'true');
        return { hasError: true, error, isReloading: true };
      }
    }
    
    return { hasError: true, error, isReloading: false };
  }

  componentDidMount() {
    // Clear the flag after a successful load to allow future reloads if needed
    sessionStorage.removeItem('chunk_failed_reload');
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.state.isReloading) {
      window.location.reload();
      return;
    }
    this.setState({
      error: error,
      componentStack: errorInfo.componentStack || null
    });
  }

  render() {
    if (this.state.isReloading) {
      return <div style={{ padding: '2rem', textAlign: 'center' }}>Laddar om applikationen för att hämta den senaste versionen...</div>;
    }
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red' }}>
          <h2>Något gick fel!</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
          <h3>React Component Stack:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.componentStack}</pre>
          <button onClick={() => { window.location.reload(); }}>Ladda om sidan</button>
        </div>
      );
    }
    return this.props.children;
  }
}

import InstallPrompt from './components/InstallPrompt';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <InstallPrompt />
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
