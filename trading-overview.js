/**
 * Trading Overview Module
 * Consolidated trading performance: PnL, positions, market data, alerts
 * Встраивается в server-simple.js через require()
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || '/home/openclaw/.openclaw';
const WORKSPACE_PATH = path.join(OPENCLAW_HOME, 'workspace');

// Helper: async check if path exists
function pathExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch(e) { return false; }
}

// Helper: async read file
function readFile(p) {
  return new Promise((resolve, reject) => {
    fs.readFile(p, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

class TradingOverview {
  constructor() {
    this.cache = { data: null, timestamp: 0 };
    this.CACHE_TTL = 30000; // 30 second cache
  }

  async getOverview() {
    const now = Date.now();
    if (this.cache.data && (now - this.cache.timestamp) < this.CACHE_TTL) {
      return this.cache.data;
    }

    try {
      const data = await this._buildOverview();
      this.cache = { data, timestamp: now };
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async _buildOverview() {
    const bots = await this._getBotData();
    const marketData = await this._getMarketData();
    const recommendations = await this._getRecommendations();
    const auditorData = await this._getAuditorData();
    const entries = await this._getCurrentEntries();

    return {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalBots: bots.length,
        activeBots: bots.filter(b => b.isActive).length,
        totalPortfolioUSDT: bots.reduce((s, b) => s + (b.balances?.total || 0), 0),
        totalTrades: bots.reduce((s, b) => s + (b.totalBuys || 0) + (b.totalSells || 0), 0),
        activePositions: bots.reduce((s, b) => s + (b.activePositionsCount || 0), 0),
        warnings: auditorData?.warnings || 0,
        criticalIssues: auditorData?.critical || 0
      },
      bots,
      positions: entries || [],
      marketData: marketData || null,
      recommendations: recommendations || [],
      auditorSummary: auditorData || null,
      auditedAt: auditorData?.timestamp || null
    };
  }

  async _getBotData() {
    const botConfigs = [
      { id: 'bybit_mean_reversion', name: 'Mean Reversion', emoji: '📉', serviceName: 'bybit-trader', logFile: 'bybit-trades.log', jsonFile: 'bybit-trades.json' },
      { id: 'bybit_aggressive', name: 'HFT Scalping', emoji: '⚡', serviceName: 'bybit-aggressive', logFile: 'bybit-aggressive-trades.log', jsonFile: 'bybit-aggressive-trades.json' },
      { id: 'memecoin', name: 'Memecoin', emoji: '🪙', serviceName: 'memecoin-trader', logFile: 'memecoins-trades.log', jsonFile: null },
      { id: 'tinkoff', name: 'Тинькофф', emoji: '🏦', serviceName: 'tinkoff-trader', logFile: 'tinkoff-live-trades.log', jsonFile: null }
    ];

    const bots = [];
    for (const config of botConfigs) {
      const data = await this._parseLog(config);
      bots.push(data);
    }
    return bots;
  }

  async _parseLog(config) {
    const logPath = path.join(WORKSPACE_PATH, config.logFile);
    const jsonPath = config.jsonFile ? path.join(WORKSPACE_PATH, config.jsonFile) : null;

    let result = {
      id: config.id,
      name: config.name,
      emoji: config.emoji,
      isActive: false,
      serviceStatus: 'unknown',
      logExists: false,
      totalLines: 0,
      lastModified: null,
      totalBuys: 0,
      totalSells: 0,
      totalErrors: 0,
      activePositionsCount: 0,
      recentTrades: [],
      balances: { usdt: null, coinValue: null, total: null },
      lastLine: null,
      lastRunTime: null,
      logExcerpt: ''
    };

    try {
      const out = execSync('systemctl is-active ' + config.serviceName + ' 2>/dev/null || echo unknown', { timeout: 3000, encoding: 'utf8' }).toString().trim();
      result.isActive = out === 'active';
      result.serviceStatus = out;
    } catch (e) {}

    if (pathExists(logPath)) {
      const stat = fs.statSync(logPath);
      result.logExists = true;
      result.lastModified = stat.mtime.toISOString();
      result.logSizeBytes = stat.size;

      try {
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        result.totalLines = lines.length;
        result.logExcerpt = lines.slice(-10).join('\n') || '';

        let buys = 0, sells = 0, errors = 0;
        lines.forEach(line => {
          if (line.includes('BUY') || line.includes('Покупка') || line.includes('buy_order') || line.includes('Bought')) buys++;
          if (line.includes('SELL') || line.includes('Продажа') || line.includes('sell_order') || line.includes('Sold') || line.includes('TakeProfit')) sells++;
          if (line.includes('ERROR') || line.includes('Error') || line.includes('❌') || line.includes('FAIL')) errors++;
        });
        result.totalBuys = buys;
        result.totalSells = sells;
        result.totalErrors = errors;

        const lastRunLine = lines.filter(l => l.includes('ИТОГО') || l.includes('запуск') || l.includes('=== Начат') || l.includes('Starting')).slice(-1)[0];
        if (lastRunLine) {
          const dateMatch = lastRunLine.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
          if (dateMatch) result.lastRunTime = dateMatch[0];
        }

        result.recentTrades = lines.filter(l => l.includes('BUY') || l.includes('SELL') || l.includes('Продажа') || l.includes('Покупка') || l.includes('TakeProfit') || l.includes('StopLoss'))
          .slice(-5)
          .map(l => {
            const parts = l.split(/\s{2,}/);
            return parts.length > 1 ? parts[parts.length - 1].trim() : l.trim();
          });
      } catch (e) {}
    }

    // Try JSON data for entries/positions
    if (jsonPath && pathExists(jsonPath)) {
      try {
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        if (jsonContent.trim().startsWith('[')) {
          const entries = JSON.parse(jsonContent);
          result.activePositionsCount = Array.isArray(entries) ? entries.length : 0;
        } else {
          const entries = jsonContent.split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
          result.activePositionsCount = entries.length;
        }
      } catch (e) {}
    }

    // Try to get balance from crypto-audit
    const auditData = await this._getAuditorData();
    if (auditData && auditData.agents) {
      const agentKey = config.id === 'bybit_mean_reversion' ? 'bybit-trader' :
                       config.id === 'bybit_aggressive' ? 'bybit-aggressive' :
                       config.id === 'memecoin' ? 'memecoin-trader' : null;
      if (agentKey && auditData.agents[agentKey]) {
        const agent = auditData.agents[agentKey];
        result.balances.usdt = agent.usdt;
        result.balances.coinValue = agent.coins_held_value;
        result.balances.total = (agent.usdt || 0) + (agent.coins_held_value || 0);
        result.totalAllTimeSells = agent.alltime_sells;
      }
    }

    return result;
  }

  async _getMarketData() {
    const scanPath = path.join(WORKSPACE_PATH, 'market-scan.json');
    if (!pathExists(scanPath)) return null;
    try {
      const content = fs.readFileSync(scanPath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }

  async _getRecommendations() {
    const auditPath = path.join(WORKSPACE_PATH, 'crypto-audit-report.json');
    if (!pathExists(auditPath)) return [];
    try {
      const content = fs.readFileSync(auditPath, 'utf8');
      const data = JSON.parse(content);
      return data.recommendations || [];
    } catch (e) {
      return [];
    }
  }

  async _getAuditorData() {
    const auditPath = path.join(WORKSPACE_PATH, 'crypto-audit-report.json');
    if (!pathExists(auditPath)) return null;
    try {
      const content = fs.readFileSync(auditPath, 'utf8');
      const data = JSON.parse(content);
      const warnings = data.recommendations ? data.recommendations.length : 0;
      const critical = data.verdict === 'critical' ? 1 : 0;
      const issueCount = Object.values(data.agents || {}).reduce((sum, a) => sum + (a.issues || []).length, 0);
      return {
        timestamp: data.timestamp,
        run: data.run,
        verdict: data.verdict,
        warnings,
        critical,
        issueCount,
        agents: {
          'bybit-trader': data.agents?.['bybit-trader'] || null,
          'bybit-aggressive': data.agents?.['bybit-aggressive'] || null,
          'memecoin-trader': data.agents?.['memecoin-trader'] || null
        }
      };
    } catch (e) {
      return null;
    }
  }

  async _getCurrentEntries() {
    const entriesPath = path.join(WORKSPACE_PATH, 'bybit-entries.json');
    if (!pathExists(entriesPath)) return [];
    try {
      const content = fs.readFileSync(entriesPath, 'utf8');
      const data = JSON.parse(content);
      return Object.entries(data).map(([symbol, info]) => ({
        symbol,
        price: parseFloat(info.price) || 0,
        qty: parseFloat(info.qty) || 0,
        valueUSDT: (parseFloat(info.price) || 0) * (parseFloat(info.qty) || 0),
        timestamp: info.time
      }));
    } catch (e) {
      return [];
    }
  }
}

module.exports = TradingOverview;
