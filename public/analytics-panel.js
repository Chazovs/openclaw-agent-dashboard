                        <div class="summary-icon">❌</div>
                    </div>
                    <div class="summary-value">Ошибка</div>
                    <div class="summary-trend">
                        ${message}
                    </div>
                </div>
            `;
        }
        
        // Управление фильтрами
        function setTimeFilter(filter) {
            currentTimeFilter = filter;
            
            // Обновляем активные кнопки
            document.querySelectorAll('.time-filter').forEach(btn => {
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
            document.querySelectorAll('.chart-controls .time-filter').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Обновляем график
            if (currentAnalytics) {
                updateTokenChart(currentAnalytics);
            }
        }
        
        // Действия с уведомлениями
        function acknowledgeAlert(timestamp) {
            // В реальном приложении здесь был бы запрос к API
            alert(`Уведомление от ${new Date(timestamp).toLocaleString('ru-RU')} отмечено как прочитанное`);
            // Перезагружаем данные
            loadAnalytics();
        }
        
        function showAlertDetails(timestamp) {
            if (!currentAnalytics) return;
            
            const alert = currentAnalytics.alerts.find(a => a.timestamp === timestamp);
            if (!alert) return;
            
            const details = `
                Тип: ${alert.type}
                Уровень: ${alert.level}
                Сообщение: ${alert.message}
                Время: ${new Date(alert.timestamp).toLocaleString('ru-RU')}
                ${alert.agents ? `Агенты: ${alert.agents.join(', ')}` : ''}
            `;
            
            alert(details);
        }
        
        // Действия пользователя
        function refreshData() {
            loadAnalytics();
            showToast('Данные обновляются...');
        }
        
        function exportData() {
            if (!currentAnalytics) {
                alert('Нет данных для экспорта');
                return;
            }
            
            const dataStr = JSON.stringify(currentAnalytics, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            const exportFileDefaultName = `openclaw-analytics-${new Date().toISOString().slice(0,10)}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            showToast('Данные экспортированы');
        }
        
        function showToast(message) {
            // Создаем тост
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #16213e;
                color: #4cc9f0;
                padding: 15px 25px;
                border-radius: 8px;
                border: 2px solid #4cc9f0;
                z-index: 1000;
                font-family: 'Courier New', monospace;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease;
            `;
            toast.textContent = message;
            
            document.body.appendChild(toast);
            
            // Удаляем через 3 секунды
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, 3000);
        }
        
        // Стили для анимаций
        const style = document.createElement('style');
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
    </script>
</body>
</html>