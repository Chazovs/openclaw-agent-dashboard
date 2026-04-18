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
        
        // Load activity history for an agent
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
                // Try to get activity from API
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
                    const duration = activity.duration ? ` (${Math.round(activity.duration / 60000)} мин)` : '';
                    
                    item.innerHTML = `
                        <div class="activity-time">${time}${duration}</div>
                        <div class="activity-task">
                            <span class="status-indicator status-${activity.status}"></span>
                            ${activity.task}
                        </div>
                    `;
                    
                    timeline.appendChild(item);
                });
                
            } catch (error) {
                console.error('Ошибка загрузки истории активности:', error);
                
                // Fallback: create demo activities
                const demoActivities = [
                    {
                        timestamp: new Date(Date.now() - 3600000).toISOString(),
                        status: 'working',
                        task: 'Анализ данных дашборда',
                        duration: 1200000
                    },
                    {
                        timestamp: new Date(Date.now() - 1800000).toISOString(),
                        status: 'idle',
                        task: 'Ожидание новых задач',
                        duration: 600000
                    },
                    {
                        timestamp: new Date(Date.now() - 600000).toISOString(),
                        status: 'working',
                        task: 'Разработка новой функциональности',
                        duration: 300000
                    }
                ];
                
                timeline.innerHTML = '';
                
                demoActivities.forEach(activity => {
                    const item = document.createElement('div');
                    item.className = 'activity-item';
                    
                    const time = new Date(activity.timestamp).toLocaleString();
                    const duration = activity.duration ? ` (${Math.round(activity.duration / 60000)} мин)` : '';
                    
                    item.innerHTML = `
                        <div class="activity-time">${time}${duration}</div>
                        <div class="activity-task">
                            <span class="status-indicator status-${activity.status}"></span>
                            ${activity.task}
                        </div>
                    `;
                    
                    timeline.appendChild(item);
                });
                
                timeline.innerHTML += '<div class="activity-item" style="border-left-color: #f0a04c;">⚠️ Используются демо-данные (API временно недоступен)</div>';
            }
        }
        
        // Close activity panel
        function closeActivityPanel() {
            const panel = document.getElementById('activity-panel');
            panel.classList.remove('active');
            currentActivityAgentId = null;
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
            document.getElementById('sort-filter').addEventListener('change', applyFilters);
            
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