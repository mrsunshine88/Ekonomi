import { useState } from 'react';
import { calculateMonth } from '../store';
import { useAuth } from '../AuthContext';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, LabelList } from 'recharts';
import { exportToExcel } from '../excel';

import { useStore } from '../store';

const COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#f43f5e', '#06b6d4'];

const formatMonthName = (monthId: string) => {
  const [year, month] = monthId.split('-');
  const monthNames = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
  return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)' }}>
        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: 'var(--text-primary)' }}>{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color || p.fill, margin: '0.25rem 0', display: 'flex', justifyContent: 'space-between', gap: '1.5rem', fontWeight: 500 }}>
            <span>{p.name}:</span>
            <span>{p.value > 0 ? '+' : ''}{p.value.toLocaleString('sv-SE')} kr</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Statistics() {
  const state = useStore(s => s.state);
  const loadYear = useStore(s => s.loadYear);
  const { user: realUser } = useAuth();
  const isDemoMode = useStore(s => s.isDemoMode);
  const user = isDemoMode ? { id: 'demo_user_1', email: 'demo@smartekonomi.se' } : realUser;
  
  const [viewMode, setViewMode] = useState<'shared' | 'private' | 'inkomst_utgift'>('shared');
  const [loadingOlder, setLoadingOlder] = useState(false);

  const isPrivate = viewMode === 'private';
  const isIncomeMode = viewMode === 'inkomst_utgift';
  const rawMonthsObj = isPrivate || isIncomeMode ? (state.privateMonths || {}) : state.months;
  
  // 1. DATA FILTERING: Only include locked/handled months
  let validMonths: string[] = [];
  if (isIncomeMode) {
    const allIds = new Set([...Object.keys(state.months || {}), ...Object.keys(state.privateMonths || {})]);
    validMonths = Array.from(allIds).filter(monthId => {
      const isSharedHandled = Object.values((state.months[monthId] || {}).handledPayments || {}).some(v => v === true);
      const isPrivateLocked = state.privateMonths?.[monthId]?.isLocked === true;
      return isSharedHandled || isPrivateLocked;
    });
  } else {
    validMonths = Object.keys(rawMonthsObj).filter(monthId => {
      if (isPrivate) {
        return (rawMonthsObj[monthId] as any).isLocked === true;
      } else {
        const handled = rawMonthsObj[monthId].handledPayments || {};
        return Object.values(handled).some(v => v === true);
      }
    });
  }
  
  const sortedMonths = validMonths.sort();
  
  const oldestMonth = sortedMonths.length > 0 ? sortedMonths[0] : null;
  const oldestYear = oldestMonth ? parseInt(oldestMonth.split('-')[0], 10) : new Date().getFullYear();

  const handleLoadOlder = async () => {
    setLoadingOlder(true);
    await loadYear((oldestYear - 1).toString());
    setLoadingOlder(false);
  };
  
  const activeBills = isPrivate 
    ? (state.privateBills || []).filter(b => b.userId === user?.id && !b.isArchived) 
    : state.bills.filter(b => !b.isArchived);

  // 1. Time Series Data (for Bar & Line charts)
  const timeData = sortedMonths.map(monthId => {
    const m = rawMonthsObj[monthId];
    const amounts = m?.billAmounts || {};
    
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

  // Calculate KPIs
  const currentYear = new Date().getFullYear().toString();
  const monthsThisYear = timeData.filter(d => d.monthId.startsWith(currentYear));
  const totalCostThisYear = monthsThisYear.reduce((sum, d) => sum + d.Total, 0);
  const avgCostPerMonth = timeData.length > 0 ? timeData.reduce((sum, d) => sum + d.Total, 0) / timeData.length : 0;
  
  let trendAmount = 0;
  if (timeData.length >= 2) {
    const latest = timeData[timeData.length - 1].Total;
    const previous = timeData[timeData.length - 2].Total;
    trendAmount = latest - previous;
  }

  // Calculate user requested additions
  let highestBill = { name: '-', amount: 0 };
  let lowestBill = { name: '-', amount: Infinity };
  let totalActiveBillsCount = 0;
  
  if (sortedMonths.length > 0) {
    const lastMonth = rawMonthsObj[sortedMonths[sortedMonths.length - 1]];
    const amounts = lastMonth?.billAmounts || {};
    activeBills.forEach(b => {
      const amt = amounts[b.id] !== undefined ? amounts[b.id] : b.defaultAmount;
      if (amt > 0) {
          totalActiveBillsCount++;
          if (amt > highestBill.amount) highestBill = { name: b.name, amount: amt };
          if (amt < lowestBill.amount) lowestBill = { name: b.name, amount: amt };
      }
    });
  }
  if (lowestBill.amount === Infinity) lowestBill.amount = 0;

  // Find most volatile bills for Line Chart
  const volatileBills = activeBills.map(b => {
    let min = Infinity;
    let max = -Infinity;
    sortedMonths.forEach(mId => {
      const amounts = rawMonthsObj[mId]?.billAmounts || {};
      const amt = amounts[b.id] !== undefined ? amounts[b.id] : b.defaultAmount;
      if (amt > 0) { 
        if (amt < min) min = amt;
        if (amt > max) max = amt;
      }
    });
    const volatility = (max === -Infinity || min === Infinity) ? 0 : max - min;
    return { name: b.name, volatility, min, max };
  }).filter(b => b.volatility > 0).sort((a, b) => b.volatility - a.volatility).slice(0, 5);

  // Calculate Movers
  const diffs = activeBills.map(b => {
    const paidHistory = sortedMonths.map(mId => {
      const amounts = rawMonthsObj[mId]?.billAmounts || {};
      return amounts[b.id] !== undefined ? amounts[b.id] : b.defaultAmount;
    }).filter(amt => amt > 0); 
    
    if (paidHistory.length >= 2) {
      const latest = paidHistory[paidHistory.length - 1];
      const previous = paidHistory[paidHistory.length - 2];
      return { name: b.name, Skillnad: latest - previous };
    }
    return { name: b.name, Skillnad: 0 };
  }).filter(m => m.Skillnad !== 0).sort((a, b) => b.Skillnad - a.Skillnad);
  
  const topIncreases = diffs.filter(d => d.Skillnad > 0).slice(0, 3);
  const topDecreases = diffs.filter(d => d.Skillnad < 0).slice(-3).reverse(); 
  const moversData = [...topIncreases, ...topDecreases];

  // Calculate Average Pie Chart (Total Distribution)
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
    pieData = activeBills.map(b => {
      let sum = 0;
      if (timeData.length > 0) {
        sum = timeData.reduce((accTotal, d) => accTotal + ((d as any)[b.name] || 0), 0) / timeData.length;
      }
      return { name: b.name, value: sum };
    }).sort((a, b) => b.value - a.value).slice(0, 5).filter(p => p.value > 0);
  }

  // History Tables Data (Only for shared)
  let history: any[] = [];
  if (!isPrivate) {
    history = sortedMonths.map((monthId, idx) => {
      const result = calculateMonth(state, monthId);
      
      let totalShared = 0;
      Object.values(result.transfersToShared).forEach(targetAcc => {
        Object.values(targetAcc).forEach(amt => totalShared += amt);
      });
      
      let prevTotalShared = 0;
      if (idx > 0) {
        const prevResult = calculateMonth(state, sortedMonths[idx - 1]);
        Object.values(prevResult.transfersToShared).forEach(targetAcc => {
          Object.values(targetAcc).forEach(amt => prevTotalShared += amt);
        });
      }
      const sharedDiff = idx > 0 ? totalShared - prevTotalShared : 0;

      return { monthId, result, totalShared, sharedDiff };
    }).reverse();
  }

  const loanStats = activeBills.filter(b => b.isLoan && b.totalDebt !== undefined).map(loan => {
    let paidSoFar = 0;
    sortedMonths.forEach(monthId => {
      const m = rawMonthsObj[monthId];
      let amort = 0;
      if (m && m.billAmortization && m.billAmortization[loan.id] !== undefined) {
         amort = m.billAmortization[loan.id];
      } else {
         amort = (m && m.billAmounts && m.billAmounts[loan.id]) !== undefined ? m.billAmounts[loan.id] : loan.defaultAmount;
      }
      paidSoFar += amort;
    });
    
    return {
       ...loan,
       paidSoFar,
       remaining: Math.max(0, loan.totalDebt! - paidSoFar),
       progress: Math.min(100, (paidSoFar / loan.totalDebt!) * 100)
    };
  });



  return (
    <div style={{ padding: '0 1rem', paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>EkonomiTB - Insikter</h2>
        <button 
          onClick={() => exportToExcel(state, user?.id)}
          style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          💾 Ladda ner Excel
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setViewMode('shared')}
          style={{ flex: 1, minWidth: '150px', padding: '0.75rem', background: viewMode === 'shared' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: viewMode === 'shared' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: viewMode === 'shared' ? 'bold' : 'normal', transition: 'all 0.2s' }}
        >
          Gemensam Statistik
        </button>
        <button 
          onClick={() => setViewMode('private')}
          style={{ flex: 1, minWidth: '150px', padding: '0.75rem', background: viewMode === 'private' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: viewMode === 'private' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: viewMode === 'private' ? 'bold' : 'normal', transition: 'all 0.2s' }}
        >
          🔒 Privat Statistik
        </button>
        <button 
          onClick={() => setViewMode('inkomst_utgift')}
          style={{ flex: 1, minWidth: '150px', padding: '0.75rem', background: viewMode === 'inkomst_utgift' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: viewMode === 'inkomst_utgift' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: viewMode === 'inkomst_utgift' ? 'bold' : 'normal', transition: 'all 0.2s' }}
        >
          💰 Inkomst / Utgift
        </button>
      </div>

      {sortedMonths.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', marginTop: '2rem' }}>
          <h3 style={{ color: 'var(--text-secondary)' }}>Ingen statistik tillgänglig</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Statistik visas först efter att ni har markerat en månad som hanterad i huvudvyn.</p>
        </div>
      ) : viewMode === 'inkomst_utgift' ? (
        <InkomstUtgiftView state={state} user={user} sortedMonths={sortedMonths} />
      ) : (
        <>
          {/* WOW FACTOR KPI OVERVIEW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'linear-gradient(145deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', marginBottom: '0.5rem' }}>Snittkostnad / Månad</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                <span className="highlight-value">{Math.round(avgCostPerMonth).toLocaleString('sv-SE')} kr</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', marginBottom: '0.5rem' }}>Senaste Månadens Trend</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: trendAmount > 0 ? '#f43f5e' : (trendAmount < 0 ? '#10b981' : 'var(--text-primary)'), display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {trendAmount > 0 ? '▲' : (trendAmount < 0 ? '▼' : '▬')} 
                {Math.abs(trendAmount).toLocaleString('sv-SE')} kr
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Jämfört med månaden innan</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', marginBottom: '0.5rem' }}>Totalt Betalt i År ({currentYear})</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {Math.round(totalCostThisYear).toLocaleString('sv-SE')} kr
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Dyrast senaste månaden</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f43f5e' }}>{highestBill.name} ({highestBill.amount.toLocaleString('sv-SE')} kr)</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Billigast senaste månaden</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>{lowestBill.name} ({lowestBill.amount.toLocaleString('sv-SE')} kr)</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Antal låsta räkningar totalt</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#3b82f6' }}>{totalActiveBillsCount} st (Senaste månaden)</div>
            </div>
          </div>

          {/* VISUAL MOVERS (STÖRSTA FÖRÄNDRINGAR) */}
          {moversData.length > 0 && (
            <div className="card" style={{ marginBottom: '2rem' }}>
               <h3 className="card-title">Största prisförändringarna</h3>
               <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>De räkningar som ändrats allra mest sedan de senast hanterades.</p>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                 {moversData.map(m => (
                    <div key={m.name} style={{ background: m.Skillnad > 0 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: m.Skillnad > 0 ? '1px solid rgba(244, 63, 94, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                       <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.5rem' }}>{m.name}</div>
                       <div style={{ color: m.Skillnad > 0 ? '#f43f5e' : '#10b981', fontSize: '1.5rem', fontWeight: 'bold' }}>
                          {m.Skillnad > 0 ? '▲ +' : '▼ '}{m.Skillnad.toLocaleString('sv-SE')} kr
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          )}

          {/* CHARTS */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 className="card-title">Kostnadsutveckling</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>En visuell överblick över alla dina totala utgifter för de låsta månaderna.</p>
            <div style={{ height: 250, width: '100%', marginTop: '1rem' }}>
              <ResponsiveContainer>
                <BarChart data={timeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '1rem' }} />
                  {!isPrivate ? (
                    state.accounts.map((acc, index) => (
                      <Bar key={acc.id} dataKey={acc.name} stackId="a" fill={COLORS[index % COLORS.length]} radius={index === state.accounts.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} maxBarSize={60} />
                    ))
                  ) : (
                    <Bar dataKey="Privat" stackId="a" fill="url(#colorUv)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                  )}
                  <defs>
                    <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[2]} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={COLORS[2]} stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
            <div className="card">
              <h3 className="card-title">Mest instabila kostnaderna</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>De räkningar som pendlar mest i pris historiskt.</p>
              {volatileBills.length > 0 ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {volatileBills.map((b, idx) => (
                    <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: COLORS[idx % COLORS.length] }}>{b.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Mellan {Math.round(b.min).toLocaleString('sv-SE')} och {Math.round(b.max).toLocaleString('sv-SE')} kr</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pendlar med</div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{Math.round(b.volatility).toLocaleString('sv-SE')} kr</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Inget tillräckligt underlag än.</div>
              )}
            </div>

            <div className="card">
              <h3 className="card-title">Genomsnittlig Fördelning</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Dina kostnaders totala snitt-uppdelning.</p>
              {pieData.length > 0 ? (
                <div style={{ height: 250, width: '100%' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} fill="#8884d8" paddingAngle={5} dataKey="value" stroke="none">
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Inget tillräckligt underlag än.</div>
              )}
            </div>
          </div>

          {loanStats.length > 0 && (
            <div className="card" style={{ marginBottom: '2rem' }}>
              <h3 className="card-title">💳 Lån & Skulder</h3>
              <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1rem' }}>
                {loanStats.map(loan => (
                  <div key={loan.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 'bold' }}>{loan.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {Math.round(loan.paidSoFar).toLocaleString('sv-SE')} kr betalt av {Math.round(loan.totalDebt!).toLocaleString('sv-SE')} kr
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '14px', background: 'rgba(255,255,255,0.1)', borderRadius: '7px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${loan.progress}%`, 
                        background: loan.progress >= 100 ? 'var(--success-color)' : 'var(--accent-gradient)',
                        transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}></div>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: '0.75rem', fontWeight: 'bold', color: loan.progress >= 100 ? 'var(--success-color)' : 'var(--accent-color)' }}>
                      {loan.progress >= 100 ? '🎉 Fullt betald!' : `${Math.round(loan.remaining).toLocaleString('sv-SE')} kr kvar`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isPrivate && history.length > 0 && (
            <div className="card">
              <h3 className="card-title">Huskonto & Swish - Historik</h3>
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Månad</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Summa till Huskonto</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left', fontWeight: 'bold' }}>Swishar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.monthId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{formatMonthName(h.monthId)}</td>
                        <td style={{ padding: '1rem' }}>
                          <div>{Math.round(h.totalShared).toLocaleString('sv-SE')} kr</div>
                          {h.sharedDiff !== 0 && (
                            <div style={{ fontSize: '0.8rem', color: h.sharedDiff > 0 ? '#f43f5e' : '#10b981', marginTop: '0.2rem' }}>
                              {h.sharedDiff > 0 ? '▲ +' : '▼ '}{Math.round(h.sharedDiff).toLocaleString('sv-SE')} kr
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {h.result.swishes.map((s: any, i: number) => {
                            const fromName = state.accounts.find(a => a.id === s.fromId)?.name || s.fromId;
                            const toName = state.accounts.find(a => a.id === s.toId)?.name || s.toId;
                            return (
                              <div key={i} style={{ fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                                <span style={{ color: '#3b82f6', fontWeight: 600 }}>{fromName}</span> swishade <span style={{ color: '#10b981', fontWeight: 600 }}>{toName}</span>: {Math.round(s.amount).toLocaleString('sv-SE')} kr
                              </div>
                            );
                          })}
                          {h.result.swishes.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>Inga överföringar</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {sortedMonths.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '3rem', marginBottom: '1rem' }}>
          <button 
            onClick={handleLoadOlder}
            disabled={loadingOlder}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: 'var(--text-secondary)', 
              padding: '0.75rem 1.5rem', 
              borderRadius: '20px',
              cursor: loadingOlder ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => {
              if (!loadingOlder) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseOut={(e) => {
              if (!loadingOlder) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {loadingOlder ? 'Hämtar...' : `Hämta äldre år (${oldestYear - 1})`}
          </button>
        </div>
      )}
    </div>
  );
}

function InkomstUtgiftView({ state, user: realUser, sortedMonths }: { state: any, user: any, sortedMonths: string[] }) {
  const isDemoMode = useStore(s => s.isDemoMode);
  const user = isDemoMode && !realUser ? { id: 'demo_user_1', email: 'demo@smartekonomi.se' } : realUser;
  
  if (!user) return null;

  const myProfile = state.householdProfiles?.find((p: any) => p.id === user.id);
  const selectedAccountId = myProfile?.person_account_id;
  
  const personAccounts = state.accounts.filter((a: any) => a.type === 'person');
  const selectedAccount = personAccounts.find((a: any) => a.id === selectedAccountId);

  if (!selectedAccount) {
    return (
      <div style={{ animation: 'fadeIn 0.3s ease', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
         <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Inget personkonto kopplat</h3>
         <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
           För att kunna räkna ut din personliga "Kvar att leva på" behöver systemet veta vilket konto i hushållet som är ditt.
         </p>
         <p style={{ color: 'var(--text-secondary)' }}>
           <strong>Be en grundare eller medägare att gå in på "Mina sidor" och koppla ditt personkonto till dig i medlemslistan.</strong>
         </p>
      </div>
    );
  }

  // Bygg upp tidsdata
  const timeData = [...sortedMonths].map(monthId => {
    let totalIncome = 0;
    if (state.monthlySalaries) {
      const [mYear, mMonth] = monthId.split('-').map(Number);
      let payYear = mYear;
      let payMonth = mMonth - 1;
      if (payMonth === 0) {
        payMonth = 12;
        payYear -= 1;
      }
      const payMonthStr = `${payYear}-${String(payMonth).padStart(2, '0')}`;
      
      state.monthlySalaries.forEach((s: any) => {
        if (s.userId === user.id && s.payDate.startsWith(payMonthStr)) {
          totalIncome += s.amount;
        }
      });
    }

    const sharedRes = calculateMonth(state, monthId);
    
    let incomingSwish = 0;
    let outgoingSwish = 0;
    sharedRes.swishes.forEach((t: any) => {
      if (t.toId === selectedAccountId) incomingSwish += t.amount;
      if (t.fromId === selectedAccountId) outgoingSwish += t.amount;
    });

    totalIncome += incomingSwish;

    let totalExpense = 0;

    if (state.privateMonths?.[monthId]) {
      const pm = state.privateMonths[monthId];
      const activePrivate = (state.privateBills || []).filter((b: any) => b.userId === user.id && !b.isArchived);
      activePrivate.forEach((b: any) => {
        const amt = pm.billAmounts?.[b.id] !== undefined ? pm.billAmounts[b.id] : b.defaultAmount;
        totalExpense += amt;
      });
    }

    const m = state.months[monthId];
    if (m) {
      const activeShared = state.bills.filter((b: any) => !b.isArchived);
      activeShared.forEach((b: any) => {
        if (b.accountId === selectedAccountId) {
          const amt = m.billAmounts?.[b.id] !== undefined ? m.billAmounts[b.id] : b.defaultAmount;
          totalExpense += amt;
        }
      });
    }

    if (sharedRes.transfersToShared[selectedAccountId]) {
      Object.values(sharedRes.transfersToShared[selectedAccountId]).forEach((amt: any) => {
        if (amt > 0) totalExpense += amt;
      });
    }

    totalExpense += outgoingSwish;

    const leftover = totalIncome - totalExpense;

    const [year, month] = monthId.split('-');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
    const name = `${monthNames[parseInt(month, 10) - 1]} '${year.substring(2)}`;

    return { monthId, name, Inkomst: totalIncome, Utgift: totalExpense, Kvar: leftover };
  });

  const avgIncome = timeData.length > 0 ? timeData.reduce((sum, d) => sum + d.Inkomst, 0) / timeData.length : 0;
  const avgUtgift = timeData.length > 0 ? timeData.reduce((sum, d) => sum + d.Utgift, 0) / timeData.length : 0;
  const avgKvar = timeData.length > 0 ? timeData.reduce((sum, d) => sum + d.Kvar, 0) / timeData.length : 0;

  const currentData = timeData.length > 0 ? timeData[timeData.length - 1] : null;
  const prevData = timeData.length > 1 ? timeData[timeData.length - 2] : null;

  const renderTrend = (key: 'Inkomst' | 'Utgift' | 'Kvar', invertColors = false) => {
    if (!currentData) return null;
    const current = currentData[key];
    const prev = prevData ? prevData[key] : current;
    const diff = current - prev;
    
    if (diff === 0) return <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Oförändrad sedan förra månaden</div>;
    
    const isIncrease = diff > 0;
    let color = isIncrease ? '#10b981' : '#f43f5e';
    if (invertColors) color = isIncrease ? '#f43f5e' : '#10b981';
    
    const sign = isIncrease ? '▲ +' : '▼ ';
    return <div style={{ fontSize: '0.9rem', color, marginTop: '0.25rem', fontWeight: 500 }}>{sign}{Math.abs(diff).toLocaleString('sv-SE')} kr jämfört med fg. månad</div>;
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>💡 Hur fungerar uträkningen?</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', margin: 0 }}>
          Den här kalkylen räknar fram exakt hur mycket pengar du har kvar att leva på varje månad. Den tittar på din <strong style={{color: 'var(--text-primary)'}}>månadslön</strong> plus de pengar du <strong style={{color: 'var(--text-primary)'}}>får via Swish</strong>, vilket utgör din totala inkomst. Från detta dras dina <strong style={{color: 'var(--text-primary)'}}>privata räkningar</strong>, de <strong style={{color: 'var(--text-primary)'}}>gemensamma räkningarna som dras från ditt konto</strong>, överföringar till huskontot, samt Swish ut. Resten är dina fickpengar!
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card stat-card" style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
          <div className="icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>💵</div>
          <div className="info">
            <h3>Snittinkomst</h3>
            <div className="value" style={{ color: '#10b981' }}>{Math.round(avgIncome).toLocaleString('sv-SE')} kr</div>
          </div>
        </div>
        <div className="card stat-card" style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
          <div className="icon" style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e' }}>📉</div>
          <div className="info">
            <h3>Snittutgift</h3>
            <div className="value" style={{ color: '#f43f5e' }}>{Math.round(avgUtgift).toLocaleString('sv-SE')} kr</div>
          </div>
        </div>
        <div className="card stat-card" style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
          <div className="icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>💰</div>
          <div className="info">
            <h3>Kvar i snitt</h3>
            <div className="value" style={{ color: '#3b82f6' }}>{Math.round(avgKvar).toLocaleString('sv-SE')} kr</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>💰 Inkomst över tid</h3>
            {currentData && (
              <>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{currentData.Inkomst.toLocaleString('sv-SE')} kr</div>
                {renderTrend('Inkomst')}
              </>
            )}
          </div>
          <div style={{ height: 200, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={timeData} margin={{ top: 30, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Inkomst" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="Inkomst" position="top" fill="var(--text-primary)" fontSize={12} formatter={(val: any) => `${Number(val).toLocaleString('sv-SE')} kr`} offset={10} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#f43f5e', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📉 Utgifter över tid</h3>
            {currentData && (
              <>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{currentData.Utgift.toLocaleString('sv-SE')} kr</div>
                {renderTrend('Utgift', true)}
              </>
            )}
          </div>
          <div style={{ height: 200, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={timeData} margin={{ top: 30, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Utgift" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="Utgift" position="top" fill="var(--text-primary)" fontSize={12} formatter={(val: any) => `${Number(val).toLocaleString('sv-SE')} kr`} offset={10} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#3b82f6', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>✨ Kvar att leva på</h3>
            {currentData && (
              <>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{currentData.Kvar.toLocaleString('sv-SE')} kr</div>
                {renderTrend('Kvar')}
              </>
            )}
          </div>
          <div style={{ height: 200, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={timeData} margin={{ top: 30, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="Kvar" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="Kvar" position="top" fill="var(--text-primary)" fontSize={12} formatter={(val: any) => `${Number(val).toLocaleString('sv-SE')} kr`} offset={10} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Månad</th>
              <th style={{ padding: '1rem', color: '#10b981', fontWeight: 600 }}>Inkomst</th>
              <th style={{ padding: '1rem', color: '#f43f5e', fontWeight: 600 }}>Utgift</th>
              <th style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Kvar att leva på</th>
            </tr>
          </thead>
          <tbody>
            {[...timeData].reverse().map(d => {
              const isPositive = d.Kvar >= 0;
              return (
                <tr key={d.monthId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '1rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>{d.monthId}</td>
                  <td style={{ padding: '1rem', color: '#10b981' }}>{Math.round(d.Inkomst).toLocaleString('sv-SE')} kr</td>
                  <td style={{ padding: '1rem', color: '#f43f5e' }}>{Math.round(d.Utgift).toLocaleString('sv-SE')} kr</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold', color: isPositive ? '#10b981' : '#f43f5e', fontSize: '1.1rem' }}>
                    {isPositive ? '+' : ''}{Math.round(d.Kvar).toLocaleString('sv-SE')} kr
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
