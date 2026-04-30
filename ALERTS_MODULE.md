# Alert & Notification Center

A unified alert aggregation and notification system for the OpenClaw Agent Dashboard. Collects, manages, and surfaces critical events from all dashboard subsystems in one place.

## Architecture

```
┌────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  System Health  │    │  Service Monitor │    │  Session Scanner │
│  (CPU, RAM,    │    │  (systemd units) │    │  (timeouts)     │
│   Disk, Load)  │    │                  │    │                 │
└───────┬────────┘    └───────┬──────────┘    └───────┬─────────┘
        │                     │                       │
        └─────────────────────┼───────────────────────┘
                              ▼
              ┌───────────────────────────┐
              │     AlertManager.js        │
              │  • Deduplication (5 min)   │
              │  • Severity ranking        │
              │  • Persistence to disk     │
              │  • Auto-prune (max 500)    │
              └───────────┬───────────────┘
                          │
                          ▼
              ┌───────────────────────────┐
              │   REST API Endpoints      │
              │  GET /api/alerts          │
              │  GET /api/alerts/summary  │
              │  POST /api/alerts/scan    │
              │  DELETE /api/alerts       │
              │  POST /:id/acknowledge    │
              └───────────┬───────────────┘
                          │
                          ▼
              ┌───────────────────────────┐
              │   Frontend Alert Panel    │
              │  • Severity badges        │
              │  • Filter buttons         │
              │  • Acknowledge actions    │
              │  • Auto-refresh (10s)     │
              └───────────────────────────┘
```

## Files

| File | Description |
|------|-------------|
| `alert-manager.js` | Core module: storage, dedup, alert generation |
| `server-simple.js` | Server with alert API routes |
| `public/index.html` | Frontend HTML + JS + CSS (alert panel) |
| `data/alerts.json` | Persisted alert storage |
| `test-alert-manager.js` | Unit tests (18 test cases) |
| `test-api-alerts.sh` | API integration tests (13 tests) |

## Severity Levels

| Level | Code | Emoji | Description |
|-------|------|-------|-------------|
| CRITICAL | 0 | 🔴 | System-critical: health < 40 |
| ERROR | 1 | ❌ | Component failure: disk > 90%, service down |
| WARNING | 2 | ⚠️ | Potential issue: CPU > 80%, RAM > 85%, health < 60 |
| INFO | 3 | 💡 | Informational: normal state changes |

## REST API

### GET /api/alerts

Retrieve alerts with optional filters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `minSeverity` | int | Minimum severity (0-3) |
| `maxSeverity` | int | Maximum severity (0-3) |
| `source` | string | Filter by source (`cpu`, `memory`, `disk`, `service`, `system`, `session`) |
| `acknowledged` | bool | Filter by acknowledged state |
| `since` | timestamp | Only alerts after this time |
| `limit` | int | Max results (default 100) |

### GET /api/alerts/summary

Returns aggregate statistics without detailed alerts.

### POST /api/alerts/:id/acknowledge

Mark a single alert as acknowledged.

### POST /api/alerts/acknowledge-all

Mark all alerts as acknowledged. Optional JSON body: `{ "source": "cpu" }` to filter by source.

### POST /api/alerts/scan

Scan current system state and generate alerts for:
- High CPU (>80%)
- High memory (>85%)
- Full disk (>90%)
- Low health score (<60)

### DELETE /api/alerts

Clear all alerts.

## Automated Sources

Alerts are auto-generated from:
1. **System health** — CPU load, memory pressure, disk usage
2. **Service failures** — systemd unit inactivity
3. **Session timeouts** — OpenClaw sessions exceeding limits
4. **Manual scan** — via "🔍 Сканировать систему" button in the UI

## Deduplication

When the same alert source+message appears within 5 minutes, it increments the `count` field rather than creating a new entry. This prevents notification spam.

## Testing

```bash
# Unit tests (backend logic)
node test-alert-manager.js

# API integration tests (requires running server at port 3000)
bash test-api-alerts.sh
```

## Design Notes

- Color scheme matches existing dashboard theme (#1a1a2e background)
- Severity badges use consistent red/orange/blue palette
- Left border color coding for quick scan
- Filter buttons preserve active state visually
- Auto-refresh at 10s when panel is open; badge-only loading on startup
