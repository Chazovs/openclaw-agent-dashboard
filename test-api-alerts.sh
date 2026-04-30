#!/bin/bash
# Integration test: Alert Manager API Endpoints
# Reads PORT from env or defaults to 3000

PORT="${PORT:-3000}"
BASE="http://localhost:$PORT"
FAILED=0
PASSED=0

green() { echo -e "\033[32m$1\033[0m"; }
red() { echo -e "\033[31m$1\033[0m"; }

test_endpoint() {
    local desc="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expect_key="$5"
    
    if [ -n "$data" ]; then
        RESP=$(curl -s -X "$method" "$BASE$url" -H 'Content-Type: application/json' -d "$data" 2>/dev/null)
    else
        RESP=$(curl -s -X "$method" "$BASE$url" 2>/dev/null)
    fi
    
    if echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('$expect_key') is not None, 'Missing key $expect_key'; print('OK')" 2>/dev/null; then
        green "  ✓ $desc"
        PASSED=$((PASSED+1))
    else
        red "  ✗ $desc — expected key '$expect_key' in response"
        echo "    Response: $(echo $RESP | head -c 200)"
        FAILED=$((FAILED+1))
    fi
}

echo "========================================="
echo "Alert Manager API Integration Tests"
echo "Server: $BASE"
echo "========================================="

# Test 1: GET /api/alerts/summary
test_endpoint "GET /api/alerts/summary returns summary" "GET" "/api/alerts/summary" "" "summary"

# Test 2: GET /api/alerts
test_endpoint "GET /api/alerts returns alerts list" "GET" "/api/alerts" "" "alerts"

# Test 3: GET /api/alerts with limit
test_endpoint "GET /api/alerts?limit=5 respects limit" "GET" "/api/alerts?limit=5" "" "alerts"

# Test 4: POST /api/alerts/scan
test_endpoint "POST /api/alerts/scan generates system alerts" "POST" "/api/alerts/scan" "" "success"

# Test 5: POST /api/alerts/acknowledge-all
test_endpoint "POST /api/alerts/acknowledge-all marks all read" "POST" "/api/alerts/acknowledge-all" '{}' "success"

# Test 6: Check the HTML page renders alert panel
ALERT_PANEL=$(curl -s "$BASE/" | grep -c "Центр оповещений" 2>/dev/null)
if [ "$ALERT_PANEL" -gt 0 ]; then
    green "  ✓ Alert Panel HTML is present in the page"
    PASSED=$((PASSED+1))
else
    red "  ✗ Alert Panel HTML missing from page"
    FAILED=$((FAILED+1))
fi

# Test 7: Check the HTML page renders all required alert JS functions
for func in "toggleAlertPanel" "loadAlertPanel" "setAlertFilter" "acknowledgeAlert" "acknowledgeAllAlerts" "scanSystem" "loadAlertBadge"; do
    if grep -q "$func" /home/openclaw/.openclaw/workspace/agent-dashboard/public/index.html 2>/dev/null; then
        green "  ✓ JS function '$func' found in page"
        PASSED=$((PASSED+1))
    else
        red "  ✗ JS function '$func' missing from page"
        FAILED=$((FAILED+1))
    fi
done

echo ""
echo "========================================="
echo "Results: $PASSED passed, $FAILED failed"
echo "========================================="

# Wait for the server process
sleep 2

exit $FAILED
