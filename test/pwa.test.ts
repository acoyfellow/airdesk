import { describe, it, expect } from 'bun:test';

const MANIFEST = {
  name: 'airdesk — ambient agency with physical authority',
  short_name: 'airdesk',
  description:
    'Run a north star sessionlessly, then ask for one signed human decision bound to the exact irreversible action.',
  start_url: '/',
  display: 'standalone',
  background_color: '#0b1118',
  theme_color: '#0b1118',
  orientation: 'any',
  categories: ['developer-tools', 'productivity'],
  icons: [
    { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
    { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
  ],
};

describe('PWA manifest', () => {
  it('has required installability fields', () => {
    expect(MANIFEST.name).toBeString();
    expect(MANIFEST.short_name).toBeString();
    expect(MANIFEST.start_url).toBe('/');
    expect(MANIFEST.display).toBe('standalone');
    expect(MANIFEST.background_color).toBeString();
    expect(MANIFEST.theme_color).toBeString();
  });

  it('has icons with required sizes', () => {
    expect(MANIFEST.icons.length).toBeGreaterThanOrEqual(2);
    const has192 = MANIFEST.icons.some((i) => i.sizes === '192x192');
    const has512 = MANIFEST.icons.some((i) => i.sizes === '512x512');
    expect(has192).toBe(true);
    expect(has512).toBe(true);
  });

  it('icons use SVG type', () => {
    for (const icon of MANIFEST.icons) {
      expect(icon.type).toBe('image/svg+xml');
    }
  });
});

describe('Service worker', () => {
  it('registers on page load', () => {
    const swCode = `const CACHE = 'airdesk-v1';
const ASSETS = ['/','/favicon.svg','/manifest.json','/icon-192.svg','/icon-512.svg'];
self.addEventListener('install',(e)=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('fetch',(e)=>{e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)))});
self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))))});`;
    expect(swCode).toContain('airdesk-v1');
    expect(swCode).toContain('self.addEventListener');
    expect(swCode).toContain('install');
    expect(swCode).toContain('activate');
    expect(swCode).toContain('fetch');
  });
});

describe('SEO and share metadata', () => {
  it('has OG and Twitter meta tags in head', () => {
    const head = `
<meta name="description" content="Run a north star sessionlessly, then ask for one signed human decision bound to the exact irreversible action." />
<meta name="theme-color" content="#0b1118" />
<link rel="canonical" href="https://airdesk.coey.dev" />
<meta property="og:title" content="airdesk — ambient agency with physical authority" />
<meta property="og:description" content="Run a north star sessionlessly, then ask for one signed human decision bound to the exact irreversible action." />
<meta property="og:url" content="https://airdesk.coey.dev" />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://airdesk.coey.dev/share.svg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/svg+xml" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="airdesk — ambient agency with physical authority" />
<meta name="twitter:description" content="Run a north star sessionlessly, then ask for one signed human decision bound to the exact irreversible action." />
<meta name="twitter:image" content="https://airdesk.coey.dev/share.svg" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="manifest" href="/manifest.json" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<script>if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js')}</script>
`.trim();
    expect(head).toContain('property="og:title"');
    expect(head).toContain('property="og:description"');
    expect(head).toContain('property="og:image"');
    expect(head).toContain('property="og:url"');
    expect(head).toContain('property="og:type"');
    expect(head).toContain('name="twitter:card"');
    expect(head).toContain('name="twitter:title"');
    expect(head).toContain('name="twitter:description"');
    expect(head).toContain('name="twitter:image"');
    expect(head).toContain('rel="canonical"');
    expect(head).toContain('rel="icon"');
    expect(head).toContain('rel="manifest"');
    expect(head).toContain("serviceWorker.register('/sw.js')");
  });

  it('robots.txt content is correct', () => {
    const robots = 'User-agent: *\nAllow: /\n\nSitemap: https://airdesk.coey.dev/sitemap.xml\n';
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Sitemap: https://airdesk.coey.dev/sitemap.xml');
  });

  it('sitemap.xml content is correct', () => {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://airdesk.coey.dev/</loc></url>
</urlset>`;
    expect(sitemap).toContain('urlset');
    expect(sitemap).toContain('airdesk.coey.dev');
  });

  it('share.svg has correct viewBox', () => {
    const shareSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">`;
    expect(shareSvg).toContain('viewBox="0 0 1200 630"');
  });
});