const fs = require('fs');

let content = fs.readFileSync('src/store.ts', 'utf8');

const functionsToPatch = [
  'updateBillAmount', 'addBill', 'removeBill', 'updateBill',
  'addAccount', 'removeAccount', 'updateAccount', 'copyFromPreviousMonth',
  'toggleHandled', 'addPrivateBill', 'removePrivateBill', 'updatePrivateBill',
  'updatePrivateBillAmount', 'copyPrivateFromPreviousMonth', 'togglePrivateLock',
  'updateSettings', 'confirmAnomaly', 'confirmPrivateAnomaly'
];

functionsToPatch.forEach(fn => {
  const regex = new RegExp(`(${fn}:\\s*async\\s*\\([^)]*\\)\\s*=>\\s*\\{)`);
  content = content.replace(regex, `$1\n    if (!navigator.onLine) { toast.error('Du är offline. Ändringen sparades inte.', { id: 'offline' }); return; }`);
});

fs.writeFileSync('src/store.ts', content);
console.log('Done!');
