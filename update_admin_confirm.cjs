const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// 1. Add state
code = code.replace(
  /const \[msg, setMsg\] = useState\(''\);/,
  `const [msg, setMsg] = useState('');\n  const [confirmDialog, setConfirmDialog] = useState<{message: string, onConfirm: () => void} | null>(null);`
);

// 2. Replace handleToggleBan
code = code.replace(
  /const handleToggleBan = async \(id: string, isBanned: boolean\) => \{\n    if \(!window\.confirm\(`Är du säker på att du vill \$\{isBanned \? 'låsa upp' : 'blockera'\} denna användare\?`\)\) return;\n    setLoading\(true\);\n    try \{\n      const \{ error \} = await supabase\.rpc\('admin_ban_user', \{ target_user_id: id, ban: !isBanned \}\);\n      if \(error\) throw error;\n      setMsg\(`🔒 Användaren har \$\{isBanned \? 'låsts upp' : 'blockerats'\}\.`\);\n      await fetchMembersList\(\);\n    \} catch \(e: unknown\) \{\n      setMsg\('❌ Admin Fel: ' \+ \(e instanceof Error \? e\.message : String\(e\)\)\);\n    \} finally \{\n      setLoading\(false\);\n    \}\n  \};/,
  `const handleToggleBan = async (id: string, isBanned: boolean) => {
    setConfirmDialog({
      message: \`Är du säker på att du vill \${isBanned ? 'låsa upp' : 'blockera'} denna användare?\`,
      onConfirm: async () => {
        setConfirmDialog(null);
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
      }
    });
  };`
);

// 3. Replace handleDeleteUser
code = code.replace(
  /const handleDeleteUser = async \(id: string, email: string\) => \{\n    if \(!window\.confirm\(`Varning! Är du HELT SÄKER på att du vill radera \$\{email\} permanent från databasen\?`\)\) return;\n    setLoading\(true\);\n    try \{\n      const \{ error \} = await supabase\.rpc\('admin_delete_user', \{ target_user_id: id \}\);\n      if \(error\) throw error;\n      setMsg\(`🗑️ Användaren \$\{email\} är raderad\.`\);\n      await fetchMembersList\(\);\n      await fetchStats\(\);\n    \} catch \(e: unknown\) \{\n      setMsg\('❌ Admin Fel: ' \+ \(e instanceof Error \? e\.message : String\(e\)\)\);\n    \} finally \{\n      setLoading\(false\);\n    \}\n  \};/,
  `const handleDeleteUser = async (id: string, email: string) => {
    setConfirmDialog({
      message: \`Varning! Är du HELT SÄKER på att du vill radera \${email} permanent från databasen?\`,
      onConfirm: async () => {
        setConfirmDialog(null);
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
      }
    });
  };`
);

// 4. Inject Dialog JSX before the final </div>
const dialogCode = `
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
`;

code = code.replace(/<\/div>\s*<\/div>,\s*document\.body\s*\)\}\s*<\/div>\s*\);\s*\}\s*$/, '        </div>,\n        document.body\n      )}\n' + dialogCode + '\n    </div>\n  );\n}\n');

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
console.log('Update finished.');
