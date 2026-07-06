// Build script for airdesk svelte-hono Worker.
import { buildHonoSvelte } from 'svelte-hono/build';

const result = await buildHonoSvelte({
  workerEntry: './src/index.ts',
  outDir: './build',
  components: {
    airdesk: '../site/AirDesk.svelte',
  },
  skipWorkerBundle: true,
});

console.log(`✓ worker  ${(result.workerBytes / 1024).toFixed(1)} KB`);
for (const [id, sizes] of Object.entries(result.bundleSizes)) {
  console.log(`  client ${id}  ${(sizes.js / 1024).toFixed(1)} KB JS + ${(sizes.css / 1024).toFixed(2)} KB CSS`);
}