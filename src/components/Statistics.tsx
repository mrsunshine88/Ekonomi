
import type { AppState } from '../types';
import { calculateMonth } from '../store';
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
  const sortedMonths = Object.keys(state.months).sort();

  // 1. Time Series Data (for Bar & Line charts)
  const timeData = sortedMonths.map(monthId => {
    const m = state.months[monthId];
    const amounts = m.billAmounts || {};
    
    const accountTotals: Record<string, number> = {};
    state.accounts.forEach(acc => accountTotals[acc.name] = 0);
    
    let total = 0;
    const billMap: any = {};
    
    state.bills.forEach(b => {
      const amt = amounts[b.id] !== undefined ? amounts[b.id] : b.defaultAmount;
      const acc = state.accounts.find(a => a.id === b.accountId);
      if (acc) {
        accountTotals[acc.name] += amt;
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
  const volatileBills = state.bills.map(b => {
    let min = Infinity;
    let max = -Infinity;
    sortedMonths.forEach(mId => {
      const amounts = state.months[mId].billAmounts || {};
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
  
  const diffs = state.bills.map(b => {
    // Find all amounts for this bill over time
    const paidHistory = sortedMonths.map(mId => {
      const amounts = state.months[mId].billAmounts || {};
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
  const pieData = state.accounts.map(acc => {
    let sum = 0;
    if (timeData.length > 0) {
      sum = timeData.reduce((accTotal, d) => accTotal + ((d as any)[acc.name] || 0), 0) / timeData.length;
    }
    return { name: acc.name, value: sum };
  }).filter(p => p.value > 0);

  // 5. History Tables Data
  const history = sortedMonths.map((monthId, idx) => {
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

  const detailedBills = state.bills.map(b => {
    const paidHistory = sortedMonths.map(mId => {
      const amounts = state.months[mId].billAmounts || {};
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ margin: 0 }}>EkonomiTB - Historisk Data</h2>
        <button 
          onClick={() => exportToExcel(state)}
          style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}
        >
          💾 Ladda ner Excel
        </button>
      </div>

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
                <tr key={h.monthId} style={{ transition: 'background 0.2s' }} className="table-row-hover">
                  <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>{formatMonthName(h.monthId)}</td>
                  <td style={tableCellStyle}>{h.totalShared.toLocaleString('sv-SE')} kr</td>
                  <td style={{ ...tableCellStyle, color: h.sharedDiff > 0 ? '#f43f5e' : h.sharedDiff < 0 ? '#10b981' : 'var(--text-secondary)', fontWeight: 'bold' }}>
                    {h.sharedDiff > 0 ? '+' : ''}{h.sharedDiff !== 0 ? `${h.sharedDiff.toLocaleString('sv-SE')} kr` : '-'}
                  </td>
                  <td style={tableCellStyle}>
                    {h.result.swishes.length > 0 ? h.result.swishes.map((s, j) => {
                      const fromPerson = state.accounts.find(a => a.id === s.fromId);
                      const toPerson = state.accounts.find(a => a.id === s.toId);
                      return (
                        <div key={j} style={{ textTransform: 'capitalize' }}>
                           {fromPerson?.name.replace(/ kontot?|konto/gi, '').trim()} swishade {toPerson?.name.replace(/ kontot?|konto/gi, '').trim()}: <strong style={{ color: 'var(--accent-color)' }}>{s.amount.toLocaleString('sv-SE')} kr</strong>
                        </div>
                      );
                    }) : <span style={{ color: 'var(--text-secondary)' }}>Inga swishar</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Alla Räkningar - Ökar eller Sjunker?</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Jämförelse mellan räkningens två senaste faktiska belopp. Sorterad på de som ökat mest.</p>
        
        <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
              <tr>
                <th style={tableHeaderStyle}>Räkning</th>
                <th style={tableHeaderStyle}>Senaste belopp</th>
                <th style={tableHeaderStyle}>Föregående belopp</th>
                <th style={tableHeaderStyle}>Prisskillnad</th>
              </tr>
            </thead>
            <tbody>
              {detailedBills.map((b, i) => (
                <tr key={i} style={{ transition: 'background 0.2s' }} className="table-row-hover">
                  <td style={{ ...tableCellStyle, fontWeight: 'bold' }}>{b.name}</td>
                  <td style={tableCellStyle}>{b.latest.toLocaleString('sv-SE')} kr</td>
                  <td style={{ ...tableCellStyle, color: 'var(--text-secondary)' }}>{b.previous > 0 ? `${b.previous.toLocaleString('sv-SE')} kr` : '-'}</td>
                  <td style={{ 
                    ...tableCellStyle, 
                    fontWeight: 'bold',
                    color: b.diff > 0 ? '#f43f5e' : b.diff < 0 ? '#10b981' : 'var(--text-secondary)' 
                  }}>
                    <span style={{ 
                      background: b.diff > 0 ? 'rgba(244, 63, 94, 0.15)' : b.diff < 0 ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      padding: b.diff !== 0 ? '0.2rem 0.6rem' : '0',
                      borderRadius: '4px'
                    }}>
                      {b.diff > 0 ? '+' : ''}{b.diff !== 0 ? `${b.diff.toLocaleString('sv-SE')} kr` : 'Oförändrad'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Månadens Vinnare & Förlorare (Grafer) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {moversData.length > 0 && (
          <div className="card">
            <h3 className="card-title">Snabb-överblick: Största skillnaderna</h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={moversData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="var(--text-secondary)" tickFormatter={(val) => `${val > 0 ? '+' : ''}${val} kr`} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" width={120} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="Skillnad" radius={[0, 4, 4, 0]}>
                    {moversData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.Skillnad > 0 ? '#f43f5e' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Genomsnittlig Fördelning */}
        <div className="card">
          <h3 className="card-title">Snittfördelning över året</h3>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ percent }) => percent !== undefined ? `${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#3b82f6" />
                  <Cell fill="#a855f7" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Rörliga Räkningar Trend */}
      {volatileBills.length > 0 && (
        <div className="card">
          <h3 className="card-title">De Mest Rörliga Räkningarna (Trend)</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Följ prisutvecklingen för de utgifter som varierar mest (t.ex. elen).</p>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <LineChart data={timeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" tickFormatter={(value) => `${value.toLocaleString('sv-SE')}`} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                {volatileBills.map((bill, index) => (
                  <Line key={bill.name} type="monotone" dataKey={bill.name} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}
