import { useState } from 'react';
import type { AppState } from '../types';
import { calculateMonth } from '../store';
import { useAuth } from '../AuthContext';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportToExcel } from '../excel';

interface Props {
  state: AppState;
}

const COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#f43f5e', '#06b6d4'];

const formatMonthName = (monthId: string) => {
  const [year, month] = monthId.split('-');
  const monthNames = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
  return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
};

export default function Statistics({ state }: Props) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'shared' | 'private'>('shared');

  const isPrivate = viewMode === 'private';
  const activeMonthsObj = isPrivate ? (state.privateMonths || {}) : state.months;
  const sortedMonths = Object.keys(activeMonthsObj).sort();
  const activeBills = isPrivate 
    ? (state.privateBills || []).filter(b => b.userId === user?.id) 
    : state.bills;

  // 1. Time Series Data (for Bar & Line charts)
  const timeData = sortedMonths.map(monthId => {
    const m = activeMonthsObj[monthId];
    const amounts = m.billAmounts || {};
    
    const accountTotals: Record<string, number> = {};
    if (!isPrivate) {
      state.accounts.forEach(acc => accountTotals[acc.name] = 0);
    } else {
      accountTotals['Privat'] = 0;
    }
    
    let total = 0;
    const billMap: any = {};
    
    activeBills.forEach(b => {
      const amt = amounts[b.id] !== undefined ? amounts[b.id] : b.defaultAmount;
      if (!isPrivate) {
        // @ts-ignore - accountId exists on shared bills
        const acc = state.accounts.find(a => a.id === b.accountId);
        if (acc) {
          accountTotals[acc.name] += amt;
        }
      } else {
        accountTotals['Privat'] += amt;
      }
      total += amt;
      billMap[b.name] = amt;
    });
    
    const [year, month] = monthId.split('-');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
    const name = `${monthNames[parseInt(month, 10) - 1]} '${year.substring(2)}`;
    
    return {
      name,
      monthId,
      Total: total,
      ...accountTotals,
      ...billMap
    };
  });

  // 2. Find most volatile bills for Line Chart (ignore months where it's 0)
  const volatileBills = activeBills.map(b => {
    let min = Infinity;
    let max = -Infinity;
    sortedMonths.forEach(mId => {
      const amounts = activeMonthsObj[mId].billAmounts || {};
      const amt = amounts[b.id] !== undefined ? amounts[b.id] : b.defaultAmount;
      if (amt > 0) { // Only calculate volatility when the bill is actually paid
        if (amt < min) min = amt;
        if (amt > max) max = amt;
      }
    });
    const volatility = (max === -Infinity || min === Infinity) ? 0 : max - min;
    return { name: b.name, volatility };
  }).filter(b => b.volatility > 0).sort((a, b) => b.volatility - a.volatility).slice(0, 5);

  // 3. Calculate Movers (Real price changes between the last two times the bill was paid)
  let moversData: any[] = [];
  
  const diffs = activeBills.map(b => {
    // Find all amounts for this bill over time
    const paidHistory = sortedMonths.map(mId => {
      const amounts = activeMonthsObj[mId].billAmounts || {};
      return amounts[b.id] !== undefined ? amounts[b.id] : b.defaultAmount;
    }).filter(amt => amt > 0); // Only keep months where it was actually paid
    
    if (paidHistory.length >= 2) {
      const latest = paidHistory[paidHistory.length - 1];
      const previous = paidHistory[paidHistory.length - 2];
      return {
        name: b.name,
        Skillnad: latest - previous,
      };
    }
    return { name: b.name, Skillnad: 0 };
  }).filter(m => m.Skillnad !== 0).sort((a, b) => b.Skillnad - a.Skillnad);
  
  // Top 3 increases, Top 3 decreases
  const topIncreases = diffs.filter(d => d.Skillnad > 0).slice(0, 3);
  const topDecreases = diffs.filter(d => d.Skillnad < 0).slice(-3).reverse(); // largest negative first
  
  moversData = [...topIncreases, ...topDecreases];

  // 4. Calculate Average Pie Chart (Total Distribution)
  let pieData: {name: string, value: number}[] = [];
  if (!isPrivate) {
    pieData = state.accounts.map(acc => {
      let sum = 0;
      if (timeData.length > 0) {
        sum = timeData.reduce((accTotal, d) => accTotal + ((d as any)[acc.name] || 0), 0) / timeData.length;
      }
      return { name: acc.name, value: sum };
    }).filter(p => p.value > 0);
  } else {
    // For private, let's just make a pie of the top 5 bills by average cost
    pieData = activeBills.map(b => {
      let sum = 0;
      if (timeData.length > 0) {
        sum = timeData.reduce((accTotal, d) => accTotal + ((d as any)[b.name] || 0), 0) / timeData.length;
      }
      return { name: b.name, value: sum };
    }).sort((a, b) => b.value - a.value).slice(0, 5).filter(p => p.value > 0);
  }

  // 5. History Tables Data (Only for shared)
  let history: any[] = [];
  if (!isPrivate) {
    history = sortedMonths.map((monthId, idx) => {
      const result = calculateMonth(state, monthId);
      
      let totalShared = 0;
      Object.values(result.transfersToShared).forEach(targetAcc => {
        Object.values(targetAcc).forEach(amt => totalShared += amt);
      });
      
      // compare to previous month's total shared
      let prevTotalShared = 0;
      if (idx > 0) {
        const prevResult = calculateMonth(state, sortedMonths[idx - 1]);
        Object.values(prevResult.transfersToShared).forEach(targetAcc => {
          Object.values(targetAcc).forEach(amt => prevTotalShared += amt);
        });
      }
      const sharedDiff = idx > 0 ? totalShared - prevTotalShared : 0;

      return {
        monthId,
        result,
        totalShared,
        sharedDiff
      };
    }).reverse(); // Newest first
  }

  const detailedBills = activeBills.map(b => {
    const paidHistory = sortedMonths.map(mId => {
      const amounts = activeMonthsObj[mId].billAmounts || {};
      return amounts[b.id] !== undefined ? amounts[b.id] : b.defaultAmount;
    }).filter(amt => amt > 0);

    const latest = paidHistory.length > 0 ? paidHistory[paidHistory.length - 1] : 0;
    const previous = paidHistory.length > 1 ? paidHistory[paidHistory.length - 2] : 0;
    const diff = latest - previous;
    
    return {
      name: b.name,
      latest,
      previous,
      diff
    };
  }).sort((a, b) => b.diff - a.diff);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>{label}</p>
          {payload.map((p: any) => (
            <div key={p.dataKey} style={{ color: p.color || p.fill, margin: '0.25rem 0', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span>{p.name}:</span>
              <strong>{p.value > 0 ? '+' : ''}{p.value.toLocaleString('sv-SE')} kr</strong>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const tableHeaderStyle = { padding: '1rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' as const, fontWeight: 'bold' };
  const tableCellStyle = { padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' };

  return (
    <div style={{ padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>EkonomiTB - Historisk Data</h2>
        <button 
          onClick={() => exportToExcel(state, user?.id)}
          style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}
        >
          💾 Ladda ner Excel
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => setViewMode('shared')}
          style={{ flex: 1, padding: '0.75rem', background: viewMode === 'shared' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: viewMode === 'shared' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: viewMode === 'shared' ? 'bold' : 'normal' }}
        >
          Gemensam Statistik
        </button>
        <button 
          onClick={() => setViewMode('private')}
          style={{ flex: 1, padding: '0.75rem', background: viewMode === 'private' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: viewMode === 'private' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: viewMode === 'private' ? 'bold' : 'normal' }}
        >
          🔒 Privat Statistik
        </button>
      </div>

      {!isPrivate && history.length > 0 && (
        <div className="card">
          <h3 className="card-title">Huskonto & Swish - Månad för Månad</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>En tydlig tabell över hur stora överföringarna varit historiskt, och exakt vem som swishade vem.</p>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Månad</th>
                  <th style={tableHeaderStyle}>Summa till Huskonto</th>
                  <th style={tableHeaderStyle}>Förändring</th>
                  <th style={tableHeaderStyle}>Swishar</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.monthId}>
                    <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>{formatMonthName(h.monthId)}</td>
                    <td style={tableCellStyle}>{Math.round(h.totalShared).toLocaleString('sv-SE')} kr</td>
                    <td style={{ ...tableCellStyle, color: h.sharedDiff > 0 ? '#f43f5e' : (h.sharedDiff < 0 ? '#10b981' : 'inherit') }}>
                      {h.sharedDiff > 0 ? '+' : ''}{Math.round(h.sharedDiff).toLocaleString('sv-SE')} kr
                    </td>
                    <td style={tableCellStyle}>
                      {h.result.swishes.map((s: any, i: number) => {
                        const fromName = state.accounts.find(a => a.id === s.fromId)?.name || s.fromId;
                        const toName = state.accounts.find(a => a.id === s.toId)?.name || s.toId;
                        return (
                          <div key={i} style={{ fontSize: '0.85rem' }}>
                            <span style={{ color: '#3b82f6' }}>{fromName}</span> swishade <span style={{ color: '#10b981' }}>{toName}</span>: {Math.round(s.amount).toLocaleString('sv-SE')} kr
                          </div>
                        );
                      })}
                      {h.result.swishes.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>Inga</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {timeData.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 className="card-title">Kostnadsutveckling över tid</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Hur dina totala utgifter har utvecklats månad för månad.</p>
            <div style={{ height: 300, width: '100%', marginTop: '1rem' }}>
              <ResponsiveContainer>
                <BarChart data={timeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '1rem' }} />
                  {!isPrivate ? (
                    state.accounts.map((acc, index) => (
                      <Bar key={acc.id} dataKey={acc.name} stackId="a" fill={COLORS[index % COLORS.length]} radius={index === state.accounts.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))
                  ) : (
                    <Bar dataKey="Privat" stackId="a" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div className="card">
              <h3 className="card-title">Mest instabila kostnaderna</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>De 5 räkningarna som pendlar mest i pris (baserat på differensen mellan billigast och dyrast historiskt).</p>
              {volatileBills.length > 0 ? (
                <div style={{ height: 250, width: '100%', marginLeft: '-15px' }}>
                  <ResponsiveContainer>
                    <LineChart data={timeData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="plainline" iconSize={14} wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      {volatileBills.map((b, index) => (
                        <Line key={b.name} type="monotone" dataKey={b.name} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Finns inte tillräckligt med historik ännu.</div>
              )}
            </div>

            <div className="card">
              <h3 className="card-title">Genomsnittlig fördelning</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Snittet per månad historiskt.</p>
              {pieData.length > 0 ? (
                <div style={{ height: 250, width: '100%' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => `${Math.round(value || 0).toLocaleString('sv-SE')} kr / mån`} contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                      <Legend iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Finns inte tillräckligt med historik ännu.</div>
              )}
            </div>
          </div>
        </>
      )}

      {moversData.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h3 className="card-title">Största förändringarna (Movers)</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Jämförelse mellan de <strong>två senaste gångerna</strong> en specifik räkning betalades. Listar de som blivit dyrast och de som blivit billigast.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
            <div>
              <h4 style={{ color: '#f43f5e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📈 Största ökningarna</h4>
              {topIncreases.length > 0 ? topIncreases.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(244, 63, 94, 0.05)', borderRadius: '8px', marginBottom: '0.5rem', border: '1px solid rgba(244, 63, 94, 0.1)' }}>
                  <span style={{ fontWeight: 'bold' }}>{m.name}</span>
                  <span style={{ color: '#f43f5e', fontWeight: 'bold' }}>+{Math.round(m.Skillnad).toLocaleString('sv-SE')} kr</span>
                </div>
              )) : <div style={{ color: 'var(--text-secondary)' }}>Inga ökningar registrerade.</div>}
            </div>
            
            <div>
              <h4 style={{ color: '#10b981', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📉 Största minskningarna</h4>
              {topDecreases.length > 0 ? topDecreases.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', marginBottom: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                  <span style={{ fontWeight: 'bold' }}>{m.name}</span>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{Math.round(m.Skillnad).toLocaleString('sv-SE')} kr</span>
                </div>
              )) : <div style={{ color: 'var(--text-secondary)' }}>Inga minskningar registrerade.</div>}
            </div>
          </div>
        </div>
      )}

      {detailedBills.length > 0 && (
        <div className="card">
          <h3 className="card-title">Detaljerad Historik - Alla {isPrivate ? 'Privata ' : ''}Räkningar</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Sökbar tabell över alla räkningar och hur mycket de kostade senaste gången vs gången innan det.</p>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Räkning</th>
                  <th style={tableHeaderStyle}>Senast Betald</th>
                  <th style={tableHeaderStyle}>Gången Innan</th>
                  <th style={tableHeaderStyle}>Differens</th>
                </tr>
              </thead>
              <tbody>
                {detailedBills.map((b, i) => (
                  <tr key={i}>
                    <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>{b.name}</td>
                    <td style={tableCellStyle}>{b.latest > 0 ? `${Math.round(b.latest).toLocaleString('sv-SE')} kr` : '-'}</td>
                    <td style={tableCellStyle}>{b.previous > 0 ? `${Math.round(b.previous).toLocaleString('sv-SE')} kr` : '-'}</td>
                    <td style={{ ...tableCellStyle, color: b.diff > 0 ? '#f43f5e' : (b.diff < 0 ? '#10b981' : 'inherit') }}>
                      {b.diff > 0 ? '+' : ''}{Math.round(b.diff).toLocaleString('sv-SE')} kr
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
