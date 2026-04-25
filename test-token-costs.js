/**
 * Tests for Token Usage & Cost Analytics
 * Проверяет:
 * - API /api/tokens/costs
 * - API /api/tokens/trends
 * - Логику расчета стоимости
 * - Форматирование данных
 */

const http = require('http');

const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`  ✅ ${label}: ${JSON.stringify(actual)}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertApprox(actual, expected, tolerance, label) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    console.log(`  ✅ ${label}: ${actual} ≈ ${expected} (±${tolerance})`);
    passed++;
  } else {
    console.log(`  ❌ ${label}: ${actual} not ≈ ${expected} (diff ${diff} > ${tolerance})`);
    failed++;
  }
}

function assertGreaterThan(actual, min, label) {
  if (actual > min) {
    console.log(`  ✅ ${label}: ${actual} > ${min}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}: ${actual} is not > ${min}`);
    failed++;
  }
}

function assertHasKeys(obj, keys, label) {
  const missing = keys.filter(k => !(k in obj));
  if (missing.length === 0) {
    console.log(`  ✅ ${label}: has all keys [${keys.join(', ')}]`);
    passed++;
  } else {
    console.log(`  ❌ ${label}: missing keys [${missing.join(', ')}]`);
    failed++;
  }
}

// Helper: HTTP GET
function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Parse error for ${path}: ${e.message}. Raw: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

// ===== Test Suite =====

async function runTests() {
  console.log('\n🔷 Test Suite: Token Usage & Cost Analytics\n');

  // 1. API endpoint existence
  console.log('\n📡 1. API Endpoints\n');
  try {
    const costsRes = await fetchJSON('/api/tokens/costs');
    assert(true, '/api/tokens/costs is accessible');
    assertHasKeys(costsRes, ['success', 'summary', 'byAgent', 'byWorkspace', 'byModel'], 'costs response structure');
    assert(costsRes.success === true, 'success flag is true');
    assertHasKeys(costsRes.summary, ['totalTokens', 'totalCost', 'totalAgents', 'totalInputTokens', 'totalOutputTokens', 'avgCostPerAgent'], 'summary has all fields');
  } catch (e) {
    console.log(`  ❌ /api/tokens/costs failed: ${e.message}`);
    failed++;
  }

  try {
    const trendsRes = await fetchJSON('/api/tokens/trends?hours=24');
    assert(true, '/api/tokens/trends?hours=24 is accessible');
    assertHasKeys(trendsRes, ['success', 'trends', 'hours', 'dataPoints'], 'trends response structure');
    assert(trendsRes.success === true, 'success flag is true');
    assert(Array.isArray(trendsRes.trends), 'trends is an array');
    if (trendsRes.trends.length > 0) {
      assertHasKeys(trendsRes.trends[0], ['timestamp', 'totalTokens'], 'trend entry structure');
    }
  } catch (e) {
    console.log(`  ❌ /api/tokens/trends failed: ${e.message}`);
    failed++;
  }

  // 2. Summary data validation
  console.log('\n📊 2. Summary Data Validation\n');
  try {
    const costs = await fetchJSON('/api/tokens/costs');
    const s = costs.summary;
    
    assertGreaterThan(s.totalAgents, 0, 'totalAgents > 0');
    assert(s.totalTokens >= 0, 'totalTokens >= 0');
    assert(s.totalInputTokens >= 0, 'totalInputTokens >= 0');
    assert(s.totalOutputTokens >= 0, 'totalOutputTokens >= 0');
    assert(s.totalCost >= 0, 'totalCost >= 0');
    assert(s.avgCostPerAgent >= 0, 'avgCostPerAgent >= 0');
    
    // Token consistency check
    if (s.totalInputTokens > 0 && s.totalOutputTokens > 0) {
      assert(s.totalCost > 0, 'totalCost > 0 when tokens exist');
    }
    
    // Total cost should be roughly input*price + output*price
    assert(typeof s.totalCost === 'number', 'totalCost is a number');
    assert(typeof s.totalTokens === 'number', 'totalTokens is a number');
  } catch (e) {
    console.log(`  ❌ Summary validation failed: ${e.message}`);
    failed++;
  }

  // 3. Per-agent data structure
  console.log('\n🤖 3. Per-Agent Data\n');
  try {
    const costs = await fetchJSON('/api/tokens/costs');
    assert(Array.isArray(costs.byAgent), 'byAgent is an array');
    
    if (costs.byAgent.length > 0) {
      const agent = costs.byAgent[0];
      assertHasKeys(agent, ['id', 'name', 'inputTokens', 'outputTokens', 'totalTokens', 'cost', 'model'], 'agent entry fields');
      assert(agent.inputTokens >= 0, `agent ${agent.name}: inputTokens >= 0`);
      assert(agent.outputTokens >= 0, `agent ${agent.name}: outputTokens >= 0`);
      assert(agent.totalTokens >= 0, `agent ${agent.name}: totalTokens >= 0`);
      assert(agent.cost >= 0, `agent ${agent.name}: cost >= 0`);
    }
    
    // Should be sorted by cost descending
    for (let i = 1; i < costs.byAgent.length; i++) {
      assert(
        costs.byAgent[i - 1].cost >= costs.byAgent[i].cost,
        `byAgent[${i-1}] cost >= byAgent[${i}] cost (sorted descending)`
      );
    }
  } catch (e) {
    console.log(`  ❌ Per-agent data failed: ${e.message}`);
    failed++;
  }

  // 4. Cost calculation accuracy
  console.log('\n💰 4. Cost Calculation Accuracy\n');
  try {
    const costs = await fetchJSON('/api/tokens/costs');
    const s = costs.summary;
    
    // Verify total tokens = sum of agent tokens
    let agentSumTokens = 0;
    let agentSumCost = 0;
    costs.byAgent.forEach(a => {
      agentSumTokens += a.totalTokens;
      agentSumCost += a.cost;
    });
    
    assertApprox(agentSumTokens, s.totalTokens, 1, 'sum(agent.totalTokens) ≈ summary.totalTokens');
    assertApprox(agentSumCost, s.totalCost, 0.001, 'sum(agent.cost) ≈ summary.totalCost');
    
    // Verify cost calculation: cost = (input/1000)*price_in + (output/1000)*price_out
    if (costs.byAgent.length > 0) {
      const a = costs.byAgent[0];
      const prices = { 'deepseek-chat': { input: 0.00027, output: 0.0011 } };
      const modelKey = a.model in prices ? a.model : 'unknown';
      const expectedCost = (a.inputTokens / 1000) * prices[modelKey].input + (a.outputTokens / 1000) * prices[modelKey].output;
      assertApprox(a.cost, expectedCost, 0.0001, `cost formula for ${a.name}: ${a.cost} ≈ ${expectedCost}`);
    }
  } catch (e) {
    console.log(`  ❌ Cost calculation failed: ${e.message}`);
    failed++;
  }

  // 5. Workspace aggregation
  console.log('\n📁 5. Workspace & Model Breakdown\n');
  try {
    const costs = await fetchJSON('/api/tokens/costs');
    
    assert(typeof costs.byWorkspace === 'object' && costs.byWorkspace !== null, 'byWorkspace exists');
    assert(typeof costs.byModel === 'object' && costs.byModel !== null, 'byModel exists');
    
    // Workspace costs should sum to total
    let wsCostSum = 0;
    let wsTokenSum = 0;
    Object.values(costs.byWorkspace).forEach(ws => {
      wsCostSum += ws.cost;
      wsTokenSum += ws.totalTokens;
    });
    assertApprox(wsCostSum, costs.summary.totalCost, 0.001, 'sum(workspace costs) ≈ totalCost');
    
    // Model costs should sum to total
    let mdlCostSum = 0;
    Object.values(costs.byModel).forEach(m => mdlCostSum += m.cost);
    assertApprox(mdlCostSum, costs.summary.totalCost, 0.001, 'sum(model costs) ≈ totalCost');
    
    if (Object.keys(costs.byModel).length > 0) {
      const topModel = Object.entries(costs.byModel).sort((a, b) => b[1].totalTokens - a[1].totalTokens)[0];
      assert(topModel[1].agentCount > 0, `top model ${topModel[0]} has agentCount > 0`);
    }
  } catch (e) {
    console.log(`  ❌ Workspace/model validation failed: ${e.message}`);
    failed++;
  }

  // 6. Frontend token-costs.js validity
  console.log('\n📜 6. Frontend Bundle Check\n');
  try {
    const fs = require('fs');
    const frontendPath = '/app/public/token-costs.js';
    const content = fs.readFileSync('/home/openclaw/.openclaw/workspace/agent-dashboard/public/token-costs.js', 'utf8');
    
    assert(content.includes('toggleTokenCostPanel'), 'exports toggleTokenCostPanel function');
    assert(content.includes('loadTokenCostData'), 'exports loadTokenCostData function');
    assert(content.includes('formatCost'), 'has formatCost helper');
    assert(content.includes('formatTokens'), 'has formatTokens helper');
    assert(content.includes('getWorkspaceEmoji'), 'has getWorkspaceEmoji helper');
    assert(content.includes('/api/tokens/costs'), 'fetches /api/tokens/costs endpoint');
    assert(content.includes('/api/tokens/trends'), 'fetches /api/tokens/trends endpoint');
    
    // Check it's parseable
    try {
      new Function(content);
      assert(true, 'JavaScript is syntactically valid');
    } catch (e) {
      assert(false, `JavaScript syntax error: ${e.message}`);
    }
  } catch (e) {
    console.log(`  ❌ Frontend check failed: ${e.message}`);
    failed++;
  }

  // 7. Frontend HTML integration  
  console.log('\n🔗 7. HTML Integration Check\n');
  try {
    const fs = require('fs');
    const htmlPath = '/home/openclaw/.openclaw/workspace/agent-dashboard/public/index.html';
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    assert(html.includes('token-cost-panel'), 'index.html has token-cost-panel id');
    assert(html.includes('toggleTokenCostPanel()'), 'toggleTokenCostPanel registered in HTML');
    assert(html.includes('token-cost-summary'), 'has token-cost-summary id');
    assert(html.includes('token-cost-agent-chart'), 'has token-cost-agent-chart id');
    assert(html.includes('token-cost-breakdown'), 'has token-cost-breakdown id');
    assert(html.includes('src="/token-costs.js"'), 'token-costs.js script included');
    assert(html.includes('Токены и стоимость'), 'panel title is in Russian');
    assert(html.includes('cost-stat-card'), 'CSS classes for cost panel exist');
    assert(html.includes('cost-bar-track'), 'CSS for bar charts exists');
    assert(html.includes('trend-bar-container'), 'CSS for trend charts exists');
  } catch (e) {
    console.log(`  ❌ HTML check failed: ${e.message}`);
    failed++;
  }

  // 8. Backend model pricing coverage
  console.log('\n📋 8. Backend Pricing Model Check\n');
  try {
    const fs = require('fs');
    const serverPath = '/home/openclaw/.openclaw/workspace/agent-dashboard/server-simple.js';
    const serverCode = fs.readFileSync(serverPath, 'utf8');
    
    assert(serverCode.includes('MODEL_PRICING'), 'MODEL_PRICING constant defined');
    assert(serverCode.includes('deepseek-chat'), 'covers deepseek-chat model');
    assert(serverCode.includes('gpt-4o'), 'covers gpt-4o model');
    assert(serverCode.includes('gpt-4o-mini'), 'covers gpt-4o-mini model');
    assert(serverCode.includes('claude-3'), 'covers claude-3 models');
    assert(serverCode.includes('/api/tokens/costs'), 'costs endpoint handler defined');
    assert(serverCode.includes('/api/tokens/trends'), 'trends endpoint handler defined');
    
    // Verify unique routes
    const routeMatches = serverCode.match(/app\.get\('\//g);
    assert(routeMatches.length >= 12, 'has at least 12 API endpoints');
  } catch (e) {
    console.log(`  ❌ Backend check failed: ${e.message}`);
    failed++;
  }

  // ===== Summary =====
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50) + '\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
