self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {}; try { payload = event.data?.json() || {}; } catch { /* Invalid push remains generic. */ }
    const route = typeof payload.route === 'string' && /^\/(assignments|matches\/[-\w]+)$/.test(payload.route) ? payload.route : '/assignments';
    await self.registration.showNotification('Argus scouting update', { body: 'Open Argus to review your assignments or handoffs.', tag: typeof payload.tag === 'string' ? payload.tag.slice(0,100) : 'argus', data: { route }, icon: '/app-icon.svg' });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const route = event.notification.data?.route || '/assignments';
    const url = new URL(`/#${route}`, self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); await existing.focus(); } else await self.clients.openWindow(url);
  })());
});
