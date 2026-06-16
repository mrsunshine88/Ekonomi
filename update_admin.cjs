const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// 1. States
code = code.replace(
  /const \[vipEmail, setVipEmail\] = useState\(''\);\s*const \[vipList, setVipList\] = useState<string\[\]>\(\[\]\);/,
  `const [showMembersModal, setShowMembersModal] = useState(false);\n  const [membersList, setMembersList] = useState<any[]>([]);\n  const [memberSearch, setMemberSearch] = useState('');`
);
code = code.replace(
  /const \[systemAdmins, setSystemAdmins\] = useState<string\[\]>\(\[\]\);\s*const \[newAdminEmail, setNewAdminEmail\] = useState\(''\);/,
  ''
);

// 2. Fetchers
code = code.replace(
  /const fetchVipList = async \(\) => \{[\s\S]*?\}\s*\};\s*const fetchStats = async \(\) => \{/,
  `const fetchMembersList = async () => {\n    try {\n      const { data, error } = await supabase.rpc('admin_get_all_users');\n      if (error) throw error;\n      setMembersList(data || []);\n    } catch (e: unknown) {\n      console.error("Kunde inte hämta medlemmar", e);\n    }\n  };\n\n  const fetchStats = async () => {`
);

code = code.replace(
  /const fetchSystemAdmins = async \(\) => \{[\s\S]*?\}\s*\};\s*useEffect/,
  `useEffect`
);

// 3. useEffect
code = code.replace(
  /useEffect\(\(\) => \{\s*fetchVipList\(\);\s*fetchStats\(\);\s*fetchContactSettings\(\);\s*fetchStripeStatus\(\);\s*fetchSystemAdmins\(\);\s*\}, \[\]\);/,
  `useEffect(() => {\n    fetchMembersList();\n    fetchStats();\n    fetchContactSettings();\n    fetchStripeStatus();\n  }, []);`
);

// 4. Handlers
code = code.replace(
  /const handleGrantVip = async \(\) => \{[\s\S]*?const handleSaveSecrets = async \(\) => \{/,
  `const handleToggleVip = async (email: string, isVip: boolean) => {
    setLoading(true);
    try {
      const rpcName = isVip ? 'revoke_household_vip_by_email' : 'set_household_vip_by_email';
      const { error } = await supabase.rpc(rpcName, { target_email: email });
      if (error) throw error;
      setMsg(isVip ? \`📉 VIP-status borttagen för \${email}.\` : \`👑 \${email} har nu VIP-status!\`);
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
      if (data && data !== 'Success') setMsg(\`ℹ️ \${data}\`);
      else setMsg(isAdmin ? \`📉 Administratörsrättigheter borttagna för \${email}.\` : \`👑 \${email} är nu admin!\`);
      await fetchMembersList();
    } catch (e: unknown) {
      setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async (id: string, isBanned: boolean) => {
    if (!window.confirm(\`Är du säker på att du vill \${isBanned ? 'låsa upp' : 'blockera'} denna användare?\`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('admin_ban_user', { target_user_id: id, ban: !isBanned });
      if (error) throw error;
      setMsg(\`🔒 Användaren har \${isBanned ? 'låsts upp' : 'blockerats'}.\`);
      await fetchMembersList();
    } catch (e: unknown) {
      setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!window.confirm(\`Varning! Är du HELT SÄKER på att du vill radera \${email} permanent från databasen?\`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('admin_delete_user', { target_user_id: id });
      if (error) throw error;
      setMsg(\`🗑️ Användaren \${email} är raderad.\`);
      await fetchMembersList();
      await fetchStats();
    } catch (e: unknown) {
      setMsg('❌ Admin Fel: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecrets = async () => {`
);

// 5. Box Click
code = code.replace(
  /<div style=\{\{ background: 'rgba\(255,255,255,0\.05\)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba\(255,255,255,0\.1\)' \}\}>\s*<div style=\{\{ fontSize: '2rem', marginBottom: '0\.5rem' \}\}>👥<\/div>\s*<div style=\{\{ fontSize: '1\.5rem', fontWeight: 'bold', color: '#fff' \}\}>\{stats\.total_members\}<\/div>\s*<div style=\{\{ fontSize: '0\.9rem', color: 'var\(--text-secondary\)' \}\}>Totala Medlemmar<\/div>\s*<\/div>/,
  `<div 
              onClick={() => setShowMembersModal(true)}
              style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{stats.total_members}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Totala Medlemmar (Klicka)</div>
            </div>`
);

// 6. VIP and Admin UI deletion
code = code.replace(
  /<div style=\{\{ marginBottom: '2\.5rem', padding: '1\.5rem', background: 'rgba\(255,255,255,0\.05\)', borderRadius: '12px' \}\}>\s*<h3 style=\{\{ marginBottom: '0\.5rem' \}\}>VIP-Kunder<\/h3>[\s\S]*?<\/div>\s*<div style=\{\{ marginBottom: '2\.5rem', padding: '1\.5rem', background: 'rgba\(255,255,255,0\.05\)', borderRadius: '12px' \}\}>\s*<h3 style=\{\{ marginBottom: '0\.5rem' \}\}>Administratörer<\/h3>[\s\S]*?<\/div>/,
  `{/* VIP & Admin UI replaced by MembersModal */}`
);

// 7. Add Modal at the end
const modalCode = `
      {showMembersModal && (
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
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => handleToggleVip(m.email, m.is_vip)}
                        disabled={loading}
                        style={{ background: m.is_vip ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)', color: m.is_vip ? '#10b981' : '#fff', border: \`1px solid \${m.is_vip ? '#10b981' : 'transparent'}\`, padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        {m.is_vip ? '💎 VIP' : 'Gör till VIP'}
                      </button>
                      <button 
                        onClick={() => handleToggleAdmin(m.email, m.is_admin)}
                        disabled={loading || m.email === 'apersson508@gmail.com'}
                        style={{ background: m.is_admin ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.1)', color: m.is_admin ? '#a855f7' : '#fff', border: \`1px solid \${m.is_admin ? '#a855f7' : 'transparent'}\`, padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        {m.is_admin ? '👑 Admin' : 'Gör till Admin'}
                      </button>
                      <button 
                        onClick={() => handleToggleBan(m.id, m.is_banned)}
                        disabled={loading || m.email === 'apersson508@gmail.com'}
                        style={{ background: m.is_banned ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255,255,255,0.1)', color: m.is_banned ? '#f43f5e' : '#fff', border: \`1px solid \${m.is_banned ? '#f43f5e' : 'transparent'}\`, padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        {m.is_banned ? 'Lås upp' : 'Blockera'}
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(m.id, m.email)}
                        disabled={loading || m.email === 'apersson508@gmail.com'}
                        style={{ background: 'transparent', color: '#f43f5e', border: '1px solid #f43f5e', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
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
        </div>
      )}
`;

code = code.replace(/<\/div>\n    <\/div>\n  \);\n\}\n?$/, modalCode + '    </div>\n  );\n}\n');

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
console.log('Update finished.');
