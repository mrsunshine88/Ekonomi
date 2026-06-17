import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface Candidate {
  normalized_name: string;
  transaction_direction: 'IN' | 'OUT';
  category: string;
  household_count: number;
  first_discovered_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  BILL: '🧾 Räkning',
  FIXED_INCOME: '💰 Fast inkomst',
  VARIABLE_INCOME: '📈 Rörlig inkomst',
};

export default function AdminLearning() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [confirmCandidate, setConfirmCandidate] = useState<Candidate | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setIsAdmin(false); setLoading(false); return; }

      const { data, error } = await supabase
        .from('global_learning_candidates_view')
        .select('*')
        .order('household_count', { ascending: false });

      if (error) { setIsAdmin(false); }
      else { setIsAdmin(true); setCandidates(data || []); }
    } catch (e) {
      console.error(e);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const triggerApprove = (candidate: Candidate) => {
    setConfirmCandidate(candidate);
  };

  const handleApproveConfirm = async () => {
    if (!confirmCandidate) return;
    const candidate = confirmCandidate;
    setConfirmCandidate(null);
    
    const key = `${candidate.normalized_name}-${candidate.transaction_direction}-${candidate.category}`;
    setApproving(key);
    try {
      const { error } = await supabase.rpc('admin_approve_system_rule', {
        p_normalized_name: candidate.normalized_name,
        p_transaction_direction: candidate.transaction_direction,
        p_category: candidate.category,
        p_household_count: candidate.household_count
      });
      if (error) throw error;
      setCandidates(prev => prev.filter(c =>
        !(c.normalized_name === candidate.normalized_name &&
          c.transaction_direction === candidate.transaction_direction &&
          c.category === candidate.category)
      ));
    } catch (e: any) {
      setErrorMsg('Kunde inte godkänna: ' + e.message);
    } finally {
      setApproving(null);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧠</div>
          <div>Laddar inlärningsdata...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', padding: '1rem' }}>
        <div style={{ textAlign: 'center', background: 'var(--surface-color)', border: '1px solid rgba(239,68,68,0.3)', padding: '2rem', borderRadius: '1rem', maxWidth: '360px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔒</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Åtkomst nekad</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Du behöver administratörsbehörighet.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '680px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 700 }}>
            🧠 Global Inlärning
          </h1>
          <button
            onClick={checkAdminAndLoadData}
            style={{ flexShrink: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--surface-color)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer' }}
          >
            🔄 Uppdatera
          </button>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Konsensusmotor — godkänn kandidater som globala systemregler
        </p>
      </div>

      {/* Statistik-chips */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Kandidater: </span>
          <strong style={{ color: 'var(--text-primary)' }}>{candidates.length}</strong>
        </div>
        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Tröskel: </span>
          <strong style={{ color: 'var(--text-primary)' }}>≥ 1 hushåll</strong>
        </div>
      </div>

      {/* Kandidat-kort */}
      {candidates.length === 0 ? (
        <div style={{
          background: 'var(--surface-color)', border: '1px solid var(--border-color)',
          borderRadius: '1rem', padding: '2.5rem 1.5rem', textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✨</div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.4rem' }}>Inga kandidater just nu</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Data samlas in automatiskt när användare importerar bankfiler eller registrerar sig.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {candidates.map((c, i) => {
            const key = `${c.normalized_name}-${c.transaction_direction}-${c.category}`;
            const isApproving = approving === key;
            return (
              <div key={i} style={{
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '1rem',
                padding: '1rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                {/* Röst-antal */}
                <div style={{
                  flexShrink: 0, width: '48px', height: '48px',
                  borderRadius: '0.75rem', background: 'rgba(99,102,241,0.12)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#818cf8', lineHeight: 1 }}>{c.household_count}</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>hushåll</span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.normalized_name}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.72rem', fontWeight: 600,
                      background: c.transaction_direction === 'IN' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                      color: c.transaction_direction === 'IN' ? '#10b981' : '#ef4444'
                    }}>
                      {c.transaction_direction === 'IN' ? '↑ Inkomst' : '↓ Utgift'}
                    </span>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.72rem', fontWeight: 500,
                      background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)'
                    }}>
                      {CATEGORY_LABELS[c.category] || c.category}
                    </span>
                  </div>
                </div>

                {/* Godkänn-knapp */}
                <button
                  onClick={() => triggerApprove(c)}
                  disabled={isApproving}
                  style={{
                    flexShrink: 0,
                    padding: '0.5rem 0.9rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: isApproving ? 'var(--border-color)' : '#6366f1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.6rem',
                    cursor: isApproving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {isApproving ? '⏳' : '✅ OK'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'center', marginTop: '1.5rem' }}>
        Godkända regler aktiveras omedelbart för alla användare i systemet.
      </p>

      {/* Bekräftelse-ruta (Custom Modal) */}
      {confirmCandidate && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '1rem', maxWidth: '400px', width: '100%', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Godkänn regel</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Vill du godkänna "<strong>{confirmCandidate.normalized_name}</strong>" som en global SYSTEM-regel för alla användare?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setConfirmCandidate(null)}
                style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Avbryt
              </button>
              <button 
                onClick={handleApproveConfirm}
                style={{ padding: '0.5rem 1rem', background: '#6366f1', border: 'none', color: '#fff', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
              >
                ✅ Godkänn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Felmeddelande-ruta (Custom Modal) */}
      {errorMsg && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '1rem', maxWidth: '400px', width: '100%', border: '1px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <h3 style={{ margin: 0, color: '#ef4444' }}>Ett fel uppstod</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', wordBreak: 'break-word', lineHeight: 1.5 }}>
              {errorMsg}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setErrorMsg(null)}
                style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
