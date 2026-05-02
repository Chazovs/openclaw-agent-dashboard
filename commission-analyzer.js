/**
 * Commission & Fee Analyzer Module
 * Анализирует комиссии по всем торговым ботам из логов.
 *
 * Формат логов (bybit-trades.log, bybit-aggressive-trades.log, memecoins-trades.log):
 *   - "✅ Buy 5.0 BNBUSDT: orderId=..." (amount in USDT)
 *   - "📈 Сигнал BNBUSDT: z=-2.29, покупаем на $5.00 USDT"
 *   - Sell/StopLoss/TakeProfit lines
 *   - tinkoff-live-trades.log — формат с акциями РФ
 *
 * Комиссия: 0.055% для скальпинга (фьючерсы), 0.1% для спот-ботов,
 * 0.05% для Тинькофф (тариф Инвестор).
 *
 * Встраивается в server-simple.js через require()
 */

const fs = require('fs');
const path = require('path');

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || '/home/openclaw/.openclaw';
const WORKSPACE_PATH = path.join(OPENCLAW_HOME, 'workspace');

function pathExists(p) {
  try { fs.accessSync(p); return true; } catch(e) { return false; }
}

function readFileSyncSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch(e) { return ''; }
}

/**
 * Extract trade volume in USDT/RUB from a log line
 */
function extractTradeVolume(line) {
  // 1: "покупаем на $5.00 USDT" (mean-reversion signal)
  var m = line.match(/покупаем на \$([\d.]+)/i);
  if (m) return parseFloat(m[1]);

  // 2: "продаем на $X.XX USDT"
  m = line.match(/продаем на \$([\d.]+)/i);
  if (m) return parseFloat(m[1]);

  // 3: "✅ Buy 5.0 BNBUSDT: orderId=..." (confirmed trade, amount in USDT)
  m = line.match(/✅\s*Buy\s+([\d.]+)\s+\w+USDT/);
  if (m) return parseFloat(m[1]);

  // 4: "Buy 5.0 BNBUSDT" (with or without prefix)
  m = line.match(/Buy\s+([\d.]+)\s+\w+USDT/);
  if (m) return parseFloat(m[1]);

  // 5: "на 500.00 ₽" or "на 500.00 Р" (tinkoff)
  m = line.match(/на\s+([\d.]+)\s*[₽Р]/u);
  if (m) return parseFloat(m[1]);

  // 6: "Размер: 500.00" (tinkoff)
  m = line.match(/Размер[^0-9]*([\d.]+)/i);
  if (m) { var v = parseFloat(m[1]); if (v > 1) return v; }

  return null;
}

function isTradeLine(line) {
  return /\b(Buy|Sell|Bought|Sold|TakeProfit|StopLoss)\b/i.test(line) ||
         /✅/i.test(line) ||
         /покупаем|продаем/i.test(line);
}

class CommissionAnalyzer {
  constructor() {
    this.cache = { data: null, timestamp: 0 };
    this.CACHE_TTL = 60000;
  }

  async getFees() {
    var now = Date.now();
    if (this.cache.data && (now - this.cache.timestamp) < this.CACHE_TTL) {
      return this.cache.data;
    }
    try {
      var data = this._buildFeeAnalysis();
      this.cache = { data: data, timestamp: now };
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Parse a single bot's log file for fee analysis.
   * @param {string} logPath - full path to log file
   * @param {string} botName - bot identifier (for fee rate inference)
   * @returns {object} parsed data
   */
  _parseTradeLogForFees(logPath, botName) {
    if (!pathExists(logPath)) {
      return { botName: botName, totalFees: 0, tradeCount: 0, totalVolume: 0, feesByDay: [],
               buyCount: 0, sellCount: 0, avgFeePerTrade: 0, avgVolumePerTrade: 0, feeRate: 0.001 };
    }

    var content = readFileSyncSafe(logPath);
    var lines = content.split('\n').filter(function(l) { return l.trim(); });
    var totalVolume = 0;
    var tradeCount = 0;
    var dayVolumes = {};

    // Fee rates: aggressive/HFT uses futures (0.055% taker), others use spot (0.1%)
    var feeRate = /aggressive|scalp|hft/i.test(botName) ? 0.00055 : 0.001;

    lines.forEach(function(line) {
      var dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s/);
      var date = dateMatch ? dateMatch[1] : null;
      var volume = extractTradeVolume(line);

      if (volume !== null && volume > 0) {
        totalVolume += volume;
        tradeCount++;
        if (date) {
          dayVolumes[date] = (dayVolumes[date] || 0) + volume;
        }
      }
    });

    var totalFees = totalVolume * feeRate;

    var feesByDay = Object.keys(dayVolumes).map(function(date) {
      var vol = dayVolumes[date];
      return {
        date: date,
        total: parseFloat((vol * feeRate).toFixed(4)),
        volume: parseFloat(vol.toFixed(2))
      };
    }).sort(function(a, b) { return a.date.localeCompare(b.date); });

    return {
      botName: botName,
      totalFees: parseFloat(totalFees.toFixed(4)),
      tradeCount: tradeCount,
      totalVolume: parseFloat(totalVolume.toFixed(2)),
      avgFeePerTrade: tradeCount > 0 ? parseFloat((totalFees / tradeCount).toFixed(4)) : 0,
      avgVolumePerTrade: tradeCount > 0 ? parseFloat((totalVolume / tradeCount).toFixed(2)) : 0,
      feeRate: feeRate,
      hasExplicitData: false,
      feesByDay: feesByDay
    };
  }

  /**
   * Parse Tinkoff log with a different log format.
   */
  _analyzeTinkoffLog(logPath) {
    if (!pathExists(logPath)) return null;

    var content = readFileSyncSafe(logPath);
    var lines = content.split('\n').filter(function(l) { return l.trim(); });
    var totalVolume = 0;
    var tradeCount = 0;
    var dayVolumes = {};
    var hasData = false;

    lines.forEach(function(line) {
      var dateMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s/);
      var date = dateMatch ? dateMatch[1] : null;
      var volume = extractTradeVolume(line);

      if (volume !== null && volume > 0) {
        totalVolume += volume;
        tradeCount++;
        hasData = true;
        if (date) {
          dayVolumes[date] = (dayVolumes[date] || 0) + volume;
        }
      }
    });

    if (!hasData) return null;

    var feeRate = 0.0005; // Tinkoff "Инвестор" тариф: 0.05%
    var totalFees = totalVolume * feeRate;

    var feesByDay = Object.keys(dayVolumes).map(function(date) {
      var vol = dayVolumes[date];
      return { date: date, total: parseFloat((vol * feeRate).toFixed(4)), volume: parseFloat(vol.toFixed(2)) };
    }).sort(function(a, b) { return a.date.localeCompare(b.date); });

    return {
      botName: 'tinkoff',
      totalFees: parseFloat(totalFees.toFixed(4)),
      tradeCount: tradeCount,
      totalVolume: parseFloat(totalVolume.toFixed(2)),
      avgFeePerTrade: tradeCount > 0 ? parseFloat((totalFees / tradeCount).toFixed(4)) : 0,
      avgVolumePerTrade: tradeCount > 0 ? parseFloat((totalVolume / tradeCount).toFixed(2)) : 0,
      feeRate: feeRate,
      hasExplicitData: false,
      feesByDay: feesByDay
    };
  }

  _buildFeeAnalysis() {
    var botConfigs = [
      { id: 'bybit_mean_reversion', name: 'Mean Reversion', emoji: '📉', logFile: 'bybit-trades.log' },
      { id: 'bybit_aggressive',     name: 'HFT Scalping',     emoji: '⚡', logFile: 'bybit-aggressive-trades.log' },
      { id: 'memecoin',             name: 'Memecoin',         emoji: '🪙', logFile: 'memecoins-trades.log' },
    ];

    var bots = botConfigs.map(function(config) {
      var logPath = path.join(WORKSPACE_PATH, config.logFile);
      var data = this._parseTradeLogForFees(logPath, config.id);
      data.id = config.id;
      data.emoji = config.emoji;
      data.name = config.name;
      return data;
    }, this);

    // Tinkoff (different format)
    var tinkoff = this._analyzeTinkoffLog(path.join(WORKSPACE_PATH, 'tinkoff-live-trades.log'));
    if (tinkoff) {
      tinkoff.id = 'tinkoff';
      tinkoff.emoji = '🏦';
      tinkoff.name = 'Тинькофф';
      bots.push(tinkoff);
    }

    // Sort bots by fees descending, filter out zero-fee bots for display
    bots.sort(function(a, b) { return b.totalFees - a.totalFees; });

    // Totals
    var totalFees = bots.reduce(function(s, b) { return s + b.totalFees; }, 0);
    var totalTrades = bots.reduce(function(s, b) { return s + b.tradeCount; }, 0);
    var totalVolume = bots.reduce(function(s, b) { return s + b.totalVolume; }, 0);

    // Daily aggregation across all bots
    var allDays = {};
    bots.forEach(function(bot) {
      (bot.feesByDay || []).forEach(function(day) {
        if (!allDays[day.date]) {
          allDays[day.date] = { total: 0, volume: 0, bots: {} };
        }
        allDays[day.date].total += day.total;
        allDays[day.date].volume += (day.volume || 0);
        allDays[day.date].bots[bot.id] = (allDays[day.date].bots[bot.id] || 0) + day.total;
      });
    });

    var dailyTrend = Object.keys(allDays).map(function(date) {
      var d = allDays[date];
      return {
        date: date,
        total: parseFloat(d.total.toFixed(4)),
        volume: parseFloat(d.volume.toFixed(2)),
        byBot: d.bots
      };
    }).sort(function(a, b) { return a.date.localeCompare(b.date); });

    // Weekly aggregation (ISO weeks)
    var weeklyMap = {};
    dailyTrend.forEach(function(day) {
      var d = new Date(day.date + 'T12:00:00');
      var dayOfWeek = d.getDay();
      var monOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      var weekStart = new Date(d);
      weekStart.setDate(d.getDate() + monOffset);
      var key = weekStart.toISOString().slice(0, 10);

      if (!weeklyMap[key]) weeklyMap[key] = { total: 0, startDate: key };
      weeklyMap[key].total += day.total;
    });
    var weeklyTrend = Object.keys(weeklyMap).sort().map(function(key) {
      return { weekStart: key, total: parseFloat(weeklyMap[key].total.toFixed(4)) };
    });

    // Monthly aggregation
    var monthlyMap = {};
    dailyTrend.forEach(function(day) {
      var key = day.date.slice(0, 7);
      if (!monthlyMap[key]) monthlyMap[key] = { total: 0, volume: 0 };
      monthlyMap[key].total += day.total;
      monthlyMap[key].volume += day.volume;
    });
    var monthlyTrend = Object.keys(monthlyMap).sort().map(function(key) {
      return { month: key, total: parseFloat(monthlyMap[key].total.toFixed(4)), volume: parseFloat(monthlyMap[key].volume.toFixed(2)) };
    });

    // Forecast
    var last4 = weeklyTrend.slice(-4);
    var weeklyAvg = last4.length > 0
      ? last4.reduce(function(s, w) { return s + w.total; }, 0) / last4.length
      : 0;
    var monthlyForecast = parseFloat((weeklyAvg * 4.33).toFixed(2));

    // PnL from audit
    var totalPnl = 0;
    try {
      var auditPath = path.join(WORKSPACE_PATH, 'crypto-audit-report.json');
      if (pathExists(auditPath)) {
        var auditData = JSON.parse(readFileSyncSafe(auditPath));
        if (auditData.agents) {
          Object.keys(auditData.agents).forEach(function(key) {
            var agent = auditData.agents[key];
            if (agent.alltime_pnl) totalPnl += agent.alltime_pnl;
          });
        }
      }
    } catch(e) {}

    var feeToPnlRatio = totalPnl !== 0 ? parseFloat((totalFees / Math.abs(totalPnl) * 100).toFixed(1)) : 0;
    var trend = dailyTrend.length >= 7 ? this._calculateTrend(dailyTrend) : 'insufficient_data';

    return {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalCommissions: parseFloat(totalFees.toFixed(4)),
        totalTrades: totalTrades,
        totalVolume: parseFloat(totalVolume.toFixed(2)),
        avgFeePerTrade: totalTrades > 0 ? parseFloat((totalFees / totalTrades).toFixed(4)) : 0,
        avgVolumePerTrade: totalTrades > 0 ? parseFloat((totalVolume / totalTrades).toFixed(2)) : 0,
        estimatedTotalPnl: parseFloat(totalPnl.toFixed(2)),
        feeToPnlRatio: feeToPnlRatio,
        monthlyForecast: monthlyForecast,
        dataQuality: 100
      },
      bots: bots.filter(function(b) { return b.tradeCount > 0; }),
      trends: {
        daily: dailyTrend.slice(-30),
        weekly: weeklyTrend,
        monthly: monthlyTrend
      },
      forecasts: {
        nextMonth: monthlyForecast,
        weeklyAvg: parseFloat(weeklyAvg.toFixed(4)),
        daysOfData: dailyTrend.length,
        trend: trend
      }
    };
  }

  _calculateTrend(dailyTrend) {
    var recent = dailyTrend.slice(-7);
    if (recent.length < 4) return 'insufficient_data';
    var mid = Math.floor(recent.length / 2);
    var first = recent.slice(0, mid);
    var second = recent.slice(mid);
    var avgFirst = first.reduce(function(s, d) { return s + d.total; }, 0) / first.length;
    var avgSecond = second.reduce(function(s, d) { return s + d.total; }, 0) / second.length;
    if (avgSecond > avgFirst * 1.15) return 'increasing';
    if (avgSecond < avgFirst * 0.85) return 'decreasing';
    return 'stable';
  }

  clearCache() {
    this.cache = { data: null, timestamp: 0 };
  }
}

// Export the class and static utils
CommissionAnalyzer.extractTradeVolume = extractTradeVolume;
CommissionAnalyzer.isTradeLine = isTradeLine;

module.exports = CommissionAnalyzer;
