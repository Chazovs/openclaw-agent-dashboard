# Changelog

## [1.5.0] — 2026-05-01

### Added
- **Activity Timeline Panel** — unified chronological feed of all system events
  - Real-time dashboard panel showing sessions, alerts, services, and system health
  - Auto-refreshes every 15 seconds with deduplication
  - Filter by event type (all, session, trade, alert, service, system, report)
  - Summary badge showing total events and "last hour" count
  - Manual refresh and cache-clear controls
  - Server-side `/api/timeline` consolidated endpoint (single HTTP call)
  - Client-side `public/activity-timeline.js` (fully self-contained IIFE)
  - 35 automated tests covering API, data integrity, sorting, limits, error handling, static assets
