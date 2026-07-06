// AirDesk Workflow — sessionless durable work execution.
// Runs a north star task to completion, then pauses for human signature.

import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';

interface WorkflowParams {
  northStar: string;
  powers: string[];
  timestamp: number;
}

export class AirDeskWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { northStar, powers } = event.payload;

    // Step 1: Initialize frontier
    const frontierId = await step.do('init frontier', async () => {
      const id = this.env.AIRDESK_FRONTIER.idFromName(`task-${event.instanceId}`);
      const stub = this.env.AIRDESK_FRONTIER.get(id);
      await stub.fetch('http://internal/init', {
        method: 'POST',
        body: JSON.stringify({
          taskId: event.instanceId,
          northStar,
          powers,
        }),
      });
      return event.instanceId;
    });

    // Step 2: Execute task (simulated — real impl would run agent work here)
    const artifact = await step.do('execute task', async () => {
      // Simulated execution: produce artifact hash
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ northStar, powers, result: 'simulated' }));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return { artifactHash: hash, evidenceRoot: hash.slice(0, 16), alternatives: ['deny', 'modify'] };
    });

    // Step 3: Publish artifact for human signature
    await step.do('publish for signature', async () => {
      const id = this.env.AIRDESK_FRONTIER.idFromName(`task-${frontierId}`);
      const stub = this.env.AIRDESK_FRONTIER.get(id);
      await stub.fetch('http://internal/publish', {
        method: 'POST',
        body: JSON.stringify({
          artifactHash: artifact.artifactHash,
          evidenceRoot: artifact.evidenceRoot,
          alternatives: artifact.alternatives,
          expiry: Date.now() + 3600_000, // 1 hour
        }),
      });
    });

    // Step 4: Wait for human decision (polled externally via PWA/WebSocket)
    // The workflow stays alive; the PWA surface polls /api/frontier/:id
    // until status changes to signed or denied.

    // Step 5: Execute on approval (triggered externally via /api/sign)
    return { frontierId, artifactHash: artifact.artifactHash };
  }
}