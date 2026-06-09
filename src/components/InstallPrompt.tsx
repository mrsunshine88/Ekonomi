import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Känn av om appen redan är installerad / körs som standalone
    const isAppStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isAppStandalone);

    if (isAppStandalone) return;

    // Känn av iOS eftersom Apple inte stöder beforeinstallprompt
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Lyssna på Android/Chrome's inbyggda event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Visa vår snygga ruta istället för den inbyggda fula
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Om det är iOS, visa en manuell instruktion efter 2 sekunder
    if (isIosDevice && !isAppStandalone) {
      const timer = setTimeout(() => {
        const hasSeenPrompt = localStorage.getItem('hasSeenIOSInstallPrompt');
        if (!hasSeenPrompt) {
          setShowPrompt(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      localStorage.setItem('hasSeenIOSInstallPrompt', 'true');
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem('hasSeenIOSInstallPrompt', 'true');
    }
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      left: '1rem',
      right: '1rem',
      background: 'rgba(11, 15, 25, 0.95)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid var(--accent-color)',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--accent-gradient)', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
            E
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>Installera Appen</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Få en app-ikon på startskärmen</p>
          </div>
        </div>
        <button onClick={handleDismiss} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.2rem' }}>
          ✕
        </button>
      </div>

      {isIOS ? (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
          För att installera på iPhone: <br/><br/>
          1. Tryck på <strong>Dela-ikonen</strong> (fyrkanten med en pil) i bottenmenyn.<br/>
          2. Skrolla ner och välj <strong>"Lägg till på hemskärmen"</strong>.
        </div>
      ) : (
        <button 
          onClick={handleInstallClick}
          style={{ width: '100%', padding: '0.8rem', background: 'var(--accent-gradient)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}
        >
          Ladda ner till startskärm
        </button>
      )}
    </div>
  );
}
