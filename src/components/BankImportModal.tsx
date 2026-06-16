import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { BankParseResult, ParsedBankRow } from '../utils/bankParser';
import type { Account, Profile } from '../types';

interface BankImportModalProps {
  parseResult: BankParseResult;
  accounts: Account[];
  profiles: Profile[];
  accounts: { id: string, name: string }[];
  profiles: { id: string, display_name?: string, email?: string }[];
  onConfirm: (selectedRows: ParsedBankRow[]) => void;
  onCancel: () => void;
  isPrivateMode?: boolean;
}

export default function BankImportModal({ parseResult, accounts, profiles, onConfirm, onCancel, isPrivateMode }: BankImportModalProps) {
  const [rows, setRows] = useState<ParsedBankRow[]>([
    ...parseResult.suggestedIncomes,
    ...parseResult.suggestedBills,
    ...parseResult.otherTransactions
  ]);
  
  const [showOther, setShowOther] = useState(false);
  const [filter, setFilter] = useState<'all' | 'new' | 'review'>('all');
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [learnRules, setLearnRules] = useState<Record<number, boolean>>({});

  const toggleExpand = (index: number) => {
    setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleToggleLearn = (index: number) => {
    setLearnRules(prev => {
      const current = prev[index] ?? true; // Default is true
      return { ...prev, [index]: !current };
    });
  };

  const handleToggleRow = (index: number) => {
    setRows(current => {
      const next = [...current];
      if (next[index].isIncoming) {
        const willBeSelected = !next[index].selectedAsIncome;
        next[index] = { 
          ...next[index], 
          selectedAsIncome: willBeSelected,
          selectedUserId: willBeSelected && !next[index].selectedUserId && profiles.length > 0 ? profiles[0].id : next[index].selectedUserId
        };
      } else {
        const willBeSelected = !next[index].selectedAsBill;
        next[index] = { 
          ...next[index], 
          selectedAsBill: willBeSelected,
          selectedAccountId: willBeSelected 
            ? (next[index].selectedAccountId || (isPrivateMode ? 'private' : (accounts.length > 0 ? accounts[0].id : null)))
            : next[index].selectedAccountId
        };
      }
      return next;
    });
  };

  const handleAccountChange = (index: number, accountId: string) => {
    setRows(current => {
      const next = [...current];
      next[index] = { ...next[index], selectedAccountId: accountId };
      return next;
    });
  };

  const handleUserChange = (index: number, userId: string) => {
    setRows(current => {
      const next = [...current];
      next[index] = { ...next[index], selectedUserId: userId };
      return next;
    });
  };

  const handleConfirm = () => {
    // Return rows with their learnRule preference embedded, so ManageBills knows whether to save the rule
    const selected = rows.filter(r => 
      (r.selectedAsBill && r.selectedAccountId) || 
      (r.selectedAsIncome && r.selectedUserId)
    ).map(r => {
       const originalIndex = rows.findIndex(x => x === r);
       return {
         ...r,
         shouldLearnRule: isPrivateMode ? false : (learnRules[originalIndex] ?? true)
       };
    });
    onConfirm(selected);
  };

  const suggestedIncomeRows = rows.filter(r => r.isSuggestedIncome);
  const suggestedBillRows = rows.filter(r => r.isSuggestedBill);
  const otherRows = rows.filter(r => !r.isSuggestedBill && !r.isSuggestedIncome);
  
  const selectedCount = rows.filter(r => r.selectedAsBill || r.selectedAsIncome).length;
  const autoRecognizedCount = rows.filter(r => r.matchLevel === 'confirmed' || r.matchLevel === 'new_discovery').length;
  const needsReviewCount = rows.filter(r => r.matchLevel === 'needs_review').length;

  const filteredIncomes = suggestedIncomeRows.filter(r => {
    if (filter === 'new') return r.matchLevel === 'new_discovery';
    if (filter === 'review') return r.matchLevel === 'needs_review';
    return true;
  });

  const filteredBills = suggestedBillRows.filter(r => {
    if (filter === 'new') return r.matchLevel === 'new_discovery';
    if (filter === 'review') return r.matchLevel === 'needs_review';
    return true;
  });

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 100000, padding: '2rem'
    }}>
      <div style={{ 
        background: 'rgba(30, 41, 59, 0.95)', 
        border: '1px solid rgba(16, 185, 129, 0.3)', 
        borderRadius: '16px', 
        padding: '2rem', 
        maxWidth: '800px', 
        width: '100%', 
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', margin: 0 }}>Granska bankimport</h2>
          <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
          {/* Summary Box */}
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🧠 SmartEkonomi hittade {autoRecognizedCount} återkommande betalningar automatiskt.
            </h3>
            {needsReviewCount > 0 && (
              <p style={{ color: '#fbbf24', margin: '0.5rem 0 0 0', fontWeight: 'bold' }}>
                {needsReviewCount} behöver granskas.
              </p>
            )}
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              ({parseResult.summary.otherCount} okända övriga transaktioner ignoreras)
            </p>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <button 
              onClick={() => setFilter('all')}
              style={{ background: filter === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent', border: filter === 'all' ? '1px solid var(--border-color)' : '1px solid transparent', color: filter === 'all' ? '#fff' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              Alla
            </button>
            <button 
              onClick={() => setFilter('new')}
              style={{ background: filter === 'new' ? 'rgba(167, 139, 250, 0.2)' : 'transparent', border: filter === 'new' ? '1px solid #a78bfa' : '1px solid transparent', color: filter === 'new' ? '#a78bfa' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              Nya upptäckter
            </button>
            <button 
              onClick={() => setFilter('review')}
              style={{ background: filter === 'review' ? 'rgba(251, 191, 36, 0.2)' : 'transparent', border: filter === 'review' ? '1px solid #fbbf24' : '1px solid transparent', color: filter === 'review' ? '#fbbf24' : 'var(--text-secondary)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              Behöver granskas
            </button>
          </div>

          {/* Suggested Incomes */}
          {filteredIncomes.length > 0 && (
            <>
              <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Föreslagna inkomster (Lön / Utbetalningar)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                {filteredIncomes.map((row, idx) => {
                  const originalIndex = rows.findIndex(r => r === row);
                  const isExpanded = expandedRows[originalIndex];
                  const learnChecked = learnRules[originalIndex] ?? true;
                  
                  let bgColor = 'rgba(255,255,255,0.03)';
                  let borderColor = 'transparent';
                  let iconColor = 'var(--text-secondary)';
                  let statusText = '';
                  
                  if (row.matchLevel === 'confirmed') {
                    bgColor = row.selectedAsIncome ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)';
                    borderColor = row.selectedAsIncome ? 'rgba(16, 185, 129, 0.3)' : 'transparent';
                    iconColor = '#10b981';
                    statusText = '🟢 Bekräftad';
                  } else if (row.matchLevel === 'already_imported') {
                    bgColor = 'rgba(255,255,255,0.02)';
                    borderColor = 'rgba(255,255,255,0.05)';
                    iconColor = '#9ca3af';
                    statusText = '✅ Redan inlagd';
                  } else if (row.matchLevel === 'new_discovery') {
                    bgColor = row.selectedAsIncome ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255,255,255,0.03)';
                    borderColor = row.selectedAsIncome ? 'rgba(167, 139, 250, 0.4)' : 'transparent';
                    iconColor = '#a78bfa';
                    statusText = '🟣 Ny upptäckt';
                  } else if (row.matchLevel === 'needs_review') {
                    bgColor = row.selectedAsIncome ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.05)';
                    borderColor = row.selectedAsIncome ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.2)';
                    iconColor = '#fbbf24';
                    statusText = '🟡 Behöver granskas';
                  }

                  return (
                    <div key={idx} style={{ 
                      display: 'flex', flexDirection: 'column', gap: '0.5rem',
                      background: bgColor, 
                      border: `1px solid ${borderColor}`,
                      padding: '1rem', borderRadius: '8px',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 2fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={row.selectedAsIncome}
                          onChange={() => handleToggleRow(originalIndex)}
                          style={{ cursor: 'pointer', width: '1.2rem', height: '1.2rem', accentColor: iconColor }}
                        />
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>{row.rawDescription}</div>
                          <div style={{ fontSize: '0.85rem', color: iconColor, marginTop: '0.2rem', fontWeight: '500' }}>
                            {statusText}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#3b82f6' }}>
                          +{row.amount.toLocaleString('sv-SE')} kr
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tillhör person:</div>
                          <select 
                            value={row.selectedUserId || ''}
                            onChange={(e) => handleUserChange(originalIndex, e.target.value)}
                            style={{ 
                              width: '100%', padding: '0.4rem', borderRadius: '4px', 
                              background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--border-color)',
                              fontSize: '0.9rem'
                            }}
                          >
                            <option value="" disabled>Välj person...</option>
                            {profiles.map(p => (
                              <option key={p.id} value={p.id}>{p.display_name || p.email}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Lär appen & Visa varför */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem', marginLeft: '2.2rem' }}>
                        <button 
                          onClick={() => toggleExpand(originalIndex)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {isExpanded ? '▲ Dölj varför' : '▼ Visa varför'}
                        </button>
                        
                        {row.selectedAsIncome && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={learnChecked}
                                onChange={() => handleToggleLearn(originalIndex)}
                                style={{ cursor: 'pointer' }}
                              />
                              Lär SmartEkonomi att detta är rätt person
                            </label>
                            {!learnChecked && (
                              <span style={{ fontSize: '0.75rem', color: '#f87171' }}>
                                SmartEkonomi kommer inte lära sig av valet.
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Visa varför detaljer */}
                      {isExpanded && (
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', marginLeft: '2.2rem', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div><strong>Ursprunglig text:</strong> {row.rawDescription}</div>
                          {row.aliasMatched && (
                            <div><strong>Alias-matchning:</strong> {row.aliasMatched}</div>
                          )}
                          {!row.aliasMatched && (
                            <div><strong>Normaliserad text:</strong> {row.normalizedDescription}</div>
                          )}
                          <div><strong>Matchad via:</strong> <span style={{ color: '#fff' }}>{row.matchedVia}</span></div>
                          
                          {row.matchLevel === 'confirmed' && row.historicalMin !== undefined && row.historicalMax !== undefined && (
                            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: row.isAmountNormal ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', borderRadius: '6px', border: row.isAmountNormal ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)', color: row.isAmountNormal ? '#10b981' : '#f43f5e' }}>
                              {row.isAmountNormal ? (
                                <>✓ Beloppet ligger inom normalt intervall (Tidigare betalningar: {row.historicalMin}–{row.historicalMax} kr)</>
                              ) : (
                                <>⚠ Beloppet avviker från tidigare betalningar (Normalt intervall: {row.historicalMin}–{row.historicalMax} kr. Nu: {row.amount} kr)</>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Suggested Bills */}
          {filteredBills.length > 0 && (
            <>
              <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginTop: '2rem' }}>
                Föreslagna räkningar
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                {filteredBills.map((row, idx) => {
                  const originalIndex = rows.findIndex(r => r === row);
                  const isExpanded = expandedRows[originalIndex];
                  const learnChecked = learnRules[originalIndex] ?? true;
                  
                  let bgColor = 'rgba(255,255,255,0.03)';
                  let borderColor = 'transparent';
                  let iconColor = 'var(--text-secondary)';
                  let statusText = '';
                  
                  if (row.matchLevel === 'confirmed') {
                    bgColor = row.selectedAsBill ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)';
                    borderColor = row.selectedAsBill ? 'rgba(16, 185, 129, 0.3)' : 'transparent';
                    iconColor = '#10b981';
                    statusText = '🟢 Bekräftad';
                  } else if (row.matchLevel === 'already_imported') {
                    bgColor = 'rgba(255,255,255,0.02)';
                    borderColor = 'rgba(255,255,255,0.05)';
                    iconColor = '#9ca3af';
                    statusText = '✅ Redan inlagd';
                  } else if (row.matchLevel === 'new_discovery') {
                    bgColor = row.selectedAsBill ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255,255,255,0.03)';
                    borderColor = row.selectedAsBill ? 'rgba(167, 139, 250, 0.4)' : 'transparent';
                    iconColor = '#a78bfa';
                    statusText = '🟣 Ny upptäckt';
                  } else if (row.matchLevel === 'needs_review') {
                    bgColor = row.selectedAsBill ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.05)';
                    borderColor = row.selectedAsBill ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.2)';
                    iconColor = '#fbbf24';
                    statusText = '🟡 Behöver granskas';
                  }
                  
                  return (
                    <div key={idx} style={{ 
                      display: 'flex', flexDirection: 'column', gap: '0.5rem',
                      background: bgColor, 
                      border: `1px solid ${borderColor}`,
                      padding: '1rem', borderRadius: '8px',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 2fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={row.selectedAsBill}
                          onChange={() => handleToggleRow(originalIndex)}
                          style={{ cursor: 'pointer', width: '1.2rem', height: '1.2rem', accentColor: iconColor }}
                        />
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>{row.rawDescription}</div>
                          <div style={{ fontSize: '0.85rem', color: iconColor, marginTop: '0.2rem', fontWeight: '500' }}>
                            {statusText}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                          -{row.amount.toLocaleString('sv-SE')} kr
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            {isPrivateMode ? 'Typ:' : 'Föreslaget konto:'}
                          </div>
                          {isPrivateMode ? (
                            <div style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: '#e2e8f0', fontSize: '0.9rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                              Privat utgift
                            </div>
                          ) : (
                            <select 
                              value={row.selectedAccountId || ''}
                              onChange={(e) => handleAccountChange(originalIndex, e.target.value)}
                              style={{ 
                                width: '100%', padding: '0.4rem', borderRadius: '4px', 
                                background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid var(--border-color)',
                                fontSize: '0.9rem'
                              }}
                            >
                              <option value="" disabled>Välj konto...</option>
                              {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>

                      {/* Lär appen & Visa varför */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem', marginLeft: '2.2rem' }}>
                        <button 
                          onClick={() => toggleExpand(originalIndex)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {isExpanded ? '▲ Dölj varför' : '▼ Visa varför'}
                        </button>
                        
                        {row.selectedAsBill && !isPrivateMode && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={learnChecked}
                                onChange={() => handleToggleLearn(originalIndex)}
                                style={{ cursor: 'pointer' }}
                              />
                              Lär SmartEkonomi att detta är rätt konto
                            </label>
                            {!learnChecked && (
                              <span style={{ fontSize: '0.75rem', color: '#f87171' }}>
                                SmartEkonomi kommer inte lära sig av valet.
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Visa varför detaljer */}
                      {isExpanded && (
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', marginLeft: '2.2rem', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div><strong>Ursprunglig text:</strong> {row.rawDescription}</div>
                          {row.aliasMatched && (
                            <div><strong>Alias-matchning:</strong> {row.aliasMatched}</div>
                          )}
                          {!row.aliasMatched && (
                            <div><strong>Normaliserad text:</strong> {row.normalizedDescription}</div>
                          )}
                          <div><strong>Matchad via:</strong> <span style={{ color: '#fff' }}>{row.matchedVia}</span></div>
                          
                          {row.matchLevel === 'confirmed' && row.historicalMin !== undefined && row.historicalMax !== undefined && (
                            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: row.isAmountNormal ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', borderRadius: '6px', border: row.isAmountNormal ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)', color: row.isAmountNormal ? '#10b981' : '#f43f5e' }}>
                              {row.isAmountNormal ? (
                                <>✓ Beloppet ligger inom normalt intervall (Tidigare betalningar: {row.historicalMin}–{row.historicalMax} kr)</>
                              ) : (
                                <>⚠ Beloppet avviker från tidigare betalningar (Normalt intervall: {row.historicalMin}–{row.historicalMax} kr. Nu: {row.amount} kr)</>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Other Transactions */}
          <div style={{ marginTop: '2rem' }}>
            <button 
              onClick={() => setShowOther(!showOther)}
              style={{ 
                background: 'transparent', border: '1px solid var(--border-color)', 
                color: 'var(--text-secondary)', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'center'
              }}
            >
              {showOther ? 'Dölj övriga transaktioner' : `Visa ${otherRows.length} övriga transaktioner`}
              <span style={{ transform: showOther ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>
            
            {showOther && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                {otherRows.map((row, idx) => {
                  const originalIndex = rows.findIndex(r => r === row);
                  const isSelected = row.isIncoming ? row.selectedAsIncome : row.selectedAsBill;
                  const accentColor = row.isIncoming ? '#3b82f6' : '#10b981';
                  const bgClass = isSelected 
                    ? (row.isIncoming ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)') 
                    : 'rgba(255,255,255,0.02)';
                  const borderClass = isSelected 
                    ? (row.isIncoming ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)') 
                    : 'transparent';

                  return (
                    <div key={idx} style={{ 
                      display: 'grid', gridTemplateColumns: 'auto 2fr 1fr 1fr', gap: '1rem', alignItems: 'center',
                      background: bgClass, 
                      border: '1px solid', borderColor: borderClass,
                      padding: '0.5rem 1rem', borderRadius: '8px',
                      opacity: isSelected ? 1 : 0.7
                    }}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => handleToggleRow(originalIndex)}
                        style={{ cursor: 'pointer', width: '1rem', height: '1rem', accentColor }}
                      />
                      <div>
                        <div style={{ color: '#e2e8f0' }}>{row.rawDescription}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.date}</div>
                      </div>
                      <div style={{ textAlign: 'right', color: row.isIncoming ? '#3b82f6' : '#e2e8f0' }}>
                        {row.isIncoming ? '+' : '-'}{row.amount} kr
                      </div>
                      {isSelected && (
                        <div>
                          {row.isIncoming ? (
                            <select 
                              value={row.selectedUserId || ''}
                              onChange={(e) => handleUserChange(originalIndex, e.target.value)}
                              style={{ 
                                width: '100%', padding: '0.3rem', borderRadius: '4px', 
                                background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid var(--border-color)',
                                fontSize: '0.8rem'
                              }}
                            >
                              <option value="" disabled>Välj person...</option>
                              {profiles.map(p => (
                                <option key={p.id} value={p.id}>{p.display_name || p.email}</option>
                              ))}
                            </select>
                          ) : (
                            isPrivateMode ? (
                              <div style={{ padding: '0.3rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: '#e2e8f0', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                Privat utgift
                              </div>
                            ) : (
                              <select 
                                value={row.selectedAccountId || ''}
                                onChange={(e) => handleAccountChange(originalIndex, e.target.value)}
                                style={{ 
                                  width: '100%', padding: '0.3rem', borderRadius: '4px', 
                                  background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid var(--border-color)',
                                  fontSize: '0.8rem'
                                }}
                              >
                                <option value="" disabled>Välj konto...</option>
                                {accounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                              </select>
                            )
                          )}
                          {!isPrivateMode && (
                            <div style={{ marginTop: '0.5rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input 
                                  type="checkbox" 
                                  checked={learnRules[originalIndex] ?? true}
                                  onChange={() => handleToggleLearn(originalIndex)}
                                  style={{ cursor: 'pointer' }}
                                />
                                Lär SmartEkonomi detta
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
          <button 
            onClick={onCancel}
            style={{ 
              flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--border-color)', 
              color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' 
            }}
          >
            Avbryt
          </button>
          <button 
            onClick={handleConfirm}
            disabled={selectedCount === 0}
            style={{ 
              flex: 2, padding: '1rem', background: selectedCount > 0 ? '#10b981' : 'rgba(16, 185, 129, 0.3)', 
              border: 'none', color: '#fff', borderRadius: '8px', cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
              fontWeight: 'bold', fontSize: '1rem', transition: 'background 0.2s'
            }}
          >
            Importera valda ({selectedCount} st)
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
