import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import type { PresenceEntry } from '../store';
import { supabase } from '../supabase';

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


// ─── Support Queue Widget ────────────────────────────────────────────────────
function SupportQueueWidget() {
  const [waitingChat, setWaitingChat] = useState(0);
  const [waitingSupport, setWaitingSupport] = useState(0);
  const [waitingInfo, setWaitingInfo] = useState(0);
  const [longestWaitChat, setLongestWaitChat] = useState<string | null>(null);
  const [longestWaitSupport, setLongestWaitSupport] = useState<string | null>(null);
  const [longestWaitInfo, setLongestWaitInfo] = useState<string | null>(null);
  const [agentCount, setAgentCount] = useState(0);

  const formatWait = (oldestDate: Date | null) => {
    if (!oldestDate) return null;
    const secs = Math.floor((Date.now() - oldestDate.getTime()) / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const fetchQueueStats = async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('created_at, ticket_type, inbound_address')
      .eq('status', 'waiting');
    
    if (data) {
      let chat = 0;
      let support = 0;
      let info = 0;
      let chatOldest: Date | null = null;
      let supportOldest: Date | null = null;
      let infoOldest: Date | null = null;

      data.forEach(d => {
        const dDate = new Date(d.created_at);
        if (d.ticket_type === 'email') {
          if (d.inbound_address?.includes('info@')) {
            info++;
            if (!infoOldest || dDate < infoOldest) infoOldest = dDate;
          } else {
            support++; // Fallback if it's email but not info
            if (!supportOldest || dDate < supportOldest) supportOldest = dDate;
          }
        } else {
          chat++;
          if (!chatOldest || dDate < chatOldest) chatOldest = dDate;
        }
      });

      setWaitingChat(chat);
      setWaitingSupport(support);
      setWaitingInfo(info);
      setLongestWaitChat(formatWait(chatOldest));
      setLongestWaitSupport(formatWait(supportOldest));
      setLongestWaitInfo(formatWait(infoOldest));
    }

    // Hämta aktiva agenter
    try {
      const { data: agents } = await supabase
        .from('agent_sessions')
        .select('status')
        .neq('status', 'offline');
      setAgentCount(agents?.length ?? 0);
    } catch {
      // agent_sessions kanske inte finns än (SQL ej kört)
    }
  };

  useEffect(() => {
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 15000);

    const channel = supabase.channel('admin_queue_stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, fetchQueueStats)
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const renderQueueCard = (title: string, icon: string, count: number, longestWait: string | null, themeColor: string) => (
    <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: `rgba(${themeColor},0.05)`, borderRadius: '12px', border: `1px solid rgba(${themeColor},0.2)` }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>{icon}</span> {title}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <div style={{ background: count > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.08)', padding: '1rem', borderRadius: '8px', border: `1px solid ${count > 0 ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.2)'}`, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: count > 0 ? '#f59e0b' : '#10b981' }}>{count}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>I kö just nu</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: longestWait ? '#f43f5e' : '#10b981' }}>
            {longestWait ?? '—'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Längsta väntan</div>
        </div>
        <div style={{ background: agentCount > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: `1px solid ${agentCount > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`, textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: agentCount > 0 ? '#10b981' : '#6b7280' }}>{agentCount}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Agenter online</div>
        </div>
      </div>
      {count > 0 && longestWait && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⚠️ {count} kund{count > 1 ? 'er' : ''} väntar – längst {longestWait} min
        </div>
      )}
    </div>
  );

  return (
    <div style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {renderQueueCard('Chatt – Live', '💬', waitingChat, longestWaitChat, '99,102,241')}
      {renderQueueCard('Support-kö – Live', '📧', waitingSupport, longestWaitSupport, '139,92,246')}
      {renderQueueCard('Info-kö – Live', '📧', waitingInfo, longestWaitInfo, '236,72,153')}
    </div>
  );
}

// ─── Agent Live Monitor Widget ───────────────────────────────────────────────
function AgentLiveMonitor() {
  type AgentStatusType = 'offline' | 'available' | 'busy' | 'post_work' | 'break' | 'lunch';
  interface AgentInfo { agent_id: string; status: AgentStatusType; updated_at: string; agent_email?: string; }

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [, setTick] = useState(0); // force re-render for timer

  const statusColor: Record<AgentStatusType, string> = { offline: '#6b7280', available: '#10b981', busy: '#f59e0b', post_work: '#f97316', break: '#8b5cf6', lunch: '#ec4899' };
  const statusLabel: Record<AgentStatusType, string> = { offline: 'Frånkopplad', available: 'Ledig', busy: 'I ärende', post_work: 'Efterarbete', break: 'Rast', lunch: 'Lunch' };
  const statusIcon: Record<AgentStatusType, string> = { offline: '⚫', available: '🟢', busy: '🟡', post_work: '📝', break: '☕', lunch: '🍔' };

  const fetchAgents = async () => {
    // Hämta alla agenter som inte är offline
    const { data } = await supabase
      .from('agent_sessions')
      .select('agent_id, status, updated_at')
      .neq('status', 'offline');
    
    if (data && data.length > 0) {
      // Hämta e-post för varje agent
      const ids = data.map((a: any) => a.agent_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', ids);
      
      const emailMap: Record<string, string> = {};
      if (profiles) profiles.forEach((p: any) => { emailMap[p.id] = p.email; });
      
      setAgents(data.map((a: any) => ({ ...a, agent_email: emailMap[a.agent_id] || 'Okänd' })));
    } else {
      setAgents([]);
    }
  };

  useEffect(() => {
    fetchAgents();
    // Realtime updates
    const channel = supabase.channel('admin_agent_monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_sessions' }, fetchAgents)
      .subscribe();
    // Tick varje sekund för tidtagare
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => { supabase.removeChannel(channel); clearInterval(timer); };
  }, []);

  const formatDuration = (iso: string) => {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>👥</span> Agenter Live
      </h3>
      {agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Inga agenter online just nu.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {agents.map(a => (
            <div key={a.agent_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.85rem 1.25rem', background: 'rgba(0,0,0,0.2)',
              borderRadius: '10px', border: `1px solid ${statusColor[a.status]}30`,
              flexWrap: 'wrap', gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: statusColor[a.status],
                  boxShadow: `0 0 8px ${statusColor[a.status]}`
                }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>
                    {a.agent_email}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: statusColor[a.status], fontWeight: 600 }}>
                    {statusIcon[a.status]} {statusLabel[a.status]}
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: '1.1rem', fontWeight: 'bold',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-secondary)',
                background: 'rgba(0,0,0,0.3)',
                padding: '0.3rem 0.7rem',
                borderRadius: '6px',
                minWidth: '4rem',
                textAlign: 'center'
              }}>
                {formatDuration(a.updated_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ✨ Support Agent Stats Widget ✨
function SupportAgentStatsWidget() {
  const [timeRange, setTimeRange] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [stats, setStats] = useState<{ email: string, count: number, avgTime: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    setLoading(true);
    let startDate = new Date();
    startDate.setHours(0,0,0,0);
    let endDate = new Date();
    endDate.setHours(23,59,59,999);

    if (timeRange === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
    } else if (timeRange === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (timeRange === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const { data: users } = await supabase.rpc('admin_get_all_users');
    const userMap = new Map();
    if (users) {
      users.forEach((u: any) => userMap.set(u.id, u.email));
    }

    const { data } = await supabase
      .from('chat_sessions')
      .select('assigned_to, created_at, updated_at')
      .eq('status', 'closed')
      .not('assigned_to', 'is', null)
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString());

    if (data) {
      const agentMap = new Map<string, { count: number, totalTime: number }>();
      data.forEach(s => {
        const agentId = s.assigned_to;
        const email = userMap.get(agentId) || 'Okänd Agent';
        const start = new Date(s.created_at).getTime();
        const end = new Date(s.updated_at).getTime();
        const durationMin = Math.max(0, (end - start) / 60000);
        
        if (!agentMap.has(email)) {
          agentMap.set(email, { count: 0, totalTime: 0 });
        }
        const st = agentMap.get(email)!;
        st.count++;
        st.totalTime += durationMin;
      });

      const result = Array.from(agentMap.entries()).map(([email, st]) => ({
        email,
        count: st.count,
        avgTime: Math.round(st.totalTime / st.count)
      })).sort((a, b) => b.count - a.count);

      setStats(result);
    }
    setLoading(false);
  };

  return (
    <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📈</span> Agentprestationer
        </h3>
        <select 
          value={timeRange} 
          onChange={(e) => setTimeRange(e.target.value as any)}
          style={{ background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '6px' }}
        >
          <option value="today">Idag</option>
          <option value="yesterday">Igår</option>
          <option value="week">Senaste veckan</option>
          <option value="month">Senaste månaden</option>
        </select>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Laddar statistik...</div>
      ) : stats.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)' }}>Inga stängda ärenden denna period.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>Agent</th>
                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal', textAlign: 'center' }}>Lösta ärenden</th>
                <th style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal', textAlign: 'right' }}>Snittid per ärende</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{s.email}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>{s.count}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: '#f59e0b' }}>{s.avgTime} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {

  const [adminTab, setAdminTab] = useState<'overview' | 'support' | 'traffic' | 'settings' | 'users'>('overview');

  const paywallActive = useStore(s => s.state.paywallActive);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{message: string, onConfirm: () => void} | null>(null);
  
  const [stripeSecret, setStripeSecret] = useState('');
  const [stripeWebhook, setStripeWebhook] = useState('');
  const [stripePriceId, setStripePriceId] = useState('');
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
  const [contactOrgnr, setContactOrgnr] = useState('');
  const [contactVat, setContactVat] = useState('');
  const [contactAddress, setContactAddress] = useState('');

  const [showCompany, setShowCompany] = useState(true);
  const [showOrgnr, setShowOrgnr] = useState(true);
  const [showVat, setShowVat] = useState(true);
  const [showAddress, setShowAddress] = useState(true);
  
  const [loginDemoEnabled, setLoginDemoEnabled] = useState(false);
  
  // Funnel state
  type FunnelPeriod = '7d' | '30d' | 'all';
  const [funnelPeriod, setFunnelPeriod] = useState<FunnelPeriod>('30d');
  const [funnelData, setFunnelData] = useState<Record<string, number>>({});
  const [funnelLoading, setFunnelLoading] = useState(false);

  // Presence – läses från Zustand (hanteras centralt i App.tsx)
  const presenceSessions = useStore(s => s.presenceSessions) as PresenceEntry[];
  const [now, setNow] = useState(Date.now());

  const STUCK_THRESHOLDS: Record<string, number> = {
    '/': 5, '/demo': 8, '/register': 3, '/login': 2,
  };

  const stuckSessions = useMemo(() => presenceSessions.filter(s => {
    const threshold = (STUCK_THRESHOLDS[s.page] ?? 10) * 60_000;
    return Date.now() - new Date(s.page_entered_at).getTime() > threshold;
  }), [presenceSessions, now]);

  const uniqueUsers = useMemo(() =>
    new Set(presenceSessions.map(s => s.user_id)).size
  , [presenceSessions]);

  const pageGroups = useMemo(() =>
    presenceSessions.reduce<Record<string, number>>((acc, s) => {
      acc[s.page_label] = (acc[s.page_label] || 0) + 1;
      return acc;
    }, {})
  , [presenceSessions]);


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
      setMsg('❌ Fel vid hämtning av användare: ' + (e instanceof Error ? e.message : JSON.stringify(e)));
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

  // Tick var 10:e sekund för stuck-beräkning (ingen nätverkstrafik)
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(tick);
  }, []);

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
      setMsg('❌ Fel vid hämtning av statistik: ' + (e instanceof Error ? e.message : JSON.stringify(e)));
    }
  };

  const fetchContactSettings = async () => {
    try {
      const { data } = await supabase.from('global_settings').select('key, value');
      if (data) {
        setContactCompany(data.find(d => d.key === 'contact_company')?.value || '');
        setContactOrgnr(data.find(d => d.key === 'contact_orgnr')?.value || '');
        setContactVat(data.find(d => d.key === 'contact_vat')?.value || '');
        setContactAddress(data.find(d => d.key === 'contact_address')?.value || '');
        
        setShowCompany(data.find(d => d.key === 'show_contact_company')?.value !== 'false');
        setShowOrgnr(data.find(d => d.key === 'show_contact_orgnr')?.value !== 'false');
        setShowVat(data.find(d => d.key === 'show_contact_vat')?.value !== 'false');
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

  const handleToggleChatAgent = async (email: string, isChatAgent: boolean, handlesChat: boolean = true, handlesEmail: boolean = false) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('toggle_chat_agent', { 
        target_email: email, 
        enable: !isChatAgent,
        p_handles_chat: handlesChat,
        p_handles_email: handlesEmail
      });
      if (error) throw error;
      setMsg(isChatAgent ? `💬 Kundservice avaktiverad för ${email}.` : `💬 ${email} kan nu jobba i kundservice!`);
      await fetchMembersList();
    } catch (e: unknown) {
      setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAgentQueues = async (email: string, handlesChat: boolean, handlesEmail: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('toggle_chat_agent', { 
        target_email: email, 
        enable: true,
        p_handles_chat: handlesChat,
        p_handles_email: handlesEmail
      });
      if (error) throw error;
      setMsg(`💬 Kö-behörigheter uppdaterade för ${email}.`);
      await fetchMembersList();
    } catch (e: unknown) {
      setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
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
        supabase.rpc('set_global_setting', { setting_key: 'contact_orgnr', setting_value: contactOrgnr }),
        supabase.rpc('set_global_setting', { setting_key: 'contact_vat', setting_value: contactVat }),
        supabase.rpc('set_global_setting', { setting_key: 'contact_address', setting_value: contactAddress }),
        supabase.rpc('set_global_setting', { setting_key: 'show_contact_company', setting_value: showCompany.toString() }),
        supabase.rpc('set_global_setting', { setting_key: 'show_contact_orgnr', setting_value: showOrgnr.toString() }),
        supabase.rpc('set_global_setting', { setting_key: 'show_contact_vat', setting_value: showVat.toString() }),
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
    <div className="card" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ color: '#f43f5e', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>👑 System Admin</h2>

      {/* ─── FLIKMENY ─── */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="settings-tabs-desktop" style={{
          display: 'flex', gap: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          {([
            { id: 'overview',  icon: '📊', label: 'Översikt' },
            { id: 'users',     icon: '👤', label: 'Användare' },
            { id: 'support',   icon: '💬', label: 'Kundservice' },
            { id: 'traffic',   icon: '📈', label: 'Trafik' },
            { id: 'settings',  icon: '⚙️', label: 'Inställningar' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setAdminTab(tab.id)}
              style={{
                padding: '0.6rem 1.2rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                border: 'none',
                borderRadius: '8px 8px 0 0',
                background: adminTab === tab.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                color: adminTab === tab.id ? '#a5b4fc' : 'var(--text-secondary)',
                borderBottom: adminTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '0.4rem'
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>
        <div className="settings-tabs-mobile">
          <select 
            value={adminTab} 
            onChange={(e) => setAdminTab(e.target.value as 'overview' | 'users' | 'support' | 'traffic' | 'settings')}
            style={{ width: '100%', padding: '0.8rem', fontSize: '1.05rem', background: 'rgba(0,0,0,0.4)', color: 'var(--text-primary)', border: '1px solid #6366f1', borderRadius: '8px', cursor: 'pointer', appearance: 'auto' }}
          >
            <option value="overview">📊 Översikt</option>
            <option value="users">👤 Hantera Användare</option>
            <option value="support">💬 Kundservice (Live)</option>
            <option value="traffic">📈 Trafik & Konvertering</option>
            <option value="settings">⚙️ Systeminställningar</option>
          </select>
        </div>
      </div>

      {/* ─── ÖVERSIKT ─── */}
      {adminTab === 'overview' && (
        <>
      {stats && (<>
          {/* General Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div 
              onClick={() => setAdminTab('users')}
              style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{stats.total_members}</div>
              <div style={{ fontSize: '0.9rem', color: '#a5b4fc' }}>Totala Medlemmar →</div>
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

      </> /* end adminTab overview */
      )}

      {/* ─── TRAFIK ─── */}
      {adminTab === 'traffic' && (
        <>
      {/* ─── FUNNEL DASHBOARD ─── */}
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

      {/* ─── LIVE PRESENCE PANEL ────────────────────────────────────── */}
      <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(16,185,129,0.04)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
        <h3 style={{ margin: '0 0 1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }} />
          Live just nu
        </h3>

        {/* Sammanfattning */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120, background: 'rgba(16,185,129,0.1)', borderRadius: '0.75rem', padding: '0.875rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{presenceSessions.length}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>aktiva sessioner</div>
          </div>
          <div style={{ flex: 1, minWidth: 120, background: 'rgba(99,102,241,0.1)', borderRadius: '0.75rem', padding: '0.875rem 1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#6366f1' }}>{uniqueUsers}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>unika användare</div>
          </div>
        </div>

        {/* Per sida */}
        {Object.keys(pageGroups).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {Object.entries(pageGroups)
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                  <div style={{ flex: 2, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${(count / presenceSessions.length) * 100}%`,
                      background: '#10b981',
                      borderRadius: 3,
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', minWidth: 20, textAlign: 'right' }}>{count}</span>
                </div>
              ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', fontStyle: 'italic' }}>
            Inga aktiva sessioner just nu.
          </div>
        )}

        {/* Stuck-lista */}
        {stuckSessions.length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🔥 Fastnade besökare
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stuckSessions.map(s => {
                const mins = Math.floor((now - new Date(s.page_entered_at).getTime()) / 60_000);
                return (
                  <div key={s.session_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem', background: 'rgba(245,158,11,0.08)', borderRadius: '0.625rem', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <span style={{ fontSize: '0.85rem', color: '#f59e0b', flex: 1 }}>{s.page_label}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{mins} min</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                      {s.role}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </> /* end traffic */
      )}

      {msg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000000, padding: '1rem 2rem', background: 'rgba(0,0,0,0.9)', borderRadius: '8px', borderBottom: '4px solid #f43f5e', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', fontWeight: 'bold', textAlign: 'center', minWidth: '300px' }}>
          {msg}
        </div>
      )}

      {/* ─── KUNDSERVICE ─── */}
      {adminTab === 'support' && (
        <>
      {/* 💬 KUNDSERVICE-KÖ & STATISTIK 💬 */}
      <SupportQueueWidget />
      <AgentLiveMonitor />
      <SupportAgentStatsWidget />
      </> /* end support */
      )}

      {/* ─── INSTÄLLNINGAR ─── */}
      {adminTab === 'settings' && (
        <>

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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Organisationsnummer</label>
            <input 
              type="text" 
              value={contactOrgnr}
              onChange={e => setContactOrgnr(e.target.value)}
              placeholder="Ex: 556123-4567"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={showOrgnr} onChange={e => setShowOrgnr(e.target.checked)} id="show_orgnr" />
              <label htmlFor="show_orgnr" style={{ fontSize: '0.85rem' }}>Visa på hemsidan</label>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Momsregistreringsnummer (VAT)</label>
            <input 
              type="text" 
              value={contactVat}
              onChange={e => setContactVat(e.target.value)}
              placeholder="Ex: SE556123456701"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
            />
            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={showVat} onChange={e => setShowVat(e.target.checked)} id="show_vat" />
              <label htmlFor="show_vat" style={{ fontSize: '0.85rem' }}>Visa på hemsidan</label>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Säte/Adress</label>
            <input 
              type="text" 
              value={contactAddress}
              onChange={e => setContactAddress(e.target.value)}
              placeholder="Ex: Storgatan 1, Stockholm"
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
        </button>
      </div>

      </> /* end settings */
      )}
      
      {/* ─── ANVÄNDARE ─── */}
      {adminTab === 'users' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>👤</span> Användarhantering
            </h3>
            <button onClick={fetchMembersList} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>🔄 Uppdatera</button>
          </div>
          <input 
            type="text" 
            placeholder="🔍 Filtrera på e-post..." 
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff', marginBottom: '1rem', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {membersList.filter(m => m.email.toLowerCase().includes(memberSearch.toLowerCase())).map(m => (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', borderLeft: m.is_banned ? '4px solid #f43f5e' : '4px solid rgba(99,102,241,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: m.is_banned ? '#f43f5e' : '#fff' }}>
                      {m.email} {m.is_banned && '(BLOCKERAD)'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Senast inloggad: {m.last_sign_in_at ? new Date(m.last_sign_in_at).toLocaleString('sv-SE') : 'Aldrig'}
                    </div>
                  </div>
                  {(m.is_vip || m.is_admin || m.chat_agent) && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {m.is_vip && <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid #10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>💎 VIP</span>}
                      {m.is_admin && <span style={{ background: 'rgba(168,85,247,0.2)', color: '#a855f7', border: '1px solid #a855f7', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>👑 Admin</span>}
                      {m.chat_agent && <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>💬 KS</span>}
                    </div>
                  )}
                </div>
                {m.email !== 'apersson508@gmail.com' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
                      <button onClick={() => handleToggleVip(m.email, m.is_vip)} disabled={loading} style={{ flex: '1 1 auto', background: m.is_vip ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)', color: m.is_vip ? '#10b981' : '#fff', border: `1px solid ${m.is_vip ? '#10b981' : 'transparent'}`, padding: '0.45rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        {m.is_vip ? '💎 VIP' : 'Gör VIP'}
                      </button>
                      <button onClick={() => handleToggleAdmin(m.email, m.is_admin)} disabled={loading} style={{ flex: '1 1 auto', background: m.is_admin ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.08)', color: m.is_admin ? '#a855f7' : '#fff', border: `1px solid ${m.is_admin ? '#a855f7' : 'transparent'}`, padding: '0.45rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        {m.is_admin ? '👑 Admin' : 'Gör Admin'}
                      </button>
                      <button onClick={() => handleToggleChatAgent(m.email, m.chat_agent, m.handles_chat, m.handles_email)} disabled={loading} style={{ flex: '1 1 auto', background: m.chat_agent ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)', color: m.chat_agent ? '#10b981' : '#fff', border: `1px solid ${m.chat_agent ? 'rgba(16,185,129,0.5)' : 'transparent'}`, padding: '0.45rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        {m.chat_agent ? '💬 KS PÅ' : '💬 KS AV'}
                      </button>
                      <button onClick={() => handleToggleBan(m.id, m.is_banned)} disabled={loading} style={{ flex: '1 1 auto', background: m.is_banned ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.08)', color: m.is_banned ? '#f43f5e' : '#fff', border: `1px solid ${m.is_banned ? '#f43f5e' : 'transparent'}`, padding: '0.45rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        {m.is_banned ? '🔓 Lås upp' : '🚫 Blockera'}
                      </button>
                      <button onClick={() => handleDeleteUser(m.id, m.email)} disabled={loading} style={{ flex: '1 1 auto', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', padding: '0.45rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                        🗑️ Radera
                      </button>
                    </div>
                    {m.chat_agent && (
                      <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                          <input type="checkbox" checked={m.handles_chat} onChange={(e) => handleUpdateAgentQueues(m.email, e.target.checked, m.handles_email)} style={{ accentColor: '#10b981' }} />
                          Chatt-kö
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                          <input type="checkbox" checked={m.handles_email} onChange={(e) => handleUpdateAgentQueues(m.email, m.handles_chat, e.target.checked)} style={{ accentColor: '#10b981' }} />
                          Mejl-kö
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {membersList.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>Inga medlemmar hittades.</div>}
          </div>
        </div>
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
