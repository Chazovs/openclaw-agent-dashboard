# Trading Performance Panel

## Overview

A comprehensive **Trading Performance Panel** that consolidates all crypto trading data into one unified view. Replaces the need to check multiple sources (logs, auditor reports, market scanners) with a single, real-time dashboard panel.

**New files:**
- `trading-overview.js` — Backend module (Node.js)
- `tests/trading-overview.test.js` — 28 automated tests

**Modified files:**
- `server-simple.js` — Added `/api/trading/overview` endpoint
- `public/index.html` — Added panel HTML + CSS + JS (~400 lines)

## Features

### 1. Consolidated Portfolio Summary
- **Total portfolio value** (USDT) across all bots
- Active bot count / total bots
- Active positions counter
- Total trades executed
- Warning/issue count from crypto auditor

### 2. Audit Verdict Badge
- Displays the latest crypto-audit verdict (`ok`, `attention`, `critical`)
- Color-coded badges (green/orange/red)
- Links to the audit run number and timestamp

### 3. Individual Bot Cards
Each bot shows:
- **Status indicator** (active/inactive dot)
- **Balance** (USDT + coin value)
- **Trade counters** (buys, sells, errors)
- **Last run timestamp** from log parsing
- **Recent trades** (last 5, color-coded: green=buy, red=sell, orange=error)
- **Log excerpt** (toggle-able last 10 lines)

### 4. Active Positions Table
- Parsed from `bybit-entries.json`
- Shows: Symbol, Price, Quantity, Value, Timestamp
- Value validated (price × qty)

### 5. Audit Recommendations
- Displays warnings/alerts from the crypto auditor
- Color-coded by severity (critical=red, warning=orange, info=blue)

### 6. Market Scanner Data
- Recent scalp recommendations from `market-scan.json`
- Grid layout: Symbol, Price, Trend %, Volatility, Spread
- Shows top 6 recommendations

### 7. Auto-refresh
- Panel auto-refreshes every 30 seconds
- Manual refresh button available

## API Endpoint

### `GET /api/trading/overview`

**Response structure:**
```json
{
  "success": true,
  "timestamp": "2026-04-29T08:10:50.000Z",
  "summary": {
    "totalBots": 4,
    "activeBots": 1,
    "totalPortfolioUSDT": 78.49,
    "totalTrades": 342,
    "activePositions": 4,
    "warnings": 1,
    "criticalIssues": 0
  },
  "bots": [
    {
      "id": "bybit_mean_reversion",
      "name": "Mean Reversion",
      "emoji": "📉",
      "isActive": false,
      "serviceStatus": "inactive",
      "logExists": true,
      "totalLines": 512,
      "totalBuys": 15,
      "totalSells": 0,
      "totalErrors": 3,
      "activePositionsCount": 7,
      "lastRunTime": "2026-04-29",
      "balances": { "usdt": 10.14, "coinValue": 7, "total": 17.14 },
      "recentTrades": ["BUY ETH @ 2273", "..."]
    }
  ],
  "positions": [
    { "symbol": "BTCUSDT", "price": 76492.5, "qty": 0.000065, "valueUSDT": 5.0 }
  ],
  "recommendations": ["⚠️ Mean Reversion: ..."],
  "auditorSummary": {
    "timestamp": "...",
    "run": 49,
    "verdict": "attention",
    "warnings": 1,
    "issueCount": 3
  },
  "marketData": {
    "timestamp": "...",
    "recommended_scalp": [ { "symbol": "BLENDUSDT", ... } ]
  }
}
```

## Data Sources

| Source | File | Description |
|--------|------|-------------|
| Bot logs | `bybit-trades.log`, `bybit-aggressive-trades.log`, etc. | Raw trade data |
| Trade entries | `bybit-entries.json` | Current open positions |
| Crypto audit | `crypto-audit-report.json` | Bot health & recommendations |
| Market scan | `market-scan.json` | Market opportunities |

## Design

- **Color scheme**: Matches existing cyberpunk dashboard (dark theme, #0f3460 borders, #ffa502 accents)
- **Typography**: Monospace for numeric values, consistent with dashboard style
- **Layout**: Summary grid → Bot cards → Positions table → Recommendations → Market data
- **Interactions**: Click to expand bot details, click to show logs
- **Loading states**: Shows loading indicator during data fetch
- **Error states**: Shows error message with retry option
