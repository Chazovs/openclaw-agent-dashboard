/**
 * Token Usage & Cost Analytics Panel
 * Отображает использование токенов и оценку стоимости по агентам
 */

let tokenCostPanelOpen = false;
let tokenCostRefreshInterval = null;

// Toggle token cost panel visibility
function toggleTokenCostPanel() {
    const body = document.getElementById('token-cost-body');
    const icon = document.getElementById('token-cost-toggle-icon');
    tokenCostPanelOpen = !tokenCostPanelOpen;
    body.classList.toggle('active', tokenCostPanelOpen);
    icon.textContent = tokenCostPanelOpen ? '▲' : '▼';

    if (tokenCostPanelOpen) {
        loadTokenCostData();
        if (tokenCostRefreshInterval) clearInterval(tokenCostRefreshInterval);
        tokenCostRefreshInterval = setInterval(loadTokenCostData, 15000);
    } else {
        if (tokenCostRefreshInterval) {
            clearInterval(tokenCostRefreshInterval);
            tokenCostRefreshInterval = null;
        }
    }
}

// Format cost in USD with appropriate precision
function formatCost(cost) {
    if (cost === 0) return '$0.00';
    if (cost < 0.001) return '$' + cost.toFixed(6);
    if (cost < 0.01) return '$' + cost.toFixed(5);
    if (cost < 0.1) return '$' + cost.toFixed(4);
    return '$' + cost.toFixed(3);
}

// Format tokens (short: 1.2K, 3.4M)
function formatTokens(count) {
    if (!count || count === 0) return '0';
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
    return (count / 1000000).toFixed(2) + 'M';
}

// Format large number with commas
function formatNumber(n) {
    return (n || 0).toLocaleString();
}

// Get token cost proportion (0-100%)
function getCostShare(cost, total) {
    if (!total || total === 0) return 0;
    return Math.round((cost / total) * 100);
}

// Get color by cost tier
function getCostColor(cost, maxCost) {
    if (!maxCost || maxCost === 0) return '#4cc9f0';
    const ratio = cost / maxCost;
    if (ratio < 0.1) return '#4cc9f0';
    if (ratio < 0.3) return '#2ed573';
    if (ratio < 0.5) return '#f0a04c';
    if (ratio < 0.7) return '#ffa502';
    return '#f05454';
}

// Get workspace emoji
function getWorkspaceEmoji(ws) {
    const map = {
        'core': '🧠',
        'messaging': '📱',
        'subagents': '🔄',
        'automation': '⏰',
        'system': '📊',
        'development': '💻',
        'content': '📰',
        'general': '📁'
    };
    return map[ws] || '📁';
}

// Load token cost data from API
async function loadTokenCostData() {
    const body = document.getElementById('token-cost-body');
    const summaryEl = document.getElementById('token-cost-summary');
    const chartEl = document.getElementById('token-cost-agent-chart');
    const breakdownEl = document.getElementById('token-cost-breakdown');

    // Show loading
    summaryEl.innerHTML = '<div class="loading">Загрузка данных токенов...</div>';
    chartEl.innerHTML = '';
    breakdownEl.innerHTML = '';

    try {
        const [costsRes, trendsRes] = await Promise.all([
            fetch('/api/tokens/costs'),
            fetch('/api/tokens/trends?hours=24')
        ]);

        if (!costsRes.ok) throw new Error('Token costs API: ' + costsRes.status);
        const costs = await costsRes.json();
        let trends = { trends: [], dataPoints: 0 };
        if (trendsRes.ok) trends = await trendsRes.json();

        // --- Summary Cards ---
        const s = costs.summary;
        summaryEl.innerHTML = `
            <div class="cost-summary-grid">
                <div class="cost-stat-card highlight">
                    <div class="cost-stat-value">${formatCost(s.totalCost)}</div>
                    <div class="cost-stat-label">Общая стоимость (оценка)</div>
                </div>
                <div class="cost-stat-card">
                    <div class="cost-stat-value">${formatTokens(s.totalTokens)}</div>
                    <div class="cost-stat-label">Всего токенов</div>
                </div>
                <div class="cost-stat-card">
                    <div class="cost-stat-value">${formatNumber(s.totalInputTokens)}</div>
                    <div class="cost-stat-label">Input токенов</div>
                </div>
                <div class="cost-stat-card">
                    <div class="cost-stat-value">${formatNumber(s.totalOutputTokens)}</div>
                    <div class="cost-stat-label">Output токенов</div>
                </div>
                <div class="cost-stat-card">
                    <div class="cost-stat-value">${s.totalAgents}</div>
                    <div class="cost-stat-label">Агентов с метриками</div>
                </div>
                <div class="cost-stat-card">
                    <div class="cost-stat-value">${formatCost(s.avgCostPerAgent)}</div>
                    <div class="cost-stat-label">Средняя стоимость на агента</div>
                </div>
            </div>
        `;

        // --- Agent Cost Horizontal Bar Chart ---
        if (costs.byAgent && costs.byAgent.length > 0) {
            const maxCost = Math.max(...costs.byAgent.map(a => a.cost));
            const maxTokens = Math.max(...costs.byAgent.map(a => a.totalTokens));

            let chartHTML = '<div class="cost-chart-title">💰 Расходы по агентам</div>';
            chartHTML += '<div class="cost-agent-list">';

            costs.byAgent.forEach((agent, idx) => {
                const costWidth = maxCost > 0 ? (agent.cost / maxCost) * 100 : 0;
                const tokenWidth = maxTokens > 0 ? (agent.totalTokens / maxTokens) * 100 : 0;
                const color = getCostColor(agent.cost, maxCost);
                const statusDot = agent.status === 'working' ? '🟢' : agent.status === 'error' ? '🔴' : agent.status === 'idle' ? '🟡' : '⚫';

                chartHTML += `
                    <div class="cost-agent-row">
                        <div class="cost-agent-info">
                            <span class="cost-agent-icon">${agent.emoji || '🤖'}</span>
                            <span class="cost-agent-name">${statusDot} ${agent.name}</span>
                            <span class="cost-agent-workspace">${getWorkspaceEmoji(agent.workspace)} ${agent.workspace}</span>
                        </div>
                        <div class="cost-agent-bars">
                            <div class="cost-bar-label">
                                <span>Стоимость: ${formatCost(agent.cost)}</span>
                                <span>${getCostShare(agent.cost, s.totalCost)}%</span>
                            </div>
                            <div class="cost-bar-track">
                                <div class="cost-bar-fill" style="width: ${costWidth}%; background: ${color};"></div>
                            </div>
                            <div class="cost-bar-label mini">
                                <span>Токены: ${formatTokens(agent.totalTokens)} (in: ${formatTokens(agent.inputTokens)} / out: ${formatTokens(agent.outputTokens)})</span>
                                <span>${agent.model}</span>
                            </div>
                            <div class="cost-bar-track mini">
                                <div class="cost-bar-fill" style="width: ${tokenWidth}%; background: #4cc9f0; opacity: 0.6;"></div>
                            </div>
                        </div>
                    </div>
                `;
            });

            chartHTML += '</div>';
            chartEl.innerHTML = chartHTML;
        } else {
            chartEl.innerHTML = '<div class="empty-state">Нет данных о токенах</div>';
        }

        // --- Breakdown section: by workspace, by model, trends ---
        let breakdownHTML = '<div class="breakdown-grid">';

        // By Workspace
        breakdownHTML += '<div class="breakdown-section"><div class="cost-chart-title">📂 По рабочим пространствам</div>';
        if (costs.byWorkspace && Object.keys(costs.byWorkspace).length > 0) {
            const wsMaxCost = Math.max(...Object.values(costs.byWorkspace).map(w => w.cost));
            Object.entries(costs.byWorkspace)
                .sort((a, b) => b[1].cost - a[1].cost)
                .forEach(([ws, data]) => {
                    const pct = wsMaxCost > 0 ? (data.cost / wsMaxCost) * 100 : 0;
                    breakdownHTML += `
                        <div class="cost-agent-row compact">
                            <div class="cost-agent-info">
                                <span class="cost-agent-name">${getWorkspaceEmoji(ws)} ${ws}</span>
                                <span class="cost-agent-workspace">${data.agentCount} агентов</span>
                            </div>
                            <div class="cost-agent-bars">
                                <div class="cost-bar-label">
                                    <span>${formatCost(data.cost)}</span>
                                    <span>${formatTokens(data.totalTokens)} токенов</span>
                                </div>
                                <div class="cost-bar-track">
                                    <div class="cost-bar-fill" style="width: ${pct}%; background: #f0a04c;"></div>
                                </div>
                            </div>
                        </div>
                    `;
                });
        } else {
            breakdownHTML += '<div class="empty-state">Нет данных</div>';
        }
        breakdownHTML += '</div>';

        // By Model
        breakdownHTML += '<div class="breakdown-section"><div class="cost-chart-title">🤖 По моделям</div>';
        if (costs.byModel && Object.keys(costs.byModel).length > 0) {
            const mdlMaxCost = Math.max(...Object.values(costs.byModel).map(m => m.cost));
            Object.entries(costs.byModel)
                .sort((a, b) => b[1].cost - a[1].cost)
                .forEach(([model, data]) => {
                    const pct = mdlMaxCost > 0 ? (data.cost / mdlMaxCost) * 100 : 0;
                    breakdownHTML += `
                        <div class="cost-agent-row compact">
                            <div class="cost-agent-info">
                                <span class="cost-agent-name">${model}</span>
                                <span class="cost-agent-workspace">${data.agentCount} агентов</span>
                            </div>
                            <div class="cost-agent-bars">
                                <div class="cost-bar-label">
                                    <span>${formatCost(data.cost)}</span>
                                    <span>${formatTokens(data.totalTokens)} токенов</span>
                                </div>
                                <div class="cost-bar-track">
                                    <div class="cost-bar-fill" style="width: ${pct}%; background: #2ed573;"></div>
                                </div>
                            </div>
                        </div>
                    `;
                });
        } else {
            breakdownHTML += '<div class="empty-state">Нет данных</div>';
        }
        breakdownHTML += '</div>';

        breakdownHTML += '</div>'; // end breakdown-grid

        // --- Trends section ---
        if (trends.trends && trends.trends.length > 1) {
            breakdownHTML += '<div class="breakdown-section full-width" style="margin-top:20px;">';
            breakdownHTML += '<div class="cost-chart-title">📈 Тренд токенов (24ч)</div>';

            const trendValues = trends.trends.map(t => t.totalTokens);
            const maxTrend = Math.max(...trendValues);
            const minTrend = Math.min(...trendValues);
            const trendRange = maxTrend - minTrend || 1;

            // Show every Nth label to avoid clutter
            const labelStep = Math.max(1, Math.floor(trends.trends.length / 12));

            breakdownHTML += '<div class="trend-bar-container">';
            trends.trends.forEach((point, idx) => {
                const height = ((point.totalTokens - minTrend) / trendRange) * 100;
                const showLabel = idx % labelStep === 0 || idx === trends.trends.length - 1;
                const time = new Date(point.timestamp);
                const timeStr = time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');

                breakdownHTML += `
                    <div class="trend-bar-wrapper" title="${timeStr} — ${formatTokens(point.totalTokens)} токенов">
                        <div class="trend-bar" style="height: ${Math.max(height, 2)}%;"></div>
                        ${showLabel ? `<div class="trend-label">${timeStr}</div>` : ''}
                    </div>
                `;
            });
            breakdownHTML += '</div>';

            // Trend stats
            const trendStart = trends.trends[0].totalTokens;
            const trendEnd = trends.trends[trends.trends.length - 1].totalTokens;
            const trendDiff = trendEnd - trendStart;
            const trendDir = trendDiff >= 0 ? '📈' : '📉';
            breakdownHTML += `
                <div class="trend-stats">
                    <span>${trendDir} ${trendDiff >= 0 ? '+' : ''}${formatTokens(trendDiff)} токенов за период</span>
                    <span>Мин: ${formatTokens(minTrend)} | Макс: ${formatTokens(maxTrend)} | Среднее: ${formatTokens(Math.round(trendValues.reduce((a, b) => a + b, 0) / trendValues.length))}</span>
                </div>
            `;

            breakdownHTML += '</div>';
        }

        breakdownEl.innerHTML = breakdownHTML;

    } catch (error) {
        console.error('Error loading token cost data:', error);
        summaryEl.innerHTML = `
            <div class="error-message">
                <h3>❌ Ошибка загрузки данных</h3>
                <p>${error.message}</p>
                <button onclick="loadTokenCostData()" class="filter-button" style="margin-top:10px;">🔄 Повторить</button>
            </div>`;
    }
}
