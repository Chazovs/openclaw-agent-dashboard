# PR: Real-time Activity Timeline Panel

## Summary
Adds a unified, real-time Activity Timeline panel to the Agent Dashboard — a chronological feed of all system events (sessions, alerts, services, system health) with filtering and auto-refresh.

## Changes

### Server-side (`server-simple.js`)
- Added `/api/timeline` consolidated endpoint
- Returns events from all sources in a single HTTP call
- Accepts `?limit=N` parameter (default 50)
- Returns structured response: `{ success, total, types, timestamp, events[] }`
- Each event has: `type`, `timestamp`, `title`, `meta`, `emoji`, `source`

### Client-side (`public/activity-timeline.js`)
- Fully self-contained IIFE — no dependencies beyond the existing dashboard
- Auto-injects itself via `MutationObserver` when the dashboard container is ready
- Fetches from `/api/timeline` every 15 seconds
- Filter buttons: All, Sessions, Trades, Alerts, Services, System, Reports
- Summary badge with event count and "last hour" indicator
- Manual refresh and cache-clear buttons
- Dedicated dark-theme styling matching the dashboard aesthetic

### HTML (`public/index.html`)
- Added `<script src="/activity-timeline.js">` after `trade-panel.js`

### Documentation
- `CHANGELOG.md` — v1.5.0 entry
- `test-timeline.js` — 35 automated tests (API validation, data integrity, sorting, limits, error handling, static assets)

## Testing
```
node test-timeline.js
```
All 35 tests pass:
- API returns valid response structure
- Events have required fields (type, timestamp, title, emoji, source)
- Events sorted newest-first
- `?limit` parameter controls event count
- Type breakdown sums correctly
- Client file is valid JS with expected exports
- Static file serving works
- Error handling for invalid parameters

## Architecture
```
┌──────────────┐     fetch()     ┌────────────────────┐
│ activity-     │ ─────────────> │ /api/timeline       │
│ timeline.js   │ <────────────  │ (server-simple.js)  │
│ (IIFE)        │    JSON        │                     │
└──────────────┘                └────────────────────┘
                                         │
                          ┌──────────────┼──────────────┐
                          ▼              ▼              ▼
                   Sessions DB     AlertManager    System health
                   (file I/O)      (in-memory)     (execSync)
```

## Deployment Notes
- Server restart required (Docker: `docker restart agent-dashboard`)
- New static file: `public/activity-timeline.js` (served automatically by Express static middleware)
