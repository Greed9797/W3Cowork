/**
 * @module main/paperclip-adapter/runner
 *
 * Agent execution coordinator. It builds the full Paperclip prompt once, then
 * delegates execution to the configured backend strategy (SDK or CLI).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentConfig } from './agents.config';
import { WORKSPACE_DIR } from './agents.config';
import type { MCPManager } from '../mcp/mcp-manager';
import { configStore } from '../config/config-store';
import { isAgentId, normalizePaperclipConfig } from './backend-types';
import { resolveBackend } from './backends';
import type { BackendExecuteResult } from './backends/types';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes per task

export interface RunTaskParams {
  agent: AgentConfig;
  task: string;
  context: Record<string, unknown>;
  budgetUsd: number;
  workspaceRoot: string; // absolute path to project root (where default_working_dir lives)
  mcpManager?: MCPManager | null;
}

export type RunTaskResult = BackendExecuteResult;

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

export async function runAgentTask(params: RunTaskParams): Promise<RunTaskResult> {
  if (!isAgentId(params.agent.id)) {
    throw new Error(`Invalid Paperclip agent id: ${params.agent.id}`);
  }

  const skillContent = loadSkillContent(params.workspaceRoot, params.agent.skill);
  const pipelineState = readPipelineState(params.workspaceRoot);
  const outputDirAbs = path.join(params.workspaceRoot, params.agent.outputDir);
  fs.mkdirSync(outputDirAbs, { recursive: true });
  const timeoutMs = parseInt(process.env.PAPERCLIP_TASK_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10);

  const prompt = buildFullPrompt(params, skillContent, pipelineState);
  const paperclipConfig = normalizePaperclipConfig(configStore.getAll().paperclip);
  const backend = resolveBackend(params.agent.id, paperclipConfig, params.mcpManager);

  return backend.execute({
    agent: params.agent,
    prompt,
    workspaceRoot: params.workspaceRoot,
    outputDirAbs,
    timeoutMs,
    budgetUsd: params.budgetUsd,
  });
}
