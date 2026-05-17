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
import * as path from 'path';
import { getAdapterStatus } from './index';
import { listAgents, WORKSPACE_DIR } from './agents.config';

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

export function registerPaperclipIpc(workspaceRoot: string): void {
  ipcMain.handle('paperclip.status', () => getAdapterStatus());

  ipcMain.handle('paperclip.listAgents', () => listAgents());

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

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* keep as text */
      }
      return { ok: res.ok, status: res.status, body: parsed };
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
