import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useStore } from '../store';
import { supabase } from '../supabase';

export default function MyPages() {
  const { user, householdId, role, refreshHousehold } = useAuth();
  const toggleSharePrivateEconomy = useStore(s => s.toggleSharePrivateEconomy);
  const householdProfiles = useStore(s => s.state.householdProfiles || []);
  const myProfile = householdProfiles.find(p => p.id === user?.id);
  const isSharingPrivate = myProfile?.share_private_economy || false;
  const [members, setMembers] = useState<{id: string, email: string, role: string, created_at?: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  
  // Admin SaaS State
  const paywallActive = useStore(s => s.state.paywallActive);
  const isAdmin = user?.email === 'apersson508@gmail.com';
  const [vipSearchEmail, setVipSearchEmail] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const isMeFounder = members.length > 0 && members[0].id === user?.id;

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setIsPushEnabled(true);
        });
      });
    }
  }, []);

  useEffect(() => {
    if (householdId) {
      supabase.from('profiles').select('id, email, role, created_at').eq('household_id', householdId).order('created_at', { ascending: true })
        .then(({ data }) => {
          if (data) setMembers(data);
        });
    } else {
      setMembers([]);
    }
  }, [householdId]);

  const handleKickMember = (memberId: string, memberEmail: string) => {
    setConfirmModal({
      visible: true,
      title: 'Kicka ut medlem',
      message: `Är du säker på att du vill ta bort ${memberEmail} från hushållet?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const newHouseholdId = crypto.randomUUID();
          await supabase.from('households').insert([{ id: newHouseholdId }]);
          await supabase.from('profiles').update({ household_id: newHouseholdId, role: 'owner' }).eq('id', memberId);
          
          setMembers(prev => prev.filter(m => m.id !== memberId));
          setMsg(`✅ ${memberEmail} har tagits bort från hushållet.`);
        } catch (e: any) {
          setMsg('❌ Kunde inte ta bort medlem: ' + e.message);
        } finally {
          setLoading(false);
          setConfirmModal({ visible: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };
  const [inviteCode, setInviteCode] = useState('');
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleJoinHousehold = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setMsg('');
    try {
      const code = inviteCode.trim();
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(code)) {
         throw new Error('Ogiltigt format på koden.');
      }

      const { error } = await supabase.from('profiles').upsert([{ 
        id: user?.id, 
        email: user?.email, 
        household_id: code, 
        role: 'member' 
      }]);
      
      if (error) {
        if (error.code === '23503') {
          throw new Error('Kunde inte hitta koden. Är den rättstavad?');
        }
        throw error;
      }

      await refreshHousehold();
      setMsg('✅ Du har gått med i hushållet!');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHousehold = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const newHouseholdId = crypto.randomUUID();
      const { error: hhErr } = await supabase.from('households').insert([{ id: newHouseholdId }]);
      if (hhErr) throw hhErr;
      
      const { error } = await supabase.from('profiles').upsert([{ id: user.id, email: user.email, household_id: newHouseholdId, role: 'owner' }]);
      if (error) throw error;
      
      await refreshHousehold();
      setMsg('✅ Molnsynk och delning aktiverat!');
    } catch (err: any) {
      console.error(err);
      setMsg('❌ Kunde inte skapa molnsynk. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    const newRole = currentRole === 'owner' ? 'member' : 'owner';
    setLoading(true);
    try {
      const { error } = await supabase.rpc('set_user_role', { target_user_id: memberId, new_role: newRole });
      if (error) throw error;
      
      setMembers(members.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setMsg(`✅ Behörighet ändrad! Personen är nu ${newRole === 'owner' ? 'Medägare (full tillgång till gemensamma räkningar)' : 'Medlem (Låst läge)'}.`);
    } catch (e: any) {
      setMsg('❌ ' + e.message + '. (Tips: Kör SQL-skriptet för behörigheter om databasen blockerar)');
    } finally {
      setLoading(false);
    }
  };

  const [currentPassword, setCurrentPassword] = useState('');
  
  const verifyCurrentPassword = async () => {
    if (!user?.email || !currentPassword) {
      throw new Error("Du måste ange ditt nuvarande lösenord för att göra ändringar.");
    }
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (error) throw new Error("Nuvarande lösenord är felaktigt.");
  };

  const handleUpdateEmail = async () => {
    if (!newEmail) return;
    setLoading(true);
    try {
      await verifyCurrentPassword();
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setMsg('✅ Bekräftelselänk har skickats till både gamla och nya mejlen!');
      setNewEmail('');
      setCurrentPassword('');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) return;
    setLoading(true);
    try {
      await verifyCurrentPassword();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setMsg('✅ Lösenordet har ändrats!');
      setNewPassword('');
      setCurrentPassword('');
    } catch (e: any) {
      setMsg('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => supabase.auth.signOut();

  const handleDeleteAccount = () => {
    setConfirmModal({
      visible: true,
      title: 'Radera konto',
      message: 'Är du HELT säker? Detta kommer radera ditt inlogg, din profil och alla dina privata räkningar för alltid. Detta går inte att ångra.',
      onConfirm: async () => {
        setLoading(true);
        try {
          const { error } = await supabase.rpc('delete_user');
          if (error) throw error;
          
          await supabase.auth.signOut();
        } catch (e: any) {
          setMsg('❌ ' + e.message);
          setLoading(false);
          setConfirmModal({ visible: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const handleToggleShare = async () => {
    const newState = !isSharingPrivate;
    try {
      await toggleSharePrivateEconomy(newState);
      setMsg(newState ? '✅ Din privata ekonomi delas nu med hushållet.' : '✅ Din privata ekonomi är nu privat igen.');
    } catch (e: any) {
      setMsg('❌ Fel: ' + e.message);
    }
  };

  const handleTogglePush = async () => {
    setPushLoading(true);
    setMsg('');
    try {
      if (isPushEnabled) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await supabase.from('push_subscriptions').delete().eq('user_id', user?.id).contains('subscription', { endpoint: sub.endpoint });
        }
        setIsPushEnabled(false);
        setMsg('✅ Push-notiser avaktiverade.');
      } else {
        const result = await Notification.requestPermission();
        if (result === 'granted') {
          const reg = await navigator.serviceWorker.ready;
          const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          if (!vapidKey) throw new Error("VAPID-nyckel saknas i .env filen (VITE_VAPID_PUBLIC_KEY).");
          
          const urlBase64ToUint8Array = (base64String: string) => {
            const padding = '='.repeat((4 - base64String.length % 4) % 4);
            const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            for (let i = 0; i < rawData.length; ++i) {
              outputArray[i] = rawData.charCodeAt(i);
            }
            return outputArray;
          };

          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
          });
          
          await supabase.from('push_subscriptions').insert([{
            user_id: user?.id,
            subscription: JSON.parse(JSON.stringify(sub))
          }]);
          
          setIsPushEnabled(true);
          setMsg('✅ Push-notiser är nu aktiverade på denna enhet!');
        } else {
          setMsg('❌ Du nekade tillåtelse för notiser i webbläsaren.');
        }
      }
    } catch (e: any) {
      setMsg('❌ Fel: ' + e.message);
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Testnotis från Ekonomiappen 💸', {
        body: 'Det fungerar! Denna enhet kan nu ta emot påminnelser.',
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png'
      });
      setMsg('✅ Skickade en testnotis!');
    } catch (e: any) {
      setMsg('❌ Fel vid test av notis: ' + e.message);
    }
  };

  const handleTogglePaywall = async () => {
    setAdminLoading(true);
    try {
      const { error } = await supabase.rpc('toggle_paywall', { is_active: !paywallActive });
      if (error) throw error;
      useStore.setState(s => ({ state: { ...s.state, paywallActive: !paywallActive } }));
      setMsg(paywallActive ? '✅ Betalväggen är nu AV. Appen är gratis.' : '🚨 Betalväggen är nu PÅ! Alla nya (och icke-VIP) kommer att tvingas betala 59 kr/mån.');
    } catch (e: any) {
      setMsg('❌ Admin Fel: ' + e.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleGrantVip = async () => {
    if (!vipSearchEmail) return;
    setAdminLoading(true);
    try {
      const { data, error } = await supabase.rpc('set_household_vip_by_email', { target_email: vipSearchEmail });
      if (error) throw error;
      setMsg(`👑 ${vipSearchEmail} har nu VIP-status (Gratis för alltid)!`);
      setVipSearchEmail('');
    } catch (e: any) {
      setMsg('❌ Admin Fel: ' + e.message);
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <>
      {confirmModal.visible && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(11, 15, 25, 0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '2rem', textAlign: 'center'
        }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '16px', padding: '2rem', maxWidth: '400px', width: '100%', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: '#f43f5e', fontSize: '1.5rem', marginBottom: '1rem' }}>{confirmModal.title}</h3>
            <p style={{ color: '#f1f5f9', marginBottom: '2rem', fontSize: '1rem', lineHeight: '1.5' }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                onClick={confirmModal.onConfirm}
                style={{ background: '#f43f5e', color: 'white', padding: '0.75rem 2.5rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(244, 63, 94, 0.4)' }}
              >
                Ja, jag är säker
              </button>
              <button 
                onClick={() => setConfirmModal({ visible: false, title: '', message: '', onConfirm: () => {} })}
                style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '0.75rem', border: '1px solid var(--text-secondary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto', marginTop: '2rem' }}>

      <h2 style={{ marginBottom: '1.5rem' }}>Mina Sidor</h2>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
        <strong>Inloggad som:</strong> <span style={{ color: 'var(--accent-color)' }}>{user?.email}</span>
      </div>

      {msg && <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>{msg}</div>}

      {isAdmin && (
        <div style={{ marginBottom: '2.5rem', padding: '1.5rem', background: 'rgba(244, 63, 94, 0.1)', borderRadius: '12px', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
          <h3 style={{ color: '#f43f5e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>👑 Admin Kontroll</h3>
          
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>Master Switch: Betalvägg (59 kr/mån)</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {paywallActive 
                  ? 'PÅ! Alla som inte är VIP kommer att krävas på 59 kr för att använda appen.' 
                  : 'AV! Appen är för tillfället helt gratis för hela världen.'}
              </div>
            </div>
            <button 
              onClick={handleTogglePaywall}
              disabled={adminLoading}
              style={{ 
                background: paywallActive ? 'var(--success-color)' : '#f43f5e', 
                color: '#fff',
                border: 'none',
                padding: '0.75rem 1.5rem', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {adminLoading ? '...' : (paywallActive ? 'Avaktivera Betalvägg' : 'Aktivera Betalvägg')}
            </button>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>VIP-Sökning (Gör hushåll gratis)</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Skriv in e-postadressen till en vän för att ge hela deras hushåll gratis VIP-access för alltid (går förbi betalväggen).</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="email" 
                placeholder="Vännens inloggnings-mejl..." 
                value={vipSearchEmail} 
                onChange={e => setVipSearchEmail(e.target.value)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
              />
              <button 
                onClick={handleGrantVip} 
                disabled={adminLoading || !vipSearchEmail} 
                style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Ge VIP
              </button>
            </div>
          </div>
        </div>
      )}

      {householdId && (
        <div style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>🔒 Integritet och Delning</h3>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>Delning av privat ekonomi</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {isSharingPrivate 
                  ? 'Din privata ekonomi är just nu synlig för andra i hushållet.' 
                  : 'Gör så att andra i hushållet kan välja att se dina privata räkningar.'}
              </div>
            </div>
            <button 
              onClick={handleToggleShare}
              style={{ 
                background: isSharingPrivate ? 'transparent' : 'var(--success-color)', 
                color: isSharingPrivate ? '#f43f5e' : '#fff',
                border: isSharingPrivate ? '1px solid #f43f5e' : 'none',
                padding: '0.75rem 1rem', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}
            >
              {isSharingPrivate ? 'Sluta dela privat ekonomi' : 'Dela min privata ekonomi'}
            </button>
          </div>

          <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', marginTop: '1.5rem' }}>🔔 Påminnelser (Push-notiser)</h3>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>Få en notis på denna enhet</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {isPushEnabled 
                  ? 'Du får notiser till denna enhet när hushållet har obetalda räkningar (Gäller det datum som är valt i Allmänna inställningar).' 
                  : 'Slå på detta för att telefonen/datorn ska plinga om ni glömt låsa månaden.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {isPushEnabled && (
                <button 
                  onClick={handleTestPush}
                  style={{ 
                    background: 'rgba(255,255,255,0.1)', 
                    color: '#fff',
                    border: '1px solid var(--border-color)',
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🔔 Testa Notis
                </button>
              )}
              <button 
                onClick={handleTogglePush}
                disabled={pushLoading}
                style={{ 
                  background: isPushEnabled ? 'transparent' : 'var(--accent-gradient)', 
                  color: isPushEnabled ? '#f43f5e' : '#fff',
                  border: isPushEnabled ? '1px solid #f43f5e' : 'none',
                  padding: '0.75rem 1rem', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
              >
                {pushLoading ? 'Laddar...' : (isPushEnabled ? 'Stäng av notiser' : 'Aktivera Push-notiser')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>⚙️ Hantera inloggning</h3>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          För din säkerhet måste du ange ditt nuvarande lösenord för att byta e-post eller lösenord.
        </p>
        
        <div style={{ marginBottom: '1rem' }}>
          <input 
            type="password" 
            placeholder="Ditt nuvarande lösenord..." 
            value={currentPassword} 
            onChange={e => setCurrentPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input 
            type="email" 
            placeholder="Ny e-postadress..." 
            value={newEmail} 
            onChange={e => setNewEmail(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          <button onClick={handleUpdateEmail} disabled={loading} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Byt Mejladress</button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="password" 
            placeholder="Nytt lösenord..." 
            value={newPassword} 
            onChange={e => setNewPassword(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          <button onClick={handleUpdatePassword} disabled={loading} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Byt Lösenord</button>
        </div>
      </div>

      {!householdId ? (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>☁️ Säkra din data i molnet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Din data sparas just nu bara på den här enheten. Klicka på knappen nedan för att ladda upp din ekonomi till ditt säkra moln. Du får då även en inbjudningskod om du vill bjuda in fler till hushållet.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
            <button onClick={handleCreateHousehold} disabled={loading} style={{ padding: '1rem', background: 'var(--success-color)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Aktivera molnsynk & Skapa inbjudningskod
            </button>
            
            <div style={{ textAlign: 'center', margin: '0.5rem 0', color: 'var(--text-secondary)' }}>eller</div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                placeholder="Klistra in inbjudningskod..." 
                value={inviteCode} 
                onChange={e => setInviteCode(e.target.value)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
              />
              <button onClick={handleJoinHousehold} disabled={loading} style={{ padding: '0.75rem 1.5rem', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                Gå med
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '2rem' }}>
          {role === 'owner' && (
            <>
              <h3 style={{ color: 'var(--success-color)', marginBottom: '0.5rem' }}>✅ Hushållet är sparat i molnet</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                För att bjuda in en medlem, be personen registrera ett eget konto och sedan ange koden nedan:
              </p>
              <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <code style={{ color: '#fff', fontSize: '1.1rem', wordBreak: 'break-all', marginRight: '1rem' }}>{householdId}</code>
                <button 
                  onClick={() => { navigator.clipboard.writeText(householdId); setMsg('Kopierat till urklipp!'); }}
                  style={{ background: 'var(--accent-color)', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Kopiera
                </button>
              </div>
            </>
          )}

          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', marginTop: '1.5rem' }}>👥 Hushållets medlemmar</h3>
          
          <div style={{ padding: '1rem', background: isMeFounder ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', borderLeft: isMeFounder ? '4px solid var(--success-color)' : '4px solid var(--text-secondary)', marginBottom: '1rem' }}>
            {isMeFounder ? (
              <>
                <strong style={{ color: 'var(--success-color)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>👑 Detta är ditt hushåll</strong>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Du är grundaren och äger därmed datan. Du har full kontroll över vilka som får vara med.</p>
              </>
            ) : (
              <>
                <strong style={{ color: '#fff', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🏠 Inbjuden medlem</strong>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Du är en inbjuden medlem i detta hushåll.</p>
              </>
            )}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
            {members.map((m, index) => {
              const isFounder = index === 0;
              return (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ color: '#fff' }}>{m.email} {m.id === user?.id && '(Du)'} {isFounder && '👑 (Grundare)'}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.role === 'owner' ? 'Medägare' : 'Medlem'}</div>
                </div>
                {role === 'owner' && m.id !== user?.id && !isFounder && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleToggleRole(m.id, m.role)}
                      disabled={loading}
                      style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      {m.role === 'owner' ? 'Lås läge (Gör till Medlem)' : 'Lås upp (Gör till Medägare)'}
                    </button>
                    <button 
                      onClick={() => handleKickMember(m.id, m.email)}
                      disabled={loading}
                      style={{ background: '#f43f5e', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Kicka ut
                    </button>
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
        <h3 style={{ color: '#f43f5e', marginBottom: '0.5rem' }}>Farlig zon</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Dessa åtgärder kan inte ångras.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {householdId && (
            isMeFounder ? (
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>
                <strong style={{ color: '#fff', fontSize: '1.1rem' }}>👑 Ditt hushåll</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                  Eftersom du är grundare av detta hushåll så äger du datan. Därför kan du inte lämna hushållet. Om du vill bli ensam i appen igen kan du gå upp till medlemslistan och kicka ut de övriga.
                </p>
              </div>
            ) : (
              <button 
                onClick={() => {
                  setConfirmModal({
                    visible: true,
                    title: 'Lämna hushåll',
                    message: 'Är du säker på att du vill lämna hushållet? Du får då en helt tom app för dig själv.',
                    onConfirm: () => {
                      handleCreateHousehold();
                      setConfirmModal({ visible: false, title: '', message: '', onConfirm: () => {} });
                    }
                  });
                }} 
                disabled={loading} 
                style={{ padding: '0.75rem 1rem', background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', borderRadius: '8px', cursor: 'pointer' }}
              >
                🚪 Lämna och skapa eget hushåll
              </button>
            )
          )}

          <button 
            onClick={handleDeleteAccount} 
            disabled={loading} 
            style={{ padding: '0.75rem 1rem', background: '#f43f5e', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            🗑️ Radera mitt konto för alltid
          </button>
        </div>
      </div>

      <button onClick={handleSignOut} style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-secondary)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '2rem' }}>
        Logga ut
      </button>
    </div>
    </>
  );
}
