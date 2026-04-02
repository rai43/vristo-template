// Mirai Client Portal Service Worker — Push Notifications
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Mirai Services';
    const options = {
        body: data.body || '',
        icon: '/mirai-logo.png',
        badge: '/favicon.png',
        data: { url: data.url || '/portal' },
        vibrate: [200, 100, 200],
        tag: data.tag || 'mirai-notification',
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/portal';
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
            if (client.url.includes('/portal') && 'focus' in client) return client.focus();
        }
        return clients.openWindow(url);
    }));
});
