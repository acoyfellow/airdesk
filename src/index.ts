// airdesk — ambient agency with physical authority.
//
// ## Pain
// Agents either trap humans in chat supervision or receive dangerously broad
// standing authority. The human should authorize consequences, not watch labor.
//
// ## Promise
// airdesk runs a north star sessionlessly across cloud and local surfaces,
// then asks for one signed human decision bound to the exact irreversible action.
//
// ## How it works
// 1. A task is submitted to the AirDesk Workflow.
// 2. The Workflow executes the task, producing an artifact + frontier state.
// 3. At publish/merge/deploy time, a WebAuthn challenge presents:
//    - artifact hash (content-addressed, immutable)
//    - exact powers invoked
//    - evidence root
//    - alternatives
//    - expiry
// 4. Human approves or denies with a passkey signature.
// 5. Approval authorizes that action only. A changed artifact cannot reuse it.
// 6. Denial leaves the loop safely resumable.
//
// ## Load-bearing primitives
// - Durable Object + WebSockets: living artifact/frontier
// - Workflows: sessionless durable work
// - WebAuthn / COSE: human identity and signed action manifests
// - R2: immutable signed artifacts and evidence
// - MCP contracts: local/physical capabilities without ambient authority
//
// ## Limits
// - No broad "agent approved" session exists.
// - The dev signer is explicitly non-production.
// - WebAuthn is the only identity mechanism.
//
// ## Policy
// See airdesk.policy.ts — the one obvious config file.

import { Hono } from 'hono';
import { svelteRenderer, attachSvelteRoutes } from 'svelte-hono';
import { bundles } from '../bundles.generated';
// @ts-expect-error esbuild-svelte emits a Svelte component module
import AirDesk from '../site/AirDesk.svelte';
import { verifyHandler } from './verify';
import { mcpHandler } from './mcp';

const app = new Hono<{ Bindings: Env }>();

attachSvelteRoutes(app as unknown as Hono, { bundles });

// Public demo surface
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
      `,
    },
  ),
);

// Static assets
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

// API routes
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

app.post('/api/sign/:id', async (c) => {
  const name = `task-${c.req.param('id')!}`;
  const doId = c.env.AIRDESK_FRONTIER.idFromName(name);
  const stub = c.env.AIRDESK_FRONTIER.get(doId);
  const result = await stub.fetch('http://internal/sign', { method: 'POST', body: c.req.raw.body });
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