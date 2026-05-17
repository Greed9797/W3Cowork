#!/usr/bin/env bash
# Bootstraps the Paperclip orchestrator for the W3 Sites Agency pipeline.
# Assumes the W3Cowork Electron app is already running with the Paperclip
# adapter enabled on 127.0.0.1:3200.
#
# Usage:  bash paperclip/setup.sh

set -euo pipefail

ADAPTER_HOST="${PAPERCLIP_ADAPTER_HOST:-127.0.0.1}"
ADAPTER_PORT="${PAPERCLIP_ADAPTER_PORT:-3200}"
ADAPTER_URL_LOCAL="http://${ADAPTER_HOST}:${ADAPTER_PORT}"
ADAPTER_URL_FROM_DOCKER="http://host.docker.internal:${ADAPTER_PORT}"
PAPERCLIP_URL="http://localhost:3100"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }

bold "=== W3 Sites Agency — Paperclip Setup ==="
echo "Adapter (local):       $ADAPTER_URL_LOCAL"
echo "Adapter (from Docker): $ADAPTER_URL_FROM_DOCKER"
echo "Paperclip dashboard:   $PAPERCLIP_URL"
echo

# 1. Verify adapter is reachable
bold "[1/4] Checking W3Cowork adapter at $ADAPTER_URL_LOCAL/agents ..."
if ! curl -sf -m 5 "$ADAPTER_URL_LOCAL/agents" > /dev/null; then
  red "  ✗ Adapter NOT reachable."
  echo "  Start W3Cowork with the adapter enabled:"
  echo "    ENABLE_PAPERCLIP_ADAPTER=true npm run dev"
  exit 1
fi
green "  ✓ Adapter reachable. Listing agents:"
curl -s "$ADAPTER_URL_LOCAL/agents" | jq -r '.agents[] | "    - \(.id): \(.name) (\(.role)) → skill: \(.skill)"' 2>/dev/null \
  || curl -s "$ADAPTER_URL_LOCAL/agents"
echo

# 2. Start Paperclip via docker compose
bold "[2/4] Starting Paperclip container ..."
if [ ! -f "$(dirname "$0")/docker-compose.yml" ]; then
  red "  ✗ docker-compose.yml not found alongside this script."
  exit 1
fi
( cd "$(dirname "$0")" && docker compose up -d )
echo

# 3. Wait for Paperclip
bold "[3/4] Waiting for Paperclip ($PAPERCLIP_URL) ..."
for i in $(seq 1 60); do
  if curl -sf -m 3 "$PAPERCLIP_URL/health" > /dev/null 2>&1 \
     || curl -sf -m 3 "$PAPERCLIP_URL" > /dev/null 2>&1; then
    green "  ✓ Paperclip is up."
    break
  fi
  printf "."
  sleep 2
done
echo

# 4. Print configuration checklist
bold "[4/4] Manual configuration in the Paperclip dashboard ($PAPERCLIP_URL):"
cat <<EOF

  1. Create Company:
       Name:    W3 Sites Agency
       Mission: Prospect and deliver websites for local SMBs without digital presence

  2. Create 7 HTTP-adapter employees (base URL: ${ADAPTER_URL_FROM_DOCKER}):

     ┌──────────┬──────────────────┬───────────────────┬────────────────────────┐
     │ Agent ID │ Display Name     │ Budget / month    │ Trigger                │
     ├──────────┼──────────────────┼───────────────────┼────────────────────────┤
     │ agent-1  │ Prospector       │ US\$ 30            │ Daily @ 08:00          │
     │ agent-2  │ Diagnosticador   │ US\$ 20            │ agent-1 completes      │
     │ agent-3  │ Builder          │ US\$ 150           │ agent-2 completes      │
     │ agent-4  │ VSL Writer       │ US\$ 30            │ agent-3 completes      │
     │ agent-5  │ Outreach         │ US\$ 30            │ agent-4 completes      │
     │ agent-6  │ Calendly Manager │ US\$ 20            │ agent-5 completes      │
     │ agent-7  │ Guardian         │ US\$ 200           │ agent-3 (parallel)     │
     └──────────┴──────────────────┴───────────────────┴────────────────────────┘

     For each, set:
       Heartbeat URL:  ${ADAPTER_URL_FROM_DOCKER}/agent/<agent-id>/heartbeat
       Health URL:     ${ADAPTER_URL_FROM_DOCKER}/agent/<agent-id>/health
       Method:         POST (heartbeat) / GET (health)

  3. Create Goal hierarchy:
       Company Goal: "Reach US\$ 18,800/month in website revenue"
       Project:      "Automated prospect-to-delivery pipeline"
       Task:         "Prospect <niche> in <city>"  →  assign to agent-1

  4. Trigger first run:
       Assign the task above to agent-1 via the dashboard,
       or POST manually:

       curl -X POST ${ADAPTER_URL_LOCAL}/agent/agent-1/heartbeat \\
         -H 'Content-Type: application/json' \\
         -d '{
           "task": { "title": "Prospect bakeries in Curitiba, PR" },
           "context": { "nicho": "padaria", "cidade": "Curitiba, PR", "quantidade": 20 },
           "budget": 0.5
         }'
EOF

green "Setup complete. Open $PAPERCLIP_URL to finish wiring."
