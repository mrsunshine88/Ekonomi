import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { supabase } from '../supabase';
import AdminChat from './AdminChat';

export default function AdminDashboard() {
  const paywallActive = useStore(s => s.state.paywallActive);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [stripeSecret, setStripeSecret] = useState('');
  const [stripeWebhook, setStripeWebhook] = useState('');
  const [stripePriceId, setStripePriceId] = useState('');
  const [vipEmail, setVipEmail] = useState('');
  const [vipList, setVipList] = useState<string[]>([]);
  const [stats, setStats] = useState<{ total_members: number, active_households: number } | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);
  const [stripeReason, setStripeReason] = useState<string | null>(null);

  const [systemAdmins, setSystemAdmins] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const [contactCompany, setContactCompany] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');

  const [showCompany, setShowCompany] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  
  const [loginDemoEnabled, setLoginDemoEnabled] = useState(false);

  const fetchVipList = async () => {
    try {
      const { data, error } = await supabase.rpc('get_vip_emails');
      if (error) throw error;
      setVipList((data || []).map((row: any) => row.email).filter((e: string) => e !== 'apersson508@gmail.com'));
    } catch (e: any) {
      console.error("Kunde inte hämta VIP-lista", e);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_stats');
      if (error) throw error;
      if (data && data.length > 0) {
        setStats({ total_members: data[0].total_members, active_households: data[0].active_households });
      }
    } catch (e: any) {
      console.error("Kunde inte hämta admin-statistik", e);
    }
  };

  const fetchContactSettings = async () => {
    try {
      const { data } = await supabase.from('global_settings').select('key, value');
      if (data) {
        setContactCompany(data.find(d => d.key === 'contact_company')?.value || '');
        setContactEmail(data.find(d => d.key === 'contact_email')?.value || '');
        setContactPhone(data.find(d => d.key === 'contact_phone')?.value || '');
        setContactAddress(data.find(d => d.key === 'contact_address')?.value || '');
        
        setShowCompany(data.find(d => d.key === 'show_contact_company')?.value !== 'false');
        setShowEmail(data.find(d => d.key === 'show_contact_email')?.value !== 'false');
        setShowPhone(data.find(d => d.key === 'show_contact_phone')?.value !== 'false');
        setShowAddress(data.find(d => d.key === 'show_contact_address')?.value !== 'false');
        
        setLoginDemoEnabled(data.find(d => d.key === 'login_demo_enabled')?.value === 'true');
      }
    } catch (e: any) {
      console.error("Kunde inte hämta kontaktuppgifter", e);
    }
  };

  const fetchStripeStatus = async () => {
    try {
      const res = await fetch('/api/check-stripe');
      const json = await res.json();
      setStripeConfigured(json.active);
      if (!json.active && json.reason) {
        setStripeReason(json.reason);
      } else {
        setStripeReason(null);
      }
    } catch (e) {
      console.error("Kunde inte hämta stripe-status via Vercel", e);
      setStripeConfigured(false);
      setStripeReason('Network error');
    }
  };

  const fetchSystemAdmins = async () => {
    try {
      const { data, error } = await supabase.rpc('get_system_admins');
      if (error) throw error;
      setSystemAdmins((data || []).map((row: any) => row.email).filter((e: string) => e !== 'apersson508@gmail.com'));
    } catch (e: any) {
      console.error("Kunde inte hämta system admins", e);
    }
  };

  useEffect(() => {
    fetchVipList();
    fetchStats();
    fetchContactSettings();
    fetchStripeStatus();
    fetchSystemAdmins();
  }, []);

  const handleTogglePaywall = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('toggle_paywall', { is_active: !paywallActive });
      if (error) throw error;
      useStore.setState(s => ({ state: { ...s.state, paywallActive: !paywallActive } }));
      setMsg(paywallActive ? '✅ Betalväggen är nu AV.' : '🚨 Betalväggen är nu PÅ! Alla nya (och icke-VIP) kommer att tvingas betala.');
    } catch (e: any) {
      setMsg('❌ Admin Fel: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLoginDemo = async () => {
    setLoading(true);
    try {
      const newValue = !loginDemoEnabled;
      const { error } = await supabase.rpc('set_global_setting', { setting_key: 'login_demo_enabled', setting_value: newValue.toString() });
      if (error) throw error;
      setLoginDemoEnabled(newValue);
      setMsg(newValue ? '✅ Demoläge på inloggningssidan är PÅ.' : '❌ Demoläge på inloggningssidan är AV.');
    } catch (e: any) {
      setMsg('❌ Admin Fel: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantVip = async () => {
    if (!vipEmail) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('set_household_vip_by_email', { target_email: vipEmail });
      if (error) throw error;
      setMsg(`👑 ${vipEmail} har nu VIP-status (Gratis för alltid)!`);
      setVipEmail('');
      await fetchVipList();
    } catch (e: any) {
      setMsg('❌ Admin Fel: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeVip = async (emailToRevoke: string = vipEmail) => {
    if (!emailToRevoke) return;
    if (!window.confirm(`Är du säker på att du vill ta bort VIP-statusen för ${emailToRevoke}?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('revoke_household_vip_by_email', { target_email: emailToRevoke });
      if (error) throw error;
      setMsg(`📉 VIP-status borttagen för ${emailToRevoke}.`);
      if (emailToRevoke === vipEmail) setVipEmail('');
      await fetchVipList();
    } catch (e: any) {
      setMsg('❌ Admin Fel: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('add_system_admin', { target_email: newAdminEmail });
      if (error) throw error;
      if (data && data !== 'Success') {
        setMsg(`ℹ️ ${data}`);
      } else {
        setMsg(`👑 ${newAdminEmail} är nu en systemadministratör!`);
        setNewAdminEmail('');
        await fetchSystemAdmins();
      }
    } catch (e: any) {
      setMsg('❌ Admin Fel: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (emailToRemove: string) => {
    if (!window.confirm(`Är du säker på att du vill ta bort administratörsrättigheterna för ${emailToRemove}?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('remove_system_admin', { target_email: emailToRemove });
      if (error) throw error;
      setMsg(`📉 Administratörsrättigheter borttagna för ${emailToRemove}.`);
      await fetchSystemAdmins();
    } catch (e: any) {
      setMsg('❌ Admin Fel: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecrets = async () => {
    setLoading(true);
    try {
      if (stripeSecret) await supabase.rpc('set_admin_secret', { secret_key: 'STRIPE_SECRET_KEY', secret_value: stripeSecret });
      if (stripeWebhook) await supabase.rpc('set_admin_secret', { secret_key: 'STRIPE_WEBHOOK_SECRET', secret_value: stripeWebhook });
      if (stripePriceId) await supabase.rpc('set_admin_secret', { secret_key: 'STRIPE_PRICE_ID', secret_value: stripePriceId });
      
      setMsg('🔒 Hemligheterna har nu sparats djupt ner i kassavalvet!');
      setStripeSecret('');
      setStripeWebhook('');
      setStripePriceId('');
      await fetchStripeStatus();
    } catch (e: any) {
      setMsg('❌ Kunde inte spara nycklar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContactInfo = async () => {
    setLoading(true);
    try {
      const calls = [
        supabase.rpc('set_global_setting', { setting_key: 'contact_company', setting_value: contactCompany }),
        supabase.rpc('set_global_setting', { setting_key: 'contact_email', setting_value: contactEmail }),
        supabase.rpc('set_global_setting', { setting_key: 'contact_phone', setting_value: contactPhone }),
        supabase.rpc('set_global_setting', { setting_key: 'contact_address', setting_value: contactAddress }),
        supabase.rpc('set_global_setting', { setting_key: 'show_contact_company', setting_value: showCompany.toString() }),
        supabase.rpc('set_global_setting', { setting_key: 'show_contact_email', setting_value: showEmail.toString() }),
        supabase.rpc('set_global_setting', { setting_key: 'show_contact_phone', setting_value: showPhone.toString() }),
        supabase.rpc('set_global_setting', { setting_key: 'show_contact_address', setting_value: showAddress.toString() })
      ];
      
      const results = await Promise.all(calls);
      for (const res of results) {
        if (res.error) throw res.error;
      }
      
      setMsg('📞 Kontaktuppgifter sparades!');
    } catch (e: any) {
      setMsg('❌ Kunde inte spara kontaktuppgifter: ' + (e.message || JSON.stringify(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ color: '#f43f5e', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>👑 System Admin</h2>
      
      {stats && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{stats.total_members}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Totala Medlemmar</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💎</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{stats.active_households}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Betalande Hushåll</div>
          </div>
        </div>
      )}

      {msg && <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', borderLeft: '4px solid #f43f5e', color: '#fff' }}>{msg}</div>}

      <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
        <AdminChat />
      </div>

      <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
        <h3 style={{ marginBottom: '1rem' }}>Global Master Switch</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>Betalvägg (Stripe)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {paywallActive ? 'PÅ! Nya användare slussas till Stripe.' : 'AV! Appen är helt gratis.'}
            </div>
          </div>
          <button 
            onClick={handleTogglePaywall}
            disabled={loading}
            style={{ 
              background: paywallActive ? 'var(--success-color)' : '#f43f5e', 
              color: '#fff', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {loading ? '...' : (paywallActive ? 'Avaktivera Betalvägg' : 'Aktivera Betalvägg')}
          </button>
        </div>
        
        <div style={{ height: '1px', background: 'var(--border-color)', margin: '1.5rem 0' }}></div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 'bold' }}>Testkörningsknapp (Demoläge på Inloggningsskärm)</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {loginDemoEnabled ? 'PÅ! Besökare kan testa appen direkt.' : 'AV! Endast inloggade kan använda appen.'}
            </div>
          </div>
          <button 
            onClick={handleToggleLoginDemo}
            disabled={loading}
            style={{ 
              background: loginDemoEnabled ? 'var(--success-color)' : 'var(--surface-color)', 
              color: '#fff', border: '1px solid var(--border-color)', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {loading ? '...' : (loginDemoEnabled ? 'Dölj Demo-knapp' : 'Visa Demo-knapp')}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>VIP-Kunder</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Ge ett hushåll gratis tillgång för alltid.</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <input 
            type="email" 
            placeholder="E-postadress..." 
            value={vipEmail} 
            onChange={e => setVipEmail(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff', minWidth: '200px' }}
          />
          <button 
            onClick={handleGrantVip} 
            disabled={loading || !vipEmail} 
            style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Ge VIP
          </button>
        </div>

        {vipList.length > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ marginBottom: '1rem', color: '#fff' }}>👑 Aktiva VIP-konton</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {vipList.map(email => (
                <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ color: '#fff' }}>{email}</span>
                  <button onClick={() => handleRevokeVip(email)} disabled={loading} style={{ background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Ta bort</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Administratörer</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Lägg till fler som ska ha tillgång till denna admin-panel. (Superadmin 'apersson508' är alltid inbyggd och osynlig i denna lista).</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <input 
            type="email" 
            placeholder="E-postadress..." 
            value={newAdminEmail} 
            onChange={e => setNewAdminEmail(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff', minWidth: '200px' }}
          />
          <button 
            onClick={handleAddAdmin} 
            disabled={loading || !newAdminEmail} 
            style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Gör till admin
          </button>
        </div>

        {systemAdmins.length > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ marginBottom: '1rem', color: '#fff' }}>🛡️ Aktiva Administratörer</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {systemAdmins.map(email => (
                <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '8px' }}>
                  <span style={{ color: '#fff' }}>{email}</span>
                  <button onClick={() => handleRemoveAdmin(email)} disabled={loading} style={{ background: 'transparent', border: '1px solid #f43f5e', color: '#f43f5e', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Ta bort</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Kontaktuppgifter (Sidfot)</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Dessa uppgifter visas när användare klickar på "Kontakt" längst ner på sidan.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Företagsnamn</label>
            <input 
              type="text" 
              value={contactCompany}
              onChange={e => setContactCompany(e.target.value)}
              placeholder="Ex: SmartEkonomi AB"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={showCompany} onChange={e => setShowCompany(e.target.checked)} id="show_comp" />
              <label htmlFor="show_comp" style={{ fontSize: '0.85rem' }}>Visa på hemsidan</label>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>E-postadress</label>
            <input 
              type="email" 
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              placeholder="Ex: info@exempel.se"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={showEmail} onChange={e => setShowEmail(e.target.checked)} id="show_email" />
              <label htmlFor="show_email" style={{ fontSize: '0.85rem' }}>Visa på hemsidan</label>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Telefonnummer</label>
            <input 
              type="text" 
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              placeholder="Ex: 070-123 45 67"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={showPhone} onChange={e => setShowPhone(e.target.checked)} id="show_phone" />
              <label htmlFor="show_phone" style={{ fontSize: '0.85rem' }}>Visa på hemsidan</label>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Adress</label>
            <input 
              type="text" 
              value={contactAddress}
              onChange={e => setContactAddress(e.target.value)}
              placeholder="Ex: Storgatan 1"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={showAddress} onChange={e => setShowAddress(e.target.checked)} id="show_address" />
              <label htmlFor="show_address" style={{ fontSize: '0.85rem' }}>Visa på hemsidan</label>
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleSaveContactInfo}
          disabled={loading}
          style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Sparar...' : 'Spara Kontaktuppgifter'}
        </button>
      </div>

      <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
        <h3 style={{ color: '#f43f5e', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          Stripe Kassavalv (Hemliga Nycklar)
        </h3>
        
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ fontWeight: 'bold', color: '#fff' }}>Status på integration:</span>
          {stripeConfigured === null ? (
            <span style={{ color: 'var(--text-secondary)' }}>Laddar...</span>
          ) : stripeConfigured ? (
            <span style={{ background: 'var(--success-color)', color: 'white', fontWeight: 'bold', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem' }}>
              🟢 AKTIVT & INKOPPLAT
            </span>
          ) : (
            <span style={{ background: '#f43f5e', color: 'white', fontWeight: 'bold', padding: '0.4rem 0.8rem', borderRadius: '4px', fontSize: '0.9rem' }}>
              🔴 INTE AKTIVT {stripeReason ? `(Fel: ${stripeReason})` : '(Inga nycklar hittades)'}
            </span>
          )}
        </div>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Nycklarna sparas i en dold databastabell. När de väl är sparade visas de aldrig igen i klartext för säkerhets skull.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Stripe Secret Key (sk_live_...)</label>
            <input 
              type="password" 
              value={stripeSecret}
              onChange={e => setStripeSecret(e.target.value)}
              placeholder="Skriv över befintlig nyckel..."
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Stripe Webhook Secret (whsec_...)</label>
            <input 
              type="password" 
              value={stripeWebhook}
              onChange={e => setStripeWebhook(e.target.value)}
              placeholder="Skriv över befintlig nyckel..."
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Stripe Price ID (price_...)</label>
            <input 
              type="text" 
              value={stripePriceId}
              onChange={e => setStripePriceId(e.target.value)}
              placeholder="Ex: price_1xyz..."
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
          </div>
        </div>

        <button 
          onClick={handleSaveSecrets}
          disabled={loading || (!stripeSecret && !stripeWebhook && !stripePriceId)}
          style={{ width: '100%', padding: '1rem', background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Spara nycklar säkert i kassavalvet
        </button>
      </div>
    </div>
  );
}
