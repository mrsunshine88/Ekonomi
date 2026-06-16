import React, { useState, useEffect } from 'react';
import { Shield, Check, Trash2, Database, AlertCircle } from 'lucide-react';
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

      // We have an is_user_admin() RPC we can call, but since we are just checking if we can view the page, 
      // we can try fetching the view. If RLS fails or we get empty due to no data, we handle it.
      // Wait, global_learning_candidates_view doesn't have RLS, but the underlying table does!
      // If the user is admin, they can read the underlying table. Let's just try fetching.
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

  if (loading) return <div className="p-8 text-center text-white/50">Laddar...</div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Åtkomst nekad</h1>
          <p className="text-slate-400">Du måste ha administratörsrättigheter för att se denna sida.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
            <Database className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Global Inlärning</h1>
            <p className="text-slate-400">Konsensusmotor för Crowdsourcad Bankimport</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Kandidater redo för godkännande
            </h2>
            <div className="text-sm text-slate-400">
              Visar kandidater med ≥ 1 hushåll
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400 text-sm">
                  <th className="p-4 font-medium">Namn (Normaliserat)</th>
                  <th className="p-4 font-medium">Riktning</th>
                  <th className="p-4 font-medium">Kategori</th>
                  <th className="p-4 font-medium text-right">Unika Hushåll</th>
                  <th className="p-4 font-medium text-center">Åtgärd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {candidates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Inga starka kandidater just nu.
                    </td>
                  </tr>
                ) : (
                  candidates.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-4">
                        <span className="font-medium text-white">{c.normalized_name}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${c.transaction_direction === 'IN' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {c.transaction_direction}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">
                        {c.category}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-lg font-bold text-white">{c.household_count}</span>
                          <span className="text-sm text-slate-500">st</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => approveCandidate(c)}
                          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Godkänn
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
import { Sparkles } from 'lucide-react';
