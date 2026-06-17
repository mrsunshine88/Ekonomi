import { useState, useEffect, lazy, Suspense } from 'react';
import { useStore } from './store';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import MonthView from './components/MonthView';
import Summary from './components/Summary';
import ManageBills from './components/ManageBills';
import { Toaster } from 'react-hot-toast';
const Statistics = lazy(() => import('./components/Statistics'));
import LoginScreen from './components/Auth/LoginScreen';
import MyPages from './components/MyPages';
import AdminDashboard from './components/AdminDashboard';
import PrivateView from './components/PrivateView';
import AdminLearning from './pages/AdminLearning';

import Onboarding from './components/Onboarding';
import PaywallModal from './components/PaywallModal';
import TermsModal from './components/TermsModal';
import Footer from './components/Footer';
import UpdatePassword from './components/Auth/UpdatePassword';
import ChatBubble from './components/ChatBubble';
import ConfirmedModal from './components/Auth/ConfirmedModal';
import StartPage from './components/StartPage';
import { trackFunnelEvent } from './hooks/useFunnelTracker';

function App() {
  const { user, householdId, setupStatus, loading, isRecoveringPassword, isAdmin, tosAccepted, isNewlyConfirmed, setIsNewlyConfirmed } = useAuth();
  const initCloud = useStore(s => s.initCloud);
  const state = useStore(s => s.state);
  const isDemoMode = useStore(s => s.isDemoMode);
  const stopDemo = useStore(s => s.stopDemo);
  type ViewType = 'start' | 'month' | 'stats' | 'manage' | 'mypages' | 'privat' | 'admin' | 'admin_learning';
  const URL_TO_VIEW: Record<string, ViewType> = {
    '/': 'start',
    '/month': 'month',
    '/stats': 'stats',
    '/manage': 'manage',
    '/mypages': 'mypages',
    '/privat': 'privat',
    '/admin': 'admin',
    '/admin/learning': 'admin_learning',
  };
  const VIEW_TO_URL: Record<ViewType, string> = {
    'start': '/',
    'month': '/month',
    'stats': '/stats',
    'manage': '/manage',
    'mypages': '/mypages',
    'privat': '/privat',
    'admin': '/admin',
    'admin_learning': '/admin/learning',
  };
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const path = window.location.pathname;
    return URL_TO_VIEW[path] || (localStorage.getItem('smartEkonomi_currentView') as ViewType) || 'start';
  });

  useEffect(() => {
    localStorage.setItem('smartEkonomi_currentView', currentView);
    const newUrl = VIEW_TO_URL[currentView] || '/';
    if (window.location.pathname !== newUrl) {
      window.history.pushState(null, '', newUrl);
    }
    // Funnel: spåra varje sidvy (ej demo-läge)
    if (!isDemoMode) {
      trackFunnelEvent('page_view', { view: currentView, path: newUrl });
    }
  }, [currentView]);

  // Återställ vy när man byter användare
  useEffect(() => {
    setCurrentView('start');
  }, [user?.id]);
  
  useEffect(() => {
    initCloud(householdId, user?.id || null);
  }, [householdId, user?.id, initCloud]);

  // Visitor Tracking
  useEffect(() => {
    let sessionId = localStorage.getItem('visitor_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('visitor_session_id', sessionId);
    }
    
    const lastLog = sessionStorage.getItem('last_visit_log');
    const now = Date.now();
    if (!lastLog || now - parseInt(lastLog) > 1000 * 60 * 60) {
      supabase.from('page_visits').insert([{ session_id: sessionId, path: window.location.pathname }]).then(({ error }) => {
        if (!error) {
          sessionStorage.setItem('last_visit_log', now.toString());
        }
      });
    }
  }, []);

  // ─── Supabase Realtime Presence ─────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode) return;

    let presenceSessionId = sessionStorage.getItem('presence_session_id');
    if (!presenceSessionId) {
      presenceSessionId = crypto.randomUUID();
      sessionStorage.setItem('presence_session_id', presenceSessionId);
    }

    const VIEW_LABELS: Record<string, string> = {
      start: 'Startsidan', month: 'Månadsvy', stats: 'Statistik',
      manage: 'Hantera Räkningar', mypages: 'Mina Sidor',
      privat: 'Privat', admin: 'Admin', admin_learning: 'Admin Inlärning',
    };

    const channel = supabase
      .channel('live-presence')
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<import('./store').PresenceEntry>();
        const entries = Object.values(state).flat();
        useStore.setState({ presenceSessions: entries });
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({
          session_id: presenceSessionId,
          user_id: user?.id || 'anonymous',
          role: isAdmin ? 'admin' : user ? 'user' : 'anonymous',
          page: VIEW_TO_URL[currentView as keyof typeof VIEW_TO_URL] || '/',
          page_label: VIEW_LABELS[currentView] || currentView,
          page_entered_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      channel.unsubscribe();
      useStore.setState({ presenceSessions: [] });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, user?.id, isAdmin]);

  // Uppdatera presence-sida när vyn ändras
  useEffect(() => {
    if (isDemoMode) return;
    const channel = supabase.getChannels().find(c => c.topic === 'realtime:live-presence');
    if (channel && channel.state === 'joined') {
      const VIEW_LABELS: Record<string, string> = {
        start: 'Startsidan', month: 'Månadsvy', stats: 'Statistik',
        manage: 'Hantera Räkningar', mypages: 'Mina Sidor',
        privat: 'Privat', admin: 'Admin', admin_learning: 'Admin Inlärning',
      };
      channel.track({
        session_id: sessionStorage.getItem('presence_session_id'),
        user_id: user?.id || 'anonymous',
        role: isAdmin ? 'admin' : user ? 'user' : 'anonymous',
        page: VIEW_TO_URL[currentView as keyof typeof VIEW_TO_URL] || '/',
        page_label: VIEW_LABELS[currentView] || currentView,
        page_entered_at: new Date().toISOString(),
      });
    }
  }, [currentView]);
  // ────────────────────────────────────────────────────────────────────────

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (view: ViewType) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };
  
  // Defaults to current month YYYY-MM
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthNames = [
    "Januari", "Februari", "Mars", "April", "Maj", "Juni", 
    "Juli", "Augusti", "September", "Oktober", "November", "December"
  ];

  const getMonthDisplay = (monthId: string) => {
    const [year, month] = monthId.split('-');
    const m = parseInt(month, 10);
    return `${monthNames[m - 1]} ${year}`;
  };

  const changeMonth = (delta: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, 1);
    const newId = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newId);
  };

  const loadYear = useStore(s => s.loadYear);
  const [loadedYears, setLoadedYears] = useState<Set<string>>(new Set([String(new Date().getFullYear())]));

  useEffect(() => {
    const year = currentMonth.split('-')[0];
    if (!loadedYears.has(year)) {
      setLoadedYears(prev => new Set(prev).add(year));
      loadYear(year);
    }
  }, [currentMonth, loadedYears, loadYear]);

  if (loading) return <div style={{ color: 'white', padding: '2rem', textAlign: 'center' }}>Laddar...</div>;

  if (isRecoveringPassword) {
    return <UpdatePassword />;
  }

  if (!user && !isDemoMode) {
    return (
      <>
        <LoginScreen />
        <ChatBubble />
      </>
    );
  }

  // 1. HARD GATE: Grattis-rutan vid ny bekräftelse
  if (isNewlyConfirmed) {
    return (
      <div className="container" style={{ minHeight: '100vh' }}>
        <ConfirmedModal onClose={() => setIsNewlyConfirmed(false)} />
      </div>
    );
  }

  // 2. HARD GATE: TOS & Privacy Policy
  if (!tosAccepted && !isDemoMode) {
    return (
      <div className="container" style={{ minHeight: '100vh' }}>
        <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff', borderRadius: '8px' } }} />
        <TermsModal />
      </div>
    );
  }

  // 2. HARD GATE: Onboarding (Create Household)
  const needsOnboarding = setupStatus === 'new_user' || setupStatus === 'setup_started';
  if (needsOnboarding && !isDemoMode) {
    return (
      <div className="container" style={{ minHeight: '100vh' }}>
        <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff', borderRadius: '8px' } }} />
        <Onboarding />
      </div>
    );
  }


  // 3. HARD GATE: Paywall
  const isPaywallBlocked = state.paywallActive && state.stripeStatus !== 'vip' && state.stripeStatus !== 'active' && !isAdmin;
  if (isPaywallBlocked && !isDemoMode) {
    return (
      <div className="container" style={{ minHeight: '100vh' }}>
        <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff', borderRadius: '8px' } }} />
        <PaywallModal />
      </div>
    );
  }

  const navButtonStyles = (view: string) => ({
    padding: '0.8rem 1.2rem',
    fontSize: '1rem',
    background: currentView === view ? 'var(--accent-gradient)' : 'transparent',
    color: currentView === view ? 'white' : 'var(--text-secondary)',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: currentView === view ? 'bold' as const : 'normal' as const,
    transition: 'all 0.2s',
    textAlign: 'left' as const,
    width: '100%'
  });

  return (
    <div className="app-layout">
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff', borderRadius: '8px' } }} />
      
      {/* DESKTOP SIDEBAR */}
      <aside className="desktop-sidebar">
        <h1 style={{ margin: 0, marginBottom: '2rem', fontSize: '1.8rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          SmartEkonomi
        </h1>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button onClick={() => navigateTo('start')} style={navButtonStyles('start')}>🏠 Startsida</button>
          <button onClick={() => navigateTo('month')} style={navButtonStyles('month')}>📅 Gemensam</button>
          <button onClick={() => navigateTo('stats')} style={navButtonStyles('stats')}>📊 Statistik</button>
          <button onClick={() => navigateTo('privat')} style={navButtonStyles('privat')}>🔒 Privat</button>
          <button onClick={() => navigateTo('manage')} style={navButtonStyles('manage')}>⚙️ Inställningar</button>
          
          {(!isDemoMode || user) && (
            <>
              <button onClick={() => navigateTo('mypages')} style={navButtonStyles('mypages')}>👤 Mina sidor</button>
              {isAdmin && (
                <>
                  <button onClick={() => navigateTo('admin')} style={navButtonStyles('admin')}>👑 Admin</button>
                  <button onClick={() => navigateTo('admin_learning')} style={navButtonStyles('admin_learning')}>🧠 Inlärning</button>
                </>
              )}
            </>
          )}
        </nav>

        {/* Utloggning i botten */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          {(!isDemoMode || user) ? (
            <button 
              onClick={() => supabase.auth.signOut()} 
              style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
            >
              🚪 Logga ut
            </button>
          ) : (
            <button 
              onClick={stopDemo} 
              style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
            >
              🚪 Avsluta Demo
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        
        {/* MOBILE HEADER (Only visible on mobile) */}
        <div className="mobile-header">
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label="Meny"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
          
          <h1 style={{ margin: 0, fontSize: '1.5rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SmartEkonomi
          </h1>
          
          {mobileMenuOpen && (
            <>
              <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
              <div className="mobile-menu-dropdown">
                <button onClick={() => navigateTo('start')} className={`mobile-menu-item ${currentView === 'start' ? 'active' : ''}`}>🏠 Startsida</button>
                <button onClick={() => navigateTo('month')} className={`mobile-menu-item ${currentView === 'month' ? 'active' : ''}`}>📅 Gemensam</button>
                <button onClick={() => navigateTo('stats')} className={`mobile-menu-item ${currentView === 'stats' ? 'active' : ''}`}>📊 Statistik</button>
                <button onClick={() => navigateTo('privat')} className={`mobile-menu-item ${currentView === 'privat' ? 'active' : ''}`}>🔒 Privat</button>
                <button onClick={() => navigateTo('manage')} className={`mobile-menu-item ${currentView === 'manage' ? 'active' : ''}`}>⚙️ Inställningar</button>
                {(!isDemoMode || user) && (
                  <>
                    <button onClick={() => navigateTo('mypages')} className={`mobile-menu-item ${currentView === 'mypages' ? 'active' : ''}`}>👤 Mina sidor</button>
                    {isAdmin && (
                      <>
                        <button onClick={() => navigateTo('admin')} className={`mobile-menu-item ${currentView === 'admin' ? 'active' : ''}`}>👑 Admin</button>
                        <button onClick={() => navigateTo('admin_learning')} className={`mobile-menu-item ${currentView === 'admin_learning' ? 'active' : ''}`}>🧠 Inlärning</button>
                      </>
                    )}
                  </>
                )}
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }}></div>
                {(!isDemoMode || user) ? (
                  <button onClick={() => supabase.auth.signOut()} className="mobile-menu-item" style={{ color: '#f43f5e' }}>🚪 Logga ut</button>
                ) : (
                  <button onClick={stopDemo} className="mobile-menu-item" style={{ color: '#f43f5e' }}>🚪 Avsluta Demo</button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="container">
          {isDemoMode && (
            <div style={{ background: '#f59e0b', color: '#000', padding: '0.75rem 1.25rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Info-text: liten och dämpad */}
              <span style={{ fontSize: '0.8rem', opacity: 0.65, fontWeight: 500 }}>🛠️ Du utforskar appen i Demo-läge. Inget sparas.</span>

              {/* CTA-sektion: lila pill + knapp */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '0.9rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '20px',
                  boxShadow: '0 2px 12px rgba(124,58,237,0.45)',
                  whiteSpace: 'nowrap'
                }}>
                  👉 Gillar du vad du ser? Prova gratis i 14 dagar.
                </span>
                <button
                  onClick={() => {
                    localStorage.setItem('smartEkonomi_openRegister', 'true');
                    stopDemo();
                  }}
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', color: '#fff', border: 'none', padding: '0.5rem 1.2rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(124,58,237,0.4)' }}
                >
                  ✨ Skapa gratis konto
                </button>
              </div>

              {/* Avsluta Demo: nedtonad */}
              <button
                onClick={stopDemo}
                style={{ background: 'transparent', color: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,0,0,0.25)', padding: '0.35rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
              >
                Avsluta Demo
              </button>
            </div>
          )}

          {currentView === 'start' ? (
            <StartPage navigateTo={navigateTo} />
          ) : currentView === 'admin' && isAdmin ? (
            <div>
              <button className="back-button" onClick={() => setCurrentView('start')}>← Tillbaka till Startsida</button>
              <AdminDashboard />
            </div>
          ) : currentView === 'admin_learning' && isAdmin ? (
            <div>
              <button className="back-button" onClick={() => setCurrentView('start')}>← Tillbaka till Startsida</button>
              <AdminLearning />
            </div>
          ) : currentView === 'mypages' ? (
            <div>
              <button className="back-button" onClick={() => setCurrentView('start')}>← Tillbaka till Startsida</button>
              <MyPages />
            </div>
          ) : currentView === 'manage' ? (
            <div>
              <ManageBills />
            </div>
          ) : currentView === 'stats' ? (
            <div>
              <button className="back-button" onClick={() => setCurrentView('start')}>← Tillbaka till Startsida</button>
              <Suspense fallback={<div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Laddar statistik...</div>}>
                <Statistics />
              </Suspense>
            </div>
          ) : currentView === 'privat' ? (
            <>
              <div className="month-selector">
                <button onClick={() => changeMonth(-1)}>← Föregående</button>
                <button className="primary" style={{ cursor: 'default' }}>{getMonthDisplay(currentMonth)}</button>
                <button onClick={() => changeMonth(1)}>Nästa →</button>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <button 
                  onClick={() => useStore.getState().copyPrivateFromPreviousMonth(currentMonth)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', background: 'var(--surface-color)' }}
                >
                  📄 Hämta siffror från förra månaden
                </button>
              </div>

              <PrivateView currentMonth={currentMonth} />
            </>
          ) : (
            <>
              <div className="month-selector">
                <button onClick={() => changeMonth(-1)}>← Föregående</button>
                <button className="primary" style={{ cursor: 'default' }}>{getMonthDisplay(currentMonth)}</button>
                <button onClick={() => changeMonth(1)}>Nästa →</button>
              </div>

              {(state.settings?.showTransferSummary === true || state.settings?.showSwishSummary === true) && (
                <Summary currentMonth={currentMonth} />
              )}

              <MonthView currentMonth={currentMonth} />
            </>
          )}

          <Footer />
        </div>
      </main>

      <ChatBubble />
    </div>
  );
}

export default App;
