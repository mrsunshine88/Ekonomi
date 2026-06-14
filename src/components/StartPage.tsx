import React from 'react';

interface StartPageProps {
  navigateTo: (view: 'month' | 'stats' | 'manage' | 'mypages' | 'privat' | 'admin' | 'start') => void;
  isAdmin: boolean;
}

export default function StartPage({ navigateTo, isAdmin }: StartPageProps) {
  const boxStyle = {
    background: 'rgba(255,255,255,0.02)', 
    border: '1px solid var(--border-color)', 
    borderRadius: '16px', 
    padding: '2rem', 
    cursor: 'pointer', 
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1rem',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
    e.currentTarget.style.transform = 'translateY(-4px)';
    e.currentTarget.style.borderColor = 'var(--accent-color)';
    e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,0,0,0.2)';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.borderColor = 'var(--border-color)';
    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  };

  const adminHandleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
    e.currentTarget.style.transform = 'translateY(-4px)';
    e.currentTarget.style.borderColor = '#10b981';
    e.currentTarget.style.boxShadow = '0 8px 15px rgba(16, 185, 129, 0.2)';
  };

  const adminHandleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)';
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
  };

  return (
    <div className="start-page" style={{ padding: '0 1rem 2rem', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
      
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: '1.2' }}>
          Slipp miniräknaren. Spara tid och få full kontroll över hushållets ekonomi.
        </h2>
        <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '700px', margin: '0 auto', lineHeight: '1.6' }}>
          SmartEkonomi räknar automatiskt ut vem som ska betala vad, håller privat ekonomi separat och visar hur era kostnader utvecklas över tid.
        </p>
      </div>

      {/* Navigation Boxes */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '4rem'
      }}>
        {/* Gemensam */}
        <div onClick={() => navigateTo('month')} style={boxStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div style={{ fontSize: '2.5rem' }}>🏠</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Gemensam ekonomi</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Samla hushållets fasta utgifter på ett ställe.<br/><br/>
            SmartEkonomi räknar automatiskt ut exakt hur mycket varje person ska föra över till det gemensamma kontot.
          </p>
        </div>

        {/* Privat */}
        <div onClick={() => navigateTo('privat')} style={boxStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div style={{ fontSize: '2.5rem' }}>🔒</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Privat ekonomi</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Håll koll på dina egna utgifter utan att de påverkar hushållets ekonomi.<br/><br/>
            Se vart dina pengar tar vägen och upptäck enkla sätt att spara mer.
          </p>
        </div>

        {/* Statistik */}
        <div onClick={() => navigateTo('stats')} style={boxStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div style={{ fontSize: '2.5rem' }}>📊</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Statistik</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Följ hushållets kostnader över tid.<br/><br/>
            Se vilka räkningar som ökar, vilka som minskar och hur ekonomin utvecklas månad för månad.
          </p>
        </div>

        {/* Inställningar */}
        <div onClick={() => navigateTo('manage')} style={boxStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div style={{ fontSize: '2.5rem' }}>⚙️</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Inställningar</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Anpassa ekonomin efter ert hushåll.<br/><br/>
            Lägg till räkningar, inkomster och konton samt välj hur kostnaderna ska fördelas mellan hushållets medlemmar.
          </p>
        </div>

        {/* Mina sidor */}
        <div onClick={() => navigateTo('mypages')} style={boxStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div style={{ fontSize: '2.5rem' }}>👤</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Mina sidor</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Full kontroll över ditt konto.<br/><br/>
            Hantera prenumeration, notiser, integritet och dina personliga inställningar på ett och samma ställe.
          </p>
        </div>


      </div>

      {/* Så fungerar det */}
      <div style={{ marginBottom: '4rem', padding: '2.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '2.5rem', textAlign: 'center' }}>Så fungerar det</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          
          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>1️⃣</span> Lägg in räkningar
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
              El, försäkringar, lån, internet och andra fasta kostnader.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>2️⃣</span> Lägg in inkomster
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
              Löner, barnbidrag eller andra återkommande inkomster.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>3️⃣</span> Få koll på utgifter och sparmöjligheter
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
              Se exakt vart pengarna går varje månad och få en tydlig bild av hushållets ekonomi.
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>4️⃣</span> Få färdiga uträkningar
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
              SmartEkonomi räknar automatiskt ut vem som ska betala vad och visar resultatet direkt.
            </p>
          </div>

        </div>
      </div>

      {/* Därför använder hushåll SmartEkonomi */}
      <div style={{ padding: '2.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '2rem', textAlign: 'center' }}>Varför hushåll väljer SmartEkonomi</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
            <span>✅</span> Slipper miniräknaren
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
            <span>✅</span> Slipper Excel
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
            <span>✅</span> Slipper diskussioner om vem som ska betala vad
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
            <span>✅</span> Full kontroll över hushållets ekonomi
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
            <span>✅</span> Tydlig statistik över tid
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
            <span>✅</span> Fungerar för både gemensam och privat ekonomi
          </div>

        </div>
      </div>

    </div>
  );
}
