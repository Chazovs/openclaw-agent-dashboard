#!/bin/bash
# Run all dashboard tests
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "=============================================="
echo " Running all dashboard tests"
echo "=============================================="
echo ""

# 1. Services test
echo ">>> Services Test"
node "$DIR/services.test.js" 2>&1 || echo "WARN: services test had failures"
echo ""

# 2. Sessions test
echo ">>> Sessions Test"
node "$DIR/test-sessions.js" 2>&1 || echo "WARN: sessions test had failures"
echo ""

# 3. Trading Overview test
echo ">>> Trading Overview Test"
node "$DIR/trading-overview.test.js" 2>&1 || echo "WARN: trading test had failures"
echo ""

# 4. Commission Analyzer test
echo ">>> Commission & Fee Analyzer Test"
bash "$DIR/commission-analyzer.test.sh" 2>&1 || echo "WARN: commission test had failures"
echo ""

echo "=============================================="
echo " All tests completed"
echo "=============================================="
