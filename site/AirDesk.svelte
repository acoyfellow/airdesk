<script>
  let { taskId = '', status = 'idle', artifactHash = '', powers = [], expiry = '' } = $props();
  let northStar = $state('');
  let selectedPowers = $state(['deploy']);
  let frontierStatus = $state('');
  let polling = $state(false);

  async function submitTask() {
    const res = await fetch('/api/task', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ northStar, powers: selectedPowers }),
    });
    const data = await res.json();
    taskId = data.workflowId;
    status = 'running';
    startPolling();
  }

  function startPolling() {
    polling = true;
    const interval = setInterval(async () => {
      if (!taskId) { clearInterval(interval); return; }
      const res = await fetch(`/api/frontier/task-${taskId}`);
      const data = await res.json();
      frontierStatus = data.status;
      artifactHash = data.artifactHash || '';
      powers = data.powers || [];
      expiry = data.expiry ? new Date(data.expiry).toISOString() : '';
      status = data.status;
      if (['signed', 'denied', 'executed'].includes(data.status)) {
        clearInterval(interval);
        polling = false;
      }
    }, 2000);
  }

  function base64UrlToArray(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Uint8Array.from(atob(s), c => c.charCodeAt(0));
  }

  function arrayToHex(arr) {
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function signAction() {
    const challengeRes = await fetch(`/api/challenge/${taskId}`);
    const challengeData = await challengeRes.json();
    if (challengeData.error) { alert(challengeData.error); return; }

    const publicKey = {
      challenge: base64UrlToArray(challengeData.challenge),
      rp: { name: challengeData.rpName, id: challengeData.rpId },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'operator',
        displayName: 'Operator',
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      timeout: 60000,
      authenticatorSelection: { userVerification: 'required' },
    };

    let credential;
    try {
      credential = await navigator.credentials.create({ publicKey });
    } catch (e) {
      alert('Passkey creation failed: ' + e.message);
      return;
    }

    const cred = credential;
    const authData = new Uint8Array(cred.response.getAuthenticatorData());
    const clientData = new Uint8Array(cred.response.getClientDataJSON());
    const sig = new Uint8Array(cred.response.signature);
    const publicKeyCose = new Uint8Array(cred.response.getPublicKey());

    const registerRes = await fetch(`/api/register/${taskId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        credentialId: arrayToHex(new Uint8Array(cred.rawId)),
        publicKeyCose: Array.from(publicKeyCose),
        signCount: 0,
      }),
    });

    const signRes = await fetch(`/api/sign/${taskId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        credentialId: arrayToHex(new Uint8Array(cred.rawId)),
        clientDataJSON: arrayToHex(clientData),
        authenticatorData: arrayToHex(authData),
        signature: arrayToHex(sig),
        signer: 'passkey',
      }),
    });
    const data = await signRes.json();
    status = data.status;
  }

  async function denyAction() {
    const res = await fetch(`/api/deny/task-${taskId}`, { method: 'POST' });
    const data = await res.json();
    status = data.status;
  }
</script>

<main>
  <div class="eyebrow">airdesk</div>
  <h1>Give an AI a job, approve the one step it cannot undo</h1>

  {#if status === 'idle'}
    <form onsubmit={(e) => { e.preventDefault(); submitTask(); }}>
      <label>
        <span>What should the AI do?</span>
        <input bind:value={northStar} placeholder="e.g. deploy the latest build to production" />
      </label>
      <label>
        <span>What can it do?</span>
        <select multiple bind:value={selectedPowers}>
          <option value="deploy">deploy</option>
          <option value="publish">publish</option>
          <option value="merge">merge</option>
          <option value="delete">delete</option>
          <option value="modify_production">modify_production</option>
        </select>
      </label>
      <button type="submit">Start</button>
    </form>
  {:else if status === 'running'}
    <div class="status">
      <p>Working on it: <strong>{taskId}</strong></p>
      <p>The AI is running in the background...</p>
    </div>
  {:else if status === 'awaiting_signature'}
    <div class="signature-panel">
      <div class="eyebrow">needs your approval</div>
      <h2>Review before approving</h2>
      <dl>
        <dt>Task</dt>
        <dd>{taskId}</dd>
        <dt>What you're approving</dt>
        <dd class="mono">{artifactHash}</dd>
        <dt>Powers</dt>
        <dd>{powers.join(', ')}</dd>
        <dt>Expires</dt>
        <dd>{expiry}</dd>
      </dl>
      <div class="actions">
        <button class="approve" onclick={signAction}>Approve with passkey</button>
        <button class="deny" onclick={denyAction}>Deny</button>
      </div>
    </div>
  {:else if status === 'signed'}
    <div class="status success">
      <p>Approved. Executing...</p>
      <p class="mono">Receipt stored in R2</p>
    </div>
  {:else if status === 'denied'}
    <div class="status denied">
      <p>Denied. You can try again with a different job.</p>
      <button onclick={() => { status = 'idle'; taskId = ''; }}>Start New</button>
    </div>
  {:else if status === 'executed'}
    <div class="status success">
      <p>Done.</p>
      <p class="mono">Artifact: {artifactHash}</p>
      <button onclick={() => { status = 'idle'; taskId = ''; }}>Start New</button>
    </div>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: Inter, system-ui, sans-serif;
    background: #0b1118;
    color: #f7f9fb;
  }
  main {
    max-width: 640px;
    margin: 4rem auto;
    padding: 0 1rem;
  }
  .eyebrow {
    font-family: 'IBM Plex Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.75rem;
    color: #f6821f;
    margin-bottom: 0.5rem;
  }
  .eyebrow::before {
    content: '[ ';
  }
  .eyebrow::after {
    content: ' ]';
  }
  h1 {
    font-size: 2rem;
    letter-spacing: -0.03em;
    font-weight: 800;
    margin: 0 0 2rem;
  }
  h2 {
    font-size: 1.25rem;
    letter-spacing: -0.03em;
    font-weight: 700;
    margin: 0 0 1rem;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  label span {
    font-size: 0.875rem;
    color: #9baaba;
  }
  input, select {
    background: #111a24;
    border: 1px solid rgba(174,196,216,.14);
    border-radius: 0.45rem;
    padding: 0.75rem;
    color: #f7f9fb;
    font-size: 1rem;
  }
  button {
    background: #f6821f;
    color: #0b1118;
    border: none;
    border-radius: 0.45rem;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
  }
  button.deny {
    background: transparent;
    color: #ff7d68;
    border: 1px solid #ff7d68;
  }
  button.approve {
    background: #63d5a2;
    color: #0b1118;
  }
  .actions {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }
  .signature-panel {
    background: #111a24;
    border: 1px solid rgba(174,196,216,.14);
    border-radius: 0.7rem;
    padding: 1.5rem;
  }
  .signature-panel dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem 1rem;
    font-size: 0.875rem;
  }
  .signature-panel dt {
    color: #9baaba;
  }
  .mono {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
    word-break: break-all;
  }
  .status {
    padding: 1.5rem;
    border-radius: 0.7rem;
    background: #111a24;
    border: 1px solid rgba(174,196,216,.14);
  }
  .status.success {
    border-color: #63d5a2;
  }
  .status.denied {
    border-color: #ff7d68;
  }
</style>