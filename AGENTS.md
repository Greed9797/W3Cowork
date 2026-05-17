# AGENTS.md — W3 Sites Agency Pipeline (open-cowork)

This repository ships an HTTP adapter that exposes 7 specialized agents to
an external Paperclip orchestrator. All agents are executed in-process by
the Electron main process via subprocess (`claude` CLI by default) and
share a workspace at `default_working_dir/`.

## Adapter

- Base URL (host, local): `http://127.0.0.1:3200`
- Base URL (from Docker): `http://host.docker.internal:3200`
- Discovery endpoint: `GET  /agents`
- Per-agent health: `GET  /agent/<id>/health`
- Per-agent heartbeat: `POST /agent/<id>/heartbeat`
- Toggle env: `ENABLE_PAPERCLIP_ADAPTER=true|false` (default true)
- Backend env: `PAPERCLIP_AGENT_BINARY=claude|pi` (default claude)

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

## Required secrets

| Variable                 | Used by                | Purpose                                               |
| ------------------------ | ---------------------- | ----------------------------------------------------- |
| `ANTHROPIC_API_KEY`      | Paperclip + claude CLI | Drives LLM calls                                      |
| `PAPERCLIP_SECRET`       | Paperclip              | Generated by `paperclip onboard`, persisted in volume |
| `PAPERCLIP_AGENT_BINARY` | adapter                | `claude` (default) or `pi`                            |
| `PAPERCLIP_ADAPTER_PORT` | adapter                | Default `3200`                                        |
| `PAPERCLIP_ADAPTER_HOST` | adapter                | Default `127.0.0.1`                                   |
| `GOOGLE_MAPS_API_KEY`    | agent-1 (optional)     | Falls back to web_search if unset                     |
| `CALENDLY_TOKEN`         | agent-6 (optional)     | Real scheduling integration                           |

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
