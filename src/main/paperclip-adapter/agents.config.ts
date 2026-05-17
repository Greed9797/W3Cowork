/**
 * @module main/paperclip-adapter/agents.config
 *
 * Agent registry for the Paperclip HTTP adapter.
 * Each entry maps an external Paperclip employee ID to:
 *   - the Claude/pi skill that drives execution
 *   - the role/system prompt seed
 *   - the workspace output directory under default_working_dir/
 *
 * Skills are auto-loaded by the SkillsManager from .claude/skills/<skill>/SKILL.md.
 * The runner reads the SKILL.md at request time and injects it into the system prompt.
 */

import type { AgentId } from './backend-types';

export interface AgentConfig {
  id: AgentId;
  name: string;
  role: string;
  skill: string;
  systemPrompt: string;
  inputFrom: string | null;
  outputDir: string;
}

export const WORKSPACE_DIR = 'default_working_dir';

export const AGENTS: Record<AgentId, AgentConfig> = {
  'agent-1': {
    id: 'agent-1',
    name: 'Prospector',
    role: 'Lead Generation Specialist',
    skill: 'google-maps-lead-gen',
    inputFrom: null,
    outputDir: `${WORKSPACE_DIR}/leads`,
    systemPrompt: `You are Agent 1 — Prospector for the W3 Sites Agency pipeline.
Your only job: find businesses WITHOUT a website on Google Maps and produce a scored lead list.
Follow the google-maps-lead-gen SKILL.md exactly.
Always write outputs under ${WORKSPACE_DIR}/leads/ and update ${WORKSPACE_DIR}/pipeline-state.json on completion.`,
  },
  'agent-2': {
    id: 'agent-2',
    name: 'Diagnosticador',
    role: 'Business Analyst',
    skill: 'site-diagnostic-report',
    inputFrom: 'agent-1',
    outputDir: `${WORKSPACE_DIR}/diagnostics`,
    systemPrompt: `You are Agent 2 — Diagnosticador for the W3 Sites Agency pipeline.
Read ${WORKSPACE_DIR}/pipeline-state.json to get the top_lead produced by Agent 1.
Generate a professional impact diagnostic with monthly revenue-loss calculation.
Follow the site-diagnostic-report SKILL.md exactly.
Always write outputs under ${WORKSPACE_DIR}/diagnostics/ and update pipeline-state.json.`,
  },
  'agent-3': {
    id: 'agent-3',
    name: 'Builder',
    role: 'Web Developer',
    skill: 'cinematic-landing-prompt',
    inputFrom: 'agent-2',
    outputDir: `${WORKSPACE_DIR}/sites`,
    systemPrompt: `You are Agent 3 — Builder for the W3 Sites Agency pipeline.
Read ${WORKSPACE_DIR}/pipeline-state.json for company data and loss estimate.
FIRST generate a DESIGN.md at the project root. THEN build the demo site respecting it.
Use the design-constraint-enforcer skill alongside cinematic-landing-prompt.
Always write outputs under ${WORKSPACE_DIR}/sites/<slug>/ and update pipeline-state.json.`,
  },
  'agent-4': {
    id: 'agent-4',
    name: 'VSL Writer',
    role: 'Video Script Specialist',
    skill: 'outreach-automation',
    inputFrom: 'agent-3',
    outputDir: `${WORKSPACE_DIR}/outreach`,
    systemPrompt: `You are Agent 4 — VSL Writer for the W3 Sites Agency pipeline.
Generate ONLY the 90-second video sales letter script using outreach-automation.
Detect agent_id=agent-4 in context. Read pipeline-state.json for lead + site URL.
Output to ${WORKSPACE_DIR}/outreach/<slug>-vsl-script.md and update pipeline-state.json.`,
  },
  'agent-5': {
    id: 'agent-5',
    name: 'Outreach Specialist',
    role: 'Sales Development Representative',
    skill: 'outreach-automation',
    inputFrom: 'agent-4',
    outputDir: `${WORKSPACE_DIR}/outreach`,
    systemPrompt: `You are Agent 5 — Outreach Specialist for the W3 Sites Agency pipeline.
Generate the full WhatsApp + Email multi-channel sequence using outreach-automation.
Detect agent_id=agent-5 in context.
Output to ${WORKSPACE_DIR}/outreach/<slug>-sequence.md and update pipeline-state.json.`,
  },
  'agent-6': {
    id: 'agent-6',
    name: 'Calendly Manager',
    role: 'Scheduling Coordinator',
    skill: 'outreach-automation',
    inputFrom: 'agent-5',
    outputDir: `${WORKSPACE_DIR}/outreach`,
    systemPrompt: `You are Agent 6 — Calendly Manager for the W3 Sites Agency pipeline.
Configure the scheduling structure, qualification questions, confirmation messages,
and the 15-minute call script. Use outreach-automation.
Detect agent_id=agent-6 in context.
Output to ${WORKSPACE_DIR}/outreach/<slug>-calendly.md and update pipeline-state.json.`,
  },
  'agent-7': {
    id: 'agent-7',
    name: 'Guardian',
    role: 'Design Quality Controller',
    skill: 'design-constraint-enforcer',
    inputFrom: 'agent-3',
    outputDir: `${WORKSPACE_DIR}/sites`,
    systemPrompt: `You are Agent 7 — Guardian for the W3 Sites Agency pipeline.
Audit ALL edits made by Agent 3 against the DESIGN.md.
Use design-constraint-enforcer to produce a conformance report.
If you detect deviations: correct them before reporting completion.
Output an audit log to ${WORKSPACE_DIR}/sites/design-audit.log.`,
  },
};

export function getAgent(id: string): AgentConfig | null {
  return (AGENTS as Record<string, AgentConfig>)[id] ?? null;
}

export function listAgents(): Array<Pick<AgentConfig, 'id' | 'name' | 'role' | 'skill'>> {
  return Object.values(AGENTS).map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    skill: a.skill,
  }));
}
