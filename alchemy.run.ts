// alchemy.run.ts — deploy path for airdesk.
// Usage: alchemy deploy | alchemy destroy

const config = {
  name: 'airdesk',
  worker: {
    entry: './build/worker.bundled.mjs',
    compatibilityDate: '2026-04-21',
    compatibilityFlags: ['nodejs_compat'],
    durableObjects: {
      AIRDESK_FRONTIER: { className: 'AirDeskFrontier' },
    },
    workflows: [{ binding: 'AIRDESK_WORKFLOW', className: 'AirDeskWorkflow' }],
    r2Buckets: [{ binding: 'AIRDESK_ARTIFACTS', bucketName: 'airdesk-artifacts' }],
  },
  routes: [
    { pattern: 'airdesk.coey.dev', zone: 'coey.dev' },
  ],
};

export default config;