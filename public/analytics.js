                `;
                return;
            }
            
            metricsPanel.innerHTML = `
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-title">Загрузка CPU</div>
                        <div>⚡</div>
                    </div>
                    <div class="metric-value">${system.cpu?.loadAvg?.[0]?.toFixed(2) || '0.00'}</div>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${Math.min((system.cpu?.loadAvg?.[0] || 0) * 20, 100)}%"></div>
                    </div>
                    <div class="metric-labels">
                        <span>0</span>
                        <span>Средняя за 1 мин</span>
                        <span>${system.cpu?.cores || 0} ядер</span>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-title">Использование памяти</div>
                        <div>💾</div>
                    </div>
                    <div class="metric-value">${system.memory?.usagePercent || 0}%</div>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: ${system.memory?.usagePercent || 0}%"></div>
                    </div>
                    <div class="metric-labels">
                        <span>${formatBytes(system.memory?.free || 0)} свободно</span>
                        <span>${formatBytes(system.memory?.used || 0)} использовано</span>
                        <span>${formatBytes(system.memory?.total || 0)} всего</span>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <div class="metric-title">Время работы</div>
                        <div>⏱️</div>
                    </div>
                    <div class="metric-value">${formatUptime(system.uptime || 0)}</div>
                    <div class="metric-bar">
                        <div class="metric-fill" style="width: 100%"></div>
                    </div>
                    <div class="metric-labels">
                        <span>Система работает</span>
                        <span>с ${system.timestamp ? new Date(system.timestamp).toLocaleTimeString('ru-RU') : 'неизвестно'}</span>
                    </div>
                </div>
            `;
        }
        
        // Вспомогательные функции
        function getStatusIcon(status) {
            switch(status) {
                case 'critical': return '🔴';
                case 'warning': return '🟡';
                case 'success': return '🟢';
                default: return '⚪';
            }
        }
        
        function getStatusText(status) {
            switch(status) {
                case 'critical': return 'Критический';
                case 'warning': return 'Предупреждение';
                case 'success': return 'Нормальный';
                default: return 'Неизвестно';
            }
        }
        
        function getTrendClass(trend) {
            if (trend > 0) return 'trend-up';
            if (trend < 0) return 'trend-down';
            return 'trend-neutral';
        }
        
        function getTrendIcon(trend) {
            if (trend > 0) return '↗️';
            if (trend < 0) return '↘️';
            return '➡️';
        }
        
        function formatTrend(value) {
            return Math.abs(value).toString();
        }
        
        function getAlertIcon(type) {
            switch(type) {
                case 'critical': return '🔴';
                case 'warning': return '🟡';
                case 'error': return '❌';
                default: return 'ℹ️';
            }
        }
        
        function formatNumber(num) {
            if (typeof num !== 'number') return '0';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toString();
        }
        
        function formatBytes(bytes) {
            if (typeof bytes !== 'number' || bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }
        
        function formatUptime(seconds) {
            if (typeof seconds !== 'number') return '0 минут';
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            if (days > 0) return `${days}д ${hours}ч`;
            if (hours > 0) return `${hours}ч ${minutes}м`;
            return `${minutes} минут`;
        }
        
        function updateLastUpdate() {
            const element = document.getElementById('last-update');
            if (element) {
                element.textContent = new Date().toLocaleTimeString('ru-RU');
            }
        }
        
        function updateDataStatus(status) {
            const element = document.getElementById('data-status');
            if (element) {
                element.textContent = status;
                element.style.color = status.includes('Ошибка') ? '#ff4757' : 
                                    status.includes('Успешно') ? '#2ed573' : '#4cc9f0';
            }
        }
        
        function showError(title, details) {
            const summaryPanel = document.getElementById('summary-panel');
            if (!summaryPanel) return;
            
            summaryPanel.innerHTML = `
                <div class="error-state" style="grid-column: 1 / -1;">
                    <div class="error-icon">❌</div>
                    <div class="error-message">${title}</div>
                    <div class="error-details">${details || 'Попробуйте обновить страницу'}</div>
                    <button onclick="refreshData()" class="nav-button" style="margin-top: 15px;">🔄 Повторить попытку</button>
                </div>
            `;
        }
        
        // Управление фильтрами
        function setTimeFilter(filter) {
            currentTimeFilter = filter;
            
            // Обновляем активные кнопки
            document.querySelectorAll('.chart-panel:first-child .time-filter').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Обновляем график
            if (currentAnalytics) {
                updateActivityChart(currentAnalytics);
            }
        }
        
        function setTokenFilter(filter) {
            currentTokenFilter = filter;
            
            // Обновляем активные кнопки
            document.querySelectorAll('.chart-panel:nth-child(2) .time-filter').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Обновляем график
            if (currentAnalytics) {
                updateTokenChart(currentAnalytics);
            }
        }
        
        // Управление автообновлением
        function startAutoRefresh() {
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
            }
            autoRefreshInterval = setInterval(() => {
                if (isAutoRefreshEnabled) {
                    loadAnalytics();
                }
            }, 30000); // 30 секунд
        }
        
        function toggleAutoRefresh() {
            isAutoRefreshEnabled = !isAutoRefreshEnabled;
            const button = document.getElementById('auto-refresh-btn');
            if (button) {
                button.textContent = isAutoRefreshEnabled ? 
                    '⏸️ Автообновление: ВКЛ' : 
                    '▶️ Автообновление: ВЫКЛ';
                button.style.borderColor = isAutoRefreshEnabled ? '#4cc9f0' : '#ffa502';
            }
            
            if (isAutoRefreshEnabled) {
                startAutoRefresh();
                showToast('Автообновление включено');
            } else {
                if (autoRefreshInterval) {
                    clearInterval(autoRefreshInterval);
                    autoRefreshInterval = null;
                }
                showToast('Автообновление отключено');
            }
        }
        
        // Действия с уведомлениями
        function acknowledgeAlert(timestamp) {
            showToast(`Уведомление от ${timestamp ? new Date(timestamp).toLocaleTimeString('ru-RU') : 'неизвестного времени'} отмечено`);
            // В реальном приложении здесь был бы запрос к API для отметки уведомления
        }
        
        // Действия пользователя
        function refreshData() {
            loadAnalytics();
            showToast('Данные обновляются...');
        }
        
        function exportData() {
            if (!currentAnalytics) {
                showToast('Нет данных для экспорта', 'error');
                return;
            }
            
            try {
                const dataStr = JSON.stringify(currentAnalytics, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
                const exportFileDefaultName = `openclaw-analytics-${new Date().toISOString().slice(0,10)}.json`;
                
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', exportFileDefaultName);
                linkElement.click();
                
                showToast('Данные экспортированы');
            } catch (err) {
                console.error('Export error:', err);
                showToast('Ошибка при экспорте данных', 'error');
            }
        }
        
        function showToast(message, type = 'info') {
            // Удаляем существующие тосты
            document.querySelectorAll('.toast-message').forEach(toast => {
                toast.remove();
            });
            
            // Создаем тост
            const toast = document.createElement('div');
            toast.className = 'toast-message';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'error' ? '#ff4757' : '#16213e'};
                color: ${type === 'error' ? 'white' : '#4cc9f0'};
                padding: 15px 25px;
                border-radius: 8px;
                border: 2px solid ${type === 'error' ? '#ff4757' : '#4cc9f0'};
                z-index: 10000;
                font-family: 'Courier New', monospace;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease;
                max-width: 400px;
                word-wrap: break-word;
            `;
            toast.textContent = message;
            
            document.body.appendChild(toast);
            
            // Удаляем через 3 секунды
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) {
                        document.body.removeChild(toast);
                    }
                }, 300);
            }, 3000);
        }
        
        // Добавляем стили для анимаций
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Обработка WebSocket сообщений
        function connectWebSocket() {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}`;
                const socket = new WebSocket(wsUrl);
                
                socket.onopen = function() {
                    console.log('WebSocket connected');
                };
                
                socket.onmessage = function(event) {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'analytics-update') {
                            currentAnalytics = data.payload;
                            updateSummary(currentAnalytics);
                            updateCharts(currentAnalytics);
                            updateAlerts(currentAnalytics);
                            updateMetrics(currentAnalytics);
                            updateLastUpdate();
                            updateDataStatus('Обновлено в реальном времени');
                        }
                    } catch (err) {
                        console.error('WebSocket message error:', err);
                    }
                };
                
                socket.onerror = function(error) {
                    console.error('WebSocket error:', error);
                };
                
                socket.onclose = function() {
                    console.log('WebSocket disconnected, reconnecting in 5 seconds...');
                    setTimeout(connectWebSocket, 5000);
                };
                
                return socket;
            } catch (err) {
                console.error('WebSocket connection error:', err);
                return null;
            }
        }
        
        // Подключаем WebSocket
        let socket = connectWebSocket();
        
        // Очистка при закрытии страницы
        window.addEventListener('beforeunload', function() {
            if (socket) {
                socket.close();
            }
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
            }
        });
        
        // Периодическая проверка соединения
        setInterval(() => {
            if (socket && socket.readyState === WebSocket.CLOSED) {
                console.log('WebSocket reconnecting...');
                socket = connectWebSocket();
            }
        }, 10000);
    </script>
</body>
</html>