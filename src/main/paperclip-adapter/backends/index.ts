import type { MCPManager } from '../../mcp/mcp-manager';
import {
  normalizePaperclipConfig,
  resolvePaperclipBackendConfig,
  type AgentId,
  type BackendAvailabilityMap,
  type PaperclipConfig,
} from '../backend-types';
import type { BackendStrategy } from './types';
import {
  ClaudeCliBackend,
  CodexCliBackend,
  PiCliBackend,
  getCliBackendAvailability,
} from './cli-backend';
import { SdkBackend } from './sdk-backend';

export function resolveBackend(
  agentId: AgentId,
  paperclipConfig: PaperclipConfig,
  mcpManager?: MCPManager | null
): BackendStrategy {
  const cfg = resolvePaperclipBackendConfig(agentId, normalizePaperclipConfig(paperclipConfig));
  switch (cfg.type) {
    case 'sdk':
      return new SdkBackend(cfg.configSetId, mcpManager);
    case 'cli-codex':
      return new CodexCliBackend();
    case 'cli-pi':
      return new PiCliBackend();
    case 'cli-claude':
    default:
      return new ClaudeCliBackend();
  }
}
export function getBackendAvailability(workspaceRoot: string): BackendAvailabilityMap {
  return getCliBackendAvailability(workspaceRoot);
}
