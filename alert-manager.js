/**
 * Alert Manager — unified alert aggregation system for OpenClaw Dashboard
 * 
 * Collects alerts from multiple sources:
 *   - Service failures (systemd inactive)
 *   - Trading bot errors
 *   - System health warnings (CPU, RAM, disk)
 *   - Session timeouts
 *   - Agent status changes
 * 
 * Alerts are deduplicated, severity-ranked, and stored with timestamps.
 */

const fs = require('fs');
const path = require('path');

const ALERTS_FILE = path.join(__dirname, 'data', 'alerts.json');

// Severity levels (0 = most severe)
const SEVERITY = {
  CRITICAL: 0,
  ERROR: 1,
  WARNING: 2,
  INFO: 3
};

const SEVERITY_LABELS = {
  0: 'CRITICAL',
  1: 'ERROR',
  2: 'WARNING',
  3: 'INFO'
};

const SEVERITY_EMOJI = {
  0: '🔴',
  1: '❌',
  2: '⚠️',
  3: '💡'
};

const SEVERITY_COLORS = {
  0: '#f05454',
  1: '#ff4757',
  2: '#ffa502',
  3: '#4cc9f0'
};

class AlertManager {
  constructor(maxAlerts = 500) {
    this.maxAlerts = maxAlerts;
    this.alerts = [];
    this.loadAlerts();
    console.log(`AlertManager initialized: ${this.alerts.length} stored alerts`);
  }

  // Load alerts from disk
  loadAlerts() {
    try {
      if (fs.existsSync(ALERTS_FILE)) {
        const content = fs.readFileSync(ALERTS_FILE, 'utf8');
        this.alerts = JSON.parse(content);
        // Prune if too many
        if (this.alerts.length > this.maxAlerts) {
          this.alerts = this.alerts.slice(-this.maxAlerts);
        }
      }
    } catch (err) {
      console.error('Error loading alerts:', err.message);
      this.alerts = [];
    }
  }

  // Save alerts to disk
  saveAlerts() {
    try {
      const dir = path.dirname(ALERTS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(ALERTS_FILE, JSON.stringify(this.alerts, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving alerts:', err.message);
    }
  }

  // Add a single alert (deduplicates by source+message within 5 minutes)
  addAlert(severity, source, message, details = {}) {
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;

    // Deduplicate: same source + message within last 5 min → update existing
    const existing = this.alerts.find(
      a => a.source === source && a.message === message && a.timestamp > fiveMinAgo
    );

    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.lastSeen = now;
      existing.details = details;
      return existing;
    }

    const alert = {
      id: `alert_${now}_${Math.random().toString(36).substring(2, 8)}`,
      severity,
      severityLabel: SEVERITY_LABELS[severity] || 'UNKNOWN',
      emoji: SEVERITY_EMOJI[severity] || '❓',
      color: SEVERITY_COLORS[severity] || '#a9a9a9',
      source,
      message,
      details,
      timestamp: now,
      lastSeen: now,
      count: 1,
      acknowledged: false,
      acknowledgedAt: null
    };

    this.alerts.push(alert);

    // Prune old alerts
    if (this.alerts.length > this.maxAlerts) {
      const keepFrom = this.alerts.length - this.maxAlerts;
      this.alerts.splice(0, keepFrom);
    }

    // Auto-save every 5 alerts
    if (this.alerts.length % 5 === 0) {
      this.saveAlerts();
    }

    return alert;
  }

  // Add multiple alerts at once (batched)
  addAlerts(alerts) {
    const results = [];
    for (const a of alerts) {
      results.push(this.addAlert(a.severity, a.source, a.message, a.details));
    }
    return results;
  }

  // Acknowledge an alert by ID
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      this.saveAlerts();
      return true;
    }
    return false;
  }

  // Acknowledge all alerts
  acknowledgeAll(source) {
    let count = 0;
    for (const alert of this.alerts) {
      if (source && alert.source !== source) continue;
      if (!alert.acknowledged) {
        alert.acknowledged = true;
        alert.acknowledgedAt = Date.now();
        count++;
      }
    }
    if (count > 0) this.saveAlerts();
    return count;
  }

  // Get alerts with filtering
  getAlerts(options = {}) {
    let filtered = [...this.alerts];

    // Filter by severity
    if (options.minSeverity !== undefined) {
      filtered = filtered.filter(a => a.severity <= options.minSeverity);
    }
    if (options.maxSeverity !== undefined) {
      filtered = filtered.filter(a => a.severity >= options.maxSeverity);
    }

    // Filter by source
    if (options.source) {
      filtered = filtered.filter(a => a.source === options.source);
    }

    // Filter by acknowledged state
    if (options.acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === options.acknowledged);
    }

    // Filter by time range
    if (options.since) {
      filtered = filtered.filter(a => a.timestamp >= options.since);
    }
    if (options.until) {
      filtered = filtered.filter(a => a.timestamp <= options.until);
    }

    // Sort by severity then timestamp (newest first)
    filtered.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity - b.severity;
      return b.timestamp - a.timestamp;
    });

    // Limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  // Get summary statistics
  getSummary() {
    const unacknowledged = this.alerts.filter(a => !a.acknowledged);
    return {
      total: this.alerts.length,
      unacknowledged: unacknowledged.length,
      bySeverity: {
        critical: this.alerts.filter(a => a.severity === 0).length,
        error: this.alerts.filter(a => a.severity === 1).length,
        warning: this.alerts.filter(a => a.severity === 2).length,
        info: this.alerts.filter(a => a.severity === 3).length
      },
      unacknowledgedBySeverity: {
        critical: unacknowledged.filter(a => a.severity === 0).length,
        error: unacknowledged.filter(a => a.severity === 1).length,
        warning: unacknowledged.filter(a => a.severity === 2).length,
        info: unacknowledged.filter(a => a.severity === 3).length
      },
      bySource: this.getCountBySource(),
      lastAlert: this.alerts.length > 0 ? this.alerts[this.alerts.length - 1] : null
    };
  }

  // Count alerts by source
  getCountBySource() {
    const counts = {};
    for (const a of this.alerts) {
      if (!counts[a.source]) counts[a.source] = { total: 0, unacknowledged: 0, critical: 0 };
      counts[a.source].total++;
      if (!a.acknowledged) counts[a.source].unacknowledged++;
      if (a.severity === 0) counts[a.source].critical++;
    }
    return counts;
  }

  // Delete old alerts (keep N newest)
  prune(maxToKeep = 300) {
    if (this.alerts.length <= maxToKeep) return 0;
    const removed = this.alerts.length - maxToKeep;
    this.alerts = this.alerts.slice(-maxToKeep);
    this.saveAlerts();
    return removed;
  }

  // Clear all alerts
  clearAll() {
    this.alerts = [];
    this.saveAlerts();
    return true;
  }

  // Generate alerts from current system state (service failures, health issues)
  generateSystemAlerts(healthData, servicesData, sessionsData) {
    const newAlerts = [];
    const now = Date.now();

    // System health alerts
    if (healthData) {
      if (healthData.health && healthData.health.score < 40) {
        newAlerts.push({
          severity: SEVERITY.CRITICAL,
          source: 'system',
          message: `Здоровье системы критическое: ${healthData.health.score}/100`,
          details: { healthScore: healthData.health.score, cpuLoad: healthData.cpu?.loadPercent, memUsage: healthData.memory?.usagePercent }
        });
      } else if (healthData.health && healthData.health.score < 60) {
        newAlerts.push({
          severity: SEVERITY.WARNING,
          source: 'system',
          message: `Здоровье системы ухудшилось: ${healthData.health.score}/100`,
          details: { healthScore: healthData.health.score }
        });
      }

      // High CPU
      if (healthData.cpu && healthData.cpu.loadPercent > 80) {
        newAlerts.push({
          severity: SEVERITY.WARNING,
          source: 'cpu',
          message: `Высокая загрузка CPU: ${healthData.cpu.loadPercent}%`,
          details: { loadPercent: healthData.cpu.loadPercent, cores: healthData.cpu.cores }
        });
      }

      // High memory
      if (healthData.memory && healthData.memory.usagePercent > 85) {
        newAlerts.push({
          severity: SEVERITY.WARNING,
          source: 'memory',
          message: `Высокое использование памяти: ${healthData.memory.usagePercent}%`,
          details: { usagePercent: healthData.memory.usagePercent, used: healthData.memory.used, total: healthData.memory.total }
        });
      }

      // High disk
      if (healthData.disk && healthData.disk.usagePercent > 90) {
        newAlerts.push({
          severity: SEVERITY.ERROR,
          source: 'disk',
          message: `Диск почти заполнен: ${healthData.disk.usagePercent}%`,
          details: { usagePercent: healthData.disk.usagePercent }
        });
      }
    }

    // Service failures
    if (servicesData && servicesData.services) {
      for (const svc of servicesData.services) {
        if (svc.systemd && !svc.systemd.active && svc.systemd.status !== 'unknown') {
          newAlerts.push({
            severity: SEVERITY.ERROR,
            source: 'service',
            message: `Служба неактивна: ${svc.name}`,
            details: { service: svc.name, status: svc.systemd.status, description: svc.description }
          });
        }
      }
    }

    // Session timeouts
    if (sessionsData && sessionsData.sessions) {
      const timeouts = sessionsData.sessions.filter(s => s.status === 'timeout');
      for (const s of timeouts) {
        newAlerts.push({
          severity: SEVERITY.WARNING,
          source: 'session',
          message: `Сессия завершилась timeout: ${s.type} (${s.model})`,
          details: { sessionKey: s.key, model: s.model, totalTokens: s.totalTokens }
        });
      }
    }

    return newAlerts;
  }
}

module.exports = AlertManager;
module.exports.SEVERITY = SEVERITY;
