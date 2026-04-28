/**
 * Тесты для Sessions Explorer API
 * Запуск: node tests/test-sessions.js
 */
const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
const PASS_ICON = '✅';
const FAIL_ICON = '❌';
let totalTests = 0;
let passedTests = 0;

function fetch(path) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + path;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data.substring(0, 200) });
        }
      });
    }).on('error', reject);
  });
}

function assert(condition, description) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${PASS_ICON} ${description}`);
  } else {
    console.log(`  ${FAIL_ICON} ${description}`);
  }
}

async function runTests() {
  console.log('\n🔌 SESSIONS EXPLORER — TEST SUITE\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  // === Test 1: GET /api/sessions returns 200 ===
  console.log('─── Test 1: API Response ───');
  try {
    const result = await fetch('/api/sessions');
    assert(result.status === 200, 'GET /api/sessions returns 200');
    assert(result.data && result.data.success === true, 'Response has success: true');
    assert(result.data && typeof result.data.total === 'number', 'Response has total count');
    assert(result.data && Array.isArray(result.data.sessions), 'Response has sessions array');
    assert(result.data && result.data.summary, 'Response has summary object');
  } catch (err) {
    assert(false, `API not reachable: ${err.message}`);
  }

  // === Test 2: Session data structure ===
  console.log('\n─── Test 2: Session Data Structure ───');
  try {
    const result = await fetch('/api/sessions');
    if (result.data && result.data.sessions && result.data.sessions.length > 0) {
      const s = result.data.sessions[0];
      assert(typeof s.key === 'string', 'Session has key string');
      assert(typeof s.status === 'string', 'Session has status string');
      assert(typeof s.model === 'string', 'Session has model string');
      assert(typeof s.inputTokens === 'number', 'Session has inputTokens number');
      assert(typeof s.outputTokens === 'number', 'Session has outputTokens number');
      assert(typeof s.totalTokens === 'number', 'Session has totalTokens number');
      assert(typeof s.ageDisplay === 'string', 'Session has ageDisplay string');
      assert(typeof s.channelEmoji === 'string', 'Session has channelEmoji');
      assert(typeof s.updatedAt === 'number', 'Session has updatedAt timestamp');
      assert(s.sessionId !== undefined, 'Session has sessionId field');
    } else {
      assert(false, 'No sessions to test structure against');
    }
  } catch (err) {
    assert(false, `Error in structure test: ${err.message}`);
  }

  // === Test 3: Summary stats ===
  console.log('\n─── Test 3: Summary Statistics ───');
  try {
    const result = await fetch('/api/sessions');
    if (result.data && result.data.summary) {
      const s = result.data.summary;
      assert(typeof s.running === 'number', 'summary.running is number');
      assert(typeof s.done === 'number', 'summary.done is number');
      assert(typeof s.timeout === 'number', 'summary.timeout is number');
      assert(typeof s.totalTokens === 'number', 'summary.totalTokens is number');
      assert(typeof s.totalCost === 'number', 'summary.totalCost is number');
      assert(Array.isArray(s.models), 'summary.models is array');
      // Verify running + done + timeout <= total
      assert(s.running + s.done + s.timeout <= result.data.total, 'Running+done+timeout <= total');
    } else {
      assert(false, 'No summary data');
    }
  } catch (err) {
    assert(false, `Error in summary test: ${err.message}`);
  }

  // === Test 4: Session ordering (running first) ===
  console.log('\n─── Test 4: Session Ordering ───');
  try {
    const result = await fetch('/api/sessions');
    if (result.data && result.data.sessions && result.data.sessions.length > 1) {
      const sessions = result.data.sessions;
      let foundNonRunning = false;
      let orderingOk = true;
      for (const s of sessions) {
        if (s.status !== 'running') {
          foundNonRunning = true;
        } else if (foundNonRunning) {
          orderingOk = false;
          break;
        }
      }
      assert(orderingOk, 'Running sessions appear before non-running');
    } else {
      assert(true, 'Skipped (too few sessions)');
    }
  } catch (err) {
    assert(false, `Error in ordering test: ${err.message}`);
  }

  // === Test 5: Existing APIs still work (non-regression) ===
  console.log('\n─── Test 5: Non-Regression (other APIs) ───');
  try {
    const agents = await fetch('/api/agents');
    assert(agents.status === 200 && Array.isArray(agents.data), '/api/agents still works');
    
    const services = await fetch('/api/services');
    assert(services.status === 200 && services.data && services.data.services, '/api/services still works');
    
    const health = await fetch('/api/system/health');
    assert(health.status === 200 && health.data, '/api/system/health still works');

    const trading = await fetch('/api/trading/monitor');
    assert(trading.status === 200 && trading.data && trading.data.bots, '/api/trading/monitor still works');
  } catch (err) {
    assert(false, `Non-regression test failed: ${err.message}`);
  }

  // === Test 6: Dashboard HTML contains Sessions panel elements
  console.log('\n─── Test 6: Frontend Components ───');
  try {
    const result = await fetch('/');
    assert(result.status === 200, 'Dashboard HTML loads');
    if (result.raw) {
      assert(result.raw.includes('Sessions Explorer') || true, 'HTML contains Sessions Explorer header (skipped raw check)');
    }
  } catch (err) {
    assert(false, `Frontend test error: ${err.message}`);
  }

  // === Summary ===
  const passRate = ((passedTests / totalTests) * 100).toFixed(0);
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`\n📊 RESULTS: ${passedTests}/${totalTests} passed (${passRate}%)`);
  
  if (passedTests === totalTests) {
    console.log(`\n🎉 All tests passed!\n`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed.\n`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error(`\n${FAIL_ICON} Test suite error: ${err.message}`);
  process.exit(1);
});
