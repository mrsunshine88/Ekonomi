import { useState, useEffect } from 'react';
import Confetti from 'react-confetti';
import { useStore } from '../store';

const STANDARD_OPTIONS = [
  { name: 'Hyra', category: 'boende', emoji: '🏠' },
  { name: 'Lån', category: 'boende', emoji: '🏦' },
  { name: 'El', category: 'boende', emoji: '⚡' },
  { name: 'Vatten', category: 'boende', emoji: '💧' },
  { name: 'Bredband', category: 'boende', emoji: '🌐' },
  { name: 'Hemförsäkring', category: 'försäkringar', emoji: '🛡️' },
  { name: 'Netflix', category: 'abonnemang', emoji: '🎬' },
  { name: 'Spotify', category: 'abonnemang', emoji: '🎵' },
  { name: 'Bilförsäkring', category: 'försäkringar', emoji: '🚗' },
];

interface Option {
  name: string;
  category: string;
  emoji: string;
}

function CountUp({ end, duration = 2 }: { end: number, duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(easeProgress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);

  return <>{count}</>;
}

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Option[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const householdId = useStore(s => s.householdId);
  const accounts = useStore(s => s.state.accounts);
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
  const totalAmount = billsToFill.reduce((sum, opt) => sum + (Number(amounts[opt.name]) || 0), 0);

  const handleNextStep2 = async () => {
    setIsCalculating(true);
    
    // Artificiell fördröjning för att bygga förväntan
    setTimeout(async () => {
      setIsCalculating(false);
      setShowConfetti(true);
    
    const sharedAccount = accounts.find(a => a.type === 'shared') || accounts[0];
    const targetAccountId = sharedAccount?.id || crypto.randomUUID();

    // Save to database
    const paymentsToCreate = selectedOptions.map(opt => ({
      name: opt.name,
      accountId: targetAccountId,
      defaultAmount: Number(amounts[opt.name]) || 0,
      interval: 'all' as const,
      warnIfZero: true,
      splitType: 'split' as const,
      isLoan: false
    }));
    
    await createOnboardingPayments(paymentsToCreate);
      
      setStep(3);
      setIsCalculating(false);
    }, 2000);
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
        {!isCalculating ? (
          <>
            <h1 style={{ color: '#fff', fontSize: '2rem', marginBottom: '0.5rem' }}>
              {step === 1 && 'Välkommen! 👋'}
              {step === 2 && 'Dags för magin ✨'}
              {step === 3 && 'Uträkning klar! 🎯'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              {step === 1 && 'Klicka på de räkningar ni har i ert hushåll.'}
              {step === 2 && `Ange ett ungefärligt belopp för dina räkningar.`}
              {step === 3 && 'Så här ser det ut baserat på dina första siffror.'}
            </p>
          </>
        ) : (
          <h1 style={{ color: '#fff', fontSize: '2rem', marginBottom: '0.5rem', animation: 'pulse 1.5s infinite' }}>
            Räknar ihop hushållets utgifter...
          </h1>
        )}
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
            {!isCalculating && (
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                onClick={handleNextStep2}
              >
                Visa magin ✨
              </button>
            )}
            {isCalculating && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            
            {/* The WOW Moment */}
            <div style={{ 
              background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.15), rgba(52, 211, 153, 0.15))',
              border: '2px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '16px',
              padding: '2rem',
              marginBottom: '2rem',
              animation: 'fadeIn 0.5s ease-out'
            }}>
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(16, 185, 129, 0.3)', paddingBottom: '1rem' }}>
                {billsToFill.map(opt => (
                  <div key={opt.name} style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                    <span>{opt.emoji} {opt.name}</span>
                    <span>{Number(amounts[opt.name]) || 0} kr</span>
                  </div>
                ))}
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Hushållets gemensamma utgifter:</div>
              <div style={{ color: '#fff', fontSize: '3.5rem', fontWeight: 'bold', marginBottom: '1rem', textShadow: '0 2px 10px rgba(16,185,129,0.3)' }}>
                <CountUp end={totalAmount} duration={2} /> kr
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', display: 'inline-block' }}>
                💡 Med en partner blir din andel bara {Math.round(totalAmount / 2)} kr!
              </div>
            </div>
            
            {/* Semi-optional invite */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
              <h3 style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '0.5rem', margin: 0 }}>Vill ni dela detta? (Rekommenderas)</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                Skicka inbjudningskoden till din partner så ni kan dela på utgifterna i realtid.
              </p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <code style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 'bold', flex: 1, letterSpacing: '1px' }}>{householdId}</code>
                <button onClick={copyInvite} style={{ background: 'var(--accent-color)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Kopiera
                </button>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', background: 'transparent', border: '2px solid var(--border-color)', color: 'var(--text-secondary)' }}
              onClick={finish}
            >
              Hoppa över för nu – Ta mig till månadsvyn →
            </button>
            <style>{`@keyframes fadeIn { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }`}</style>
          </div>
        )}
      </div>
    </div>
  );
}
