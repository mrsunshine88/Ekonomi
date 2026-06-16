import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { BankParseResult, ParsedBankRow } from '../utils/bankParser';
import type { Account, Profile } from '../types';

interface BankImportModalProps {
  parseResult: BankParseResult;
  accounts: Account[];
  profiles: Profile[];
  onConfirm: (selectedRows: ParsedBankRow[]) => void;
  onCancel: () => void;
}

export default function BankImportModal({ parseResult, accounts, profiles, onConfirm, onCancel }: BankImportModalProps) {
  const [rows, setRows] = useState<ParsedBankRow[]>([
    ...parseResult.suggestedIncomes,
    ...parseResult.suggestedBills,
    ...parseResult.otherTransactions
  ]);
  
  const [showOther, setShowOther] = useState(false);

  const handleToggleRow = (index: number) => {
    setRows(current => {
      const next = [...current];
      if (next[index].isIncoming) {
        next[index] = { ...next[index], selectedAsIncome: !next[index].selectedAsIncome };
      } else {
        next[index] = { ...next[index], selectedAsBill: !next[index].selectedAsBill };
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
    // Only return rows that are selected AND have a valid target
    const selected = rows.filter(r => 
      (r.selectedAsBill && r.selectedAccountId) || 
      (r.selectedAsIncome && r.selectedUserId)
    );
    onConfirm(selected);
  };

  const suggestedIncomeRows = rows.filter(r => r.isSuggestedIncome);
  const suggestedBillRows = rows.filter(r => r.isSuggestedBill);
  const otherRows = rows.filter(r => !r.isSuggestedBill && !r.isSuggestedIncome);
  
  const selectedCount = rows.filter(r => r.selectedAsBill || r.selectedAsIncome).length;

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
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem' }}>
            <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '1rem', fontSize: '1.2rem' }}>Sammanfattning</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#e2e8f0' }}>
              {parseResult.summary.suggestedIncomesCount > 0 && (
                <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#10b981' }}>✓</span> 
                  Vi hittade {parseResult.summary.suggestedIncomesCount} inkommande utbetalning(ar)
                </li>
              )}
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> 
                Vi hittade {parseResult.summary.suggestedCount} föreslagna räkningar 
                <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>(varav {parseResult.summary.recognizedSuggestedCount} känns igen)</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> 
                {parseResult.summary.otherCount} övriga transaktioner
              </li>
            </ul>
          </div>

          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            SmartEkonomi kommer ihåg dina val och blir smartare för varje import.
          </p>

          {/* Suggested Incomes */}
          {suggestedIncomeRows.length > 0 && (
            <>
              <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Föreslagna inkomster (Lön / Utbetalningar)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                {suggestedIncomeRows.map((row, idx) => {
                  const originalIndex = rows.findIndex(r => r === row);
                  const isVeryConfident = row.confidenceScore >= 80;
                  
                  return (
                    <div key={idx} style={{ 
                      display: 'grid', gridTemplateColumns: 'auto 2fr 1fr 1fr', gap: '1rem', alignItems: 'center',
                      background: row.selectedAsIncome ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)', 
                      border: '1px solid', borderColor: row.selectedAsIncome ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                      padding: '0.75rem 1rem', borderRadius: '8px',
                      transition: 'all 0.2s'
                    }}>
                      <input 
                        type="checkbox" 
                        checked={row.selectedAsIncome}
                        onChange={() => handleToggleRow(originalIndex)}
                        style={{ cursor: 'pointer', width: '1.2rem', height: '1.2rem', accentColor: '#3b82f6' }}
                      />
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{row.rawDescription}</div>
                        {isVeryConfident ? (
                          <div style={{ fontSize: '0.8rem', color: '#3b82f6', display: 'flex', gap: '4px', alignItems: 'center' }}>
                            ✨ Sannolikt en inkomst ({row.confidenceScore}%)
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Säkerhet: {row.confidenceScore}%
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#3b82f6' }}>
                        +{row.amount} kr
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Tillhör person:</div>
                        <select 
                          value={row.selectedUserId || ''}
                          onChange={(e) => handleUserChange(originalIndex, e.target.value)}
                          style={{ 
                            width: '100%', padding: '0.4rem', borderRadius: '4px', 
                            background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid var(--border-color)',
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
                  );
                })}
              </div>
            </>
          )}

          {/* Suggested Bills */}
          <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Föreslagna räkningar
          </h3>
          {suggestedBillRows.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>Inga räkningar hittades automatiskt denna gång.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
              {suggestedBillRows.map((row, idx) => {
                const originalIndex = rows.findIndex(r => r === row);
                const isVeryConfident = row.confidenceScore >= 80;
                
                return (
                  <div key={idx} style={{ 
                    display: 'grid', gridTemplateColumns: 'auto 2fr 1fr 1fr', gap: '1rem', alignItems: 'center',
                    background: row.selectedAsBill ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)', 
                    border: '1px solid', borderColor: row.selectedAsBill ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                    padding: '0.75rem 1rem', borderRadius: '8px',
                    transition: 'all 0.2s'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={row.selectedAsBill}
                      onChange={() => handleToggleRow(originalIndex)}
                      style={{ cursor: 'pointer', width: '1.2rem', height: '1.2rem', accentColor: '#10b981' }}
                    />
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>{row.rawDescription}</div>
                      {isVeryConfident ? (
                        <div style={{ fontSize: '0.8rem', color: '#10b981', display: 'flex', gap: '4px', alignItems: 'center' }}>
                          ✨ Vi är ganska säkra på denna ({row.confidenceScore}%)
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Säkerhet: {row.confidenceScore}%
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>
                      -{row.amount} kr
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>Dras från konto:</div>
                      <select 
                        value={row.selectedAccountId || ''}
                        onChange={(e) => handleAccountChange(originalIndex, e.target.value)}
                        style={{ 
                          width: '100%', padding: '0.4rem', borderRadius: '4px', 
                          background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid var(--border-color)',
                          fontSize: '0.9rem'
                        }}
                      >
                        <option value="" disabled>Välj konto...</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
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
