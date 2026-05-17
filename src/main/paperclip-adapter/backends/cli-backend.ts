import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type {
  BackendAvailability,
  BackendAvailabilityMap,
  PaperclipBackendType,
} from '../backend-types';
import type { BackendExecuteParams, BackendExecuteResult, BackendStrategy } from './types';
import { collectNewFiles } from './file-utils';

const DEFAULT_CLAUDE_ALLOWED_TOOLS = [
  'WebSearch',
  'web_search',
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'Bash',
  'Grep',
  'Glob',
  'LS',
];
const AVAILABILITY_CACHE_TTL_MS = 10_000;
let availabilityCache: {
  workspaceRoot: string;
  checkedAt: number;
  value: BackendAvailabilityMap;
} | null = null;

function splitList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstExisting(candidates: Array<string | undefined>): string | null {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function versionAvailability(
  type: PaperclipBackendType,
  binary: string,
  args: string[] = ['--version']
): BackendAvailability {
  const res = spawnSync(binary, args, {
    encoding: 'utf-8',
    timeout: 1500,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (res.error) {
    return { type, available: false, binary, reason: res.error.message };
  }
  if (res.status !== 0) {
    return {
      type,
      available: false,
      binary,
      reason: (res.stderr || res.stdout || `exit ${res.status}`).trim().slice(0, 300),
    };
  }
  return { type, available: true, binary, reason: null };
}

export function resolveClaudeBinary(): string {
  return (
    firstExisting([
      process.env.PAPERCLIP_CLAUDE_BIN,
      path.join(process.env.HOME || '', '.local', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
    ]) || 'claude'
  );
}

export function resolveCodexBinary(): string {
  return process.env.PAPERCLIP_CODEX_BIN || 'codex';
}

export function resolvePiBinary(workspaceRoot: string): string {
  return (
    firstExisting([
      process.env.PAPERCLIP_PI_BIN,
      path.join(workspaceRoot, 'node_modules', '.bin', 'pi'),
    ]) || 'pi'
  );
}

export function getCliBackendAvailability(workspaceRoot: string): BackendAvailabilityMap {
  const now = Date.now();
  if (
    availabilityCache &&
    availabilityCache.workspaceRoot === workspaceRoot &&
    now - availabilityCache.checkedAt < AVAILABILITY_CACHE_TTL_MS
  ) {
    return availabilityCache.value;
  }
  const value: BackendAvailabilityMap = {
    sdk: { type: 'sdk', available: true, binary: 'sdk', reason: null },
    'cli-claude': versionAvailability('cli-claude', resolveClaudeBinary()),
    'cli-codex': versionAvailability('cli-codex', resolveCodexBinary()),
    'cli-pi': versionAvailability('cli-pi', resolvePiBinary(workspaceRoot)),
  };
  availabilityCache = { workspaceRoot, checkedAt: now, value };
  return value;
}

abstract class CliBackend implements BackendStrategy {
  abstract readonly type: PaperclipBackendType;

  abstract resolveBinary(workspaceRoot: string): string;

  abstract buildArgs(params: BackendExecuteParams): string[];

  async execute(params: BackendExecuteParams): Promise<BackendExecuteResult> {
    if (params.signal?.aborted) {
      throw new Error(`Agent ${params.agent.id} was cancelled before execution started`);
    }
    const binary = this.resolveBinary(params.workspaceRoot);
    const args = this.buildArgs(params);
    fs.mkdirSync(params.outputDirAbs, { recursive: true });
    const startTime = Date.now();

    return new Promise<BackendExecuteResult>((resolve, reject) => {
      const child = spawn(binary, args, {
        cwd: params.workspaceRoot,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (params.signal) params.signal.removeEventListener('abort', onAbort);
        fn();
      };

      const onAbort = () => {
        child.kill('SIGTERM');
        settle(() => reject(new Error(`Agent ${params.agent.id} was cancelled`)));
      };

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        settle(() =>
          reject(new Error(`Agent ${params.agent.id} timed out after ${params.timeoutMs}ms`))
        );
      }, params.timeoutMs);

      if (params.signal) params.signal.addEventListener('abort', onAbort, { once: true });

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });
      child.on('error', (err) => {
        settle(() => reject(new Error(`Failed to spawn ${binary}: ${err.message}`)));
      });
      child.on('close', (code) => {
        settle(() => {
          const durationMs = Date.now() - startTime;
          if (code !== 0) {
            reject(
              new Error(
                `Agent ${params.agent.id} exited with code ${code}. stderr: ${stderr.substring(
                  0,
                  2000
                )}`
              )
            );
            return;
          }
          resolve({
            summary: stdout.trim().substring(0, 4000) || `${params.agent.name} completed.`,
            outputFiles: collectNewFiles(params.outputDirAbs, startTime),
            exitCode: code ?? 0,
            durationMs,
            binary,
          });
        });
      });
    });
  }
}

export class ClaudeCliBackend extends CliBackend {
  readonly type = 'cli-claude' as const;

  resolveBinary(): string {
    return resolveClaudeBinary();
  }

  buildArgs(params: BackendExecuteParams): string[] {
    const permissionMode = process.env.PAPERCLIP_PERMISSION_MODE || 'auto';
    const allowedTools = splitList(
      process.env.PAPERCLIP_ALLOWED_TOOLS,
      DEFAULT_CLAUDE_ALLOWED_TOOLS
    );
    return [
      '--print',
      '--permission-mode',
      permissionMode,
      params.prompt,
      '--allowed-tools',
      ...allowedTools,
    ];
  }
}

export class CodexCliBackend extends CliBackend {
  readonly type = 'cli-codex' as const;

  resolveBinary(): string {
    return resolveCodexBinary();
  }

  buildArgs(params: BackendExecuteParams): string[] {
    return [
      'exec',
      '--cd',
      params.workspaceRoot,
      '--skip-git-repo-check',
      '--sandbox',
      'workspace-write',
      '--ephemeral',
      '-c',
      'approval_policy="never"',
      '--color',
      'never',
      params.prompt,
    ];
  }
}

export class PiCliBackend extends CliBackend {
  readonly type = 'cli-pi' as const;

  resolveBinary(workspaceRoot: string): string {
    return resolvePiBinary(workspaceRoot);
  }

  buildArgs(params: BackendExecuteParams): string[] {
    return [
      '--no-session',
      '--tools',
      'read,bash,edit,write,grep,find,ls',
      '--print',
      params.prompt,
    ];
  }
}
