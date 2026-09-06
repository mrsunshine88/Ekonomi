import { createPortal } from 'react-dom';
import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

export default function AboutModal({ onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);
  return createPortal(
    <div 
      onClick={onClose}
      style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999, padding: '2rem'
    }}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ 
        background: 'rgba(30, 41, 59, 0.95)', 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        borderRadius: '16px', 
        padding: '2rem', 
        maxWidth: '800px', 
        width: '100%', 
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-badge" style={{ margin: 0, display: 'inline-block' }}>📖 Historien om SmartEkonomi</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--accent-gradient)' }}></div>
          
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: '2rem', lineHeight: 1.2 }}>
            <span className="text-gradient">En svensk utmanare</span><br />byggd på frustration och lera
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '1rem' }}>
            
            <section>
              <h2 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem' }}>Vem är Andreas Persson?</h2>
              <p>
                Jag är från Karlskrona och har byggt flera olika system och appar genom åren. Innan SmartEkonomi hade jag redan utvecklat sex olika system och applikationer. Erfarenheterna från dessa projekt gav mig kunskapen att bygga SmartEkonomi från grunden och utveckla tjänsten till den robusta plattform den är idag.
              </p>
            </section>

            <section>
              <h2 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem' }}>Varför byggdes SmartEkonomi?</h2>
              <p>
                Jag och min sambo ville få bättre koll på vår gemensamma ekonomi. Vi hade alla husets räkningar samlade i ett Excel-dokument där vi varje månad fyllde i kostnaderna manuellt. Därefter satt vi med miniräknare och räknade ut hur mycket vi skulle föra över till vårt gemensamma huskonto. Vissa räkningar stod dessutom på henne och andra på mig, vilket gjorde att vi även behövde räkna ut vem som skulle föra över pengar till vem. Det fungerade, men tog tid och blev snabbt omständligt.
              </p>
            </section>

            <section>
              <h2 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem' }}>Historien bakom projektet</h2>
              <p>
                En dag satt jag med Excel-filen och tröttnade. Då fick jag idén att bygga en app som automatiskt skulle göra allt det arbete som vi gjorde manuellt varje månad. Jag började utveckla SmartEkonomi för vårt eget bruk. Tanken från början var att systemet bara skulle användas lokalt på min dator av mig och min sambo. Efter hand blev appen allt mer avancerad och löste fler problem än vad Excel kunde göra. Till slut kände jag att systemet blivit så bra att fler borde kunna använda det. Då började jag bygga vidare på projektet och utvecklade det till den webbaserade tjänst som idag finns på SmartEkonomi.nu.
              </p>
            </section>

            <section>
              <h2 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem' }}>Kopplingen till Ramdala Krukor</h2>
              <p>
                Den egentliga kopplingen mellan SmartEkonomi och Ramdala Krukor är jag själv. Jag arbetar med Ramdala Krukor på dagarna och har utvecklat SmartEkonomi på kvällar och helger. SmartEkonomi är mitt eget projekt som jag byggt från grunden. Många känner igen mig genom Ramdala Krukor, där jag är personen som syns utåt. Det är jag som medverkar i sociala medier, tidningsartiklar och andra sammanhang där Ramdala Krukor representeras.
              </p>
            </section>

          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
