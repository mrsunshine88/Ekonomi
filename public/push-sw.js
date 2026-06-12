self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'Ekonomi & Swish';
    const options = {
      body: data.body || 'Dags att betala räkningar!',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});

// A dummy fetch handler to satisfy Chrome's PWA installability requirements
self.addEventListener('fetch', function(event) {
  // We don't do anything here, we just need to have a fetch listener
});
