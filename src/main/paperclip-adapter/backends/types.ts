import type { AgentConfig } from '../agents.config';
import type { PaperclipBackendType } from '../backend-types';

export interface BackendExecuteParams {
  agent: AgentConfig;
  prompt: string;
  workspaceRoot: string;
  outputDirAbs: string;
  timeoutMs: number;
  budgetUsd: number;
}
export interface BackendExecuteResult {
  summary: string;
  outputFiles: string[];
  exitCode: number;
  durationMs: number;
  binary: string;
}

export interface BackendStrategy {
  type: PaperclipBackendType;
  execute(params: BackendExecuteParams): Promise<BackendExecuteResult>;
}
