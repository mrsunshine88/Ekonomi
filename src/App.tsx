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
import InstallPrompt from './components/InstallPrompt';
import Onboarding from './components/Onboarding';
import PaywallModal from './components/PaywallModal';
import TermsModal from './components/TermsModal';
import Footer from './components/Footer';

function App() {
  const { user, householdId, loading } = useAuth();
  const initCloud = useStore(s => s.initCloud);
  const state = useStore(s => s.state);
  
  useEffect(() => {
    initCloud(householdId, user?.id || null);
  }, [householdId, user?.id, initCloud]);

  const [currentView, setCurrentView] = useState<'month' | 'stats' | 'manage' | 'mypages' | 'privat' | 'admin'>('month');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (view: 'month' | 'stats' | 'manage' | 'mypages' | 'privat' | 'admin') => {
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
    let newDate = new Date(year, month - 1 + delta, 1);
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

  if (!user) {
    return <LoginScreen />;
  }

  const needsOnboarding = state.accounts.length === 0;
  const isAdmin = user?.email?.toLowerCase() === 'apersson508@gmail.com';
  const isPaywallBlocked = state.paywallActive && state.stripeStatus !== 'vip' && state.stripeStatus !== 'active' && !isAdmin;

  return (
    <div className="container">
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff', borderRadius: '8px' } }} />
      <InstallPrompt />
      <TermsModal />
      {needsOnboarding && <Onboarding />}
      {!needsOnboarding && isPaywallBlocked && <PaywallModal />}
      
      <header className="header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', position: 'relative' }}>
        {/* Mobile hamburger button - only visible on mobile */}
        <button
          className="hamburger-btn"
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label="Meny"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>

        {/* Mobile dropdown overlay - only visible on mobile when open */}
        {mobileMenuOpen && (
          <>
            <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} />
            <div className="mobile-menu-dropdown">
              <button onClick={() => navigateTo('month')} className={`mobile-menu-item ${currentView === 'month' ? 'active' : ''}`}>📅 Månadsvy</button>
              <button onClick={() => navigateTo('privat')} className={`mobile-menu-item ${currentView === 'privat' ? 'active' : ''}`}>🔒 Privat</button>
              <button onClick={() => navigateTo('stats')} className={`mobile-menu-item ${currentView === 'stats' ? 'active' : ''}`}>📊 EkonomiTB</button>
              <button onClick={() => navigateTo('mypages')} className={`mobile-menu-item ${currentView === 'mypages' ? 'active' : ''}`}>👤 Mina sidor</button>
              <button onClick={() => navigateTo('manage')} className={`mobile-menu-item ${currentView === 'manage' ? 'active' : ''}`}>⚙️ Inställningar</button>
              {user?.email?.toLowerCase() === 'apersson508@gmail.com' && (
                <button onClick={() => navigateTo('admin')} className={`mobile-menu-item ${currentView === 'admin' ? 'active' : ''}`}>👑 Admin</button>
              )}
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }}></div>
              <button onClick={() => supabase.auth.signOut()} className="mobile-menu-item" style={{ color: '#f43f5e' }}>🚪 Logga ut</button>
            </div>
          </>
        )}

        <div>
          <h1 style={{ margin: 0, marginBottom: '0.5rem' }}>SmartEkonomi</h1>
          <p style={{ margin: 0 }}>Automatisk uträkning av hushållets räkningar</p>
        </div>
        {/* Desktop nav - hidden on mobile via CSS */}
        <nav className="nav-container">
          <button 
            onClick={() => navigateTo('month')} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'month' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'month' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'month' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            📅 Månadsvy
          </button>
          <button 
            onClick={() => navigateTo('privat')} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'privat' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'privat' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'privat' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            🔒 Privat
          </button>
          <button 
            onClick={() => navigateTo('stats')} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'stats' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'stats' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'stats' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            📊 EkonomiTB
          </button>
          <button 
            onClick={() => navigateTo('mypages')} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'mypages' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'mypages' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'mypages' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            👤 Mina sidor
          </button>
          <button 
            onClick={() => navigateTo('manage')} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'manage' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'manage' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'manage' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            ⚙️ Inställningar
          </button>
          {user?.email === 'apersson508@gmail.com' && (
            <button 
              onClick={() => navigateTo('admin')} 
              style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'admin' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'admin' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'admin' ? 'bold' : 'normal', transition: 'all 0.2s' }}
            >
              👑 Admin
            </button>
          )}
          <button 
            onClick={() => supabase.auth.signOut()} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', marginLeft: '0.5rem' }}
          >
            🚪 Logga ut
          </button>
        </nav>
      </header>

      {currentView === 'admin' ? (
        <div>
          <button className="back-button" onClick={() => setCurrentView('month')}>← Tillbaka till Månadsvy</button>
          <AdminDashboard />
        </div>
      ) : currentView === 'mypages' ? (
        <div>
          <button className="back-button" onClick={() => setCurrentView('month')}>← Tillbaka till Månadsvy</button>
          <MyPages />
        </div>
      ) : currentView === 'manage' ? (
        <div>
          <ManageBills />
        </div>
      ) : currentView === 'stats' ? (
        <div>
          <button className="back-button" onClick={() => setCurrentView('month')}>← Tillbaka till Månadsvy</button>
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

          {state.settings?.showSummary !== false && (
            <Summary currentMonth={currentMonth} />
          )}

          <div style={{ textAlign: 'center', marginBottom: '1.5rem', marginTop: state.settings?.showSummary !== false ? '0' : '1.5rem' }}>
            {Object.values(state.months[currentMonth]?.handledPayments || {}).some(v => v) ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'inline-block' }}>
                🔒 Vissa betalningar är låsta. Lås upp för att kunna hämta historik.
              </div>
            ) : (
              <button 
                onClick={() => useStore.getState().copyFromPreviousMonth(currentMonth)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', background: 'var(--surface-color)' }}
              >
                📄 Hämta siffror från förra månaden
              </button>
            )}
          </div>

          <MonthView currentMonth={currentMonth} />
        </>
      )}

      <Footer />
    </div>
  );
}

export default App;
