/**
 * Automated tests for AlertManager module
 * Run: node test-alert-manager.js
 */

const AlertManager = require('./alert-manager');
const assert = {
  equal: (a, b, msg) => { if (a !== b) throw new Error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); else process.stdout.write(`.`); },
  ok: (v, msg) => { if (!v) throw new Error(`FAIL: ${msg}`); else process.stdout.write(`.`); },
  deepEqual: (a, b, msg) => { const sa = JSON.stringify(a); const sb = JSON.stringify(b); if (sa !== sb) throw new Error(`FAIL: ${msg} — expected ${sb}, got ${sa}`); else process.stdout.write(`.`); }
};

const SEVERITY = AlertManager.SEVERITY;

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    testsPassed++;
    console.log(` ✓ ${name}`);
  } catch (err) {
    testsFailed++;
    console.log(` ✗ ${name}: ${err.message}`);
  }
}

// === Setup ===
const am = new AlertManager();
am.clearAll();

// === Test 1: Initial state ===
test('Initial state is empty', () => {
  const summary = am.getSummary();
  assert.ok(summary.total === 0, 'total should be 0');
  assert.ok(summary.unacknowledged === 0, 'unacknowledged should be 0');
  assert.deepEqual(summary.bySeverity, { critical: 0, error: 0, warning: 0, info: 0 }, 'severity breakdown empty');
});

// === Test 2: Add basic alert ===
test('Add a critical alert', () => {
  const alert = am.addAlert(SEVERITY.CRITICAL, 'test', 'Test critical alert');
  assert.ok(alert.id, 'alert should have an id');
  assert.equal(alert.severity, 0, 'severity should be CRITICAL (0)');
  assert.equal(alert.source, 'test', 'source should be set');
  assert.equal(alert.message, 'Test critical alert', 'message should be set');
  assert.equal(alert.count, 1, 'count should start at 1');
  assert.ok(!alert.acknowledged, 'alert should not be acknowledged yet');
});

// === Test 3: Deduplication ===
test('Deduplicate same alert within 5 minutes', () => {
  const alert2 = am.addAlert(SEVERITY.CRITICAL, 'test', 'Test critical alert');
  assert.equal(alert2.count, 2, 'count should increment to 2');
  assert.equal(am.alerts.length, 1, 'should still be 1 alert in list');
});

// === Test 4: Different source/message creates new alert ===
test('Different source creates separate alert', () => {
  const alert3 = am.addAlert(SEVERITY.ERROR, 'cpu', 'High CPU usage');
  assert.equal(am.alerts.length, 2, 'should now have 2 alerts');
  assert.equal(alert3.count, 1, 'new alert count starts at 1');
});

// === Test 5: Severity levels ===
test('Severity levels are correct', () => {
  assert.equal(SEVERITY.CRITICAL, 0, 'CRITICAL = 0');
  assert.equal(SEVERITY.ERROR, 1, 'ERROR = 1');
  assert.equal(SEVERITY.WARNING, 2, 'WARNING = 2');
  assert.equal(SEVERITY.INFO, 3, 'INFO = 3');
});

// === Test 6: Add alerts with all severities ===
test('Add alerts at all severity levels', () => {
  am.addAlert(SEVERITY.CRITICAL, 'test', 'Critical');
  am.addAlert(SEVERITY.ERROR, 'test', 'Error');
  am.addAlert(SEVERITY.WARNING, 'test', 'Warning');
  am.addAlert(SEVERITY.INFO, 'test', 'Info');
  // Currently 2 (before this) + 4 = 6, but the dedup creates new ones since messages differ
  assert.equal(am.alerts.length, 6, 'should have 6 unique alerts');
});

// === Test 7: Filter by severity ===
test('Filter by minimum severity', () => {
  const criticals = am.getAlerts({ minSeverity: 0, maxSeverity: 0 });
  // At least 2 criticals (from test 2 + test 6)
  assert.ok(criticals.length >= 2, 'should find at least 2 critical alerts');
  criticals.forEach(a => assert.equal(a.severity, 0, 'all should be CRITICAL'));
});

// === Test 8: Filter by source ===
test('Filter by source', () => {
  const cpuAlerts = am.getAlerts({ source: 'cpu' });
  assert.equal(cpuAlerts.length, 1, 'should find exactly 1 CPU alert');
});

// === Test 9: Acknowledge alerts ===
test('Acknowledge a single alert', () => {
  const all = am.getAlerts();
  const lastId = all[all.length - 1].id;
  am.acknowledgeAlert(lastId);
  const ackd = am.getAlerts({ acknowledged: true });
  assert.ok(ackd.length >= 1, 'should have at least 1 acknowledged alert');
  assert.ok(ackd.find(a => a.id === lastId), 'the specific alert should be acknowledged');
});

// === Test 10: Acknowledge all ===
test('Acknowledge all alerts', () => {
  const count = am.acknowledgeAll();
  assert.ok(count > 0, 'should acknowledge some alerts');
  const unackd = am.getAlerts({ acknowledged: false });
  assert.equal(unackd.length, 0, 'no unacknowledged alerts should remain');
  const all = am.alerts;
  all.forEach(a => assert.ok(a.acknowledged, 'all alerts should be acknowledged'));
});

// === Test 11: Generate system alerts (healthy system) ===
test('No alerts for healthy system', () => {
  const health = {
    health: { score: 85, status: 'healthy' },
    cpu: { loadPercent: 40, cores: 8 },
    memory: { usagePercent: 50, used: 8e9, total: 16e9 },
    disk: { usagePercent: 60 }
  };
  const alerts = am.generateSystemAlerts(health, null, null);
  assert.equal(alerts.length, 0, 'healthy system should generate 0 alerts');
});

// === Test 12: Generate system alerts (high CPU) ===
test('Warning alert for high CPU', () => {
  const health = {
    cpu: { loadPercent: 85, cores: 8 },
    memory: { usagePercent: 50 },
    disk: { usagePercent: 40 }
  };
  const alerts = am.generateSystemAlerts(health, null, null);
  assert.ok(alerts.length > 0, 'should generate alerts');
  const cpuAlert = alerts.find(a => a.source === 'cpu');
  assert.ok(cpuAlert, 'should have a CPU alert');
  assert.equal(cpuAlert.severity, SEVERITY.WARNING, 'high CPU should be WARNING');
});

// === Test 13: Generate system alerts (low health score) ===
test('Critical alert for very low health score', () => {
  const health = {
    health: { score: 30, status: 'critical' },
    cpu: { loadPercent: 30, cores: 8 },
    memory: { usagePercent: 80 },
    disk: { usagePercent: 50 }
  };
  const alerts = am.generateSystemAlerts(health, null, null);
  const healthAlert = alerts.find(a => a.source === 'system' && a.message.includes('критическое'));
  assert.ok(healthAlert, 'should have critical health alert');
  assert.equal(healthAlert.severity, SEVERITY.CRITICAL, 'critical health should be CRITICAL');
});

// === Test 14: Generate system alerts (full disk) ===
test('Error alert for full disk', () => {
  const health = {
    cpu: { loadPercent: 30 },
    memory: { usagePercent: 50 },
    disk: { usagePercent: 95 }
  };
  const alerts = am.generateSystemAlerts(health, null, null);
  const diskAlert = alerts.find(a => a.source === 'disk');
  assert.ok(diskAlert, 'should have disk alert');
  assert.equal(diskAlert.severity, SEVERITY.ERROR, 'full disk should be ERROR');
});

// === Test 15: Get summary by source ===
test('Summary by source is correct', () => {
  const summary = am.getSummary();
  assert.ok(summary.bySource.cpu, 'should have cpu in bySource');
  assert.ok(summary.bySource.test, 'should have test in bySource');
  assert.ok(summary.total > 0, 'total should be > 0');
});

// === Test 16: Prune old alerts ===
test('Prune keeps only N newest', () => {
  // Add more alerts to make count > 10
  for (let i = 0; i < 15; i++) {
    am.addAlert(SEVERITY.INFO, 'prune-test', `Alert ${i}`, { index: i });
  }
  assert.ok(am.alerts.length >= 15, 'should have at least 15 alerts');
  const removed = am.prune(10);
  assert.ok(removed > 0, 'should have removed some alerts');
  assert.equal(am.alerts.length, 10, 'should now have exactly 10 alerts');
});

// === Test 17: Clear all ===
test('Clear all alerts', () => {
  am.clearAll();
  assert.equal(am.alerts.length, 0, 'no alerts after clear');
  const summary = am.getSummary();
  assert.equal(summary.total, 0, 'summary total should be 0');
});

// === Test 18: Add alerts in batch ===
test('Add alerts in batch', () => {
  const batch = [
    { severity: SEVERITY.CRITICAL, source: 'batch', message: 'Batch critical' },
    { severity: SEVERITY.ERROR, source: 'batch', message: 'Batch error' },
    { severity: SEVERITY.WARNING, source: 'batch', message: 'Batch warning' },
    { severity: SEVERITY.INFO, source: 'batch', message: 'Batch info' }
  ];
  const results = am.addAlerts(batch);
  assert.equal(results.length, 4, 'should return 4 results');
  assert.equal(am.alerts.length, 4, 'should have 4 alerts');
});

// === Print results ===
console.log('\n========================================');
console.log(`Tests: ${testsPassed} passed, ${testsFailed} failed out of ${testsPassed + testsFailed}`);
console.log('========================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  // Cleanup
  am.clearAll();
  console.log('✓ All tests passed!');
}
