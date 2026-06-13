import { StrictMode, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './AuthContext'
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://9f0dea41c5c429ec14fe555113b2fc7c@o4511558355910656.ingest.de.sentry.io/4511558367182928",
  enabled: import.meta.env.PROD, // Skicka bara loggar i produktion, inte när vi kodar lokalt
});

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null, componentStack: string | null, isReloading: boolean}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, isReloading: false };
  }

  static getDerivedStateFromError(error: Error) {
    const isChunkLoadFailed = error?.message?.includes('Failed to fetch dynamically imported module') || error?.message?.includes('Importing a module script failed');
    
    if (isChunkLoadFailed) {
      const lastReload = sessionStorage.getItem('chunk_failed_reload_time');
      const now = Date.now();
      
      // If we haven't reloaded in the last 10 seconds, try to reload automatically
      if (!lastReload || (now - parseInt(lastReload, 10) > 10000)) {
        sessionStorage.setItem('chunk_failed_reload_time', now.toString());
        return { hasError: true, error, isReloading: true };
      }
    }
    
    return { hasError: true, error, isReloading: false };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.state.isReloading) {
      // Unregister service workers to ensure we get fresh files from the server
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
        } catch (e) {
          console.error('Service Worker unregistration failed:', e);
        }
      }
      window.location.reload();
      return;
    }
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack
      }
    });

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
          <p>Det verkar som att appen har uppdaterats och din webbläsare har gamla filer cachade.</p>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
          <h3>React Component Stack:</h3>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.componentStack}</pre>
          <button 
            onClick={async () => { 
              if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                  await registration.unregister();
                }
              }
              window.location.reload(); 
            }}
            style={{ padding: '10px 20px', fontSize: '16px', background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '1rem' }}
          >
            Tvinga omladdning och rensa cache
          </button>
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
