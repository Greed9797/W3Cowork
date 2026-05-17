import { Type, type TSchema } from '@sinclair/typebox';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import type { MCPManager } from '../mcp/mcp-manager';
import { logError } from '../utils/logger';
import { normalizeMcpToolResultForModel } from './tool-result-utils';
import { analyzeImage, getVisualModelConfig } from './visual-model';

/**
 * Bridge MCP tools from MCPManager into pi-coding-agent ToolDefinition[] format.
 * Each MCP tool becomes a customTool whose execute() delegates to mcpManager.callTool().
 */
export function buildMcpCustomTools(mcpManager: MCPManager): ToolDefinition[] {
  const mcpTools = mcpManager.getTools();
  return mcpTools.map((mcpTool) => {
    const parameters = Type.Unsafe<Record<string, unknown>>(
      mcpTool.inputSchema as Record<string, unknown>
    );

    const toolDef: ToolDefinition<TSchema, unknown> = {
      name: mcpTool.name,
      label: mcpTool.name.replace(/^mcp__/, '').replace(/__/g, ' -> '),
      description: mcpTool.description || `MCP tool from ${mcpTool.serverName}`,
      parameters,
      async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
        try {
          const result = await mcpManager.callTool(mcpTool.name, params as Record<string, unknown>);
          const normalizedResult = normalizeMcpToolResultForModel(result);

          let visualAnalysis = '';
          if (normalizedResult.images.length > 0) {
            const visualConfig = getVisualModelConfig();
            if (visualConfig) {
              visualAnalysis = await analyzeImage(visualConfig, normalizedResult.images);
            }
          }

          return {
            content: [{ type: 'text' as const, text: normalizedResult.text + visualAnalysis }],
            details:
              normalizedResult.images.length > 0
                ? { openCoworkImages: normalizedResult.images }
                : undefined,
          };
        } catch (err: unknown) {
          logError(`[MCPTools] MCP tool ${mcpTool.name} failed:`, err);
          throw err instanceof Error ? err : new Error(String(err));
        }
      },
    };
    return toolDef;
  });
}
