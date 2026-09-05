import React from 'react';
import { useStore } from '../store';
import { useAuth } from '../AuthContext';

interface StartPageProps {
  navigateTo: (view: 'month' | 'stats' | 'manage' | 'mypages' | 'privat' | 'admin' | 'start') => void;
}

export default function StartPage({ navigateTo }: StartPageProps) {
  const openAuthModal = useStore(s => s.openAuthModal);
  const { user } = useAuth();

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

  return (
    <div className="start-page" style={{ padding: '0 1rem 2rem', maxWidth: '1000px', margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
      
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '1rem' }}>
        <h1 className="login-hero-title" style={{ marginTop: '0', textAlign: 'center' }}>
          Slipp miniräknaren. <br/>
          <span className="text-gradient">Spara tid och få full kontroll<br/>över hushållets ekonomi.</span>
        </h1>
        <p className="login-hero-subtitle" style={{ maxWidth: '600px', margin: '0 auto' }}>
          SmartEkonomi räknar automatiskt ut vem som ska betala vad, håller privat ekonomi separat och visar hur era kostnader utvecklas över tid.
          {!user && (
            <span> Helt gratis att använda! 💸✨ <button onClick={openAuthModal} style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', fontWeight: 'bold', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>Skapa konto här</button></span>
          )}
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
            Ladda upp din bankfil så sorterar SmartEkonomi automatiskt in utgifter och lön. Systemet lär sig av dina val och blir smartare för varje import!
          </p>
        </div>

        {/* Mina sidor */}
        <div onClick={() => navigateTo('mypages')} style={boxStyle} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div style={{ fontSize: '2.5rem' }}>👤</div>
          <h3 style={{ margin: 0, fontSize: '1.3rem' }}>Mina sidor</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
            Full kontroll över ditt konto.<br/><br/>
            Hantera din profil, notiser, integritet och dina personliga inställningar på ett och samma ställe.
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
              El, försäkringar, lån, internet och andra fasta kostnader. Importera direkt från banken (t.ex. Swedbank, SEB, Länsförsäkringar) eller lägg in manuellt.
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
            <span>✅</span> Smart bank-import som förstår både utgifter och inkomster
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

      {/* Kom igång gratis */}
      {!user && (
        <div style={{ padding: '3rem', background: 'var(--surface-color)', borderRadius: '16px', border: '1px solid var(--accent-color)', marginBottom: '4rem', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <h2 style={{ fontSize: '2.5rem', margin: '0 0 1rem' }}>Kom igång helt gratis 🎁</h2>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
            Skapa ett konto på 10 sekunder och få full koll på ekonomin.
          </p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '1.1rem' }}>
            Appen är 100% gratis att använda för hela hushållet.
          </p>
          <button 
            onClick={openAuthModal}
            style={{ 
              background: 'var(--accent-gradient)', color: '#fff', border: 'none', 
              padding: '1.2rem 2.5rem', borderRadius: '12px', fontSize: '1.3rem', 
              fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
              transition: 'transform 0.2s', animation: 'pulse 2s infinite'
            }}
          >
            Skapa gratis konto nu 🚀
          </button>
        </div>
      )}

    </div>
  );
}
