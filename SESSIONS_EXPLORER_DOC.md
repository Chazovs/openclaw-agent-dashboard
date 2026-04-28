# 🔌 OpenClaw Sessions Explorer

## Overview

The **Sessions Explorer** is a new dashboard panel that provides real-time visibility into all OpenClaw sessions stored in `sessions.json`. Unlike the agent grid (which summarizes agents), this panel gives you raw session-level insight: what's running, what models are being used, how old each session is, and token consumption per session.

## ✨ Features

### 1. Session Summary Cards
- **Total sessions**, **active count**, **total tokens** across all sessions, and **estimated cost** (based on model pricing)
- At-a-glance understanding of system load

### 2. Filter Buttons
- **📋 All** — All sessions
- **▶ Running** — Only currently executing sessions
- **🕐 Last Hour** — Sessions updated in the last 60 minutes
- **📅 Today** — Sessions updated since midnight

### 3. Session List with Expand/Collapse
Each session card shows:
- **Status dot** (green pulsing for running, blue for done, red for timeout)
- **Channel emoji** (📱 Telegram, 🌐 WebChat, ⏰ Cron, etc.)
- **Session type label** (Main, Telegram, Cron, SubAgent)
- **Model badge** (e.g. `deepseek-chat`)
- **Age display** (e.g. `8 мин`, `24ч 5м`)

Click a session card to expand and see:
- Full session key
- Token bar (visual input/output ratio)
- Session ID, channel, provider
- Last message preview (when available)
- Aborted status indication

### 4. Auto-Refresh
- Panel refreshes every 15 seconds while open
- Manual refresh button available
- Panel only polls API when visible (collapsed = no requests)

## 🛠 API Endpoint

### `GET /api/sessions`

Returns all OpenClaw sessions from `sessions.json` with computed metadata.

**Response structure:**
```json
{
  "success": true,
  "total": 14,
  "summary": {
    "running": 1,
    "done": 11,
    "timeout": 1,
    "totalTokens": 373942,
    "totalCost": 0.144548,
    "models": ["deepseek-chat", "?"]
  },
  "sessions": [
    {
      "key": "agent:main:cron:a635c3ca-...",
      "sessionId": "2cda8d7c-...",
      "type": "cron",
      "status": "running",
      "statusDisplay": "▶ Running",
      "updatedAt": 1777363427066,
      "ageDisplay": "1 мин",
      "model": "deepseek-chat",
      "inputTokens": 48776,
      "outputTokens": 65,
      "totalTokens": 48841,
      "channel": "?",
      "channelEmoji": "❓",
      "aborted": false,
      "messageCount": 0,
      ...
    }
  ]
}
```

### Session fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Raw session key (`agent:main:type:id`) |
| `sessionId` | string | UUID session identifier |
| `type` | string | Session type: `main`, `telegram`, `cron`, `subagent` |
| `status` | string | `running`, `done`, `timeout`, or `unknown` |
| `statusDisplay` | string | Human-readable with emoji |
| `ageDisplay` | string | Human-readable age |
| `model` | string | Model name used |
| `totalTokens` | number | Input + output tokens |
| `channel` | string | Channel name |
| `channelEmoji` | string | Channel emoji identifier |
| `aborted` | boolean | Was session aborted? |
| `contextTokens` | number | Context window size |

## 📈 Non-Regression

All existing APIs remain intact:
- `/api/agents` — agent management
- `/api/services` — services & cron
- `/api/trading/monitor` — trading bots
- `/api/system/health` — system health
- `/api/tokens/costs` — token cost analytics

Tested with **29 tests** covering API response, data structure, summary stats, ordering, and non-regression.

## 📁 Files Changed

| File | Change |
|------|--------|
| `server-simple.js` | Added `GET /api/sessions` endpoint (new route) |
| `public/index.html` | Added Sessions Explorer panel, CSS styles, JS logic, filter bar |
| `tests/test-sessions.js` | New test suite (29 tests) |
