import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { supabase } from '../supabase';
import AdminChat from './AdminChat';

// ─── Funnel config ──────────────────────────────────────────────────────────
const FUNNEL_STEPS = [
  { event: 'page_view',           label: 'Besök',              icon: '🌐', color: '#6366f1' },
  { event: 'demo_start',          label: 'Startade Demo',      icon: '🛠️', color: '#8b5cf6' },
  { event: 'register_start',      label: 'Öppnade Registrering', icon: '📝', color: '#a855f7' },
  { event: 'register_complete',   label: 'Konto skapat',       icon: '✅', color: '#10b981' },
  { event: 'bank_upload_complete',label: 'Laddade upp bankfil', icon: '🏦', color: '#3b82f6' },
  { event: 'onboarding_complete', label: 'Slutförde Onboarding',icon: '🎉', color: '#f59e0b' },
  { event: 'premium_complete',    label: 'Blev betalande',     icon: '💎', color: '#f43f5e' },
] as const;

export default function AdminDashboard() {
  const paywallActive = useStore(s => s.state.paywallActive);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{message: string, onConfirm: () => void} | null>(null);
  
  const [stripeSecret, setStripeSecret] = useState('');
  const [stripeWebhook, setStripeWebhook] = useState('');
  const [stripePriceId, setStripePriceId] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [stats, setStats] = useState<{ 
    total_members: number, 
    active_households: number, 
    unique_visitors_today?: number, 
    total_page_views_today?: number,
    demo_unique_today?: number,
    demo_views_today?: number,
    unique_visitors_yesterday?: number,
    total_page_views_yesterday?: number,
    demo_unique_yesterday?: number,
    demo_views_yesterday?: number,
    unique_visitors_this_week?: number,
    total_page_views_this_week?: number,
    demo_unique_this_week?: number,
    demo_views_this_week?: number,
    unique_visitors_this_month?: number,
    total_page_views_this_month?: number,
    demo_unique_this_month?: number,
    demo_views_this_month?: number,
    unconfirmed_users?: number
  } | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);
  const [stripeReason, setStripeReason] = useState<string | null>(null);

  

  const [contactCompany, setContactCompany] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactAddress, setContactAddress] = useState('');

  const [showCompany, setShowCompany] = useState(true);
  const [showEmail, setShowEmail] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  
  const [loginDemoEnabled, setLoginDemoEnabled] = useState(false);
  
  // Funnel state
  type FunnelPeriod = '7d' | '30d' | 'all';
  const [funnelPeriod, setFunnelPeriod] = useState<FunnelPeriod>('30d');
  const [funnelData, setFunnelData] = useState<Record<string, number>>({});
  const [funnelLoading, setFunnelLoading] = useState(false);

  // Dölj meddelanden automatiskt efter 5 sekunder
  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const fetchMembersList = async () => {
    try {
      const { data, error } = await supabase.rpc('admin_get_all_users');
      if (error) throw error;
      setMembersList(data || []);
    } catch (e: unknown) {
      console.error("Kunde inte hämta medlemmar", e);
    }
  };

  const fetchFunnel = async (period: '7d' | '30d' | 'all') => {
    setFunnelLoading(true);
    try {
      let query = supabase
        .from('funnel_events')
        .select('event, session_id');
      
      if (period !== 'all') {
        const days = period === '7d' ? 7 : 30;
        const from = new Date(Date.now() - days * 86400000).toISOString();
        query = query.gte('created_at', from);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Räkna unika sessioner per event
      const counts: Record<string, Set<string>> = {};
      (data || []).forEach((row: { event: string; session_id: string }) => {
        if (!counts[row.event]) counts[row.event] = new Set();
        counts[row.event].add(row.session_id);
      });
      const result: Record<string, number> = {};
      Object.entries(counts).forEach(([k, v]) => { result[k] = v.size; });
      setFunnelData(result);
    } catch (e) {
      console.error('Kunde inte hämta funnel-data', e);
    } finally {
      setFunnelLoading(false);
    }
  };

  useEffect(() => { fetchFunnel(funnelPeriod); }, [funnelPeriod]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_stats');
      if (error) throw error;
      if (data && data.length > 0) {
        setStats({ 
          total_members: data[0].total_members, 
          active_households: data[0].active_households,
          unique_visitors_today: data[0].unique_visitors_today,
          total_page_views_today: data[0].total_page_views_today,
          demo_unique_today: data[0].demo_unique_today,
          demo_views_today: data[0].demo_views_today,
          unique_visitors_yesterday: data[0].unique_visitors_yesterday,
          total_page_views_yesterday: data[0].total_page_views_yesterday,
          demo_unique_yesterday: data[0].demo_unique_yesterday,
          demo_views_yesterday: data[0].demo_views_yesterday,
          unique_visitors_this_week: data[0].unique_visitors_this_week,
          total_page_views_this_week: data[0].total_page_views_this_week,
          demo_unique_this_week: data[0].demo_unique_this_week,
          demo_views_this_week: data[0].demo_views_this_week,
          unique_visitors_this_month: data[0].unique_visitors_this_month,
          total_page_views_this_month: data[0].total_page_views_this_month,
          demo_unique_this_month: data[0].demo_unique_this_month,
          demo_views_this_month: data[0].demo_views_this_month,
          unconfirmed_users: data[0].unconfirmed_users
        });
      }
    } catch (e: unknown) {
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
    } catch (e: unknown) {
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

  useEffect(() => {
    fetchMembersList();
    fetchStats();
    fetchContactSettings();
    fetchStripeStatus();
  }, []);

  useEffect(() => {
    if (showMembersModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showMembersModal]);

  const handleTogglePaywall = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('toggle_paywall', { is_active: !paywallActive });
      if (error) throw error;
      useStore.setState(s => ({ state: { ...s.state, paywallActive: !paywallActive } }));
      setMsg(paywallActive ? '✅ Betalväggen är nu AV.' : '🚨 Betalväggen är nu PÅ! Alla nya (och icke-VIP) kommer att tvingas betala.');
    } catch (e: unknown) {
      setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
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
    } catch (e: unknown) {
      setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVip = async (email: string, isVip: boolean) => {
    setLoading(true);
    try {
      const rpcName = isVip ? 'revoke_household_vip_by_email' : 'set_household_vip_by_email';
      const { error } = await supabase.rpc(rpcName, { target_email: email });
      if (error) throw error;
      setMsg(isVip ? `📉 VIP-status borttagen för ${email}.` : `👑 ${email} har nu VIP-status!`);
      await fetchMembersList();
    } catch (e: unknown) {
      setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (email: string, isAdmin: boolean) => {
    if (email === 'apersson508@gmail.com') return;
    setLoading(true);
    try {
      const rpcName = isAdmin ? 'remove_system_admin' : 'add_system_admin';
      const { data, error } = await supabase.rpc(rpcName, { target_email: email });
      if (error) throw error;
      if (data && data !== 'Success') setMsg(`ℹ️ ${data}`);
      else setMsg(isAdmin ? `📉 Administratörsrättigheter borttagna för ${email}.` : `👑 ${email} är nu admin!`);
      await fetchMembersList();
    } catch (e: unknown) {
      setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async (id: string, isBanned: boolean) => {
    setConfirmDialog({
      message: `Är du säker på att du vill ${isBanned ? 'låsa upp' : 'blockera'} denna användare?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          const { error } = await supabase.rpc('admin_ban_user', { target_user_id: id, ban: !isBanned });
          if (error) throw error;
          setMsg(`🔒 Användaren har ${isBanned ? 'låsts upp' : 'blockerats'}.`);
          await fetchMembersList();
        } catch (e: unknown) {
          setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleDeleteUser = async (id: string, email: string) => {
    setConfirmDialog({
      message: `Varning! Är du HELT SÄKER på att du vill radera ${email} permanent från databasen?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          const { error } = await supabase.rpc('admin_delete_user', { target_user_id: id });
          if (error) throw error;
          setMsg(`🗑️ Användaren ${email} är raderad.`);
          await fetchMembersList();
          await fetchStats();
        } catch (e: unknown) {
          setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
          setLoading(false);
        }
      }
    });
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
    } catch (e: unknown) {
      setMsg('❌ Kunde inte spara nycklar: ' + (e instanceof Error ? e.message : String(e)));
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
    } catch (e: unknown) {
      setMsg('❌ Kunde inte spara kontaktuppgifter: ' + ((e instanceof Error ? e.message : String(e)) || JSON.stringify(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ color: '#f43f5e', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>👑 System Admin</h2>
      
      {stats && (
        <>
          {/* General Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div 
              onClick={() => setShowMembersModal(true)}
              style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{stats.total_members}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Totala Medlemmar (Klicka)</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💎</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{stats.active_households}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Betalande Hushåll</div>
            </div>
            <div style={{ background: 'rgba(244, 63, 94, 0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📧</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f43f5e' }}>{stats.unconfirmed_users || 0}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Obekräftade E-post</div>
            </div>
          </div>

          {/* Visitor Stats */}
          <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📊</span> Besöksstatistik
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              
              {/* Idag */}
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <div style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Idag</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>👁️ Unika</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.unique_visitors_today || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📈 Visningar</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.total_page_views_today || 0}</span>
                </div>
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🛠️ Demo Unika</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.demo_unique_today || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🛠️ Demo Visn.</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.demo_views_today || 0}</span>
                  </div>
                </div>
              </div>

              {/* Igår */}
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Igår</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>👁️ Unika</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.unique_visitors_yesterday || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📈 Visningar</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.total_page_views_yesterday || 0}</span>
                </div>
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🛠️ Demo Unika</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.demo_unique_yesterday || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🛠️ Demo Visn.</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.demo_views_yesterday || 0}</span>
                  </div>
                </div>
              </div>

              {/* Vecka */}
              <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                <div style={{ fontSize: '0.9rem', color: '#a855f7', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Denna Veckan</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>👁️ Unika</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.unique_visitors_this_week || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📈 Visningar</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.total_page_views_this_week || 0}</span>
                </div>
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(168, 85, 247, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🛠️ Demo Unika</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.demo_unique_this_week || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🛠️ Demo Visn.</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.demo_views_this_week || 0}</span>
                  </div>
                </div>
              </div>

              {/* Månad */}
              <div style={{ background: 'rgba(244, 63, 94, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                <div style={{ fontSize: '0.9rem', color: '#f43f5e', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Denna Månaden</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>👁️ Unika</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.unique_visitors_this_month || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>📈 Visningar</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.total_page_views_this_month || 0}</span>
                </div>
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(244, 63, 94, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🛠️ Demo Unika</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.demo_unique_this_month || 0}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>🛠️ Demo Visn.</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{stats.demo_views_this_month || 0}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ─── FUNNEL DASHBOARD ──────────────────────────────────────── */}
      <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(99,102,241,0.05)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📈</span> Konverteringsfunnel
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['7d', '30d', 'all'] as const).map(p => (
              <button
                key={p}
                onClick={() => setFunnelPeriod(p)}
                style={{
                  padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600,
                  borderRadius: '0.5rem', cursor: 'pointer', border: 'none',
                  background: funnelPeriod === p ? '#6366f1' : 'rgba(255,255,255,0.08)',
                  color: funnelPeriod === p ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                {p === '7d' ? '7 dagar' : p === '30d' ? '30 dagar' : 'Totalt'}
              </button>
            ))}
            <button
              onClick={() => fetchFunnel(funnelPeriod)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '0.5rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--text-secondary)' }}
            >
              🔄
            </button>
          </div>
        </div>

        {funnelLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Laddar funnel-data...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FUNNEL_STEPS.map((step, i) => {
              const count = funnelData[step.event] || 0;
              const topCount = funnelData[FUNNEL_STEPS[0].event] || 1;
              const prevCount = i > 0 ? (funnelData[FUNNEL_STEPS[i - 1].event] || 0) : count;
              const pctOfTop = topCount > 0 ? Math.round((count / topCount) * 100) : 0;
              const pctOfPrev = prevCount > 0 && i > 0 ? Math.round((count / prevCount) * 100) : null;
              const barWidth = topCount > 0 ? (count / topCount) * 100 : 0;
              const isWorstDropoff = i > 0 && pctOfPrev !== null && pctOfPrev < 40;

              return (
                <div key={step.event}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '1rem', width: '1.5rem', textAlign: 'center' }}>{step.icon}</span>
                    <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {step.label}
                    </span>
                    <span style={{ fontWeight: 700, color: '#fff', fontSize: '1rem', minWidth: '2.5rem', textAlign: 'right' }}>{count}</span>
                    <span style={{ fontSize: '0.78rem', minWidth: '3.5rem', textAlign: 'right', color: count === 0 ? 'rgba(255,255,255,0.2)' : 'var(--text-secondary)' }}>
                      ({pctOfTop}%)
                    </span>
                    {pctOfPrev !== null && (
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 700, minWidth: '4rem', textAlign: 'right',
                        color: isWorstDropoff ? '#f43f5e' : pctOfPrev >= 70 ? '#10b981' : '#f59e0b'
                      }}>
                        {isWorstDropoff ? '⚠️ ' : ''}{pctOfPrev}% av föreg.
                      </span>
                    )}
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', marginLeft: '2.25rem' }}>
                    <div style={{
                      height: '100%',
                      width: `${barWidth}%`,
                      background: step.color,
                      borderRadius: '4px',
                      transition: 'width 0.6s ease',
                      boxShadow: `0 0 8px ${step.color}66`
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Störst drop-off */}
        {!funnelLoading && (() => {
          let worst = { label: '', drop: 100, prev: 0, curr: 0 };
          FUNNEL_STEPS.forEach((step, i) => {
            if (i === 0) return;
            const curr = funnelData[step.event] || 0;
            const prev = funnelData[FUNNEL_STEPS[i - 1].event] || 0;
            if (prev === 0) return;
            const pct = Math.round((curr / prev) * 100);
            if (pct < worst.drop) worst = { label: `${FUNNEL_STEPS[i-1].label} → ${step.label}`, drop: pct, prev, curr };
          });
          if (worst.drop === 100 || worst.prev === 0) return null;
          return (
            <div style={{ marginTop: '1.25rem', padding: '0.875rem 1rem', background: 'rgba(244,63,94,0.08)', borderRadius: '0.75rem', border: '1px solid rgba(244,63,94,0.25)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#f43f5e', fontSize: '0.9rem' }}>Störst drop-off</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  {worst.label} — {worst.prev} → {worst.curr} ({worst.drop}% fortsatte)
                </div>
              </div>
            </div>
          );
        })()}
      </div>
      {/* ───────────────────────────────────────────────────────────── */}

      {msg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000000, padding: '1rem 2rem', background: 'rgba(0,0,0,0.9)', borderRadius: '8px', borderBottom: '4px solid #f43f5e', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', fontWeight: 'bold', textAlign: 'center', minWidth: '300px' }}>
          {msg}
        </div>
      )}

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

      {/* VIP & Admin UI replaced by MembersModal */}
      
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
      
      {showMembersModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 100000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: '900px', maxHeight: '90vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>👥 Medlemslista</h2>
              <button onClick={() => setShowMembersModal(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
              <input 
                type="text" 
                placeholder="🔍 Filtrera på e-post..." 
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              {membersList.filter(m => m.email.toLowerCase().includes(memberSearch.toLowerCase())).map(m => (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: m.is_banned ? '4px solid #f43f5e' : '4px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: m.is_banned ? '#f43f5e' : '#fff' }}>
                        {m.email} {m.is_banned && '(BLOCKERAD)'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Senast inloggad: {m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString('sv-SE') : 'Aldrig'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-start' }}>
                      <button 
                        onClick={() => handleToggleVip(m.email, m.is_vip)}
                        disabled={loading}
                        style={{ flex: '1 1 45%', background: m.is_vip ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)', color: m.is_vip ? '#10b981' : '#fff', border: `1px solid ${m.is_vip ? '#10b981' : 'transparent'}`, padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', display: m.email === 'apersson508@gmail.com' ? 'none' : 'block' }}
                      >
                        {m.is_vip ? '💎 VIP' : 'Gör till VIP'}
                      </button>
                      <button 
                        onClick={() => handleToggleAdmin(m.email, m.is_admin)}
                        disabled={loading || m.email === 'apersson508@gmail.com'}
                        style={{ flex: '1 1 45%', background: m.is_admin ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.1)', color: m.is_admin ? '#a855f7' : '#fff', border: `1px solid ${m.is_admin ? '#a855f7' : 'transparent'}`, padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', display: m.email === 'apersson508@gmail.com' ? 'none' : 'block' }}
                      >
                        {m.is_admin ? '👑 Admin' : 'Gör till Admin'}
                      </button>
                      <button 
                        onClick={() => handleToggleBan(m.id, m.is_banned)}
                        disabled={loading || m.email === 'apersson508@gmail.com'}
                        style={{ flex: '1 1 45%', background: m.is_banned ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255,255,255,0.1)', color: m.is_banned ? '#f43f5e' : '#fff', border: `1px solid ${m.is_banned ? '#f43f5e' : 'transparent'}`, padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', display: m.email === 'apersson508@gmail.com' ? 'none' : 'block' }}
                      >
                        {m.is_banned ? 'Lås upp' : 'Blockera'}
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(m.id, m.email)}
                        disabled={loading || m.email === 'apersson508@gmail.com'}
                        style={{ flex: '1 1 45%', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem', display: m.email === 'apersson508@gmail.com' ? 'none' : 'block' }}
                      >
                        Radera
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {membersList.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Inga medlemmar hittades.</div>}
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDialog && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', zIndex: 1000000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ background: '#1e293b', padding: '2rem', borderRadius: '12px', maxWidth: '400px', width: '100%', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#fff' }}>Bekräfta</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setConfirmDialog(null)}
                style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Avbryt
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                style={{ padding: '0.75rem 1.5rem', background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Jag är säker
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
