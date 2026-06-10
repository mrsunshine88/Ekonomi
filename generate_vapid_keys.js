import webpush from 'web-push';
const vapidKeys = webpush.generateVAPIDKeys();

console.log('--- VAPID KEYS GENERATED ---');
console.log('Kopiera dessa nycklar!');
console.log('');
console.log('Public Key (Lägg denna i din .env-fil som VITE_VAPID_PUBLIC_KEY):');
console.log(vapidKeys.publicKey);
console.log('');
console.log('Private Key (Denna ska sparas säkert i din backend, t.ex. Vercel Environment Variables):');
console.log(vapidKeys.privateKey);
console.log('----------------------------');
