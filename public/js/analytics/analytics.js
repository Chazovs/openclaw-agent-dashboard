/**
 * Продолжение analytics.js
 */

/**
 * Обновление оповещений (продолжение)
 */
function updateAlerts(data) {
    if (!data || !data.alerts) return;
    
    const alertsContainer = document.getElementById('alerts-container');
    if (!alertsContainer) return;
    
    if (data.alerts.length === 0) {
        alertsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #a9a9a9;">
                <div style="font-size: 3rem; margin-bottom: 20px;">✅</div>
                <div>Нет активных оповещений</div>
                <div style="font-size: 0.9rem; margin-top: 10px;">Все системы работают нормально</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    data.alerts.forEach(alert => {
        const icon = getAlertIcon(alert.level);
        const alertClass = `alert-${alert.level}`;
        
        html += `
            <div class="alert ${alertClass}">
                <div style="font-size: 1.5rem;">${icon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${alert.message}</div>
                    <div style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.7);">
                        Агент: ${alert.agent} | Тип: ${alert.type}
                        ${alert.value ? ` | Значение: ${formatNumber(alert.value)}` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    alertsContainer.innerHTML = html;
}

/**
 * Обновление рекомендаций
 */
function updateRecommendations(data) {
    if (!data) return;
    
    const recommendationsContainer = document.getElementById('recommendations-container');
    const optimizationContainer = document.getElementById('optimization-potential');
    const priorityContainer = document.getElementById('priority-actions');
    
    if (!recommendationsContainer) return;
    
    // Генерация рекомендаций на основе данных
    const recommendations = generateRecommendations(data);
    
    if (recommendations.length === 0) {
        recommendationsContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #a9a9a9;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🎯</div>
                <div>Нет рекомендаций</div>
                <div style="font-size: 0.9rem; margin-top: 10px;">Система оптимально настроена</div>
            </div>
        `;
        return;
    }
    
    // Отображение рекомендаций
    let recHtml = '';
    recommendations.forEach(rec => {
        const priorityIcon = getPriorityIcon(rec.priority);
        
        recHtml += `
            <div class="alert alert-info" style="margin-bottom: 15px;">
                <div style="font-size: 1.5rem;">${priorityIcon}</div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${rec.title}</div>
                    <div style="margin-bottom: 10px;">${rec.description}</div>
                    <div style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.7);">
                        Тип: ${rec.type} | Приоритет: ${rec.priority}
                    </div>
                </div>
            </div>
        `;
    });
    
    recommendationsContainer.innerHTML = recHtml;
    
    // Потенциал оптимизации
    if (optimizationContainer) {
        const optimizationScore = calculateOptimizationScore(data);
        const width = Math.min(100, optimizationScore);
        
        optimizationContainer.innerHTML = `
            <div style="text-align: center;">
                <div class="card-value">${optimizationScore}%</div>
                <div class="card-label">Потенциал оптимизации</div>
                <div style="background: #0f3460; height: 20px; border-radius: 10px; margin: 20px 0;">
                    <div style="background: #4cc9f0; width: ${width}%; height: 100%; border-radius: 10px;"></div>
                </div>
                <div style="font-size: 0.9rem; color: #a9a9a9;">
                    ${getOptimizationMessage(optimizationScore)}
                </div>
            </div>
        `;
    }
    
    // Приоритетные действия
    if (priorityContainer) {
        const highPriority = recommendations.filter(r => r.priority === 'high');
        
        let priorityHtml = '<div style="display: flex; flex-direction: column; gap: 10px;">';
        
        if (highPriority.length > 0) {
            highPriority.forEach((action, index) => {
                priorityHtml += `
                    <div style="background: rgba(255, 0, 0, 0.1); padding: 10px; border-radius: 5px; border-left: 4px solid #ff0000;">
                        <div style="font-weight: bold;">${index + 1}. ${action.title}</div>
                        <div style="font-size: 0.9rem; margin-top: 5px;">${action.description}</div>
                    </div>
                `;
            });
        } else {
            priorityHtml += `
                <div style="text-align: center; padding: 20px; color: #a9a9a9;">
                    <div>Нет приоритетных действий</div>
                    <div style="font-size: 0.9rem; margin-top: 5px;">Все системы в норме</div>
                </div>
            `;
        }
        
        priorityHtml += '</div>';
        priorityContainer.innerHTML = priorityHtml;
    }
}

/**
 * Генерация рекомендаций на основе данных
 */
function generateRecommendations(data) {
    const recommendations = [];
    
    // Проверка использования токенов
    if (data.tokenUsage?.average > 50000) {
        recommendations.push({
            type: 'optimization',
            priority: 'high',
            title: 'Высокое среднее использование токенов',
            description: 'Рассмотрите оптимизацию промптов или использование более легких моделей'
        });
    }
    
    // Проверка ошибок
    if (data.byStatus?.error > 0) {
        recommendations.push({
            type: 'maintenance',
            priority: 'high',
            title: 'Агенты с ошибками',
            description: `Обнаружено ${data.byStatus.error} агентов в состоянии ошибки. Требуется диагностика.`
        });
    }
    
    // Проверка эффективности
    if (data.efficiency?.average < 100) {
        recommendations.push({
            type: 'performance',
            priority: 'medium',
            title: 'Низкая средняя эффективность',
            description: 'Рассмотрите оптимизацию задач или перераспределение нагрузки между агентами'
        });
    }
    
    // Проверка распределения по статусам
    const workingRatio = (data.byStatus?.working || 0) / data.totalAgents;
    if (workingRatio < 0.3) {
        recommendations.push({
            type: 'utilization',
            priority: 'medium',
            title: 'Низкая утилизация агентов',
            description: 'Менее 30% агентов активно работают. Рассмотрите увеличение нагрузки.'
        });
    }
    
    // Проверка workspace
    const workspaceCount = Object.keys(data.byWorkspace || {}).length;
    if (workspaceCount > 5) {
        recommendations.push({
            type: 'organization',
            priority: 'low',
            title: 'Много workspace',
            description: `Обнаружено ${workspaceCount} workspace. Рассмотрите консолидацию для лучшего управления.`
        });
    }
    
    return recommendations;
}

/**
 * Расчет оценки оптимизации
 */
function calculateOptimizationScore(data) {
    let score = 0;
    
    // Использование токенов (чем выше, тем больше потенциал)
    if (data.tokenUsage?.average > 0) {
        const tokenScore = Math.min(100, (data.tokenUsage.average / 100000) * 100);
        score += tokenScore * 0.4;
    }
    
    // Эффективность (чем ниже, тем больше потенциал)
    if (data.efficiency?.average > 0) {
        const efficiencyScore = Math.max(0, 100 - (data.efficiency.average / 10));
        score += efficiencyScore * 0.3;
    }
    
    // Ошибки (каждая ошибка добавляет потенциал)
    const errorCount = data.byStatus?.error || 0;
    score += Math.min(30, errorCount * 10) * 0.2;
    
    // Распределение по статусам
    const workingRatio = (data.byStatus?.working || 0) / data.totalAgents;
    const utilizationScore = Math.max(0, 100 - (workingRatio * 100));
    score += utilizationScore * 0.1;
    
    return Math.round(score);
}

/**
 * Вспомогательные функции
 */

function showSection(sectionId) {
    // Скрыть все секции
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Показать выбранную секцию
    document.getElementById(`${sectionId}-section`).style.display = 'block';
    
    // Обновить активную кнопку навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

function setTimeRange(hours) {
    currentTimeRange = hours;
    
    // Обновить активную кнопку времени
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Перезагрузить данные
    loadAnalyticsData();
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    // Простое отображение ошибки
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 15px;
        border-radius: 5px;
        z-index: 1000;
        max-width: 300px;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('last-update').textContent = `Обновлено: ${timeString}`;
}

function formatNumber(num, decimals = 0) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(decimals) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(decimals) + 'K';
    }
    return num.toFixed(decimals);
}

function calculateEfficiencyScore(agent) {
    if (!agent.efficiency) return 0;
    return Math.min(10, Math.round(agent.efficiency / 10));
}

function getAlertIcon(level) {
    switch(level) {
        case 'error': return '🔴';
        case 'warning': return '🟡';
        case 'info': return '🔵';
        default: return '⚪';
    }
}

function getPriorityIcon(priority) {
    switch(priority) {
        case 'high': return '🔴';
        case 'medium': return '🟡';
        case 'low': return '🟢';
        default: return '⚪';
    }
}

function getOptimizationMessage(score) {
    if (score >= 80) return 'Высокий потенциал оптимизации';
    if (score >= 50) return 'Средний потенциал оптимизации';
    if (score >= 20) return 'Низкий потенциал оптимизации';
    return 'Минимальный потенциал оптимизации';
}

/**
 * Обновление круговой диаграммы статусов
 */
function updateStatusChart(data) {
    if (!charts.status || !data.byStatus) return;
    
    const labels = Object.keys(data.byStatus);
    const values = Object.values(data.byStatus);
    
    // Русские названия статусов
    const russianLabels = labels.map(label => {
        switch(label) {
            case 'working': return 'Работает';
            case 'sleeping': return 'Спит';
            case 'idle': return 'Ожидает';
            case 'error': return 'Ошибка';
            default: return label;
        }
    });
    
    charts.status.data.labels = russianLabels;
    charts.status.data.datasets[0].data = values;
    charts.status.update();
}

/**
 * Обновление при загрузке данных
 */
function updateAllCharts() {
    if (!currentData) return;
    
    updateStatusChart(currentData.performance);
    
    // Обновление графика эффективности если есть
    if (charts.efficiency && currentData.performance.efficiency?.byAgent) {
        const agents = currentData.performance.efficiency.byAgent.slice(0, 10);
        charts.efficiency.data.labels = agents.map(a => a.name);
        charts.efficiency.data.datasets[0].data = agents.map(a => a.efficiency);
        charts.efficiency.update();
    }
}

// Экспорт функций для использования в консоли
window.AnalyticsDashboard = {
    loadAnalyticsData,
    showSection,
    setTimeRange,
    updateAllCharts
};