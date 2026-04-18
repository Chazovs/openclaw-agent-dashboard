').value.toLowerCase();
            const statusFilter = document.getElementById('status-filter').value;
            const workspaceFilter = document.getElementById('workspace-filter').value;
            const sortFilter = document.getElementById('sort-filter')?.value || 'name';
            
            // Filter agents
            let filteredAgents = allAgents.filter(agent => {
                // Search filter
                if (searchFilter && !agent.name.toLowerCase().includes(searchFilter)) {
                    return false;
                }
                
                // Status filter
                if (statusFilter !== 'all' && agent.status !== statusFilter) {
                    return false;
                }
                
                // Workspace filter
                if (workspaceFilter !== 'all' && agent.workspace !== workspaceFilter) {
                    return false;
                }
                
                return true;
            });
            
            // Sort agents
            filteredAgents.sort((a, b) => {
                switch (sortFilter) {
                    case 'name':
                        return a.name.localeCompare(b.name);
                    case 'status':
                        return a.status.localeCompare(b.status);
                    case 'workspace':
                        return a.workspace.localeCompare(b.workspace);
                    case 'lastSeen':
                        return new Date(b.lastSeen) - new Date(a.lastSeen);
                    default:
                        return 0;
                }
            });
            
            // Clear container
            container.innerHTML = '';
            
            // Display filtered agents
            if (filteredAgents.length === 0) {
                container.innerHTML = '<div class="loading">Агентов не найдено</div>';
                return;
            }
            
            filteredAgents.forEach(agent => {
                const card = document.createElement('div');
                card.className = 'agent-card';
                card.dataset.agentId = agent.id;
                
                // Status class
                const statusClass = `status-${agent.status}`;
                
                card.innerHTML = `
                    <div class="agent-header">
                        <div class="pixel-avatar">${agent.emoji}</div>
                        <div class="agent-info">
                            <h3>${agent.name}</h3>
                            <div class="agent-id">ID: ${agent.id}</div>
                        </div>
                    </div>
                    <div class="status-text">
                        <span class="status-indicator ${statusClass}"></span>
                        <span>${getStatusText(agent.status)}</span>
                    </div>
                    <div class="agent-details">
                        <p><strong>Рабочее пространство:</strong> ${agent.workspace}</p>
                        <p><strong>Описание:</strong> ${agent.description}</p>
                        <p><strong>Последняя активность:</strong> ${new Date(agent.lastSeen).toLocaleString()}</p>
                        <button onclick="loadActivityHistory('${agent.id}', '${agent.name}')" 
                                class="filter-input" 
                                style="margin-top: 10px; cursor: pointer; width: 100%;">
                            📊 Показать историю активности
                        </button>
                    </div>
                `;
                
                container.appendChild(card);
            });
        }
        
        // Get status text in Russian
        function getStatusText(status) {
            const statusMap = {
                'working': 'Работает',
                'idle': 'Ожидает',
                'sleeping': 'Спит',
                'error': 'Ошибка'
            };
            return statusMap[status] || status;
        }
        
        // Load activity history for an agent (REAL DATA)
        async function loadActivityHistory(agentId, agentName) {
            const panel = document.getElementById('activity-panel');
            const timeline = document.getElementById('activity-timeline');
            const agentNameSpan = document.getElementById('activity-agent-name');
            
            // Show panel
            panel.classList.add('active');
            agentNameSpan.textContent = agentName;
            currentActivityAgentId = agentId;
            
            // Show loading
            timeline.innerHTML = '<div class="loading">Загрузка истории активности...</div>';
            
            try {
                // Get real activity from API
                const response = await fetch(`/api/agents/${agentId}/activity`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const activities = await response.json();
                
                // Display activities
                if (activities.length === 0) {
                    timeline.innerHTML = '<div class="loading">История активности отсутствует</div>';
                    return;
                }
                
                timeline.innerHTML = '';
                
                activities.forEach(activity => {
                    const item = document.createElement('div');
                    item.className = 'activity-item';
                    
                    const time = new Date(activity.timestamp).toLocaleString();
                    
                    // Определяем текст активности
                    let activityText = 'Неизвестная активность';
                    let status = 'unknown';
                    
                    if (activity.task) {
                        // Старый формат (демо данные)
                        activityText = activity.task;
                        status = activity.status || 'unknown';
                    } else if (activity.action) {
                        // Новый формат (реальные данные из OpenClaw)
                        const actionMap = {
                            'message_sent': '📤 Отправлено сообщение',
                            'message_received': '📥 Получено сообщение',
                            'tool_executed': '🛠️ Использован инструмент',
                            'tool_result': '📊 Получен результат инструмента',
                            'session_started': '🚀 Запущена сессия',
                            'thinking': '🤔 Обработка запроса',
                            'unknown': '❓ Неизвестное действие'
                        };
                        
                        activityText = actionMap[activity.action] || `Действие: ${activity.action}`;
                        status = 'working'; // По умолчанию для реальных действий
                        
                        // Добавляем детали если есть
                        if (activity.details && activity.details.content) {
                            const shortContent = activity.details.content.substring(0, 80);
                            activityText += `: "${shortContent}..."`;
                        } else if (activity.details && activity.details.toolName) {
                            activityText += `: ${activity.details.toolName}`;
                        }
                    }
                    
                    const statusClass = `status-${status}`;
                    
                    item.innerHTML = `
                        <div class="activity-time">${time}</div>
                        <div class="activity-task">
                            <span class="status-indicator ${statusClass}"></span>
                            ${activityText}
                            ${activity.source ? `<small style="color: #a9a9a9; margin-left: 10px;">[${activity.source}]</small>` : ''}
                        </div>
                    `;
                    
                    timeline.appendChild(item);
                });
                
                // Add success message
                timeline.innerHTML += '<div class="success">✅ Реальные данные с бэкенд-хранилища</div>';
                
            } catch (error) {
                console.error('Ошибка загрузки истории активности:', error);
                timeline.innerHTML = `
                    <div class="error">
                        <h3>❌ Ошибка загрузки истории активности</h3>
                        <p>${error.message}</p>
                        <p>Проверьте подключение к API</p>
                    </div>
                `;
            }
        }
        
        // Load activity statistics
        async function loadActivityStats() {
            const panel = document.getElementById('activity-stats-panel');
            const grid = document.getElementById('activity-stats-grid');
            
            // Show panel
            panel.classList.add('active');
            grid.innerHTML = '<div class="loading">Загрузка статистики активности...</div>';
            
            try {
                // Get activity stats from API
                const response = await fetch('/api/activity/stats');
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const stats = await response.json();
                
                // Display stats
                grid.innerHTML = '';
                
                const statCards = [
                    { label: 'Всего агентов', value: stats.totalAgents, color: '#4cc9f0' },
                    { label: 'Всего активностей', value: stats.totalActivities, color: '#f0a04c' },
                    { label: 'Активностей за 24ч', value: stats.recentActivityCount, color: '#f05454' },
                    { label: 'Уникальных статусов', value: Object.keys(stats.activitiesByStatus || {}).length, color: '#a9a9a9' }
                ];
                
                statCards.forEach(stat => {
                    const card = document.createElement('div');
                    card.className = 'activity-stat-card';
                    card.innerHTML = `
                        <div class="activity-stat-value" style="color: ${stat.color}">${stat.value}</div>
                        <div class="activity-stat-label">${stat.label}</div>
                    `;
                    grid.appendChild(card);
                });
                
                // Add status breakdown
                if (stats.activitiesByStatus && Object.keys(stats.activitiesByStatus).length > 0) {
                    const statusHeader = document.createElement('div');
                    statusHeader.style.gridColumn = '1 / -1';
                    statusHeader.style.marginTop = '20px';
                    statusHeader.style.color = '#a9a9a9';
                    statusHeader.innerHTML = '<h4>Распределение по статусам:</h4>';
                    grid.appendChild(statusHeader);
                    
                    for (const [status, count] of Object.entries(stats.activitiesByStatus)) {
                        const statusCard = document.createElement('div');
                        statusCard.className = 'activity-stat-card';
                        const statusColor = status === 'working' ? '#4cc9f0' : 
                                          status === 'idle' ? '#f0a04c' : 
                                          status === 'sleeping' ? '#a9a9a9' : '#f05454';
                        statusCard.innerHTML = `
                            <div class="activity-stat-value" style="color: ${statusColor}">${count}</div>
                            <div class="activity-stat-label">${getStatusText(status)}</div>
                        `;
                        grid.appendChild(statusCard);
                    }
                }
                
            } catch (error) {
                console.error('Ошибка загрузки статистики:', error);
                grid.innerHTML = `
                    <div class="error" style="grid-column: 1 / -1;">
                        <h3>❌ Ошибка загрузки статистики</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
        
        // Record test activity
        async function recordTestActivity() {
            const successMessage = document.getElementById('success-message');
            
            if (allAgents.length === 0) {
                successMessage.innerHTML = '❌ Нет агентов для записи активности';
                successMessage.style.display = 'block';
                return;
            }
            
            // Select random agent
            const agent = allAgents[Math.floor(Math.random() * allAgents.length)];
            const tasks = [
                'Тестовая задача от пользователя',
                'Проверка системы активности',
                'Демонстрация работы API',
                'Запись тестовой активности'
            ];
            const task = tasks[Math.floor(Math.random() * tasks.length)];
            
            try {
                const response = await fetch(`/api/agents/${agent.id}/activity`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'working',
                        task: task,
                        duration: 300000, // 5 минут
                        details: { test: true, source: 'dashboard-ui' },
                        source: 'user-test'
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const result = await response.json();
                
                successMessage.innerHTML = `✅ Тестовая активность записана для ${agent.name}: "${task}"`;
                successMessage.style.display = 'block';
                
                // Hide message after 5 seconds
                setTimeout(() => {
                    successMessage.style.display = 'none';
                }, 5000);
                
                // Reload agents to show updated status
                loadAgents();
                
            } catch (error) {
                console.error('Ошибка записи тестовой активности:', error);
                successMessage.innerHTML = `❌ Ошибка записи активности: ${error.message}`;
                successMessage.style.display = 'block';
            }
        }
        
        // Close activity panel
        function closeActivityPanel() {
            const panel = document.getElementById('activity-panel');
            panel.classList.remove('active');
            currentActivityAgentId = null;
        }
        
        // Close activity stats panel
        function closeActivityStats() {
            const panel = document.getElementById('activity-stats-panel');
            panel.classList.remove('active');
        }
        
        // Update last update time
        function updateLastUpdate() {
            const now = new Date();
            const timeString = now.toLocaleTimeString();
            document.getElementById('last-update').textContent = timeString;
        }
        
        // Initialize event listeners
        function initEventListeners() {
            // Filter inputs
            document.getElementById('search-filter').addEventListener('input', applyFilters);
            document.getElementById('status-filter').addEventListener('change', applyFilters);
            document.getElementById('workspace-filter').addEventListener('change', applyFilters);
            
            // Auto-refresh every 30 seconds
            setInterval(loadAgents, 30000);
        }
        
        // Initialize dashboard
        async function initDashboard() {
            // Load agents
            await loadAgents();
            
            // Initialize event listeners
            initEventListeners();
            
            // Update last update time
            updateLastUpdate();
        }
        
        // Start dashboard when page loads
        window.addEventListener('load', initDashboard);