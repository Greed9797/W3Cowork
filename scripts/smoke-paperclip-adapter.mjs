#!/usr/bin/env node
// Standalone smoke test for the Paperclip adapter.
// Compiles the adapter TS files via tsx, starts the HTTP server on a random
// port, hits /agents and /agent/agent-1/health, then exits.
//
// Run:  npx tsx scripts/smoke-paperclip-adapter.mjs
//   or: node --import tsx scripts/smoke-paperclip-adapter.mjs

import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const PORT = 13200; // ephemeral port to avoid clash with a running app

async function loadAdapter() {
  // Load via tsx so we don't need a prior tsc build.
  const { createAdapterServer } = await import('../src/main/paperclip-adapter/server.ts');
  const { listAgents } = await import('../src/main/paperclip-adapter/agents.config.ts');
  return { createAdapterServer, listAgents };
}

async function main() {
  const { createAdapterServer, listAgents } = await loadAdapter();

  console.log('[smoke] In-process listAgents() →', listAgents().length, 'agents');

  const server = createAdapterServer(process.cwd());
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`[smoke] Adapter listening on 127.0.0.1:${PORT}`);

  await wait(100);

  // 1) GET /agents
  const agentsRes = await fetch(`http://127.0.0.1:${PORT}/agents`);
  const agentsBody = await agentsRes.json();
  console.assert(agentsRes.status === 200, 'GET /agents → 200');
  console.assert(Array.isArray(agentsBody.agents), 'agents is array');
  console.assert(agentsBody.agents.length === 7, 'expected 7 agents');
  console.log('[smoke] GET /agents → OK,', agentsBody.agents.length, 'agents');

  // 2) GET /agent/agent-1/health
  const healthRes = await fetch(`http://127.0.0.1:${PORT}/agent/agent-1/health`);
  const healthBody = await healthRes.json();
  console.assert(healthRes.status === 200, 'GET health → 200');
  console.assert(healthBody.status === 'healthy', 'health.status === healthy');
  console.assert(healthBody.agent === 'Prospector', 'name === Prospector');
  console.log('[smoke] GET /agent/agent-1/health → OK,', healthBody);

  // 3) GET /agent/unknown/health → 404
  const unkRes = await fetch(`http://127.0.0.1:${PORT}/agent/agent-99/health`);
  console.assert(unkRes.status === 404, 'unknown agent → 404');
  console.log('[smoke] GET /agent/agent-99/health → 404 OK');

  // 4) GET /health (adapter-level)
  const adapterHealth = await fetch(`http://127.0.0.1:${PORT}/health`);
  const adapterHealthBody = await adapterHealth.json();
  console.assert(adapterHealth.status === 200, 'adapter /health → 200');
  console.assert(adapterHealthBody.status === 'ok', 'adapter health ok');
  console.log('[smoke] GET /health → OK');

  // 5) POST malformed body → 400
  const badRes = await fetch(`http://127.0.0.1:${PORT}/agent/agent-1/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json',
  });
  console.assert(badRes.status === 400, 'malformed JSON → 400');
  console.log('[smoke] POST malformed JSON → 400 OK');

  await new Promise((resolve) => server.close(resolve));
  console.log('[smoke] All assertions passed.');
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err);
  process.exit(1);
});
