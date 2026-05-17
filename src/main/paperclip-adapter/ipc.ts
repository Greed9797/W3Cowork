/**
 * @module main/paperclip-adapter/ipc
 *
 * IPC bridge exposing the Paperclip adapter to the renderer process.
 * Channels follow the `paperclip.<action>` convention used elsewhere in the app.
 *
 * Channels:
 *   paperclip.status        → AdapterStatus
 *   paperclip.listAgents    → AgentInfo[]
 *   paperclip.getState      → pipeline-state.json contents (or {})
 *   paperclip.resetState    → write empty template, return new state
 *   paperclip.trigger       → fire heartbeat against the running adapter
 *   paperclip.openWorkspace → open default_working_dir in OS file manager
 *   paperclip.readOutput    → return contents of an absolute path inside the
 *                              workspace (size-capped, text-only safety)
 */

import { ipcMain, shell } from 'electron';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { getAdapterStatus } from './index';
import { listAgents, WORKSPACE_DIR } from './agents.config';
import { configStore } from '../config/config-store';
import { normalizePaperclipConfig } from './backend-types';

const PIPELINE_STATE_TEMPLATE = {
  version: '1.0',
  last_updated: null as string | null,
  agent1_completed: false,
  agent2_completed: false,
  agent3_completed: false,
  agent4_completed: false,
  agent5_completed: false,
  agent6_completed: false,
  agent7_completed: false,
  top_lead: null,
  total_leads: 0,
  leads_file: null,
  perda_mensal: null,
  perda_anual: null,
  clientes_perdidos_mes: null,
  ticket_medio: null,
  diagnostico_file: null,
  script_file: null,
  concorrentes: [] as unknown[],
  site_url: null,
  site_path: null,
  design_md_file: null,
  vsl_script_file: null,
  sequence_file: null,
  calendly_file: null,
  calendly_url: null,
  design_audit_log: null,
};

const MAX_OUTPUT_BYTES = 256 * 1024; // 256 KB read cap
const DEFAULT_TASK_TIMEOUT_MS = 10 * 60 * 1000;
const IPC_TRIGGER_TIMEOUT_BUFFER_MS = 30 * 1000;

function statePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, WORKSPACE_DIR, 'pipeline-state.json');
}

function readPipelineState(workspaceRoot: string): Record<string, unknown> {
  const p = statePath(workspaceRoot);
  if (!fs.existsSync(p)) return { ...PIPELINE_STATE_TEMPLATE };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return { ...PIPELINE_STATE_TEMPLATE, _parse_error: true };
  }
}

function writePipelineState(workspaceRoot: string, data: Record<string, unknown>): void {
  const p = statePath(workspaceRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function isPathInsideWorkspace(workspaceRoot: string, target: string): boolean {
  const resolvedRoot = path.resolve(workspaceRoot, WORKSPACE_DIR);
  const resolvedTarget = path.resolve(target);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}

function resolveTriggerTimeoutMs(): number {
  const taskTimeoutMs = parseInt(
    process.env.PAPERCLIP_TASK_TIMEOUT_MS || `${DEFAULT_TASK_TIMEOUT_MS}`,
    10
  );
  return taskTimeoutMs + IPC_TRIGGER_TIMEOUT_BUFFER_MS;
}

function postLocalJson(
  urlString: string,
  body: string,
  timeoutMs: number
): Promise<{ status: number; text: string }> {
  const url = new URL(urlString);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            text: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Paperclip heartbeat timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export function registerPaperclipIpc(workspaceRoot: string): void {
  ipcMain.handle('paperclip.status', () => getAdapterStatus());

  ipcMain.handle('paperclip.listAgents', () => listAgents());

  ipcMain.handle('paperclip.getConfig', () =>
    normalizePaperclipConfig(configStore.getAll().paperclip)
  );

  ipcMain.handle('paperclip.setConfig', (_event, config: unknown) => {
    const normalized = normalizePaperclipConfig(config);
    configStore.update({ paperclip: normalized });
    return normalizePaperclipConfig(configStore.getAll().paperclip);
  });

  ipcMain.handle('paperclip.getState', () => readPipelineState(workspaceRoot));

  ipcMain.handle('paperclip.resetState', () => {
    const fresh = { ...PIPELINE_STATE_TEMPLATE, last_updated: new Date().toISOString() };
    writePipelineState(workspaceRoot, fresh);
    return fresh;
  });

  ipcMain.handle(
    'paperclip.trigger',
    async (
      _event,
      payload: {
        agentId: string;
        task?: { title?: string; description?: string };
        context?: Record<string, unknown>;
        budget?: number;
      }
    ) => {
      const status = getAdapterStatus();
      if (!status.running || !status.port || !status.host) {
        throw new Error('Paperclip adapter is not running. Enable it first.');
      }
      const url = `http://${status.host}:${status.port}/agent/${payload.agentId}/heartbeat`;
      const body = JSON.stringify({
        task: payload.task ?? {},
        context: payload.context ?? {},
        budget: typeof payload.budget === 'number' ? payload.budget : 0.5,
      });

      const res = await postLocalJson(url, body, resolveTriggerTimeoutMs());
      let parsed: unknown = res.text;
      try {
        parsed = JSON.parse(res.text);
      } catch {
        /* keep as text */
        parsed = res.text;
      }
      return { ok: res.status >= 200 && res.status < 300, status: res.status, body: parsed };
    }
  );

  ipcMain.handle('paperclip.openWorkspace', async () => {
    const dir = path.join(workspaceRoot, WORKSPACE_DIR);
    fs.mkdirSync(dir, { recursive: true });
    const err = await shell.openPath(dir);
    return { ok: !err, error: err || null, path: dir };
  });

  ipcMain.handle('paperclip.readOutput', (_event, absolutePath: string) => {
    if (typeof absolutePath !== 'string' || absolutePath.length === 0) {
      throw new Error('absolutePath must be a non-empty string');
    }
    if (!isPathInsideWorkspace(workspaceRoot, absolutePath)) {
      throw new Error('Path is outside the workspace');
    }
    if (!fs.existsSync(absolutePath)) return { exists: false, content: '', truncated: false };
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) throw new Error('Path is not a regular file');
    const buf = fs.readFileSync(absolutePath);
    const truncated = buf.byteLength > MAX_OUTPUT_BYTES;
    const slice = truncated ? buf.subarray(0, MAX_OUTPUT_BYTES) : buf;
    return {
      exists: true,
      content: slice.toString('utf-8'),
      truncated,
      size: stat.size,
      mtime: stat.mtimeMs,
    };
  });
}
