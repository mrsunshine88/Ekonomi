import React from 'react';
import Footer from './Footer';

interface AboutViewProps {
  onBack?: () => void;
}

export default function AboutView({ onBack }: AboutViewProps) {
  // Sätt bakgrunden för denna vy så den matchar det mörka temat snyggt
  React.useEffect(() => {
    document.body.style.background = '#060913';
    window.scrollTo(0, 0);
    return () => {
      document.body.style.background = '#0b0f19';
    };
  }, []);

  return (
    <div className="login-wrapper" style={{ overflowY: 'auto' }}>
      <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
        
        {onBack ? (
          <button onClick={onBack} style={{ background: 'transparent', color: 'var(--accent-color)', border: 'none', cursor: 'pointer', fontSize: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ← Tillbaka
          </button>
        ) : (
          <a href="/" style={{ textDecoration: 'none', color: 'var(--accent-color)', fontSize: '1rem', marginBottom: '2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            ← Tillbaka till startsidan
          </a>
        )}

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '3rem', position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--accent-gradient)' }}></div>

          <div className="brand-badge" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>📖 Historien om SmartEkonomi</div>
          
          <h1 style={{ fontSize: '2.5rem', marginBottom: '2rem', lineHeight: 1.2 }}>
            <span className="text-gradient">En svensk utmanare</span><br />byggd på frustration och lera
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '1.1rem' }}>
            
            <section>
              <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '1rem' }}>Vem är Andreas Persson?</h2>
              <p>
                Jag är från Karlskrona och har byggt flera olika system och appar genom åren. Innan SmartEkonomi hade jag redan utvecklat sex olika system och applikationer. Erfarenheterna från dessa projekt gav mig kunskapen att bygga SmartEkonomi från grunden och utveckla tjänsten till den robusta plattform den är idag.
              </p>
            </section>

            <section>
              <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '1rem' }}>Varför byggdes SmartEkonomi?</h2>
              <p>
                Jag och min sambo ville få bättre koll på vår gemensamma ekonomi. Vi hade alla husets räkningar samlade i ett Excel-dokument där vi varje månad fyllde i kostnaderna manuellt. Därefter satt vi med miniräknare och räknade ut hur mycket vi skulle föra över till vårt gemensamma huskonto. Vissa räkningar stod dessutom på henne och andra på mig, vilket gjorde att vi även behövde räkna ut vem som skulle föra över pengar till vem. Det fungerade, men tog tid och blev snabbt omständligt.
              </p>
            </section>

            <section>
              <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '1rem' }}>Historien bakom projektet</h2>
              <p>
                En dag satt jag med Excel-filen och tröttnade. Då fick jag idén att bygga en app som automatiskt skulle göra allt det arbete som vi gjorde manuellt varje månad. Jag började utveckla SmartEkonomi för vårt eget bruk. Tanken från början var att systemet bara skulle användas lokalt på min dator av mig och min sambo. Efter hand blev appen allt mer avancerad och löste fler problem än vad Excel kunde göra. Till slut kände jag att systemet blivit så bra att fler borde kunna använda det. Då började jag bygga vidare på projektet och utvecklade det till den webbaserade tjänst som idag finns på SmartEkonomi.nu.
              </p>
            </section>

            <section>
              <h2 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '1rem' }}>Kopplingen till Ramdala Krukor</h2>
              <p>
                Den egentliga kopplingen mellan SmartEkonomi och Ramdala Krukor är jag själv. Jag arbetar med Ramdala Krukor på dagarna och har utvecklat SmartEkonomi på kvällar och helger. SmartEkonomi är mitt eget projekt som jag byggt från grunden. Många känner igen mig genom Ramdala Krukor, där jag är personen som syns utåt. Det är jag som medverkar i sociala medier, tidningsartiklar och andra sammanhang där Ramdala Krukor representeras.
              </p>
            </section>

          </div>
        </div>

        <div style={{ marginTop: '3rem' }}>
          <Footer />
        </div>
      </div>
    </div>
  );
}
