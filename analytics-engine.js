/**
 * Analytics Engine для дашборда OpenClaw
 * Сбор и анализ метрик производительности агентов
 */

const fs = require('fs');
const path = require('path');

class AnalyticsEngine {
    constructor() {
        this.metricsHistory = [];
        this.maxHistorySize = 1000; // Максимальное количество записей в истории
        this.alertThresholds = {
            highTokenUsage: 100000, // Порог высокого использования токенов
            longInactivity: 3600000, // 1 час бездействия
            errorRate: 0.1, // 10% ошибок
            lowEfficiency: 0.5 // Низкая эффективность (токены/время)
        };
        
        // Инициализация хранилища метрик
        this.metricsFile = path.join(__dirname, 'data', 'analytics-metrics.json');
        this.loadMetrics();
    }
    
    /**
     * Загрузка сохраненных метрик
     */
    loadMetrics() {
        try {
            if (fs.existsSync(this.metricsFile)) {
                const data = fs.readFileSync(this.metricsFile, 'utf8');
                this.metricsHistory = JSON.parse(data);
                console.log(`Загружено ${this.metricsHistory.length} записей метрик`);
            }
        } catch (error) {
            console.error('Ошибка загрузки метрик:', error);
            this.metricsHistory = [];
        }
    }
    
    /**
     * Сохранение метрик
     */
    saveMetrics() {
        try {
            const dir = path.dirname(this.metricsFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // Сохраняем только последние записи
            const toSave = this.metricsHistory.slice(-this.maxHistorySize);
            fs.writeFileSync(this.metricsFile, JSON.stringify(toSave, null, 2));
        } catch (error) {
            console.error('Ошибка сохранения метрик:', error);
        }
    }
    
    /**
     * Анализ агентов и сбор метрик
     * @param {Array} agents - Список агентов
     * @returns {Object} Аналитические данные
     */
    analyzeAgents(agents) {
        const timestamp = new Date().toISOString();
        const metrics = {
            timestamp,
            totalAgents: agents.length,
            byStatus: {},
            byWorkspace: {},
            tokenUsage: {
                total: 0,
                average: 0,
                max: 0,
                min: Infinity,
                byAgent: []
            },
            efficiency: {
                total: 0,
                average: 0,
                byAgent: []
            },
            alerts: []
        };
        
        // Анализ по статусам
        agents.forEach(agent => {
            // Статистика по статусам
            metrics.byStatus[agent.status] = (metrics.byStatus[agent.status] || 0) + 1;
            
            // Статистика по workspace
            metrics.byWorkspace[agent.workspace] = (metrics.byWorkspace[agent.workspace] || 0) + 1;
            
            // Анализ использования токенов
            if (agent.realMetrics && agent.realMetrics.totalTokens) {
                const tokens = agent.realMetrics.totalTokens;
                metrics.tokenUsage.total += tokens;
                metrics.tokenUsage.max = Math.max(metrics.tokenUsage.max, tokens);
                metrics.tokenUsage.min = Math.min(metrics.tokenUsage.min, tokens);
                
                metrics.tokenUsage.byAgent.push({
                    name: agent.name,
                    tokens,
                    workspace: agent.workspace,
                    status: agent.status
                });
            }
            
            // Проверка на аномалии
            this.checkAnomalies(agent, metrics.alerts);
        });
        
        // Расчет средних значений
        if (agents.length > 0) {
            metrics.tokenUsage.average = metrics.tokenUsage.total / agents.length;
            
            // Сортировка агентов по использованию токенов
            metrics.tokenUsage.byAgent.sort((a, b) => b.tokens - a.tokens);
            
            // Топ-5 агентов по использованию токенов
            metrics.tokenUsage.topConsumers = metrics.tokenUsage.byAgent.slice(0, 5);
        }
        
        // Анализ эффективности (если есть данные о времени)
        this.calculateEfficiency(agents, metrics);
        
        // Сохранение метрик в историю
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.maxHistorySize) {
            this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
        }
        
        // Сохранение на диск
        this.saveMetrics();
        
        return metrics;
    }
    
    /**
     * Расчет эффективности агентов
     */
    calculateEfficiency(agents, metrics) {
        agents.forEach(agent => {
            if (agent.realMetrics && agent.realMetrics.totalTokens > 0) {
                // Простая метрика эффективности: токены / возраст (в часах)
                const ageHours = agent.realMetrics.ageMs / (1000 * 60 * 60);
                const efficiency = ageHours > 0 ? agent.realMetrics.totalTokens / ageHours : 0;
                
                metrics.efficiency.total += efficiency;
                metrics.efficiency.byAgent.push({
                    name: agent.name,
                    efficiency: Math.round(efficiency * 100) / 100,
                    tokens: agent.realMetrics.totalTokens,
                    ageHours: Math.round(ageHours * 100) / 100
                });
            }
        });
        
        if (metrics.efficiency.byAgent.length > 0) {
            metrics.efficiency.average = metrics.efficiency.total / metrics.efficiency.byAgent.length;
            metrics.efficiency.byAgent.sort((a, b) => b.efficiency - a.efficiency);
            metrics.efficiency.topPerformers = metrics.efficiency.byAgent.slice(0, 5);
        }
    }
    
    /**
     * Проверка на аномалии и генерация оповещений
     */
    checkAnomalies(agent, alerts) {
        if (!agent.realMetrics) return;
        
        // Проверка высокого использования токенов
        if (agent.realMetrics.totalTokens > this.alertThresholds.highTokenUsage) {
            alerts.push({
                type: 'high_token_usage',
                level: 'warning',
                agent: agent.name,
                value: agent.realMetrics.totalTokens,
                threshold: this.alertThresholds.highTokenUsage,
                message: `Высокое использование токенов: ${agent.realMetrics.totalTokens}`
            });
        }
        
        // Проверка длительного бездействия
        if (agent.status === 'sleeping' && agent.realMetrics.ageMs > this.alertThresholds.longInactivity) {
            const hours = Math.round(agent.realMetrics.ageMs / (1000 * 60 * 60) * 100) / 100;
            alerts.push({
                type: 'long_inactivity',
                level: 'info',
                agent: agent.name,
                value: hours,
                threshold: this.alertThresholds.longInactivity / (1000 * 60 * 60),
                message: `Длительное бездействие: ${hours} часов`
            });
        }
        
        // Проверка на ошибки
        if (agent.status === 'error') {
            alerts.push({
                type: 'agent_error',
                level: 'error',
                agent: agent.name,
                message: `Агент в состоянии ошибки: ${agent.description || 'Неизвестная ошибка'}`
            });
        }
    }
    
    /**
     * Получение исторических данных для графиков
     * @param {number} hours - Количество часов истории
     * @returns {Object} Данные для графиков
     */
    getHistoricalData(hours = 24) {
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        
        const filtered = this.metricsHistory.filter(metric => 
            new Date(metric.timestamp) >= cutoffTime
        );
        
        // Подготовка данных для графиков
        const chartData = {
            timestamps: [],
            totalAgents: [],
            workingAgents: [],
            totalTokens: [],
            averageTokens: [],
            alerts: []
        };
        
        filtered.forEach(metric => {
            chartData.timestamps.push(new Date(metric.timestamp).toLocaleTimeString());
            chartData.totalAgents.push(metric.totalAgents);
            chartData.workingAgents.push(metric.byStatus.working || 0);
            chartData.totalTokens.push(metric.tokenUsage.total);
            chartData.averageTokens.push(Math.round(metric.tokenUsage.average));
            chartData.alerts.push(metric.alerts.length);
        });
        
        return {
            raw: filtered,
            charts: chartData,
            summary: {
                totalMetrics: filtered.length,
                timeRange: `${hours} часов`,
                totalAlerts: filtered.reduce((sum, metric) => sum + metric.alerts.length, 0),
                avgAgents: filtered.length > 0 ? 
                    Math.round(filtered.reduce((sum, metric) => sum + metric.totalAgents, 0) / filtered.length) : 0
            }
        };
    }
    
    /**
     * Получение статистики по workspace
     */
    getWorkspaceStats() {
        if (this.metricsHistory.length === 0) return {};
        
        const latest = this.metricsHistory[this.metricsHistory.length - 1];
        const workspaceStats = {};
        
        Object.entries(latest.byWorkspace).forEach(([workspace, count]) => {
            workspaceStats[workspace] = {
                count,
                percentage: Math.round((count / latest.totalAgents) * 100),
                agents: latest.tokenUsage.byAgent
                    .filter(agent => agent.workspace === workspace)
                    .slice(0, 3) // Топ-3 агента по токенам в workspace
            };
        });
        
        return workspaceStats;
    }
    
    /**
     * Получение сводки производительности
     */
    getPerformanceSummary() {
        if (this.metricsHistory.length === 0) return null;
        
        const latest = this.metricsHistory[this.metricsHistory.length - 1];
        const historical = this.getHistoricalData(24);
        
        return {
            current: {
                totalAgents: latest.totalAgents,
                workingAgents: latest.byStatus.working || 0,
                totalTokens: latest.tokenUsage.total,
                averageTokens: Math.round(latest.tokenUsage.average),
                activeAlerts: latest.alerts.length
            },
            trends: {
                agentGrowth: this.calculateTrend(historical.charts.totalAgents),
                tokenGrowth: this.calculateTrend(historical.charts.totalTokens),
                efficiencyTrend: this.calculateTrend(historical.charts.averageTokens)
            },
            recommendations: this.generateRecommendations(latest, historical)
        };
    }
    
    /**
     * Расчет тренда (рост/падение)
     */
    calculateTrend(data) {
        if (data.length < 2) return 0;
        
        const first = data[0];
        const last = data[data.length - 1];
        
        if (first === 0) return last > 0 ? 100 : 0;
        
        return Math.round(((last - first) / first) * 100);
    }
    
    /**
     * Генерация рекомендаций на основе анализа
     */
    generateRecommendations(currentMetrics, historicalData) {
        const recommendations = [];
        
        // Анализ использования токенов
        if (currentMetrics.tokenUsage.average > 50000) {
            recommendations.push({
                type: 'optimization',
                priority: 'high',
                title: 'Высокое среднее использование токенов',
                description: 'Рассмотрите оптимизацию промптов или использование более легких моделей',
                action: 'review_token_usage'
            });
        }
        
        // Анализ распределения по workspace
        const workspaceCount = Object.keys(currentMetrics.byWorkspace).length;
        if (workspaceCount > 5) {
            recommendations.push({
                type: 'organization',
                priority: 'medium',
                title: 'Много workspace',
                description: `Обнаружено ${workspaceCount} workspace. Рассмотрите консолидацию для лучшего управления`,
                action: 'consolidate_workspaces'
            });
        }
        
        // Анализ ошибок
        const errorAgents = currentMetrics.byStatus.error || 0;
        if (errorAgents > 0) {
            recommendations.push({
                type: 'maintenance',
                priority: 'high',
                title: 'Агенты с ошибками',
                description: `Обнаружено ${errorAgents} агентов в состоянии ошибки`,
                action: 'review_errors'
            });
        }
        
        // Анализ эффективности
        if (currentMetrics.efficiency.average < 100) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                title: 'Низкая средняя эффективность',
                description: 'Рассмотрите оптимизацию задач или перераспределение нагрузки',
                action: 'optimize_efficiency'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Сброс метрик (для тестирования)
     */
    resetMetrics() {
        this.metricsHistory = [];
        this.saveMetrics();
        console.log('Метрики сброшены');
    }
}

module.exports = AnalyticsEngine;