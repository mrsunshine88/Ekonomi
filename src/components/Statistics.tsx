import { useState } from 'react';
import { calculateMonth } from '../store';
import { useAuth } from '../AuthContext';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { exportToExcel } from '../excel';

import { useStore } from '../store';

const COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#f43f5e', '#06b6d4'];

const formatMonthName = (monthId: string) => {
  const [year, month] = monthId.split('-');
  const monthNames = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
  return `${monthNames[parseInt(month, 10) - 1]} ${year}`;
};

export default function Statistics() {
  const state = useStore(s => s.state);
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'shared' | 'private'>('shared');

  const isPrivate = viewMode === 'private';
  const rawMonthsObj = isPrivate ? (state.privateMonths || {}) : state.months;
  
  // 1. DATA FILTERING: Only include locked/handled months
  const validMonths = Object.keys(rawMonthsObj).filter(monthId => {
    if (isPrivate) {
      return (rawMonthsObj[monthId] as any).isLocked === true;
    } else {
      const handled = rawMonthsObj[monthId].handledPayments || {};
      return Object.values(handled).some(v => v === true);
    }
  });
  
  const sortedMonths = validMonths.sort();
  
  const activeBills = isPrivate 
    ? (state.privateBills || []).filter(b => b.userId === user?.id && !b.isArchived) 
    : state.bills.filter(b => !b.isArchived);

  // 1. Time Series Data (for Bar & Line charts)
  const timeData = sortedMonths.map(monthId => {
    const m = rawMonthsObj[monthId];
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
    const amounts = lastMonth.billAmounts || {};
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
      const amounts = rawMonthsObj[mId].billAmounts || {};
      const amt = amounts[b.id] !== undefined ? amounts[b.id] : b.defaultAmount;
      if (amt > 0) { 
        if (amt < min) min = amt;
        if (amt > max) max = amt;
      }
    });
    const volatility = (max === -Infinity || min === Infinity) ? 0 : max - min;
    return { name: b.name, volatility };
  }).filter(b => b.volatility > 0).sort((a, b) => b.volatility - a.volatility).slice(0, 5);

  // Calculate Movers
  const diffs = activeBills.map(b => {
    const paidHistory = sortedMonths.map(mId => {
      const amounts = rawMonthsObj[mId].billAmounts || {};
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
      const amt = (m.billAmounts && m.billAmounts[loan.id]) !== undefined ? m.billAmounts[loan.id] : loan.defaultAmount;
      paidSoFar += amt;
    });
    
    return {
       ...loan,
       paidSoFar,
       remaining: Math.max(0, loan.totalDebt! - paidSoFar),
       progress: Math.min(100, (paidSoFar / loan.totalDebt!) * 100)
    };
  });

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

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => setViewMode('shared')}
          style={{ flex: 1, padding: '0.75rem', background: viewMode === 'shared' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: viewMode === 'shared' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: viewMode === 'shared' ? 'bold' : 'normal', transition: 'all 0.2s' }}
        >
          Gemensam Statistik
        </button>
        <button 
          onClick={() => setViewMode('private')}
          style={{ flex: 1, padding: '0.75rem', background: viewMode === 'private' ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)', color: viewMode === 'private' ? '#fff' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: viewMode === 'private' ? 'bold' : 'normal', transition: 'all 0.2s' }}
        >
          🔒 Privat Statistik
        </button>
      </div>

      {sortedMonths.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', marginTop: '2rem' }}>
          <h3 style={{ color: 'var(--text-secondary)' }}>Ingen statistik tillgänglig</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Statistik visas först efter att ni har markerat en månad som hanterad i huvudvyn.</p>
        </div>
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
                      <Bar key={acc.id} dataKey={acc.name} stackId="a" fill={COLORS[index % COLORS.length]} radius={index === state.accounts.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]} />
                    ))
                  ) : (
                    <Bar dataKey="Privat" stackId="a" fill="url(#colorUv)" radius={[6, 6, 0, 0]} />
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
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>De räkningar som pendlat mest i pris historiskt.</p>
              {volatileBills.length > 0 ? (
                <div style={{ height: 250, width: '100%', marginLeft: '-15px' }}>
                  <ResponsiveContainer>
                    <LineChart data={timeData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '1rem' }} />
                      {volatileBills.map((b, idx) => (
                        <Line key={b.name} type="monotone" dataKey={b.name} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
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
    </div>
  );
}
