import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Circle,
  ExternalLink,
  FolderOpen,
  Loader2,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../../store';
import type {
  AgentId,
  AppConfig,
  BackendAvailabilityMap,
  PaperclipBackendConfig,
  PaperclipBackendType,
  PaperclipConfig,
} from '../../types';
import {
  DEFAULT_PAPERCLIP_CONFIG,
  PAPERCLIP_BACKEND_TYPES,
  isAgentId,
  normalizePaperclipConfig,
  resolvePaperclipBackendConfig,
} from '../../../shared/paperclip-types';

interface AdapterStatus {
  running: boolean;
  port: number | null;
  host: string | null;
  backend: string;
  workspaceRoot: string | null;
  backends: BackendAvailabilityMap | null;
}

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  skill: string;
}

interface TriggerResult {
  ok: boolean;
  status: number;
  body: unknown;
}

type PipelineState = Record<string, unknown>;

const AGENT_ORDER: AgentId[] = [
  'agent-1',
  'agent-2',
  'agent-3',
  'agent-4',
  'agent-5',
  'agent-6',
  'agent-7',
];

const POLL_INTERVAL_MS = 5000;

const BACKEND_LABELS: Record<PaperclipBackendType, string> = {
  sdk: 'paperclip.backendSdk',
  'cli-claude': 'paperclip.backendCliClaude',
  'cli-codex': 'paperclip.backendCliCodex',
  'cli-pi': 'paperclip.backendCliPi',
};

function safeString(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return '[object]';
  }
}

function formatCurrencyBR(v: unknown): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function fallbackBackendLabel(type: PaperclipBackendType): string {
  switch (type) {
    case 'sdk':
      return 'SDK (API key)';
    case 'cli-claude':
      return 'CLI · claude';
    case 'cli-codex':
      return 'CLI · codex';
    case 'cli-pi':
      return 'CLI · pi';
  }
}

function agentCompletionKey(agentId: string): string {
  // agent-1 → agent1_completed
  return `${agentId.replace('-', '')}_completed`;
}

export function SettingsPaperclip({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  const setSettingsTab = useAppStore((s) => s.setSettingsTab);
  const [status, setStatus] = useState<AdapterStatus | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [state, setState] = useState<PipelineState>({});
  const [paperclipConfig, setPaperclipConfig] = useState<PaperclipConfig>(() =>
    normalizePaperclipConfig(DEFAULT_PAPERCLIP_CONFIG)
  );
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [busyAgentId, setBusyAgentId] = useState<string | null>(null);
  const [lastTrigger, setLastTrigger] = useState<{ agentId: string; result: TriggerResult } | null>(
    null
  );
  const [resetting, setResetting] = useState(false);

  // Trigger modal state
  const [triggerModalFor, setTriggerModalFor] = useState<string | null>(null);
  const [triggerTitle, setTriggerTitle] = useState('');
  const [triggerContext, setTriggerContext] = useState(
    '{\n  "nicho": "padaria",\n  "cidade": "Curitiba, PR",\n  "quantidade": 10\n}'
  );
  const [triggerBudget, setTriggerBudget] = useState('0.5');

  const api = (typeof window !== 'undefined' && window.electronAPI?.paperclip) || null;

  const refresh = useCallback(async () => {
    if (!api) return;
    setIsLoading(true);
    setError(null);
    try {
      const [st, ag, s, pc, cfg] = await Promise.all([
        api.status(),
        api.listAgents(),
        api.getState(),
        api.getConfig(),
        window.electronAPI.config.get(),
      ]);
      setStatus(st);
      setAgents(ag);
      setState(s);
      setPaperclipConfig(normalizePaperclipConfig(pc));
      setAppConfig(cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!isActive) return;
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isActive, refresh]);

  const sortedAgents = useMemo(() => {
    const map = new Map(agents.map((a) => [a.id, a]));
    return AGENT_ORDER.map((id) => map.get(id)).filter((a): a is AgentInfo => Boolean(a));
  }, [agents]);

  const normalizedPaperclipConfig = useMemo(
    () => normalizePaperclipConfig(paperclipConfig),
    [paperclipConfig]
  );

  const backendLabel = useCallback(
    (type: PaperclipBackendType) => t(BACKEND_LABELS[type], fallbackBackendLabel(type)),
    [t]
  );

  const activeProviderModel = useMemo(() => {
    const provider = appConfig?.provider || '—';
    const model = appConfig?.model || '—';
    return `${provider}:${model}`;
  }, [appConfig]);

  const getBackendOptions = useCallback(
    (currentType?: PaperclipBackendType): PaperclipBackendType[] =>
      PAPERCLIP_BACKEND_TYPES.filter((type) => {
        if (type !== 'cli-codex') return true;
        return Boolean(status?.backends?.['cli-codex']?.available || currentType === 'cli-codex');
      }),
    [status]
  );

  const describeBackend = useCallback(
    (backend: PaperclipBackendConfig): string => {
      if (backend.type === 'sdk') {
        return `SDK (${activeProviderModel})`;
      }
      const availability = status?.backends?.[backend.type];
      const binary = availability?.binary || backend.type.replace('cli-', '');
      return `${backendLabel(backend.type)} (${binary})`;
    },
    [activeProviderModel, backendLabel, status]
  );

  const resolveAgentBackend = useCallback(
    (agentId: string): PaperclipBackendConfig => {
      if (!isAgentId(agentId)) return normalizedPaperclipConfig.default;
      return resolvePaperclipBackendConfig(agentId, normalizedPaperclipConfig);
    },
    [normalizedPaperclipConfig]
  );

  const savePaperclipConfig = useCallback(
    async (nextConfig: PaperclipConfig) => {
      if (!api) return;
      const normalized = normalizePaperclipConfig(nextConfig);
      setPaperclipConfig(normalized);
      setIsSavingConfig(true);
      setError(null);
      try {
        const saved = await api.setConfig(normalized);
        setPaperclipConfig(normalizePaperclipConfig(saved));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        void refresh();
      } finally {
        setIsSavingConfig(false);
      }
    },
    [api, refresh]
  );

  const updateDefaultBackend = (type: PaperclipBackendType) => {
    void savePaperclipConfig({
      ...normalizedPaperclipConfig,
      default: { type, configSetId: null },
    });
  };

  const updateAgentOverride = (agentId: string, value: 'default' | PaperclipBackendType) => {
    if (!isAgentId(agentId)) return;
    const perAgent = { ...normalizedPaperclipConfig.perAgent };
    if (value === 'default') {
      delete perAgent[agentId];
    } else {
      perAgent[agentId] = { type: value, configSetId: null };
    }
    void savePaperclipConfig({ ...normalizedPaperclipConfig, perAgent });
  };

  const openTriggerModal = (agentId: string) => {
    setTriggerModalFor(agentId);
    setTriggerTitle(`Trigger ${agentId} manually`);
    setLastTrigger(null);
  };

  const runTrigger = async () => {
    if (!api || !triggerModalFor) return;
    setBusyAgentId(triggerModalFor);
    setError(null);
    let context: Record<string, unknown> = {};
    if (triggerContext.trim().length > 0) {
      try {
        context = JSON.parse(triggerContext);
      } catch (err) {
        setError(`Invalid JSON context: ${(err as Error).message}`);
        setBusyAgentId(null);
        return;
      }
    }
    const budget = Number.parseFloat(triggerBudget);
    try {
      const result = await api.trigger({
        agentId: triggerModalFor,
        task: { title: triggerTitle, description: triggerTitle },
        context,
        budget: Number.isFinite(budget) ? budget : 0.5,
      });
      setLastTrigger({ agentId: triggerModalFor, result });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAgentId(null);
      setTriggerModalFor(null);
    }
  };

  const handleResetState = async () => {
    if (!api) return;
    setResetting(true);
    try {
      const fresh = await api.resetState();
      setState(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  };

  const handleOpenWorkspace = async () => {
    if (!api) return;
    try {
      await api.openWorkspace();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!api) {
    return (
      <div className="rounded-lg border border-border-muted bg-surface-secondary p-6 text-text-secondary">
        <p>{t('paperclip.notAvailable', 'Paperclip adapter is not available in this build.')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status card */}
      <section className="rounded-lg border border-border-muted bg-surface-secondary p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {status?.running ? (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <Activity className="h-5 w-5" />
              </span>
            ) : (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-500/15 text-red-500">
                <XCircle className="h-5 w-5" />
              </span>
            )}
            <div>
              <h4 className="text-base font-semibold text-text-primary">
                {t('paperclip.adapterTitle', 'Paperclip HTTP adapter')}
              </h4>
              <p className="text-sm text-text-secondary">
                {status?.running
                  ? t('paperclip.statusRunning', 'Running on {{host}}:{{port}} ({{backend}})', {
                      host: status.host ?? '?',
                      port: status.port ?? '?',
                      backend: status.backend,
                    })
                  : t(
                      'paperclip.statusStopped',
                      'Adapter is not running. Set ENABLE_PAPERCLIP_ADAPTER=true and restart.'
                    )}
              </p>
              {status?.workspaceRoot && (
                <p className="mt-1 font-mono text-xs text-text-muted">{status.workspaceRoot}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                <span className="font-medium text-text-muted">
                  {t('paperclip.backendDefault', 'Default backend')}
                </span>
                <select
                  value={normalizedPaperclipConfig.default.type}
                  disabled={isSavingConfig}
                  onChange={(e) => updateDefaultBackend(e.target.value as PaperclipBackendType)}
                  className="rounded-md border border-border-muted bg-background px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                >
                  {getBackendOptions(normalizedPaperclipConfig.default.type).map((type) => (
                    <option
                      key={type}
                      value={type}
                      disabled={type === 'cli-codex' && !status?.backends?.['cli-codex']?.available}
                    >
                      {backendLabel(type)}
                    </option>
                  ))}
                </select>
                {normalizedPaperclipConfig.default.type === 'sdk' && (
                  <span className="rounded-full border border-border-muted bg-background px-2 py-1 font-mono text-[11px] text-text-muted">
                    {activeProviderModel}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSettingsTab('api')}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  {t('paperclip.configureInApi', 'Configure in Settings -> API')}
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-muted bg-background px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              {t('common.refresh', 'Refresh')}
            </button>
            <button
              onClick={handleOpenWorkspace}
              className="inline-flex items-center gap-1.5 rounded-md border border-border-muted bg-background px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-hover"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {t('paperclip.openWorkspace', 'Open workspace')}
            </button>
          </div>
        </div>
      </section>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="break-all">{error}</p>
        </div>
      )}

      {/* Backend overrides */}
      <details className="rounded-lg border border-border-muted bg-surface-secondary p-4">
        <summary className="cursor-pointer text-sm font-semibold text-text-primary">
          {t('paperclip.backendOverride', 'Advanced: per-agent backend overrides')}
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {AGENT_ORDER.map((agentId) => {
            const agent = agents.find((item) => item.id === agentId);
            const override = normalizedPaperclipConfig.perAgent[agentId]?.type ?? 'default';
            const resolved = resolveAgentBackend(agentId);
            return (
              <div
                key={agentId}
                className="rounded-md border border-border-muted bg-background p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-text-primary">
                      {agentId} · {agent?.name ?? agentId}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-muted">
                      {describeBackend(resolved)}
                    </p>
                  </div>
                  <select
                    value={override}
                    disabled={isSavingConfig}
                    onChange={(e) =>
                      updateAgentOverride(
                        agentId,
                        e.target.value as 'default' | PaperclipBackendType
                      )
                    }
                    className="w-36 rounded-md border border-border-muted bg-surface-secondary px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                  >
                    <option value="default">{t('paperclip.useDefault', 'Use default')}</option>
                    {getBackendOptions(override === 'default' ? undefined : override).map(
                      (type) => (
                        <option
                          key={type}
                          value={type}
                          disabled={
                            type === 'cli-codex' && !status?.backends?.['cli-codex']?.available
                          }
                        >
                          {backendLabel(type)}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {/* Agents grid */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            {t('paperclip.agents', 'Pipeline agents')}
          </h4>
          <span className="text-xs text-text-muted">{sortedAgents.length} / 7</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {sortedAgents.map((agent) => {
            const completed = Boolean(state[agentCompletionKey(agent.id)]);
            const busy = busyAgentId === agent.id;
            return (
              <article
                key={agent.id}
                className="rounded-lg border border-border-muted bg-surface-secondary p-4"
              >
                <header className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {completed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-text-muted" />
                    )}
                    <h5 className="text-sm font-semibold text-text-primary">
                      {agent.id} · {agent.name}
                    </h5>
                  </div>
                  <button
                    disabled={!status?.running || busy}
                    onClick={() => openTriggerModal(agent.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border-muted bg-background px-2 py-1 text-xs text-text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="h-3.5 w-3.5" />
                    )}
                    {t('paperclip.trigger', 'Trigger')}
                  </button>
                </header>
                <p className="mt-1 text-xs text-text-secondary">{agent.role}</p>
                <p className="mt-2 font-mono text-[11px] text-text-muted">skill: {agent.skill}</p>
                <p className="mt-1 font-mono text-[11px] text-text-muted">
                  backend: {describeBackend(resolveAgentBackend(agent.id))}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Pipeline state */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
            {t('paperclip.pipelineState', 'Pipeline state')}
          </h4>
          <button
            onClick={handleResetState}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-muted bg-background px-3 py-1.5 text-xs text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            {resetting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            {t('paperclip.resetState', 'Reset state')}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <KeyValue label="last_updated" value={safeString(state.last_updated)} />
          <KeyValue label="total_leads" value={safeString(state.total_leads)} />
          <KeyValue label="perda_mensal" value={formatCurrencyBR(state.perda_mensal)} />
          <KeyValue label="perda_anual" value={formatCurrencyBR(state.perda_anual)} />
          <KeyValue label="top_lead" value={summarizeTopLead(state.top_lead)} />
          <KeyValue label="site_url" value={safeString(state.site_url)} />
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-text-muted hover:text-text-secondary">
            {t('paperclip.viewRawState', 'View raw pipeline-state.json')}
          </summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border-muted bg-background p-3 font-mono text-[11px] text-text-secondary">
            {JSON.stringify(state, null, 2)}
          </pre>
        </details>
      </section>

      {/* Last trigger result */}
      {lastTrigger && (
        <section>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
            {t('paperclip.lastTrigger', 'Last trigger result')} — {lastTrigger.agentId}
          </h4>
          <div className="rounded-lg border border-border-muted bg-surface-secondary p-3">
            <p className="mb-2 text-xs text-text-secondary">
              HTTP {lastTrigger.result.status} · {lastTrigger.result.ok ? 'OK' : 'FAIL'}
            </p>
            <pre className="max-h-64 overflow-auto rounded-md border border-border-muted bg-background p-3 font-mono text-[11px] text-text-secondary">
              {JSON.stringify(lastTrigger.result.body, null, 2)}
            </pre>
          </div>
        </section>
      )}

      {/* Trigger modal */}
      {triggerModalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-border-muted bg-background p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-text-primary">
              {t('paperclip.triggerModalTitle', 'Trigger')} {triggerModalFor}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {t(
                'paperclip.triggerModalDesc',
                'Sends an HTTP heartbeat to the running adapter. The agent will execute via the configured backend.'
              )}
            </p>
            <p className="mt-2 rounded-md border border-border-muted bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
              {t('paperclip.willExecuteVia', 'Will execute via')}:&nbsp;
              <span className="font-mono text-text-primary">
                {describeBackend(resolveAgentBackend(triggerModalFor))}
              </span>
            </p>

            <label className="mt-4 block text-xs font-medium text-text-secondary">Task title</label>
            <input
              type="text"
              value={triggerTitle}
              onChange={(e) => setTriggerTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-border-muted bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />

            <label className="mt-3 block text-xs font-medium text-text-secondary">
              Context (JSON)
            </label>
            <textarea
              value={triggerContext}
              onChange={(e) => setTriggerContext(e.target.value)}
              rows={6}
              spellCheck={false}
              className="mt-1 w-full rounded-md border border-border-muted bg-surface-secondary px-3 py-2 font-mono text-xs text-text-primary focus:border-accent focus:outline-none"
            />

            <label className="mt-3 block text-xs font-medium text-text-secondary">
              Budget (USD)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={triggerBudget}
              onChange={(e) => setTriggerBudget(e.target.value)}
              className="mt-1 w-32 rounded-md border border-border-muted bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setTriggerModalFor(null)}
                className="rounded-md border border-border-muted px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={runTrigger}
                disabled={busyAgentId !== null}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
              >
                {busyAgentId !== null && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('paperclip.send', 'Send heartbeat')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <section className="rounded-lg border border-border-muted bg-surface-secondary p-4 text-xs text-text-muted">
        <p className="flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          {t(
            'paperclip.docsHint',
            'See AGENTS.md and paperclip/setup.sh at the repo root for the orchestrator wiring guide.'
          )}
        </p>
      </section>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-muted bg-surface-secondary p-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-0.5 break-all text-sm text-text-primary">{value}</p>
    </div>
  );
}

function summarizeTopLead(v: unknown): string {
  if (!v || typeof v !== 'object') return '—';
  const obj = v as Record<string, unknown>;
  const nome = typeof obj.nome === 'string' ? obj.nome : '';
  const score = typeof obj.score === 'number' ? obj.score : null;
  if (!nome) return '—';
  return score !== null ? `${nome} (score ${score})` : nome;
}
