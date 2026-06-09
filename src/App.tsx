import React, { useState, useEffect } from 'react';
import { useStore, calculateMonth } from './store';
import { useAuth } from './AuthContext';
import MonthView from './components/MonthView';
import Summary from './components/Summary';
import ManageBills from './components/ManageBills';
import Statistics from './components/Statistics';
import LoginScreen from './components/Auth/LoginScreen';
import MyPages from './components/MyPages';

function App() {
  const { user, householdId, loading } = useAuth();
  const { state, updateBillAmount, addBill, removeBill, updateBill, addAccount, removeAccount, updateAccount, copyFromPreviousMonth, togglePaymentStatus, confirmAnomaly, unlockAccount } = useStore(householdId);
  const [currentView, setCurrentView] = useState<'month' | 'stats' | 'manage' | 'mypages'>('month');
  
  // Defaults to current month YYYY-MM
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthNames = [
    "Januari", "Februari", "Mars", "April", "Maj", "Juni", 
    "Juli", "Augusti", "September", "Oktober", "November", "December"
  ];

  const getMonthDisplay = (monthId: string) => {
    const [year, month] = monthId.split('-');
    const m = parseInt(month, 10);
    return `${monthNames[m - 1]} ${year}`;
  };

  const changeMonth = (delta: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    let newDate = new Date(year, month - 1 + delta, 1);
    const newId = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newId);
  };

  const calcResult = calculateMonth(state, currentMonth);

  useEffect(() => {
    // Solo mode: no redirect needed if no householdId
  }, [user, householdId, currentView]);

  if (loading) return <div style={{ color: 'white', padding: '2rem', textAlign: 'center' }}>Laddar...</div>;

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="container">
      <header className="header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, marginBottom: '0.5rem' }}>Ekonomi & Swish</h1>
          <p style={{ margin: 0 }}>Automatisk uträkning av hushållets räkningar</p>
        </div>
        <nav className="nav-container">
          <button 
            onClick={() => setCurrentView('month')} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'month' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'month' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'month' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            📅 Månadsvy
          </button>
          <button 
            onClick={() => setCurrentView('stats')} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'stats' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'stats' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'stats' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            📊 EkonomiTB
          </button>
          <button 
            onClick={() => setCurrentView('manage')} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'manage' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'manage' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'manage' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            ⚙️ Inställningar
          </button>
          <button 
            onClick={() => setCurrentView('mypages')} 
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', background: currentView === 'mypages' ? 'var(--accent-gradient)' : 'transparent', color: currentView === 'mypages' ? 'white' : 'var(--text-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: currentView === 'mypages' ? 'bold' : 'normal', transition: 'all 0.2s' }}
          >
            👤 Mina sidor
          </button>
        </nav>
      </header>

      {currentView === 'mypages' ? (
        <div>
          <button className="back-button" onClick={() => setCurrentView('month')}>← Tillbaka till Månadsvy</button>
          <MyPages />
        </div>
      ) : currentView === 'manage' ? (
        <div>
          <button className="back-button" onClick={() => setCurrentView('month')}>← Tillbaka till Månadsvy</button>
          <ManageBills 
            state={state} 
            onAddBill={addBill} 
            onRemoveBill={removeBill} 
            onUpdateBill={updateBill} 
            onAddAccount={addAccount}
            onRemoveAccount={removeAccount}
            onUpdateAccount={updateAccount}
            onUnlockAccount={unlockAccount}
          />
        </div>
      ) : currentView === 'stats' ? (
        <div>
          <button className="back-button" onClick={() => setCurrentView('month')}>← Tillbaka till Månadsvy</button>
          <Statistics state={state} />
        </div>
      ) : (
        <>
          <div className="month-selector">
            <button onClick={() => changeMonth(-1)}>← Föregående</button>
            <button className="primary" style={{ cursor: 'default' }}>{getMonthDisplay(currentMonth)}</button>
            <button onClick={() => changeMonth(1)}>Nästa →</button>
          </div>

          <Summary 
            state={state}
            result={calcResult} 
            monthData={state.months[currentMonth] || { monthId: currentMonth, billAmounts: {} }}
            onToggleStatus={(paymentId) => togglePaymentStatus(currentMonth, paymentId)}
          />

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            {Object.values(state.months[currentMonth]?.handledPayments || {}).some(v => v) ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'inline-block' }}>
                🔒 Vissa betalningar är låsta. Lås upp för att kunna hämta historik.
              </div>
            ) : (
              <button 
                onClick={() => copyFromPreviousMonth(currentMonth)}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', background: 'var(--surface-color)' }}
              >
                📄 Hämta siffror från förra månaden
              </button>
            )}
          </div>

          <MonthView 
            state={state}
            currentMonth={currentMonth}
            onChangeAmount={(billId, amount) => updateBillAmount(currentMonth, billId, amount)} 
            onConfirmAnomaly={(billId) => confirmAnomaly(currentMonth, billId)}
          />
        </>
      )}
    </div>
  );
}

export default App;
