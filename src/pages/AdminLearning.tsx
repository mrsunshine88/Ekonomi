import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface Candidate {
  normalized_name: string;
  transaction_direction: 'IN' | 'OUT';
  category: string;
  household_count: number;
  first_discovered_at: string;
}

export default function AdminLearning() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from('global_learning_candidates_view')
        .select('*')
        .order('household_count', { ascending: false });

      if (error) {
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
        setCandidates(data || []);
      }
    } catch (e) {
      console.error(e);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const approveCandidate = async (candidate: Candidate) => {
    if (!confirm(`Vill du godkänna ${candidate.normalized_name} som en global SYSTEM-regel?`)) return;

    try {
      const { error } = await supabase.rpc('admin_approve_system_rule', {
        p_normalized_name: candidate.normalized_name,
        p_transaction_direction: candidate.transaction_direction,
        p_category: candidate.category,
        p_household_count: candidate.household_count
      });

      if (error) throw error;

      alert(`✅ ${candidate.normalized_name} är nu en global SYSTEM-regel!`);
      checkAdminAndLoadData();
    } catch (e: any) {
      alert('Kunde inte godkänna: ' + e.message);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Laddar...</div>;

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ background: 'var(--surface-color)', border: '1px solid rgba(239,68,68,0.3)', padding: '2rem', borderRadius: '1rem', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Åtkomst nekad</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Du måste ha administratörsrättigheter för att se denna sida.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem' }}>🧠</div>
          <div>
            <h1 style={{ color: 'var(--text-primary)', margin: 0 }}>Global Inlärning</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Konsensusmotor för Crowdsourcad Bankimport</p>
          </div>
          <button onClick={checkAdminAndLoadData} style={{ marginLeft: 'auto', padding: '0.4rem 1rem', fontSize: '0.85rem', background: 'var(--surface-color)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', cursor: 'pointer' }}>
            🔄 Uppdatera
          </button>
        </div>

        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '1rem', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem' }}>✨ Kandidater redo för godkännande</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Visar kandidater med ≥ 1 hushåll</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>Namn (Normaliserat)</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>Riktning</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>Kategori</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500, textAlign: 'right' }}>Unika Hushåll</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 500, textAlign: 'center' }}>Åtgärd</th>
                </tr>
              </thead>
              <tbody>
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Inga starka kandidater just nu. Data börjar samlas in automatiskt när användare registrerar sig!
                    </td>
                  </tr>
                ) : (
                  candidates.map((c, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {c.normalized_name}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem', borderRadius: '0.3rem', fontSize: '0.75rem', fontWeight: 500,
                          background: c.transaction_direction === 'IN' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                          color: c.transaction_direction === 'IN' ? '#10b981' : '#ef4444'
                        }}>
                          {c.transaction_direction === 'IN' ? '↑ IN' : '↓ OUT'}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {c.category}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{c.household_count}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.3rem' }}>st</span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => approveCandidate(c)}
                          className="primary"
                          style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                        >
                          ✅ Godkänn
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
