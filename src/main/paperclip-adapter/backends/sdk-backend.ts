import {
  createAgentSession,
  createCodingTools,
  DefaultResourceLoader,
  SessionManager as PiSessionManager,
  SettingsManager as PiSettingsManager,
  type AgentSession,
} from '@mariozechner/pi-coding-agent';
import type { Api, Model } from '@mariozechner/pi-ai';
import type { MCPManager } from '../../mcp/mcp-manager';
import { type AppConfig, type CustomProtocolType, configStore } from '../../config/config-store';
import { normalizeOpenAICompatibleBaseUrl } from '../../config/auth-utils';
import { buildMcpCustomTools } from '../../claude/mcp-custom-tools';
import { getSharedAuthStorage, ModelRegistry } from '../../claude/shared-auth';
import {
  applyPiModelRuntimeOverrides,
  buildSyntheticPiModel,
  inferPiApi,
  resolvePiModelString,
  resolvePiRegistryModel,
  resolvePiRouteProtocol,
  resolveSyntheticPiModelFallback,
} from '../../claude/pi-model-resolution';
import type { BackendExecuteParams, BackendExecuteResult, BackendStrategy } from './types';
import { collectNewFiles } from './file-utils';

function resolveEffectiveConfig(configSetId?: string | null): AppConfig {
  const id = configSetId?.trim();
  return id ? configStore.getAllForConfigSetId(id) : configStore.getAll();
}

function resolveEffectiveBaseUrl(config: AppConfig, routeProtocol: string): string | undefined {
  const rawBaseUrl = config.baseUrl?.trim() || undefined;
  if (routeProtocol === 'openai' && config.provider !== 'ollama') {
    return normalizeOpenAICompatibleBaseUrl(rawBaseUrl) || rawBaseUrl;
  }
  return rawBaseUrl;
}

function resolveModel(config: AppConfig): Model<Api> {
  const modelString = resolvePiModelString(config);
  const keyProvider = config.customProtocol || config.provider || 'anthropic';
  const routeProtocol = resolvePiRouteProtocol(config.provider, config.customProtocol);
  const effectiveBaseUrl = resolveEffectiveBaseUrl(config, routeProtocol);

  let piModel = resolvePiRegistryModel(modelString, {
    configProvider: keyProvider,
    customBaseUrl: effectiveBaseUrl,
    rawProvider: config.provider || 'anthropic',
    customProtocol: config.customProtocol,
  });

  if (!piModel) {
    const effectiveProtocol = routeProtocol as CustomProtocolType;
    const api = effectiveBaseUrl ? inferPiApi(effectiveProtocol) : undefined;
    const synthetic = resolveSyntheticPiModelFallback({
      rawModel: config.model,
      resolvedModelString: modelString,
      rawProvider: config.provider,
      routeProtocol: effectiveProtocol,
      baseUrl: effectiveBaseUrl,
    });
    piModel = buildSyntheticPiModel(
      synthetic.modelId,
      synthetic.provider,
      effectiveProtocol,
      effectiveBaseUrl || '',
      api
    );
    piModel = applyPiModelRuntimeOverrides(piModel, {
      configProvider: keyProvider,
      customBaseUrl: effectiveBaseUrl,
      rawProvider: config.provider || 'anthropic',
      customProtocol: config.customProtocol,
    });
  }

  return piModel as Model<Api>;
}

function applyRuntimeApiKey(config: AppConfig, model: Model<Api>): void {
  const apiKey = config.apiKey?.trim();
  if (!apiKey) return;
  const authStorage = getSharedAuthStorage();
  const modelString = resolvePiModelString(config);
  const parts = modelString.split('/');
  const keyProvider = parts.length >= 2 ? parts[0] : config.customProtocol || config.provider;
  if (keyProvider) {
    authStorage.setRuntimeApiKey(keyProvider, apiKey);
  }
  if (model.provider && model.provider !== keyProvider) {
    authStorage.setRuntimeApiKey(model.provider, apiKey);
  }
}

function getAssistantSummary(session: AgentSession): string {
  const messages = session.state?.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as {
      role?: string;
      content?: Array<{ type?: string; text?: string; thinking?: string }>;
      stopReason?: string;
      errorMessage?: string;
    };
    if (message.role !== 'assistant') continue;
    if (message.stopReason === 'error' || message.stopReason === 'aborted') {
      throw new Error(message.errorMessage || `SDK request ${message.stopReason}`);
    }
    const text = (message.content || [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('')
      .trim();
    if (text) return text.substring(0, 4000);
  }
  return '';
}

export class SdkBackend implements BackendStrategy {
  readonly type = 'sdk' as const;

  constructor(
    private readonly configSetId: string | null | undefined,
    private readonly mcpManager?: MCPManager | null
  ) {}

  async execute(params: BackendExecuteParams): Promise<BackendExecuteResult> {
    if (params.signal?.aborted) {
      throw new Error(`Agent ${params.agent.id} was cancelled before execution started`);
    }
    const startTime = Date.now();
    const config = resolveEffectiveConfig(this.configSetId);
    const piModel = resolveModel(config);
    applyRuntimeApiKey(config, piModel);

    const authStorage = getSharedAuthStorage();
    const modelRegistry = new ModelRegistry(authStorage);
    const resourceLoader = new DefaultResourceLoader({
      cwd: params.workspaceRoot,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      appendSystemPrompt:
        'You are executing a Paperclip pipeline task. Write required artifacts to disk before finishing.',
    });
    await resourceLoader.reload();

    const tools = createCodingTools(params.workspaceRoot);
    const customTools = this.mcpManager ? buildMcpCustomTools(this.mcpManager) : [];
    const { session } = await createAgentSession({
      model: piModel,
      thinkingLevel: config.enableThinking ? 'medium' : 'off',
      authStorage,
      modelRegistry,
      tools,
      customTools,
      sessionManager: PiSessionManager.inMemory(),
      settingsManager: PiSettingsManager.inMemory({
        retry: { enabled: true, maxRetries: 2 },
      }),
      resourceLoader,
      cwd: params.workspaceRoot,
    });

    const unsubscribe = session.subscribe(() => {
      // Subscription keeps the SDK session event pipeline active; no UI streaming in v1.
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;
    try {
      await Promise.race([
        session.prompt(params.prompt, { expandPromptTemplates: false }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            void session.abort().catch(() => undefined);
            reject(new Error(`SDK backend timed out after ${params.timeoutMs}ms`));
          }, params.timeoutMs);
        }),
        new Promise<never>((_, reject) => {
          if (!params.signal) return;
          abortListener = () => {
            void session.abort().catch(() => undefined);
            reject(new Error(`Agent ${params.agent.id} was cancelled`));
          };
          params.signal.addEventListener('abort', abortListener, { once: true });
        }),
      ]);

      return {
        summary: getAssistantSummary(session) || `${params.agent.name} completed.`,
        outputFiles: collectNewFiles(params.outputDirAbs, startTime),
        exitCode: 0,
        durationMs: Date.now() - startTime,
        binary: `sdk:${config.provider}:${config.model}`,
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (params.signal && abortListener) {
        params.signal.removeEventListener('abort', abortListener);
      }
      try {
        unsubscribe();
      } catch {
        // Ignore unsubscribe races during shutdown.
      }
      session.dispose();
    }
  }
}
