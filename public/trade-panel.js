/**
 * Trading Monitor Panel
 * Отображает мониторинг работы торговых ботов: балансы, позиции, сделки, логи
 */

let tradePanelOpen = false;
let tradeRefreshInterval = null;

// Toggle panel
function toggleTradePanel() {
    const body = document.getElementById('trade-panel-body');
    const icon = document.getElementById('trade-panel-toggle-icon');
    tradePanelOpen = !tradePanelOpen;
    body.classList.toggle('active', tradePanelOpen);
    icon.textContent = tradePanelOpen ? '▲' : '▼';

    if (tradePanelOpen) {
        loadTradeData();
        if (tradeRefreshInterval) clearInterval(tradeRefreshInterval);
        tradeRefreshInterval = setInterval(loadTradeData, 15000);
    } else {
        if (tradeRefreshInterval) {
            clearInterval(tradeRefreshInterval);
            tradeRefreshInterval = null;
        }
    }
}

// Format time ago
function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const ms = Date.now() - new Date(dateStr).getTime();
    if (ms < 0) return 'только что';
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return sec + 'с назад';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + 'м назад';
    const h = Math.floor(min / 60);
    if (h < 24) return h + 'ч ' + (min % 60) + 'м назад';
    const d = Math.floor(h / 24);
    return d + 'д назад';
}

// Format bytes
function formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// Format time string from log
function formatLogTime(str) {
    if (!str) return '—';
    return str.substring(0, 19);
}

// Main load function
async function loadTradeData() {
    const body = document.getElementById('trade-panel-body');
    if (!body) return;

    const summaryEl = document.getElementById('trade-summary');
    const botsEl = document.getElementById('trade-bots');

    summaryEl.innerHTML = '<div class="loading">⏳ Мониторинг торговых ботов...</div>';
    botsEl.innerHTML = '';

    try {
        const response = await fetch('/api/trading/monitor');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        renderTradeData(data);
    } catch (err) {
        console.error('Trade monitor error:', err);
        summaryEl.innerHTML = '<div class="error-message" style="padding: 20px; text-align: center;"><h3>❌ Ошибка загрузки</h3><p>' + err.message + '</p><button onclick="loadTradeData()" class="filter-button" style="margin-top: 10px;">🔄 Повторить</button></div>';
    }
}

// Render all trade data
function renderTradeData(data) {
    const summaryEl = document.getElementById('trade-summary');
    const botsEl = document.getElementById('trade-bots');

    if (!data.success || !data.bots) {
        summaryEl.innerHTML = '<div class="error-message">❌ Данные не получены</div>';
        return;
    }

    const s = data.summary;
    const bots = data.bots;

    // Summary bar
    summaryEl.innerHTML = `
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
            <span style="background: #0f3460; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">
                🤖 <strong>${s.totalBots}</strong> ботов
            </span>
            <span style="background: #0f3460; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; color: ${s.activeBots > 0 ? '#2ed573' : '#a9a9a9'};">
                🟢 <strong>${s.activeBots}</strong> активны
            </span>
            <span style="background: #0f3460; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">
                💰 Покупок: <strong>${s.totalBuys}</strong>
            </span>
            <span style="background: #0f3460; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">
                💸 Продаж: <strong>${s.totalSells}</strong>
            </span>
            <span style="background: #0f3460; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; color: ${s.totalErrors > 0 ? '#f05454' : '#2ed573'};">
                ⚠️ Ошибок: <strong>${s.totalErrors}</strong>
            </span>
            <span style="background: #0f3460; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem;">
                📦 Позиций: <strong>${s.activePositions}</strong>
            </span>
            <span style="margin-left: auto; color: #a9a9a9; font-size: 0.75rem;">
                ${new Date(data.timestamp).toLocaleTimeString()}
            </span>
        </div>
    `;

    // Bot cards
    botsEl.innerHTML = bots.map(function(bot, idx) {
        return renderBotCard(bot, idx);
    }).join('');

    // Add event listeners for log viewers
    bots.forEach(function(bot, idx) {
        const logEl = document.getElementById('trade-log-excerpt-' + idx);
        if (logEl) {
            logEl.onclick = function() {
                var expanded = document.getElementById('trade-log-full-' + idx);
                if (expanded) {
                    expanded.style.display = expanded.style.display === 'none' ? 'block' : 'none';
                }
            };
        }

        const toggleBtn = document.getElementById('trade-bot-toggle-' + idx);
        if (toggleBtn) {
            toggleBtn.onclick = function() {
                var details = document.getElementById('trade-bot-details-' + idx);
                if (details) {
                    var isHidden = details.style.display === 'none';
                    details.style.display = isHidden ? 'block' : 'none';
                    toggleBtn.textContent = isHidden ? '▲' : '▼';
                }
            };
        }
    });
}

// Render individual bot card
function renderBotCard(bot, idx) {
    var statusColor = '#a9a9a9';
    var statusText = 'Неизвестно';
    if (bot.isActive) {
        statusColor = '#2ed573';
        statusText = 'Активен';
    } else if (bot.exists) {
        statusColor = '#f0a04c';
        statusText = 'Неактивен';
    } else {
        statusColor = '#f05454';
        statusText = 'Нет данных';
    }

    var lastSeenStr = '—';
    if (bot.secondsSinceUpdate !== null && bot.secondsSinceUpdate !== undefined) {
        if (bot.secondsSinceUpdate < 120) {
            lastSeenStr = '<span style="color: #2ed573;">только что</span>';
        } else {
            var min = Math.floor(bot.secondsSinceUpdate / 60);
            if (min < 60) lastSeenStr = min + 'м назад';
            else {
                var h = Math.floor(min / 60);
                lastSeenStr = h + 'ч ' + (min % 60) + 'м назад';
            }
        }
    }

    var balanceInfo = '';
    if (bot.balances && bot.balances.length > 0) {
        var lastBal = bot.balances[bot.balances.length - 1];
        balanceInfo = '<div class="health-metric"><span class="health-metric-label">💰 Баланс USDT</span><span class="health-metric-value" style="color: #4cc9f0;">$' + lastBal.amount.toFixed(2) + '</span></div>';
    }

    var positionsHtml = '';
    if (bot.activePositions && bot.activePositions.length > 0) {
        positionsHtml = '<div class="health-section-title">📦 Открытые позиции</div>';
        bot.activePositions.forEach(function(pos) {
            var priceStr = pos.price ? '$' + pos.price.toFixed(4) : '—';
            var ddStr = pos.drawdown !== undefined ? (pos.drawdown >= 0 ? '<span style="color: #2ed573;">' + pos.drawdown.toFixed(1) + '%</span>' : '<span style="color: #f05454;">' + pos.drawdown.toFixed(1) + '%</span>') : '';
            positionsHtml += '<div class="health-metric"><span class="health-metric-label">' + pos.symbol + ' (' + (pos.qty || '—') + ')</span><span class="health-metric-value">' + priceStr + ' ' + ddStr + '</span></div>';
        });
    }

    var tradesHtml = '';
    if (bot.recentTrades && bot.recentTrades.length > 0) {
        tradesHtml = '<div class="health-section-title">🔄 Последние сделки</div>';
        bot.recentTrades.slice(0, 10).forEach(function(t) {
            var icon = t.type === 'buy' ? '🟢' : '🔴';
            var typeText = t.type === 'buy' ? 'BUY' : 'SELL';
            tradesHtml += '<div class="health-metric"><span class="health-metric-label" style="font-size: 0.8rem;">' + t.time + '</span><span class="health-metric-value" style="font-size: 0.8rem;">' + icon + ' ' + typeText + ' ' + t.symbol + ' (' + t.qty + ')</span></div>';
        });
    }

    var jsonHtml = '';
    if (bot.jsonTrades && bot.jsonTrades.length > 0) {
        jsonHtml = '<div class="health-section-title">📋 JSON-трейды (всего: ' + (bot.totalJsonTrades || 0) + ')</div>';
        bot.jsonTrades.slice(0, 8).forEach(function(t) {
            jsonHtml += '<div class="health-metric"><span class="health-metric-label" style="font-size: 0.75rem;">' + formatLogTime(t.time) + '</span><span class="health-metric-value" style="font-size: 0.75rem;">' + t.symbol + ' ' + (t.side || '—') + ' (' + t.qty + ')</span></div>';
        });
    }

    var logPreview = '';
    if (bot.logExcerpt) {
        var lines = bot.logExcerpt.split('\\n').slice(-15);
        logPreview = '<div class="log-viewer" id="trade-log-excerpt-' + idx + '" style="cursor: pointer; max-height: 100px;" title="Нажмите для показа полного лога">';
        lines.forEach(function(l) {
            var lineClass = 'log-entry';
            if (l.includes('ERROR') || l.includes('❌')) lineClass += ' log-error';
            else if (l.includes('WARNING') || l.includes('WARN')) lineClass += ' log-warn';
            else if (l.includes('✅') || l.includes('SUCCESS')) lineClass += ' log-success';
            logPreview += '<div class="' + lineClass + '" style="color: #a9a9a9;">' + escapeHtml(l.trim()) + '</div>';
        });
        logPreview += '</div>';
        logPreview += '<div id="trade-log-full-' + idx + '" style="display: none; margin-top: 5px;">';
        logPreview += '<div class="log-viewer" style="max-height: 400px;">';
        bot.logExcerpt.split('\\n').forEach(function(l) {
            var lineClass = 'log-entry';
            if (l.includes('ERROR') || l.includes('❌')) lineClass += ' log-error';
            else if (l.includes('WARNING') || l.includes('WARN')) lineClass += ' log-warn';
            else if (l.includes('✅') || l.includes('SUCCESS')) lineClass += ' log-success';
            logPreview += '<div class="' + lineClass + '" style="color: #a9a9a9;">' + escapeHtml(l.trim()) + '</div>';
        });
        logPreview += '</div></div>';
    }

    var logSize = bot.sizeBytes ? formatBytes(bot.sizeBytes) : '—';
    var totalLines = bot.totalLines ? bot.totalLines.toLocaleString() : '—';

    return `
        <div class="health-panel" style="margin-bottom: 15px;">
            <div class="health-header" onclick="document.getElementById('trade-bot-details-${idx}').style.display = document.getElementById('trade-bot-details-${idx}').style.display === 'none' ? 'block' : 'none'; this.querySelector('.toggle-icon').textContent = this.querySelector('.toggle-icon').textContent === '▲' ? '▼' : '▲';">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.5rem;">${bot.emoji}</span>
                    <div>
                        <strong style="color: #4cc9f0;">${bot.name}</strong>
                        <div style="color: #a9a9a9; font-size: 0.8rem;">${bot.serviceName}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="health-badge" style="background: ${statusColor}22; color: ${statusColor}; border-color: ${statusColor};">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; margin-right: 4px;"></span>
                        ${statusText}
                    </span>
                    <span style="font-size: 0.75rem; color: #a9a9a9;">${lastSeenStr}</span>
                    <span class="toggle-icon" style="color: #a9a9a9;">▼</span>
                </div>
            </div>
            <div class="health-body active" id="trade-bot-details-${idx}">
                <div class="health-grid">
                    <div class="health-section">
                        <div class="health-section-title">📊 Статистика</div>
                        <div class="health-metric"><span class="health-metric-label">📏 Размер лога</span><span class="health-metric-value">${logSize} (${totalLines} строк)</span></div>
                        <div class="health-metric"><span class="health-metric-label">🕐 Последний запуск</span><span class="health-metric-value">${formatLogTime(bot.lastRunTime)}</span></div>
                        <div class="health-metric"><span class="health-metric-label">🟢 Покупок</span><span class="health-metric-value">${bot.totalBuys}</span></div>
                        <div class="health-metric"><span class="health-metric-label">🔴 Продаж</span><span class="health-metric-value">${bot.totalSells}</span></div>
                        <div class="health-metric"><span class="health-metric-label">⚠️ Ошибок</span><span class="health-metric-value" style="color: ${bot.totalErrors > 0 ? '#f05454' : '#2ed573'};">${bot.totalErrors}</span></div>
                        ${balanceInfo}
                    </div>
                    <div class="health-section">
                        ${positionsHtml || '<div class="health-section-title">📦 Открытые позиции</div><div style="color: #a9a9a9; font-size: 0.85rem;">Нет открытых позиций</div>'}
                        ${tradesHtml || '<div class="health-section-title">🔄 Последние сделки</div><div style="color: #a9a9a9; font-size: 0.85rem;">Нет сделок</div>'}
                    </div>
                </div>
                ${jsonHtml ? '<div class="health-section" style="margin-top: 10px;">' + jsonHtml + '</div>' : ''}
                <div class="health-section" style="margin-top: 10px;">
                    <div class="health-section-title">📜 Последние строки лога <span style="color: #a9a9a9; font-size: 0.7rem;">(нажмите для разворота)</span></div>
                    ${logPreview || '<div style="color: #a9a9a9; font-size: 0.85rem;">Лог пуст</div>'}
                </div>
            </div>
        </div>
    `;
}
