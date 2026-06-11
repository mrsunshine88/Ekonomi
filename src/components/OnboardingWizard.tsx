import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { useStore } from '../store';

const STANDARD_OPTIONS = [
  { name: 'Hyra / Lån', category: 'boende', emoji: '🏠' },
  { name: 'El & Vatten', category: 'boende', emoji: '⚡' },
  { name: 'Bredband', category: 'boende', emoji: '🌐' },
  { name: 'Hemförsäkring', category: 'försäkringar', emoji: '🛡️' },
  { name: 'Matkonto', category: 'mat', emoji: '🛒' },
  { name: 'Netflix', category: 'abonnemang', emoji: '🎬' },
  { name: 'Spotify', category: 'abonnemang', emoji: '🎵' },
  { name: 'Bilen', category: 'transport', emoji: '🚗' },
];

interface Option {
  name: string;
  category: string;
  emoji: string;
}

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Option[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const householdId = useStore(s => s.householdId);
  const createOnboardingPayments = useStore(s => s.createOnboardingPayments);

  useEffect(() => {
    const handleResize = () => setWindowDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleOption = (opt: Option) => {
    if (selectedOptions.find(o => o.name === opt.name)) {
      setSelectedOptions(selectedOptions.filter(o => o.name !== opt.name));
    } else {
      setSelectedOptions([...selectedOptions, opt]);
    }
  };

  const handleNextStep1 = () => {
    if (selectedOptions.length === 0) return;
    setStep(2);
  };

  const billsToFill = selectedOptions.slice(0, 3); // Begär bara belopp för max de 3 första för aha-momentet

  const handleNextStep2 = async () => {
    setShowConfetti(true);
    
    // Save to database
    const paymentsToCreate = selectedOptions.map(opt => ({
      name: opt.name,
      accountId: opt.category,
      defaultAmount: Number(amounts[opt.name]) || 0,
      interval: 'all' as const,
      warnIfZero: true,
      splitType: 'split' as const,
      isLoan: false
    }));
    
    await createOnboardingPayments(paymentsToCreate);
    
    setTimeout(() => {
      setStep(3);
    }, 2500);
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(`Gå med i mitt hushåll på SmartEkonomi!\nKlistra in denna kod under Mina Sidor: ${householdId}`);
    alert('Kopierat! Klistra in och skicka till din partner.');
  };

  const finish = () => {
    // This will unmount the wizard because monthView will re-render since recurring_payments.length > 0
    window.location.reload(); // Enkel fulhack om komponenten inte triggar re-render av monthview direkt, men Zustand ska hantera det. Vi tar bort detta om vi litar på store-reactivityn.
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem' }}>
      {showConfetti && <Confetti width={windowDimensions.width} height={windowDimensions.height} recycle={false} numberOfPieces={400} />}
      
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ 
              height: '8px', 
              width: '40px', 
              borderRadius: '4px', 
              background: step >= i ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
              transition: 'all 0.3s'
            }} />
          ))}
        </div>
        <h1 style={{ color: '#fff', fontSize: '2rem', marginBottom: '0.5rem' }}>
          {step === 1 && 'Välkommen! 👋'}
          {step === 2 && 'Dags för magin ✨'}
          {step === 3 && 'Halva jobbet gjort! 🎯'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          {step === 1 && 'Klicka på de räkningar ni har i ert hushåll.'}
          {step === 2 && `Ange ett ungefärligt belopp för dina räkningar.`}
          {step === 3 && 'Bjud in din partner så delar ni på ansvaret.'}
        </p>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        {step === 1 && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginBottom: '2rem' }}>
              {STANDARD_OPTIONS.map(opt => {
                const isSelected = selectedOptions.some(o => o.name === opt.name);
                return (
                  <button
                    key={opt.name}
                    onClick={() => toggleOption(opt)}
                    style={{
                      padding: '0.75rem 1.25rem',
                      borderRadius: '20px',
                      border: `2px solid ${isSelected ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)'}`,
                      background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                      color: isSelected ? '#fff' : '#ccc',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>{opt.emoji}</span> {opt.name}
                  </button>
                );
              })}
            </div>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              onClick={handleNextStep1}
              disabled={selectedOptions.length === 0}
            >
              Nästa steg →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {billsToFill.map(opt => (
                <div key={opt.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '1.1rem' }}>
                    <span>{opt.emoji}</span> {opt.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="number" 
                      value={amounts[opt.name] || ''}
                      onChange={e => setAmounts({ ...amounts, [opt.name]: e.target.value })}
                      placeholder="0"
                      style={{ width: '100px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', textAlign: 'right', fontSize: '1.1rem' }}
                    />
                    <span style={{ color: 'var(--text-secondary)' }}>kr</span>
                  </div>
                </div>
              ))}
              {selectedOptions.length > 3 && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  + {selectedOptions.length - 3} andra räkningar (vi tar dem senare!)
                </div>
              )}
            </div>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              onClick={handleNextStep2}
            >
              Visa magin ✨
            </button>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💌</div>
            <p style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Nu finns räkningarna i appen! Klistra in din inbjudningskod i ett SMS till din partner så ni kan hjälpas åt att lägga in resten.
            </p>
            
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px dashed var(--accent-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Ditt Hushålls-ID:</div>
              <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 'bold', wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: '1rem' }}>
                {householdId}
              </div>
              <button onClick={copyInvite} style={{ background: 'var(--accent-color)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                📋 Kopiera kod & text
              </button>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
              onClick={finish}
            >
              Klar! Ta mig till appen 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
