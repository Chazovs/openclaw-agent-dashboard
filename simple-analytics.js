// Упрощенная версия analytics-module для тестирования

class SimpleAnalytics {
    constructor() {
        this.hourlyData = {};
        this.dailyData = {};
        console.log('SimpleAnalytics initialized');
    }

    async collectData(agents) {
        console.log('Collecting data for', agents.length, 'agents');
        
        const now = new Date();
        const hourKey = now.toISOString().slice(0, 13);
        
        // Простые метрики
        const working = agents.filter(a => a.status === 'working').length;
        const idle = agents.filter(a => a.status === 'idle').length;
        const sleeping = agents.filter(a => a.status === 'sleeping').length;
        const error = agents.filter(a => a.status === 'error').length;
        
        const totalTokens = agents.reduce((sum, agent) => {
            return sum + (agent.realMetrics?.totalTokens || 0);
        }, 0);
        
        this.hourlyData[hourKey] = {
            timestamp: now.toISOString(),
            agentCount: agents.length,
            workingAgents: working,
            idleAgents: idle,
            sleepingAgents: sleeping,
            errorAgents: error,
            totalTokens: totalTokens,
            avgTokensPerAgent: agents.length > 0 ? Math.round(totalTokens / agents.length) : 0
        };
        
        return {
            current: this.hourlyData[hourKey],
            hourly: this.getHourlyData(24),
            daily: this.getDailyData(7),
            alerts: [],
            system: {
                cpu: { loadAvg: [0.5, 0.4, 0.3] },
                memory: { usagePercent: 50 },
                uptime: 1000,
                timestamp: now.toISOString()
            }
        };
    }

    getHourlyData(hours) {
        const data = [];
        for (let i = 0; i < hours; i++) {
            data.push({
                timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
                agentCount: Math.floor(Math.random() * 10) + 1,
                workingAgents: Math.floor(Math.random() * 5) + 1,
                totalTokens: Math.floor(Math.random() * 10000) + 1000
            });
        }
        return data.reverse();
    }

    getDailyData(days) {
        const data = [];
        for (let i = 0; i < days; i++) {
            data.push({
                date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                maxAgents: Math.floor(Math.random() * 15) + 5,
                avgWorkingAgents: Math.floor(Math.random() * 8) + 2,
                totalTokens: Math.floor(Math.random() * 50000) + 10000
            });
        }
        return data.reverse();
    }

    getAnalyticsSummary() {
        return {
            summary: {
                currentAgents: 5,
                agentTrend: 1,
                currentTokens: 15000,
                tokenTrend: 500,
                systemLoad: 0.5,
                memoryUsage: 50
            },
            hourly: this.getHourlyData(24),
            daily: this.getDailyData(7)
        };
    }
}

module.exports = SimpleAnalytics;