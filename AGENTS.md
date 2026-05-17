# AGENTS.md — W3 Sites Agency Pipeline (open-cowork)

This repository ships an HTTP adapter that exposes 7 specialized agents to
an external Paperclip orchestrator. Agents are executed by the Electron main
process via the configured Paperclip backend: SDK by default, with CLI
overrides for `claude`, `codex`, or `pi`. Outputs share a workspace at
`default_working_dir/`.

## Adapter

- Base URL (host, local): `http://127.0.0.1:3200`
- Base URL (from Docker): `http://host.docker.internal:3200`
- Discovery endpoint: `GET  /agents`
- Per-agent health: `GET  /agent/<id>/health`
- Per-agent heartbeat: `POST /agent/<id>/heartbeat`
- Toggle env: `ENABLE_PAPERCLIP_ADAPTER=true|false` (default true)
- Backend config: Settings → Paperclip Pipeline controls global default and
  per-agent overrides. The default is SDK, with `agent-1` pinned to CLI Claude
  for native web search.

Heartbeat request body:

```json
{
  "task": { "title": "string", "description": "string (optional)" },
  "context": { "any": "json the agent should read" },
  "budget": 0.5
}
```

Heartbeat response:

```json
{
  "status": "completed",
  "agentId": "agent-1",
  "summary": "stdout from the subprocess (truncated)",
  "outputFiles": ["absolute/paths/..."],
  "durationMs": 42000,
  "exitCode": 0,
  "binary": "/Users/.../claude"
}
```

---

## Agents

### agent-1: Prospector

- **Role:** Lead Generation Specialist
- **Heartbeat:** `POST http://host.docker.internal:3200/agent/agent-1/heartbeat`
- **Skill:** [`google-maps-lead-gen`](.claude/skills/google-maps-lead-gen/SKILL.md)
- **Schedule:** Daily @ 08:00
- **Budget:** US$ 30 / month
- **Output:** `default_working_dir/leads/`
- **Updates:** `default_working_dir/pipeline-state.json` → `agent1_completed`, `top_lead`

### agent-2: Diagnosticador

- **Role:** Business Analyst
- **Heartbeat:** `POST http://host.docker.internal:3200/agent/agent-2/heartbeat`
- **Skill:** [`site-diagnostic-report`](.claude/skills/site-diagnostic-report/SKILL.md)
- **Trigger:** agent-1 completes
- **Budget:** US$ 20 / month
- **Output:** `default_working_dir/diagnostics/`
- **Updates:** `agent2_completed`, `perda_mensal`, `diagnostico_file`, `script_file`

### agent-3: Builder

- **Role:** Web Developer
- **Heartbeat:** `POST http://host.docker.internal:3200/agent/agent-3/heartbeat`
- **Skill:** `cinematic-landing-prompt` + [`design-constraint-enforcer`](.claude/skills/design-constraint-enforcer/SKILL.md)
- **Trigger:** agent-2 completes
- **Budget:** US$ 150 / month
- **Output:** `default_working_dir/sites/<slug>/`
- **Updates:** `agent3_completed`, `site_url`, `site_path`, `design_md_file`

### agent-4: VSL Writer

- **Role:** Video Script Specialist
- **Heartbeat:** `POST http://host.docker.internal:3200/agent/agent-4/heartbeat`
- **Skill:** [`outreach-automation`](.claude/skills/outreach-automation/SKILL.md)
- **Trigger:** agent-3 completes
- **Budget:** US$ 30 / month
- **Output:** `default_working_dir/outreach/<slug>-vsl-script.md`
- **Updates:** `agent4_completed`, `vsl_script_file`

### agent-5: Outreach Specialist

- **Role:** Sales Development Representative
- **Heartbeat:** `POST http://host.docker.internal:3200/agent/agent-5/heartbeat`
- **Skill:** [`outreach-automation`](.claude/skills/outreach-automation/SKILL.md)
- **Trigger:** agent-4 completes
- **Budget:** US$ 30 / month
- **Output:** `default_working_dir/outreach/<slug>-sequence.md`
- **Updates:** `agent5_completed`, `sequence_file`

### agent-6: Calendly Manager

- **Role:** Scheduling Coordinator
- **Heartbeat:** `POST http://host.docker.internal:3200/agent/agent-6/heartbeat`
- **Skill:** [`outreach-automation`](.claude/skills/outreach-automation/SKILL.md)
- **Trigger:** agent-5 completes
- **Budget:** US$ 20 / month
- **Output:** `default_working_dir/outreach/<slug>-calendly.md`
- **Updates:** `agent6_completed`, `calendly_file`, `calendly_url`

### agent-7: Guardian

- **Role:** Design Quality Controller
- **Heartbeat:** `POST http://host.docker.internal:3200/agent/agent-7/heartbeat`
- **Skill:** [`design-constraint-enforcer`](.claude/skills/design-constraint-enforcer/SKILL.md)
- **Trigger:** agent-3 completes (runs in PARALLEL with agent-4)
- **Budget:** US$ 200 / month
- **Output:** `default_working_dir/sites/design-audit.log`
- **Updates:** `agent7_completed`, `design_audit_log`

---

## Shared workspace

All agents read and write under `default_working_dir/`:

```
default_working_dir/
├── pipeline-state.json   ← shared state, every agent reads/writes
├── leads/                ← agent-1 output
├── diagnostics/          ← agent-2 output
├── sites/                ← agent-3 and agent-7 output
└── outreach/             ← agents 4, 5, 6 output
```

`pipeline-state.json` is the source of truth for hand-offs between agents.
Each agent must read it before starting and update it on completion.

---

## Vendored external skills

The Paperclip runner reads skills directly from `.claude/skills/<name>/SKILL.md`.
External skills vendored for the W3 Sites Agency pipeline:

- [`impeccable`](.claude/skills/impeccable/SKILL.md) — frontend craft, UI audit, polish, and design hardening.
- [`design-taste-frontend`](.claude/skills/design-taste-frontend/SKILL.md) — high-agency frontend taste and anti-generic UI rules.
- [`marketing-cro`](.claude/skills/marketing-cro/SKILL.md) — conversion-rate optimization guidance.
- [`marketing-copywriting`](.claude/skills/marketing-copywriting/SKILL.md) — persuasive page and offer copy.
- [`marketing-cold-email`](.claude/skills/marketing-cold-email/SKILL.md) — B2B cold outreach and follow-up sequences.
- [`marketing-video`](.claude/skills/marketing-video/SKILL.md) — AI/programmatic marketing video production workflows.

Validation note: agent-1 was validated through the real Electron UI on
`2026-05-17T01:05:00Z` with 1 cafeteria lead. The run wrote JSON/CSV under
`default_working_dir/leads/`, updated `pipeline-state.json` with
`agent1_completed: true`, `total_leads: 1`, and `top_lead` =
`Café das Coisinhas`.

In the local app used for validation, Settings → Skills had its custom storage
directory set to `/Users/vitormiguelgoedertdaluz/Documents/skills`, so these
vendored skills were also mirrored there to make the UI list them. The repo
copies above remain the Paperclip runner source of truth.

---

## Required secrets

| Variable                    | Used by                | Purpose                                                                                  |
| --------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`         | Paperclip + claude CLI | Optional when `claude` CLI is already authenticated via the user's persisted credentials |
| `PAPERCLIP_SECRET`          | Paperclip              | Generated by `paperclip onboard`, persisted in volume                                    |
| `PAPERCLIP_AGENT_BINARY`    | adapter                | Legacy fallback only; Settings → Paperclip Pipeline now controls SDK/CLI backend choice  |
| `PAPERCLIP_CLAUDE_BIN`      | adapter                | Optional absolute path to Claude CLI if Electron cannot resolve it from PATH             |
| `PAPERCLIP_CODEX_BIN`       | adapter                | Optional absolute path to Codex CLI if Electron cannot resolve it from PATH              |
| `PAPERCLIP_PI_BIN`          | adapter                | Optional absolute path to pi CLI if Electron cannot resolve it from local node_modules   |
| `PAPERCLIP_ALLOWED_TOOLS`   | adapter                | Optional comma/space list; defaults include `WebSearch`, `web_search`, and file tools    |
| `PAPERCLIP_PERMISSION_MODE` | adapter                | Optional Claude Code permission mode; defaults to `auto`                                 |
| `PAPERCLIP_ADAPTER_PORT`    | adapter                | Default `3200`                                                                           |
| `PAPERCLIP_ADAPTER_HOST`    | adapter                | Default `127.0.0.1`                                                                      |
| `GOOGLE_MAPS_API_KEY`       | agent-1 (optional)     | Falls back to web_search if unset                                                        |
| `CALENDLY_TOKEN`            | agent-6 (optional)     | Real scheduling integration                                                              |

---

## First run

1. Launch W3Cowork with the adapter enabled:
   ```bash
   ENABLE_PAPERCLIP_ADAPTER=true npm run dev
   ```
2. Verify the adapter:
   ```bash
   curl http://127.0.0.1:3200/agents
   ```
3. Start Paperclip:
   ```bash
   bash paperclip/setup.sh
   ```
4. Follow the checklist printed by the script to wire the 7 employees
   in the Paperclip dashboard (`http://localhost:3100`).
