const fs = require('fs');
const path = 'SYSTEM_DOKUMENTATION.md';
let doc = fs.readFileSync(path, 'utf8');

const newSection = `
### Version 2.2.0 (Senaste ändringar - Admin & UX)
- **FAQ Uppdaterad:** Instruktionen för att avsluta prenumerationen pekar nu korrekt till "Inställningar" i sidomenyn.
- **Admin UI Rutor:** Ersatte webbläsarens inbyggda \`window.confirm\` (Windows-rutor) med skräddarsydda React Portal-modaler för blockering och radering av användare för en mycket modernare känsla.
- **Globala Admin-notiser (Toasts):** Flyttade admin-meddelanden från vanliga divs till en global "Toast"-notis högst upp på skärmen. Notiserna svävar över alla vyer och stänger ner sig automatiskt efter 5 sekunder via en timer.
- **Realtidsuppdateringar för Admin:** Applikationen prenumererar nu på \`postgres_changes\` från tabellen \`system_admins\` (filtrerat på \`user_id\`). När en användare får administratörsrättigheter uppdateras deras \`AuthContext\` omedelbart via WebSocket, och "Admin"-knappen i sidomenyn ploppar upp på direkten utan behov av siduppdatering (F5).
- **Åtgärdad VIP-logik:** Byggde om funktionerna \`set_household_vip_by_email\` och \`revoke_household_vip_by_email\` till enhetliga PL/pgSQL-funktioner (TEXT). Löste en databaskonflikt så att VIP-knappen nu kan togglas felfritt.
- **Dold VIP-knapp för ägare:** För root-administratören döljs VIP-knappen helt från adminpanelens medlemslista för att hålla gränssnittet rent.
- **Korrekt Betalningsstatistik:** Funktionen \`get_admin_stats()\` räknar nu endast hushåll med \`stripe_status = 'active'\`. VIP-konton ingår inte längre i rutan "Betalande Hushåll".
- **Svenskt Inloggningsfel:** Fångar upp Supabase-felet "User is banned" och visar tydligt texten "Ditt konto är blockerat av en administratör."
`;

if (doc.includes('## 🔄 Versionshistorik')) {
  doc = doc.replace('## 🔄 Versionshistorik', '## 🔄 Versionshistorik\n' + newSection);
} else {
  doc += '\n\n## 🔄 Versionshistorik\n' + newSection;
}

fs.writeFileSync(path, doc);
console.log('Documentation updated!');
