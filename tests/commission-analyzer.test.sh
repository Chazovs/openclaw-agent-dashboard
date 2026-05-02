#!/bin/bash
# Tests for Commission & Fee Analyzer
# Run: bash tests/commission-analyzer.test.sh

PASS=0
FAIL=0
TEST_NUM=0

assert_eq() {
    local desc="$1" expected="$2" actual="$3"
    TEST_NUM=$((TEST_NUM+1))
    if [ "$expected" = "$actual" ]; then
        PASS=$((PASS+1))
        echo "  ✓ TEST $TEST_NUM: $desc"
    else
        FAIL=$((FAIL+1))
        echo "  ✗ TEST $TEST_NUM: $desc"
        echo "      Expected: '$expected'"
        echo "      Actual:   '$actual'"
    fi
}

assert_contains() {
    local desc="$1" needle="$2" haystack="$3"
    TEST_NUM=$((TEST_NUM+1))
    if echo "$haystack" | grep -q "$needle"; then
        PASS=$((PASS+1))
        echo "  ✓ TEST $TEST_NUM: $desc"
    else
        FAIL=$((FAIL+1))
        echo "  ✗ TEST $TEST_NUM: $desc"
        echo "      Expected to contain: '$needle'"
    fi
}

echo ""
echo "===================================="
echo " Commission & Fee Analyzer Tests"
echo "===================================="
echo ""

# 1. Module loads without errors
echo "--- 1. Module Loading ---"
node -e "const CA = require('./commission-analyzer'); console.log('Module loaded:', typeof CA);" 2>&1
assert_eq "Module exports constructor" "function" $(node -e "const CA = require('./commission-analyzer'); console.log(typeof CA);" 2>&1)

# 2. Can instantiate
node -e "const CA = require('./commission-analyzer'); new CA(); console.log('OK');" 2>&1
assert_eq "Can instantiate" "OK" $(node -e "const CA = require('./commission-analyzer'); new CA(); console.log('OK');" 2>&1)

# 3. getFees returns valid structure
echo ""
echo "--- 2. Data Structure ---"
DATA=$(node -e "
const CA = require('./commission-analyzer');
var c = new CA();
c.getFees().then(function(d) { console.log(JSON.stringify(d)); }).catch(function(e) { console.log('ERROR:'+e.message); });
" 2>&1)
assert_eq "success is true" "true" $(echo "$DATA" | node -e "var d=require('fs').readFileSync('/dev/stdin','utf8').trim(); console.log(JSON.parse(d).success);" 2>/dev/null || echo "parse_fail")
assert_contains "has timestamp" '"timestamp"' "$DATA"
assert_contains "has summary" '"summary"' "$DATA"
assert_contains "has bots" '"bots"' "$DATA"
assert_contains "has trends" '"trends"' "$DATA"
assert_contains "has forecasts" '"forecasts"' "$DATA"

# 4. Summary fields exist
echo ""
echo "--- 3. Summary Fields ---"
SUMMARY=$(echo "$DATA" | node -e "var d=require('fs').readFileSync('/dev/stdin','utf8').trim(); var s=JSON.parse(d).summary; console.log(typeof s.totalCommissions, typeof s.totalTrades, typeof s.avgFeePerTrade);" 2>/dev/null)
assert_eq "summary fields are numbers" "number number number" "$SUMMARY"

# 5. Bots have required fields
echo ""
echo "--- 4. Bot Fields ---"
BOTFIELDS=$(echo "$DATA" | node -e "
var d=require('fs').readFileSync('/dev/stdin','utf8').trim();
var bots = JSON.parse(d).bots;
var ok = 0;
bots.forEach(function(b) {
    if (b.id && b.name && typeof b.totalFees === 'number' && typeof b.tradeCount === 'number') ok++;
});
console.log(ok + '/' + bots.length);
" 2>/dev/null)
assert_eq "all bots have required fields" "$(echo "$BOTFIELDS" | grep -oP '^\d+')/$(echo "$BOTFIELDS" | grep -oP '/\K\d+')" "3/3"

# 6. extractTradeVolume static method
echo ""
echo "--- 5. Volume Extraction ---"
VOL_METHOD=$(node -e "const CA = require('./commission-analyzer'); console.log(typeof CA.extractTradeVolume);" 2>&1)
assert_eq "extractTradeVolume exists" "function" "$VOL_METHOD"

# 7. Volume extraction from signal line
VOL1=$(node -e "const CA = require('./commission-analyzer'); console.log(CA.extractTradeVolume('📈 Сигнал BNBUSDT: z=-3.57, покупаем на \$8.57 USDT (15.0% от счёта)'));" 2>&1)
assert_eq "extract from 'покупаем на'" "8.57" "$VOL1"

# 8. Volume extraction from Buy line (with colon)
VOL2=$(node -e "const CA = require('./commission-analyzer'); console.log(CA.extractTradeVolume('✅ Buy 5.0 DOTUSDT: orderId=2203153011755543808'));" 2>&1)
assert_eq "extract from 'Buy X.X SYM: orderId'" "5" "$VOL2"

# 9. Volume extraction from Buy line (parens format)
VOL3=$(node -e "const CA = require('./commission-analyzer'); console.log(CA.extractTradeVolume('✅ Buy 6.0000 SHIBUSDT (orderId=2203124727055391488)'));" 2>&1)
assert_eq "extract from 'Buy X.X SYM (orderId'" "6" "$VOL3"

# 10. Volume extraction from tinkoff format
VOL4=$(node -e "const CA = require('./commission-analyzer'); console.log(CA.extractTradeVolume('покупаем на 500.00 ₽'));" 2>&1)
assert_eq "extract from tinkoff ₽ format" "500" "$VOL4"

# 11. No match for non-trade line
VOL5=$(node -e "const CA = require('./commission-analyzer'); console.log(CA.extractTradeVolume('2026-04-28 14:31:32,959 - INFO - Держим'));" 2>&1)
assert_eq "no match for non-trade line" "null" "$VOL5"

# 12. isTradeLine
echo ""
echo "--- 6. Trade Line Detection ---"
TRADE1=$(node -e "const CA = require('./commission-analyzer'); console.log(CA.isTradeLine('✅ Buy 5.0 DOTUSDT'));" 2>&1)
assert_eq "isTradeLine true for Buy" "true" "$TRADE1"
TRADE2=$(node -e "const CA = require('./commission-analyzer'); console.log(CA.isTradeLine('Держим'));" 2>&1)
assert_eq "isTradeLine false for non-trade" "false" "$TRADE2"

# 13. Fee calculation
echo ""
echo "--- 7. Fee Calculation ---"
FEE_RESULT=$(node -e "
const CA = require('./commission-analyzer');
var c = new CA();
c.getFees().then(function(d) {
    var s = d.summary;
    var allValid = true;
    if (s.totalCommissions <= 0) { console.log('err: zero fees'); allValid = false; }
    if (s.totalTrades <= 0) { console.log('err: zero trades'); allValid = false; }
    if (!d.bots.length) { console.log('err: no bots'); allValid = false; }
    // Check fee = volume * rate
    d.bots.forEach(function(b) {
        var expectedFee = b.totalVolume * b.feeRate;
        var diff = Math.abs(b.totalFees - expectedFee);
        if (diff > 0.001) console.log('err: fee mismatch for ' + b.id + ' got ' + b.totalFees + ' expected ~' + expectedFee);
    });
    if (allValid) console.log('OK');
}).catch(function(e) { console.log('err: ' + e.message); });
" 2>&1)
assert_eq "fee calculations correct" "OK" "$FEE_RESULT"

# 14. Clear cache works
echo ""
echo "--- 8. Cache ---"
CACHE_RES=$(node -e "
const CA = require('./commission-analyzer');
var c = new CA();
c.clearCache();
console.log('OK');
" 2>&1)
assert_eq "clearCache works" "OK" "$CACHE_RES"

# 15. Cache TTL
CACHE_TTL=$(node -e "
const CA = require('./commission-analyzer');
var c = new CA();
console.log(c.CACHE_TTL >= 10000 ? 'OK' : 'too short');
" 2>&1)
assert_eq "cache TTL >= 10s" "OK" "$CACHE_TTL"

# 16. API endpoint responds
echo ""
echo "--- 9. API Endpoint ---"
API_RESP=$(curl -s http://localhost:3000/api/commissions 2>/dev/null)
assert_eq "API returns 200" "1" $(echo "$API_RESP" | grep -c '"success":true' 2>/dev/null)
assert_contains "API has bots" '"bots"' "$API_RESP"
assert_contains "API has daily trend" '"daily"' "$API_RESP"

# 17. POST /api/commissions/refresh returns 200
REFRESH_RESP=$(curl -s -X POST http://localhost:3000/api/commissions/refresh 2>/dev/null)
assert_eq "refresh endpoint works" "1" $(echo "$REFRESH_RESP" | grep -c '"success":true' 2>/dev/null)

# 18. Daily trend dates are sorted
echo ""
echo "--- 10. Data Integrity ---"
DAILY_SORTED=$(echo "$DATA" | node -e "
var d=require('fs').readFileSync('/dev/stdin','utf8').trim();
var days = JSON.parse(d).trends.daily;
if (!days || days.length < 2) { console.log('skip'); process.exit(); }
var sorted = true;
for (var i=1; i<days.length; i++) { if (days[i].date < days[i-1].date) sorted = false; }
console.log(sorted ? 'YES' : 'NO');
" 2>/dev/null)
assert_eq "daily trend sorted by date" "YES" "$DAILY_SORTED"

# 19. Weekly trend sorted
WEEKLY_SORTED=$(echo "$DATA" | node -e "
var d=require('fs').readFileSync('/dev/stdin','utf8').trim();
var w = JSON.parse(d).trends.weekly;
if (!w || w.length < 2) { console.log('skip'); process.exit(); }
var sorted = true;
for (var i=1; i<w.length; i++) { if (w[i].weekStart < w[i-1].weekStart) sorted = false; }
console.log(sorted ? 'YES' : 'NO');
" 2>/dev/null)
assert_eq "weekly trend sorted by week" "YES" "$WEEKLY_SORTED"

echo ""
echo "===================================="
echo " Results: $PASS passed, $FAIL failed"
echo "===================================="
echo ""

if [ "$FAIL" -gt 0 ]; then exit 1; fi
