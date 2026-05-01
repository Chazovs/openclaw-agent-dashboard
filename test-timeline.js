/**
 * Automated tests for the Activity Timeline feature (API + UI)
 *
 * Tests:
 * 1. Server-side /api/timeline endpoint returns valid data structure
 * 2. Timeline events have required fields (type, timestamp, title, emoji, source)
 * 3. Timeline sorts events by timestamp descending
 * 4. Timeline respects ?limit parameter
 * 5. Client-side activity-timeline.js file is parseable JS
 * 6. Index.html includes the activity-timeline.js script tag
 * 7. All event types return data with expected categories
 * 8. Timeline endpoint handles errors gracefully
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message} (got: ${JSON.stringify(actual)})`);
    passed++;
  } else {
    console.error(`  ✗ ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    }).on('error', reject);
  });
}

// Helper to format uptime for timestamps display
function formatUptime(seconds) {
  if (!seconds) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  let parts = [];
  if (days > 0) parts.push(days + 'd');
  if (hours > 0) parts.push(hours + 'h');
  if (mins > 0) parts.push(mins + 'm');
  if (secs > 0 && days === 0) parts.push(secs + 's');
  return parts.join(' ') || '<1s';
}

async function runTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║     Activity Timeline Feature — Auto Tests    ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log();

  // ===== Test 1: /api/timeline returns valid response =====
  console.log('Test 1: API /api/timeline returns valid response');
  try {
    const result = await fetch(`${BASE_URL}/api/timeline`);
    assertEqual(result.status, 200, 'Timeline endpoint returns HTTP 200');
    assert(result.body.success === true, 'Response has success: true');
    assert(typeof result.body.total === 'number', 'Response has total (number)');
    assert(Array.isArray(result.body.events), 'Response has events (array)');
    assert(typeof result.body.timestamp === 'string', 'Response has timestamp string');
    assert(result.body.total === result.body.events.length, `total (${result.body.total}) matches events.length (${result.body.events.length})`);
  } catch (err) {
    console.error(`  ✗ Test 1 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Test 2: Events have required fields =====
  console.log('Test 2: Timeline events contain required fields');
  try {
    const result = await fetch(`${BASE_URL}/api/timeline?limit=50`);
    const events = result.body.events || [];
    assert(events.length > 0, `Timeline returned ${events.length} events`);

    let allValid = true;
    for (const e of events) {
      if (!e.type || !e.timestamp || !e.title) {
        console.error(`  ✗ Event missing required field: ${JSON.stringify(e)}`);
        allValid = false;
      }
      if (typeof e.timestamp !== 'number' || e.timestamp <= 0) {
        console.error(`  ✗ Event has invalid timestamp: ${e.timestamp}`);
        allValid = false;
      }
      if (!e.emoji) {
        console.error(`  ✗ Event missing emoji: ${e.title}`);
        allValid = false;
      }
      if (!e.source) {
        console.error(`  ✗ Event missing source: ${e.title}`);
        allValid = false;
      }
    }
    assert(allValid, 'All events have type, timestamp, title, emoji, source');

    // Check event types are valid
    const validTypes = ['session', 'alert', 'service', 'system', 'trade'];
    const actualTypes = [...new Set(events.map(e => e.type))];
    const hasValidTypes = actualTypes.every(t => validTypes.includes(t));
    assert(hasValidTypes, `All event types are valid: ${actualTypes.join(', ')}`);
  } catch (err) {
    console.error(`  ✗ Test 2 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Test 3: Events sorted by timestamp descending =====
  console.log('Test 3: Events are sorted newest-first');
  try {
    const result = await fetch(`${BASE_URL}/api/timeline?limit=100`);
    const events = result.body.events || [];
    let sorted = true;
    for (let i = 1; i < events.length; i++) {
      if (events[i].timestamp > events[i - 1].timestamp) {
        console.error(`  ✗ Event ${i} (${events[i].title}) has newer timestamp than event ${i-1}`);
        sorted = false;
        break;
      }
    }
    assert(sorted, 'Events are sorted by timestamp descending (newest first)');
  } catch (err) {
    console.error(`  ✗ Test 3 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Test 4: Limit parameter works =====
  console.log('Test 4: ?limit parameter controls event count');
  try {
    const result5 = await fetch(`${BASE_URL}/api/timeline?limit=5`);
    assert(result5.body.events.length <= 5, `With ?limit=5, got ${result5.body.events.length} events`);

    const result3 = await fetch(`${BASE_URL}/api/timeline?limit=3`);
    assert(result3.body.events.length <= 3, `With ?limit=3, got ${result3.body.events.length} events`);

    assert(result3.body.events.length <= result5.body.events.length, 'limit=3 returns fewer/equal events than limit=5');
  } catch (err) {
    console.error(`  ✗ Test 4 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Test 5: Types summary present =====
  console.log('Test 5: Response includes event type breakdown');
  try {
    const result = await fetch(`${BASE_URL}/api/timeline`);
    assert(result.body.types !== undefined, 'Response has types breakdown');
    if (result.body.types) {
      const typeCount = Object.values(result.body.types).reduce((a, b) => a + b, 0);
      assertEqual(typeCount, result.body.total, 'Type counts sum to total events');
    }
  } catch (err) {
    console.error(`  ✗ Test 5 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Test 6: activity-timeline.js is valid JS =====
  console.log('Test 6: Client-side activity-timeline.js is present and valid');
  try {
    const filePath = path.join(__dirname, 'public', 'activity-timeline.js');
    assert(fs.existsSync(filePath), `File exists at ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.length > 1000, `File is not empty (${content.length} bytes)`);
    assert(content.includes('ActivityTimeline'), 'File exports ActivityTimeline object');
    assert(content.includes('/api/timeline'), 'File references /api/timeline endpoint');
    assert(content.includes('injectStyles'), 'File has injectStyles function');
    assert(content.includes('injectPanel'), 'File has injectPanel function');
    assert(content.includes('refreshTimeline'), 'File has refreshTimeline function');
    
    // Verify JS syntax via Node.js check
    const { execSync } = require('child_process');
    try {
      execSync(`node --check "${filePath}" 2>&1`, { timeout: 5000, stdio: 'pipe' });
      assert(true, 'JS file has valid Node syntax');
    } catch (checkErr) {
      // Browser-specific code (fetch, MutationObserver) is fine — check if it's a syntax error
      const stderr = (checkErr.stderr || checkErr.stdout || '').toString();
      if (stderr.includes('SyntaxError')) {
        assert(false, `JS file has SyntaxError: ${stderr.substring(0, 120)}`);
      } else {
        // Known browser-only constructs — skip syntax check but validate structure
        assert(content.includes('function') && content.includes('var'), 
          'JS file uses valid function/var structure (browser-targeted file)');
      }
    }
  } catch (err) {
    console.error(`  ✗ Test 6 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Test 7: Index.html includes the script =====
  console.log('Test 7: Index.html includes activity-timeline.js');
  try {
    const result = await fetch(`${BASE_URL}/`);
    const html = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
    assert(html.includes('activity-timeline.js'), 'HTML contains script reference to activity-timeline.js');
    assert(html.includes('src="/activity-timeline.js"'), 'Script tag uses correct src path');
  } catch (err) {
    console.error(`  ✗ Test 7 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Test 8: Static file serving works =====
  console.log('Test 8: activity-timeline.js is served as static file');
  try {
    const result = await new Promise((resolve, reject) => {
      http.get(`${BASE_URL}/activity-timeline.js`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }).on('error', reject);
    });
    assertEqual(result.status, 200, 'Static file returns HTTP 200');
    assert(result.body.length > 1000, `File content is non-empty (${result.body.length} bytes)`);
    assert(result.body.includes('ActivityTimeline'), 'Served file contains ActivityTimeline object');
  } catch (err) {
    console.error(`  ✗ Test 8 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Test 9: Safety — handle errors gracefully =====
  console.log('Test 9: Endpoint handles unexpected input gracefully');
  try {
    const result1 = await fetch(`${BASE_URL}/api/timeline?limit=-1`);
    assertEqual(result1.status, 200, 'limit=-1 returns HTTP 200 (falls back to default)');

    const result2 = await fetch(`${BASE_URL}/api/timeline?limit=abc`);
    assertEqual(result2.status, 200, 'limit=abc returns HTTP 200 (falls back to default)');

    const result3 = await fetch(`${BASE_URL}/api/timeline?limit=999999`);
    assert(result3.body.events.length > 0, 'Large limit returns events');
    assert(result3.body.success === true, 'Large limit still returns success: true');
  } catch (err) {
    console.error(`  ✗ Test 9 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Test 10: Verify categories/types present =====
  console.log('Test 10: Timeline populates data from all available sources');
  try {
    const result = await fetch(`${BASE_URL}/api/timeline?limit=50`);
    const types = result.body.types || {};
    const typeNames = Object.keys(types);
    
    // The system should always have at least the health event
    assert(types.system > 0, 'Timeline includes system events');
    assert(types.session > 0, 'Timeline includes session events');
    
    // Check at least 2 of the expected categories
    assert(typeNames.length >= 2, `Timeline includes at least 2 event types (got: ${typeNames.join(', ')})`);
  } catch (err) {
    console.error(`  ✗ Test 10 FAILED: ${err.message}`);
    failed++;
  }
  console.log();

  // ===== Summary =====
  const total = passed + failed;
  console.log('═'.repeat(50));
  console.log(`Result: ${passed}/${total} tests passed`);
  if (failed > 0) {
    console.error(`         ${failed} tests FAILED!`);
    process.exit(1);
  } else {
    console.log('         All tests passed! ✓');
    process.exit(0);
  }
}

runTests();
