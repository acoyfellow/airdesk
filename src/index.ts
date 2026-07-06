import { Hono } from 'hono';
import { svelteRenderer, attachSvelteRoutes } from 'svelte-hono';
import { bundles } from '../bundles.generated';
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
    title: 'airdesk — ambient agency with physical authority',
    head: `
      <meta name="description" content="Run a north star sessionlessly, then ask for one signed human decision bound to the exact irreversible action.">
      <meta property="og:title" content="airdesk">
      <meta property="og:description" content="Ambient agency with physical authority. Sign one action, not a session.">
      <meta property="og:type" content="website">
      <meta name="twitter:card" content="summary_large_image">
      <link rel="manifest" href="/manifest.json">
      <link rel="canonical" href="https://airdesk.coey.dev">
      <script>if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');</script>
    `,
  }),
);

app.get('/manifest.json', (c) => {
  return c.json({
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
  });
});

app.get('/sw.js', (c) => {
  return c.text(`const CACHE = 'airdesk-v1';
const URLS = ['/'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});`, { headers: { 'Content-Type': 'application/javascript', 'Service-Worker-Allowed': '/' } });
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