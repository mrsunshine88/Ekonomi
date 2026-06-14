interface StartPageProps {
  navigateTo: (view: 'month' | 'stats' | 'manage' | 'mypages' | 'privat' | 'admin' | 'start') => void;
  isAdmin: boolean;
}

export default function StartPage({ navigateTo, isAdmin }: StartPageProps) {
  return (
    <div className="start-page" style={{ padding: '2rem 1rem', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Välkommen till SmartEkonomi
        </h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
          Välj en sektion nedan för att utforska och hantera din ekonomi, både gemensamt och privat.
        </p>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '1.5rem' 
      }}>
        {/* Gemensam */}
        <div 
          onClick={() => navigateTo('month')}
          style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '2rem', 
            cursor: 'pointer', 
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = 'var(--accent-color)';
            e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>📅</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Gemensam</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Översikt över hushållets ekonomi. Se månadens räkningar och vem som ska betala vad.
          </p>
        </div>

        {/* Privat */}
        <div 
          onClick={() => navigateTo('privat')}
          style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '2rem', 
            cursor: 'pointer', 
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = 'var(--accent-color)';
            e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>🔒</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Privat</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Din privata vy där du kan hantera egna inkomster och personliga utgifter.
          </p>
        </div>

        {/* Statistik */}
        <div 
          onClick={() => navigateTo('stats')}
          style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '2rem', 
            cursor: 'pointer', 
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = 'var(--accent-color)';
            e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>📊</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Statistik</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Visuell sammanställning av er ekonomi. Följ upp kostnader och utveckling över tid.
          </p>
        </div>

        {/* Inställningar */}
        <div 
          onClick={() => navigateTo('manage')}
          style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '2rem', 
            cursor: 'pointer', 
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = 'var(--accent-color)';
            e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>⚙️</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Inställningar</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Konfigurera fasta räkningar, lägg in löner och justera hur hushållets kostnader ska fördelas.
          </p>
        </div>

        {/* Mina sidor */}
        <div 
          onClick={() => navigateTo('mypages')}
          style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '16px', 
            padding: '2rem', 
            cursor: 'pointer', 
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = 'var(--accent-color)';
            e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>👤</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Mina sidor</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Hantera din profil, uppdatera e-post, byt lösenord och hantera din prenumeration.
          </p>
        </div>

        {/* Admin (if isAdmin) */}
        {isAdmin && (
          <div 
            onClick={() => navigateTo('admin')}
            style={{ 
              background: 'rgba(16, 185, 129, 0.05)', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              borderRadius: '16px', 
              padding: '2rem', 
              cursor: 'pointer', 
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.boxShadow = '0 8px 15px rgba(16, 185, 129, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{ fontSize: '2.5rem' }}>👑</div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#10b981' }}>Admin</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
              Administratörspanel för systemet. Hantera funktioner och användare.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
