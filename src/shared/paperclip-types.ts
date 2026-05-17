export const PAPERCLIP_AGENT_IDS = [
  'agent-1',
  'agent-2',
  'agent-3',
  'agent-4',
  'agent-5',
  'agent-6',
  'agent-7',
] as const;

export type AgentId = (typeof PAPERCLIP_AGENT_IDS)[number];

export type PaperclipBackendType = 'sdk' | 'cli-claude' | 'cli-codex' | 'cli-pi';

export interface PaperclipBackendConfig {
  type: PaperclipBackendType;
  configSetId?: string | null;
}

export interface PaperclipConfig {
  default: PaperclipBackendConfig;
  perAgent: Partial<Record<AgentId, PaperclipBackendConfig>>;
}

export interface BackendAvailability {
  type: PaperclipBackendType;
  available: boolean;
  binary: string | null;
  reason?: string | null;
}

export type BackendAvailabilityMap = Record<PaperclipBackendType, BackendAvailability>;

export const PAPERCLIP_BACKEND_TYPES: PaperclipBackendType[] = [
  'sdk',
  'cli-claude',
  'cli-codex',
  'cli-pi',
];

export const DEFAULT_PAPERCLIP_CONFIG: PaperclipConfig = {
  default: { type: 'sdk', configSetId: null },
  perAgent: {
    'agent-1': { type: 'cli-claude', configSetId: null },
  },
};

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === 'string' && PAPERCLIP_AGENT_IDS.includes(value as AgentId);
}

export function isPaperclipBackendType(value: unknown): value is PaperclipBackendType {
  return (
    typeof value === 'string' && PAPERCLIP_BACKEND_TYPES.includes(value as PaperclipBackendType)
  );
}

export function normalizePaperclipBackendConfig(
  value: unknown,
  fallback: PaperclipBackendConfig = DEFAULT_PAPERCLIP_CONFIG.default
): PaperclipBackendConfig {
  const raw = value && typeof value === 'object' ? (value as Partial<PaperclipBackendConfig>) : {};
  const type = isPaperclipBackendType(raw.type) ? raw.type : fallback.type;
  const configSetId =
    typeof raw.configSetId === 'string' && raw.configSetId.trim().length > 0
      ? raw.configSetId.trim()
      : null;

  return {
    type,
    configSetId: type === 'sdk' ? configSetId : null,
  };
}

export function normalizePaperclipConfig(value: unknown): PaperclipConfig {
  if (!value || typeof value !== 'object') {
    return {
      default: normalizePaperclipBackendConfig(DEFAULT_PAPERCLIP_CONFIG.default),
      perAgent: { ...DEFAULT_PAPERCLIP_CONFIG.perAgent },
    };
  }
  const raw = value && typeof value === 'object' ? (value as Partial<PaperclipConfig>) : {};
  const defaultConfig = normalizePaperclipBackendConfig(
    raw.default,
    DEFAULT_PAPERCLIP_CONFIG.default
  );
  const perAgent: Partial<Record<AgentId, PaperclipBackendConfig>> = {};
  const rawPerAgent =
    raw.perAgent && typeof raw.perAgent === 'object'
      ? (raw.perAgent as Partial<Record<string, unknown>>)
      : {};

  for (const agentId of PAPERCLIP_AGENT_IDS) {
    const normalized = normalizePaperclipBackendConfig(
      rawPerAgent[agentId],
      DEFAULT_PAPERCLIP_CONFIG.perAgent[agentId] ?? defaultConfig
    );
    if (rawPerAgent[agentId]) {
      perAgent[agentId] = normalized;
    }
  }

  return { default: defaultConfig, perAgent };
}

export function resolvePaperclipBackendConfig(
  agentId: AgentId,
  config: PaperclipConfig
): PaperclipBackendConfig {
  const normalized = normalizePaperclipConfig(config);
  return normalized.perAgent[agentId] ?? normalized.default;
}
