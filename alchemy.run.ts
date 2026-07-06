// alchemy.run.ts — deploy path for airdesk.
// Usage: alchemy deploy | alchemy destroy
// Requires `alchemy` package: bun add -d alchemy

import type { AlchemyConfig } from 'alchemy';

const config: AlchemyConfig = {
  name: 'airdesk',
  worker: {
    entry: './build/worker.bundled.mjs',
    compatibilityDate: '2026-04-21',
    compatibilityFlags: ['nodejs_compat'],
    durableObjects: {
      AIRDESK_FRONTIER: { className: 'AirDeskFrontier' },
    },
    workflows: ['AIRDESK_WORKFLOW'],
    r2Buckets: ['AIRDESK_ARTIFACTS'],
  },
  routes: [
    { pattern: 'airdesk.coey.dev', zone: 'coey.dev' },
  ],
};

export default config;