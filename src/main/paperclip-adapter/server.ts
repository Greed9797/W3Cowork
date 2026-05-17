/**
 * @module main/paperclip-adapter/server
 *
 * Lightweight HTTP server exposing the W3Cowork agents to the Paperclip
 * orchestrator. Uses Node's built-in `http` module (no express) to keep
 * the Electron bundle small and avoid a new dependency.
 *
 * Routes:
 *   GET  /agents                       — list all configured agents
 *   GET  /agent/:id/health             — health check for a single agent
 *   POST /agent/:id/heartbeat          — execute a task via the agent
 *
 * Heartbeat body:
 *   { task: { title?, description? }, context: {...}, budget?: number }
 *
 * Heartbeat response:
 *   { status: "completed"|"failed", agentId, result?, outputFiles?, durationMs?, error? }
 */

import http, { IncomingMessage, ServerResponse } from 'http';
import { getAgent, listAgents } from './agents.config';
import { runAgentTask } from './runner';

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB safety cap

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let received = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        req.destroy();
        return reject(new Error(`Request body exceeds ${MAX_BODY_BYTES} bytes`));
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${(err as Error).message}`));
      }
    });
    req.on('error', reject);
  });
}

function matchAgentRoute(
  pathname: string
): { agentId: string; action: 'health' | 'heartbeat' } | null {
  // /agent/<id>/health  or /agent/<id>/heartbeat
  const m = /^\/agent\/([^/]+)\/(health|heartbeat)$/.exec(pathname);
  if (!m) return null;
  return { agentId: m[1], action: m[2] as 'health' | 'heartbeat' };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  workspaceRoot: string
): Promise<void> {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/agents') {
    return sendJson(res, 200, { agents: listAgents() });
  }

  if (req.method === 'GET' && pathname === '/health') {
    return sendJson(res, 200, { status: 'ok', service: 'paperclip-adapter' });
  }

  const route = matchAgentRoute(pathname);
  if (route) {
    const agent = getAgent(route.agentId);
    if (!agent) return sendJson(res, 404, { error: `Agent ${route.agentId} not found` });

    if (route.action === 'health' && req.method === 'GET') {
      return sendJson(res, 200, {
        status: 'healthy',
        agent: agent.name,
        role: agent.role,
        skill: agent.skill,
      });
    }

    if (route.action === 'heartbeat' && req.method === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = await readJsonBody(req);
      } catch (err) {
        return sendJson(res, 400, { error: (err as Error).message });
      }

      const task = body.task as { title?: string; description?: string } | undefined;
      const taskText = task?.description || task?.title || 'Execute your role';
      const context = (body.context as Record<string, unknown>) ?? {};
      const budget = typeof body.budget === 'number' ? (body.budget as number) : 1.0;

      try {
        const result = await runAgentTask({
          agent,
          task: taskText,
          context,
          budgetUsd: budget,
          workspaceRoot,
        });
        return sendJson(res, 200, {
          status: 'completed',
          agentId: agent.id,
          summary: result.summary,
          outputFiles: result.outputFiles,
          durationMs: result.durationMs,
          binary: result.binary,
          exitCode: result.exitCode,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return sendJson(res, 500, { status: 'failed', agentId: agent.id, error: message });
      }
    }
  }

  return sendJson(res, 404, { error: 'Not found', path: pathname });
}

export function createAdapterServer(workspaceRoot: string): http.Server {
  return http.createServer((req, res) => {
    handleRequest(req, res, workspaceRoot).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      // last-resort response
      try {
        sendJson(res, 500, { error: 'Internal adapter error', detail: message });
      } catch {
        // socket already closed
      }
    });
  });
}
