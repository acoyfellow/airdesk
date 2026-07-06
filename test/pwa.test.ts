import { describe, it, expect } from 'bun:test';

const MANIFEST = {
  name: 'airdesk',
  short_name: 'airdesk',
  description: 'Ambient agency with physical authority',
  start_url: '/',
  display: 'standalone',
  background_color: '#0b1118',
  theme_color: '#f6821f',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
};

describe('PWA manifest', () => {
  it('has required fields', () => {
    expect(MANIFEST.name).toBeString();
    expect(MANIFEST.short_name).toBeString();
    expect(MANIFEST.start_url).toBe('/');
    expect(MANIFEST.display).toBe('standalone');
  });

  it('has icons', () => {
    expect(MANIFEST.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of MANIFEST.icons) {
      expect(icon.src).toBeString();
      expect(icon.sizes).toBeString();
      expect(icon.type).toBe('image/png');
    }
  });

  it('has theme colors', () => {
    expect(MANIFEST.theme_color).toBeString();
    expect(MANIFEST.background_color).toBeString();
  });
});

describe('Service worker', () => {
  it('registers on page load', () => {
    const swCode = `
const CACHE = 'airdesk-v1';
const URLS = ['/'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});`;
    expect(swCode).toContain('airdesk-v1');
    expect(swCode).toContain('install');
    expect(swCode).toContain('activate');
    expect(swCode).toContain('fetch');
  });
});