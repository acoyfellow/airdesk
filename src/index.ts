import { Hono } from 'hono';
import { svelteRenderer, attachSvelteRoutes } from 'svelte-hono';
import { bundles } from './bundles.generated';
// @ts-expect-error esbuild-svelte emits a Svelte component module
import AirDesk from '../site/AirDesk.svelte';
import { verifyHandler } from './verify';
import { mcpHandler } from './mcp';
import AirDeskFrontier from './frontier';
import { AirDeskWorkflow } from './workflow';

export { AirDeskFrontier, AirDeskWorkflow };

const app = new Hono<{ Bindings: Env }>();

attachSvelteRoutes(app as unknown as Hono, { bundles });

app.get(
  '/',
  svelteRenderer(AirDesk, {
    hydrateAs: 'airdesk',
    title: 'airdesk — give an AI a job, approve the one step it cannot undo',
    head: `
<meta name="description" content="Tell an AI what to do, let it work in the background, then approve the exact action with your phone or passkey. No babysitting a chat." />
<meta name="theme-color" content="#0b1118" />
<link rel="canonical" href="https://airdesk.coey.dev" />
<meta property="og:title" content="airdesk — give an AI a job, approve the one step it cannot undo" />
<meta property="og:description" content="Tell an AI what to do, let it work in the background, then approve the exact action with your phone or passkey. No babysitting a chat." />
<meta property="og:url" content="https://airdesk.coey.dev" />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://airdesk.coey.dev/share.svg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:type" content="image/svg+xml" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="airdesk — give an AI a job, approve the one step it cannot undo" />
<meta name="twitter:description" content="Tell an AI what to do, let it work in the background, then approve the exact action with your phone or passkey. No babysitting a chat." />
<meta name="twitter:image" content="https://airdesk.coey.dev/share.svg" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="manifest" href="/manifest.json" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<script>if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js')}</script>
`.trim(),
  }),
);

app.get('/favicon.svg', (c) => {
  return c.body(faviconSvg, 200, { 'Content-Type': 'image/svg+xml' });
});

app.get('/manifest.json', (c) => {
  return c.json(manifest);
});

app.get('/sw.js', (c) => {
  return c.body(swJs, 200, { 'Content-Type': 'application/javascript' });
});

app.get('/icon-192.svg', (c) => {
  return c.body(icon192Svg, 200, { 'Content-Type': 'image/svg+xml' });
});

app.get('/icon-512.svg', (c) => {
  return c.body(icon512Svg, 200, { 'Content-Type': 'image/svg+xml' });
});

app.get('/share.svg', (c) => {
  return c.body(shareSvg, 200, { 'Content-Type': 'image/svg+xml' });
});

app.get('/robots.txt', (c) => {
  return c.text('User-agent: *\nAllow: /\n\nSitemap: https://airdesk.coey.dev/sitemap.xml\n');
});

app.get('/sitemap.xml', (c) => {
  return c.text(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://airdesk.coey.dev/</loc></url>
</urlset>`,
    200,
    { 'Content-Type': 'application/xml' },
  );
});

app.post('/api/task', async (c) => {
  const { northStar, powers } = await c.req.json<{ northStar: string; powers: string[] }>();
  const instance = await c.env.AIRDESK_WORKFLOW.create({
    params: { northStar, powers, timestamp: Date.now() },
  });
  return c.json({ workflowId: instance.id });
});

app.get('/api/frontier/:id', async (c) => {
  const name = c.req.param('id')!;
  const doId = c.env.AIRDESK_FRONTIER.idFromName(name);
  const stub = c.env.AIRDESK_FRONTIER.get(doId);
  const state = await stub.fetch('http://internal/state');
  return c.json(await state.json());
});

app.get('/api/challenge/:id', async (c) => {
  const name = `task-${c.req.param('id')!}`;
  const doId = c.env.AIRDESK_FRONTIER.idFromName(name);
  const stub = c.env.AIRDESK_FRONTIER.get(doId);
  const result = await stub.fetch('http://internal/challenge');
  return c.json(await result.json());
});

app.post('/api/register/:id', async (c) => {
  const name = `task-${c.req.param('id')!}`;
  const doId = c.env.AIRDESK_FRONTIER.idFromName(name);
  const stub = c.env.AIRDESK_FRONTIER.get(doId);
  const result = await stub.fetch('http://internal/register', { method: 'POST', body: c.req.raw.body });
  return c.json(await result.json());
});

app.post('/api/sign/:id', async (c) => {
  const name = `task-${c.req.param('id')!}`;
  const doId = c.env.AIRDESK_FRONTIER.idFromName(name);
  const stub = c.env.AIRDESK_FRONTIER.get(doId);
  const result = await stub.fetch('http://internal/sign', { method: 'POST', body: c.req.raw.body });
  return c.json(await result.json());
});

app.post('/api/dev-sign/:id', async (c) => {
  const name = `task-${c.req.param('id')!}`;
  const doId = c.env.AIRDESK_FRONTIER.idFromName(name);
  const stub = c.env.AIRDESK_FRONTIER.get(doId);
  const result = await stub.fetch('http://internal/dev-sign', { method: 'POST', body: c.req.raw.body });
  return c.json(await result.json());
});

app.post('/api/deny/:id', async (c) => {
  const name = `task-${c.req.param('id')!}`;
  const doId = c.env.AIRDESK_FRONTIER.idFromName(name);
  const stub = c.env.AIRDESK_FRONTIER.get(doId);
  const result = await stub.fetch('http://internal/deny', { method: 'POST' });
  return c.json(await result.json());
});

app.get('/api/verify/:id', async (c) => {
  return verifyHandler(c);
});

app.post('/api/mcp', async (c) => {
  return mcpHandler(c);
});

export default app;

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="16" fill="#0b1118"/>
  <text x="50" y="68" font-family="Inter, sans-serif" font-size="48" font-weight="800" fill="#f6821f" text-anchor="middle">A</text>
  <circle cx="78" cy="22" r="8" fill="none" stroke="#f7b53b" stroke-width="2" opacity="0.6"/>
  <circle cx="85" cy="30" r="4" fill="none" stroke="#71b8d8" stroke-width="1.5" opacity="0.4"/>
</svg>`;

const manifest = {
  name: 'airdesk — give an AI a job, approve the one step it cannot undo',
  short_name: 'airdesk',
  description:
    'Tell an AI what to do, let it work in the background, then approve the exact action with your phone or passkey.',
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

const swJs = `const CACHE = 'airdesk-v1';
const ASSETS = ['/','/favicon.svg','/manifest.json','/icon-192.svg','/icon-512.svg'];
self.addEventListener('install',(e)=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('fetch',(e)=>{e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)))});
self.addEventListener('activate',(e)=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))))});`;

const icon192Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="32" fill="#0b1118"/>
  <text x="96" y="130" font-family="Inter, sans-serif" font-size="96" font-weight="800" fill="#f6821f" text-anchor="middle">A</text>
  <circle cx="150" cy="42" r="16" fill="none" stroke="#f7b53b" stroke-width="3" opacity="0.6"/>
  <circle cx="164" cy="58" r="8" fill="none" stroke="#71b8d8" stroke-width="2" opacity="0.4"/>
</svg>`;

const icon512Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#0b1118"/>
  <text x="256" y="340" font-family="Inter, sans-serif" font-size="240" font-weight="800" fill="#f6821f" text-anchor="middle">A</text>
  <circle cx="400" cy="112" r="40" fill="none" stroke="#f7b53b" stroke-width="6" opacity="0.6"/>
  <circle cx="436" cy="156" r="20" fill="none" stroke="#71b8d8" stroke-width="4" opacity="0.4"/>
</svg>`;

const shareSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs><radialGradient id="b" cx="50%" cy="40%" r="60%"><stop offset="0%" stop-color="#f7b53b" stop-opacity="0.12"/><stop offset="100%" stop-color="#0b1118" stop-opacity="0"/></radialGradient></defs>
  <rect width="1200" height="630" fill="#0b1118"/>
  <rect width="1200" height="630" fill="url(#b)"/>
  <rect width="1200" height="630" fill="none" stroke="rgba(174,196,216,0.14)" stroke-width="1"/>
  <g transform="translate(80,80)"><rect width="80" height="80" rx="16" fill="#0b1118" stroke="#f6821f" stroke-width="2"/><text x="40" y="54" font-family="Inter,sans-serif" font-size="40" font-weight="800" fill="#f6821f" text-anchor="middle">A</text></g>
  <text x="180" y="120" font-family="Inter,sans-serif" font-size="48" font-weight="800" fill="#f7f9fb" letter-spacing="-0.03em">airdesk</text>
  <text x="180" y="156" font-family="IBM Plex Mono,monospace" font-size="20" fill="#9baaba" letter-spacing="0.18em">[ GIVE AN AI A JOB, APPROVE THE ONE STEP IT CANNOT UNDO ]</text>
  <line x1="80" y1="200" x2="1120" y2="200" stroke="rgba(174,196,216,0.14)" stroke-width="1"/>
  <text x="80" y="260" font-family="Inter,sans-serif" font-size="28" font-weight="600" fill="#f7b53b" letter-spacing="-0.02em">The pain</text>
  <text x="80" y="300" font-family="Inter,sans-serif" font-size="22" fill="#9baaba">Agents either trap humans in chat supervision or receive</text>
  <text x="80" y="336" font-family="Inter,sans-serif" font-size="22" fill="#9baaba">dangerously broad standing authority. The human should</text>
  <text x="80" y="372" font-family="Inter,sans-serif" font-size="22" fill="#9baaba">authorize consequences, not watch labor.</text>
  <text x="80" y="440" font-family="Inter,sans-serif" font-size="28" font-weight="600" fill="#f7b53b" letter-spacing="-0.02em">The fix</text>
  <text x="80" y="480" font-family="Inter,sans-serif" font-size="22" fill="#f6821f">Tell it what to do, let it work in the background,</text>
  <text x="80" y="516" font-family="Inter,sans-serif" font-size="22" fill="#f6821f">then approve the exact action with your phone</text>
  <text x="80" y="552" font-family="Inter,sans-serif" font-size="22" fill="#f6821f">or passkey. No babysitting a chat.</text>
  <text x="1120" y="600" font-family="IBM Plex Mono,monospace" font-size="14" fill="#9baaba" text-anchor="end">airdesk.coey.dev</text>
</svg>`;