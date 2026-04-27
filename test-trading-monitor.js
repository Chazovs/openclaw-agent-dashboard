/**
 * Тест Trading Monitor API
 * Проверяет /api/trading/monitor endpoint: формат ответа, наличие данных, корректность метрик
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const API_URL = '/api/trading/monitor';

let passed = 0;
let failed = 0;
let totalTests = 0;

function test(name, fn) {
    totalTests++;
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        console.log(`  ❌ ${name}: ${err.message}`);
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg || ''} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertDefined(val, msg) {
    if (val === undefined || val === null) {
        throw new Error(msg || 'Value is undefined/null');
    }
}

function getJson(url) {
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
    console.log('\n🧪 === TRADING MONITOR API TESTS ===\n');

    // 1. Smoke test - endpoint отвечает
    let result;
    try {
        result = await getJson(BASE_URL + API_URL);
        console.log('  📡 API ответ получен');
    } catch (err) {
        console.log(`  ❌ Smoke test failed: ${err.message}`);
        console.log('\n📊 Итого: все тесты провалены — API недоступен');
        process.exit(1);
    }

    // 2. Базовая структура ответа
    test('Response имеет success=true', () => {
        assert(result.body.success === true, 'success should be true');
    });

    test('Response имеет timestamp', () => {
        assertDefined(result.body.timestamp, 'timestamp missing');
    });

    test('Response имеет summary', () => {
        assertDefined(result.body.summary, 'summary missing');
    });

    test('Response имеет bots array', () => {
        assert(Array.isArray(result.body.bots), 'bots should be an array');
    });

    // 3. Summary
    test('summary.totalBots > 0', () => {
        assert(result.body.summary.totalBots > 0, `Expected > 0, got ${result.body.summary.totalBots}`);
    });

    test('summary.activeBots определён', () => {
        assertDefined(result.body.summary.activeBots);
    });

    test('summary.totalBuys определён', () => {
        assertDefined(result.body.summary.totalBuys);
    });

    test('summary.totalSells определён', () => {
        assertDefined(result.body.summary.totalSells);
    });

    test('summary.totalErrors определён', () => {
        assertDefined(result.body.summary.totalErrors);
    });

    test('summary.activePositions определён', () => {
        assertDefined(result.body.summary.activePositions);
    });

    // 4. Каждый бот имеет правильную структуру
    const botIds = new Set();
    result.body.bots.forEach((bot, idx) => {
        test(`Bot ${idx}: имеет id`, () => {
            assertDefined(bot.id, 'id missing');
            assert(!botIds.has(bot.id), `duplicate id: ${bot.id}`);
            botIds.add(bot.id);
        });

        test(`Bot ${bot.id}: имеет name`, () => {
            assertDefined(bot.name);
        });

        test(`Bot ${bot.id}: имеет serviceName`, () => {
            assertDefined(bot.serviceName);
        });

        test(`Bot ${bot.id}: имеет serviceStatus`, () => {
            assertDefined(bot.serviceStatus);
        });

        test(`Bot ${bot.id}: имеет isActive (boolean)`, () => {
            assert(typeof bot.isActive === 'boolean', `expected boolean, got ${typeof bot.isActive}`);
        });

        test(`Bot ${bot.id}: имеет exists (boolean)`, () => {
            assert(typeof bot.exists === 'boolean', `expected boolean, got ${typeof bot.exists}`);
        });

        test(`Bot ${bot.id}: имеет totalBuys`, () => {
            assert(typeof bot.totalBuys === 'number');
        });

        test(`Bot ${bot.id}: имеет totalSells`, () => {
            assert(typeof bot.totalSells === 'number');
        });

        test(`Bot ${bot.id}: имеет totalErrors`, () => {
            assert(typeof bot.totalErrors === 'number');
        });

        test(`Bot ${bot.id}: recentTrades is array`, () => {
            assert(Array.isArray(bot.recentTrades));
        });

        test(`Bot ${bot.id}: balances is array`, () => {
            assert(Array.isArray(bot.balances));
        });

        test(`Bot ${bot.id}: activePositions is array`, () => {
            assert(Array.isArray(bot.activePositions));
        });

        test(`Bot ${bot.id}: logExcerpt is string`, () => {
            assert(typeof bot.logExcerpt === 'string', `expected string, got ${typeof bot.logExcerpt}`);
        });
    });

    // 5. Проверка конкретных данных (если файлы существуют)
    const bybitBot = result.body.bots.find(b => b.id === 'bybit-mean-reversion');
    test('Bybit Mean Reversion bot найден', () => {
        assertDefined(bybitBot, 'bybit-mean-reversion not found');
    });

    if (bybitBot && bybitBot.exists) {
        test('Bybit Mean Reversion имеет totalLines > 0', () => {
            assert(bybitBot.totalLines > 0, `expected > 0, got ${bybitBot.totalLines}`);
        });

        test('Bybit Mean Reversion имеет sizeBytes > 0', () => {
            assert(bybitBot.sizeBytes > 0, `expected > 0, got ${bybitBot.sizeBytes}`);
        });

        test('Bybit Mean Reversion имеет lastModified', () => {
            assertDefined(bybitBot.lastModified);
            assert(bybitBot.lastModified.length > 0);
        });

        if (bybitBot.recentTrades && bybitBot.recentTrades.length > 0) {
            const trade = bybitBot.recentTrades[0];
            test('Bybit Mean Reversion: trade имеет type', () => {
                assert(['buy', 'sell'].includes(trade.type));
            });
            test('Bybit Mean Reversion: trade имеет symbol', () => {
                assertDefined(trade.symbol);
                assert(trade.symbol.length > 0);
            });
            test('Bybit Mean Reversion: trade имеет qty (number)', () => {
                assert(typeof trade.qty === 'number' && trade.qty > 0);
            });
            test('Bybit Mean Reversion: trade имеет time', () => {
                assertDefined(trade.time);
            });
        }
    }

    const scalpBot = result.body.bots.find(b => b.id === 'bybit-scalp');
    test('Bybit Scalp bot найден', () => {
        assertDefined(scalpBot, 'bybit-scalp not found');
    });

    if (scalpBot && scalpBot.activePositions && scalpBot.activePositions.length > 0) {
        const pos = scalpBot.activePositions[0];
        test('Bybit Scalp: position имеет symbol', () => {
            assertDefined(pos.symbol);
        });
        if (pos.price) {
            test('Bybit Scalp: position price > 0', () => {
                assert(pos.price > 0);
            });
        }
    }

    const memecoinBot = result.body.bots.find(b => b.id === 'memecoin-trader');
    test('Memecoin Trader bot найден', () => {
        assertDefined(memecoinBot, 'memecoin-trader not found');
    });

    // 6. JSON trades (если есть)
    const botsWithJson = result.body.bots.filter(b => b.jsonTrades && b.jsonTrades.length > 0);
    if (botsWithJson.length > 0) {
        test(`Найдено ${botsWithJson.length} ботов с JSON трейдами`, () => {
            assert(botsWithJson.length > 0);
        });
    }

    // 7. Проверка что фронтенд файл существует
    test('trade-panel.js существует', () => {
        const frontendPath = path.join(__dirname, 'public', 'trade-panel.js');
        assert(fs.existsSync(frontendPath), 'trade-panel.js not found');
        const stats = fs.statSync(frontendPath);
        assert(stats.size > 0, 'trade-panel.js is empty');
    });

    // 8. Проверка что index.html ссылается на trade-panel.js
    test('index.html содержит trade-panel.js script', () => {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        assert(fs.existsSync(indexPath), 'index.html not found');
        const content = fs.readFileSync(indexPath, 'utf8');
        assert(content.includes('trade-panel.js'), 'script tag for trade-panel.js not found');
        assert(content.includes('trade-panel'), 'trading panel HTML section not found');
    });

    // 9. Проверка серверного кода
    test('server-simple.js содержит /api/trading/monitor endpoint', () => {
        const serverPath = path.join(__dirname, 'server-simple.js');
        assert(fs.existsSync(serverPath), 'server-simple.js not found');
        const content = fs.readFileSync(serverPath, 'utf8');
        assert(content.includes('/api/trading/monitor'), 'trading endpoint not found');
        assert(content.includes('TRADING_BOTS'), 'TRADING_BOTS config not found');
        assert(content.includes('parseTradeLog'), 'parseTradeLog function not found');
    });

    // 10. HTTP статус код
    test('HTTP status 200', () => {
        assertEqual(result.status, 200, `Expected 200, got ${result.status}`);
    });

    // Итоги
    console.log(`\n📊 Итоги: ${totalTests} тестов | ✅ ${passed} пройдено | ❌ ${failed} провалено`);
    if (failed > 0) {
        console.log('⚠️ Некоторые тесты не пройдены');
        process.exit(1);
    } else {
        console.log('🎉 Все тесты пройдены!');
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
});
