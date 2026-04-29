/**
 * Tests for Trading Overview Module
 * Run with: node tests/trading-overview.test.js
 */

const assert = require('assert');
const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_PATH = '/api/trading/overview';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}, body: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    console.log(`\n  ${name}`);
    try {
      fn();
      console.log('    ✓ PASS');
      passed++;
    } catch (e) {
      console.log(`    ✗ FAIL: ${e.message}`);
      failed++;
    }
  }

  function assertType(val, type) {
    assert.strictEqual(typeof val, type, `Expected type ${type}, got ${typeof val}`);
  }

  console.log('🧪 Trading Overview Module Tests');
  console.log(`   Target: ${BASE_URL}${API_PATH}\n`);

  // ========== API Response Structure ==========
  console.log('📋 API Response Structure');

  let data;
  try {
    const response = await fetchJson(`${BASE_URL}${API_PATH}`);
    assert.strictEqual(response.status, 200, `Expected 200, got ${response.status}`);
    data = response.body;
    console.log('  ✓ HTTP 200 OK');
  } catch (e) {
    console.log(`  ✗ HTTP request failed: ${e.message}`);
    console.log('\n❌ Cannot proceed without API connection');
    process.exit(1);
    return;
  }

  test('success field is true', () => {
    assert.strictEqual(data.success, true);
  });

  test('has timestamp', () => {
    assertType(data.timestamp, 'string');
    assert.ok(data.timestamp.length > 0);
  });

  test('has summary object', () => {
    assertType(data.summary, 'object');
    assert.ok(data.summary !== null);
  });

  test('summary has required fields', () => {
    const required = ['totalBots', 'activeBots', 'totalPortfolioUSDT', 'totalTrades', 'activePositions'];
    required.forEach(field => {
      assert.ok(field in data.summary, `Missing summary field: ${field}`);
    });
  });

  test('totalBots is >= 0', () => {
    assert.ok(data.summary.totalBots >= 0);
  });

  test('totalPortfolioUSDT is numeric', () => {
    assertType(data.summary.totalPortfolioUSDT, 'number');
  });

  test('has bots array', () => {
    assert.ok(Array.isArray(data.bots));
  });

  test('has positions array', () => {
    assert.ok(Array.isArray(data.positions));
  });

  test('has recommendations array', () => {
    assert.ok(Array.isArray(data.recommendations));
  });

  // ========== Bot Data Structure ==========
  console.log('\n📋 Bot Data Structure');

  if (data.bots.length > 0) {
    const bot = data.bots[0];

    test('bot has id', () => {
      assertType(bot.id, 'string');
    });

    test('bot has name', () => {
      assertType(bot.name, 'string');
    });

    test('bot has isActive', () => {
      assertType(bot.isActive, 'boolean');
    });

    test('bot has serviceStatus', () => {
      assertType(bot.serviceStatus, 'string');
    });

    test('bot has balances object', () => {
      assertType(bot.balances, 'object');
      assert.ok('usdt' in bot.balances);
      assert.ok('total' in bot.balances);
    });

    test('bot has totalBuys and totalSells', () => {
      assert.ok('totalBuys' in bot);
      assert.ok('totalSells' in bot);
      assertType(bot.totalBuys, 'number');
      assertType(bot.totalSells, 'number');
    });

    test('bot id is one of expected values', () => {
      const validIds = ['bybit_mean_reversion', 'bybit_aggressive', 'memecoin', 'tinkoff'];
      assert.ok(validIds.includes(bot.id), `Unexpected bot id: ${bot.id}`);
    });

    test('bot name is non-empty', () => {
      assert.ok(bot.name.length > 0);
    });
  } else {
    console.log('  ⚠ No bots to test (may be intentional)');
  }

  // ========== Positions Data ==========
  console.log('\n📋 Positions Data Structure');

  if (data.positions.length > 0) {
    const pos = data.positions[0];

    test('position has symbol', () => {
      assertType(pos.symbol, 'string');
      assert.ok(pos.symbol.length > 0);
    });

    test('position has price', () => {
      assertType(pos.price, 'number');
      assert.ok(pos.price > 0);
    });

    test('position has qty', () => {
      assertType(pos.qty, 'number');
      assert.ok(pos.qty > 0);
    });

    test('position has valueUSDT', () => {
      assertType(pos.valueUSDT, 'number');
    });

    test('position value matches price * qty', () => {
      const expected = Math.round(pos.price * pos.qty * 100) / 100;
      const actual = Math.round(pos.valueUSDT * 100) / 100;
      assert.strictEqual(actual, expected, `Expected ${expected}, got ${actual}`);
    });
  }

  // ========== Recommendations ==========
  console.log('\n📋 Recommendations');

  if (data.recommendations.length > 0) {
    test('recommendations are strings', () => {
      data.recommendations.forEach(rec => {
        assertType(rec, 'string');
        assert.ok(rec.length > 0);
      });
    });
  }

  // ========== Auditor Summary ==========
  console.log('\n📋 Auditor Summary');

  if (data.auditorSummary) {
    const au = data.auditorSummary;

    test('auditor has verdict', () => {
      assertType(au.verdict, 'string');
    });

    test('auditor has run number', () => {
      assertType(au.run, 'number');
    });

    test('auditor has warnings count', () => {
      assertType(au.warnings, 'number');
      assert.ok(au.warnings >= 0);
    });
  }

  // ========== Market Data (Optional) ==========
  console.log('\n📋 Market Data (optional)');

  if (data.marketData) {
    test('marketData has timestamp', () => {
      assertType(data.marketData.timestamp, 'string');
    });

    if (data.marketData.recommended_scalp) {
      test('market has scalp recommendations', () => {
        assert.ok(Array.isArray(data.marketData.recommended_scalp));
      });
    }
  } else {
    console.log('  ⚠ No market data available');
  }

  // ========== Summary ==========
  const total = passed + failed;
  console.log(`\n${'='.repeat(45)}`);
  console.log(`📊 Results: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`❌ ${failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
