/**
 * @module main/paperclip-adapter/runner
 *
 * Subprocess-based agent execution. Spawns either the `claude` CLI (default,
 * globally installed) or the bundled `pi` CLI (pi-coding-agent) as a child
 * process, passing the system prompt + task and reading stdout.
 *
 * This decouples Paperclip from the in-process ClaudeAgentRunner used by
 * the Electron UI — no shared state, no SDK version coupling, and the app
 * keeps working if the subprocess fails.
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { AgentConfig } from './agents.config';
import { WORKSPACE_DIR } from './agents.config';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per task

export interface RunTaskParams {
  agent: AgentConfig;
  task: string;
  context: Record<string, unknown>;
  budgetUsd: number;
  workspaceRoot: string; // absolute path to project root (where default_working_dir lives)
}

export interface RunTaskResult {
  summary: string;
  outputFiles: string[];
  exitCode: number;
  durationMs: number;
  binary: string;
}

type Backend = 'claude' | 'pi';

function resolveBackend(): Backend {
  const env = (process.env.PAPERCLIP_AGENT_BINARY || 'claude').toLowerCase();
  return env === 'pi' ? 'pi' : 'claude';
}

function resolveBinaryPath(backend: Backend, workspaceRoot: string): string | null {
  if (backend === 'claude') {
    const candidates = [
      process.env.PAPERCLIP_CLAUDE_BIN,
      path.join(process.env.HOME || '', '.local', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
    ].filter(Boolean) as string[];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'claude'; // hope it's on PATH
  }
  // pi backend: prefer local node_modules
  const local = path.join(workspaceRoot, 'node_modules', '.bin', 'pi');
  if (fs.existsSync(local)) return local;
  return 'pi';
}

function loadSkillContent(workspaceRoot: string, skillName: string): string {
  const candidates = [
    path.join(workspaceRoot, '.claude', 'skills', skillName, 'SKILL.md'),
    path.join(workspaceRoot, '.agents', 'skills', skillName, 'SKILL.md'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p, 'utf-8');
      } catch {
        // ignore, fall through
      }
    }
  }
  return `(Skill "${skillName}" not found locally — operate with base knowledge.)`;
}

function readPipelineState(workspaceRoot: string): Record<string, unknown> {
  const statePath = path.join(workspaceRoot, WORKSPACE_DIR, 'pipeline-state.json');
  if (!fs.existsSync(statePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch {
    return {};
  }
}

function buildFullPrompt(
  params: RunTaskParams,
  skillContent: string,
  pipelineState: Record<string, unknown>
): string {
  const { agent, task, context, budgetUsd, workspaceRoot } = params;
  return [
    agent.systemPrompt,
    '',
    '## Active Skill',
    skillContent,
    '',
    '## Current pipeline state',
    '```json',
    JSON.stringify(pipelineState, null, 2),
    '```',
    '',
    '## Task context from Paperclip',
    '```json',
    JSON.stringify(context, null, 2),
    '```',
    '',
    '## Constraints',
    `- Budget cap (informational): US$ ${budgetUsd}`,
    `- Workspace root: ${workspaceRoot}`,
    `- Output directory: ${path.join(workspaceRoot, agent.outputDir)}`,
    `- ALWAYS update ${path.join(workspaceRoot, WORKSPACE_DIR, 'pipeline-state.json')} when done`,
    '',
    '## Task',
    task,
  ].join('\n');
}

function buildArgs(
  backend: Backend,
  prompt: string,
  workspaceRoot: string
): { args: string[]; useStdin: boolean } {
  // claude CLI: `claude -p "<prompt>" --print` runs non-interactive
  // pi CLI: `pi --print "<prompt>"` (best-effort, may need adjustment per pi version)
  if (backend === 'claude') {
    return {
      args: ['--print', '--cwd', workspaceRoot, prompt],
      useStdin: false,
    };
  }
  return {
    args: ['--print', prompt],
    useStdin: false,
  };
}

function collectNewFiles(outputDirAbs: string, sinceMs: number): string[] {
  if (!fs.existsSync(outputDirAbs)) return [];
  const results: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      try {
        const st = fs.statSync(full);
        if (ent.isDirectory()) {
          walk(full);
        } else if (st.mtimeMs >= sinceMs) {
          results.push(full);
        }
      } catch {
        // ignore stat errors
      }
    }
  };
  walk(outputDirAbs);
  return results;
}

export async function runAgentTask(params: RunTaskParams): Promise<RunTaskResult> {
  const backend = resolveBackend();
  const binary = resolveBinaryPath(backend, params.workspaceRoot);
  if (!binary) throw new Error(`No binary resolved for backend ${backend}`);

  const skillContent = loadSkillContent(params.workspaceRoot, params.agent.skill);
  const pipelineState = readPipelineState(params.workspaceRoot);
  const prompt = buildFullPrompt(params, skillContent, pipelineState);
  const { args } = buildArgs(backend, prompt, params.workspaceRoot);

  const outputDirAbs = path.join(params.workspaceRoot, params.agent.outputDir);
  fs.mkdirSync(outputDirAbs, { recursive: true });

  const startTime = Date.now();
  const timeoutMs = parseInt(process.env.PAPERCLIP_TASK_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10);

  return new Promise<RunTaskResult>((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: params.workspaceRoot,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Agent ${params.agent.id} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn ${binary}: ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      if (code !== 0) {
        return reject(
          new Error(
            `Agent ${params.agent.id} exited with code ${code}. stderr: ${stderr.substring(0, 2000)}`
          )
        );
      }
      const outputFiles = collectNewFiles(outputDirAbs, startTime);
      const summary = stdout.trim().substring(0, 4000) || `${params.agent.name} completed.`;
      resolve({
        summary,
        outputFiles,
        exitCode: code ?? 0,
        durationMs,
        binary,
      });
    });
  });
}
