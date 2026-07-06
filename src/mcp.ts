import type { Context } from 'hono';

interface MCPRequest {
  method: string;
  params?: Record<string, unknown>;
}

export async function mcpHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const body = await c.req.json<MCPRequest>();
  const { method, params } = body;

  switch (method) {
    case 'submit_task': {
      const { northStar, powers } = params as { northStar: string; powers: string[] };
      const instance = await c.env.AIRDESK_WORKFLOW.create({
        params: { northStar, powers, timestamp: Date.now() },
      });
      return c.json({ result: { workflowId: instance.id } });
    }

    case 'get_frontier': {
      const { taskId } = params as { taskId: string };
      const id = c.env.AIRDESK_FRONTIER.idFromName(`task-${taskId}`);
      const stub = c.env.AIRDESK_FRONTIER.get(id);
      const state = await stub.fetch('http://internal/state');
      return c.json({ result: await state.json() });
    }

    case 'get_challenge': {
      const { taskId } = params as { taskId: string };
      const id = c.env.AIRDESK_FRONTIER.idFromName(`task-${taskId}`);
      const stub = c.env.AIRDESK_FRONTIER.get(id);
      const result = await stub.fetch('http://internal/challenge');
      return c.json({ result: await result.json() });
    }

    case 'register_credential': {
      const { taskId, credentialId, publicKeyCose, signCount } = params as { taskId: string; credentialId: string; publicKeyCose: number[]; signCount: number };
      const id = c.env.AIRDESK_FRONTIER.idFromName(`task-${taskId}`);
      const stub = c.env.AIRDESK_FRONTIER.get(id);
      const result = await stub.fetch('http://internal/register', {
        method: 'POST',
        body: JSON.stringify({ credentialId, publicKeyCose, signCount }),
      });
      return c.json({ result: await result.json() });
    }

    case 'sign_action': {
      const { taskId, credentialId, clientDataJSON, authenticatorData, signature, signer } = params as {
        taskId: string; credentialId: string; clientDataJSON: string; authenticatorData: string; signature: string; signer: string;
      };
      const id = c.env.AIRDESK_FRONTIER.idFromName(`task-${taskId}`);
      const stub = c.env.AIRDESK_FRONTIER.get(id);
      const result = await stub.fetch('http://internal/sign', {
        method: 'POST',
        body: JSON.stringify({ credentialId, clientDataJSON, authenticatorData, signature, signer }),
      });
      return c.json({ result: await result.json() });
    }

    case 'dev_sign': {
      const { taskId, signature, signer } = params as { taskId: string; signature: string; signer: string };
      const id = c.env.AIRDESK_FRONTIER.idFromName(`task-${taskId}`);
      const stub = c.env.AIRDESK_FRONTIER.get(id);
      const result = await stub.fetch('http://internal/dev-sign', {
        method: 'POST',
        body: JSON.stringify({ signature, signer }),
      });
      return c.json({ result: await result.json() });
    }

    case 'deny_action': {
      const { taskId } = params as { taskId: string };
      const id = c.env.AIRDESK_FRONTIER.idFromName(`task-${taskId}`);
      const stub = c.env.AIRDESK_FRONTIER.get(id);
      const result = await stub.fetch('http://internal/deny', { method: 'POST' });
      return c.json({ result: await result.json() });
    }

    case 'verify': {
      const { taskId } = params as { taskId: string };
      const manifestObj = await c.env.AIRDESK_ARTIFACTS.get(`manifests/${taskId}.json`);
      if (!manifestObj) {
        return c.json({ error: 'manifest not found' }, 404);
      }
      const manifest = JSON.parse(await manifestObj.text());
      return c.json({ result: manifest });
    }

    default:
      return c.json({ error: `unknown method: ${method}` }, 400);
  }
}