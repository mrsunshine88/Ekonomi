fetch('https://www.smartekonomi.nu/api/send-push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ record: { sender_type: 'user', message: 'Detta ar ett test från systemet' } })
}).then(r => r.text()).then(console.log);
