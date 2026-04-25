const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const ANALYTICS_DATA_PATH = path.join(__dirname, 'data', 'analytics.json');

// Создаем директорию для данных, если её нет
fs.ensureDirSync(path.join(__dirname, 'data'));

class AnalyticsModule {
  constructor() {
    this.hourlyData = {};
    this.dailyData = {};
    this.loadHistoricalData();
    console.log('AnalyticsModule initialized');
  }

  // Загрузка исторических данных
  loadHistoricalData() {
    try {
      if (fs.existsSync(ANALYTICS_DATA_PATH)) {
        const data = fs.readJsonSync(ANALYTICS_DATA_PATH);
        this.hourlyData = data.hourlyData || {};
        this.dailyData = data.dailyData || {};
        console.log(`Analytics data loaded: ${Object.keys(this.hourlyData).length} hourly points, ${Object.keys(this.dailyData).length} daily points`);
      } else {
        console.log('No existing analytics data found, starting fresh');
      }
    } catch (err) {
      console.error('Error loading analytics data:', err.message);
      this.hourlyData = {};
      this.dailyData = {};
    }
  }

  // Сохранение данных
  saveData() {
    try {
      const data = {
        hourlyData: this.hourlyData,
        dailyData: this.dailyData,
        lastUpdated: new Date().toISOString()
      };
      fs.writeJsonSync(ANALYTICS_DATA_PATH, data, { spaces: 2 });
    } catch (err) {
      console.error('Error saving analytics data:', err.message);
    }
  }

  // Сбор данных из сессий
  async collectData(agents) {
    try {
      const now = new Date();
      const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

      // Получаем системные метрики
      const systemMetrics = this.getSystemMetrics();
      
      // Анализируем агентов
      const agentMetrics = this.analyzeAgents(agents);

      // Сохраняем часовые данные (только если еще нет данных за этот час)
      if (!this.hourlyData[hourKey]) {
        this.hourlyData[hourKey] = {
          timestamp: now.toISOString(),
          agentCount: agents.length,
          workingAgents: agents.filter(a => a.status === 'working').length,
          idleAgents: agents.filter(a => a.status === 'idle').length,
          sleepingAgents: agents.filter(a => a.status === 'sleeping').length,
          errorAgents: agents.filter(a => a.status === 'error').length,
          totalTokens: agentMetrics.totalTokens,
          avgTokensPerAgent: agentMetrics.avgTokensPerAgent,
          system: systemMetrics,
          topAgentsByTokens: agentMetrics.topAgentsByTokens.slice(0, 5)
        };

        // Сохраняем дневные агрегации
        this.updateDailyAggregation(dayKey, this.hourlyData[hourKey]);

        // Сохраняем данные
        this.saveData();

        // Очищаем старые данные (храним 7 дней)
        this.cleanupOldData();
      }

      return {
        current: this.hourlyData[hourKey] || this.getEmptyHourlyData(now),
        hourly: this.getHourlyData(24),
        daily: this.getDailyData(7),
        system: systemMetrics,
        alerts: this.generateAlerts(agents, systemMetrics)
      };
    } catch (err) {
      console.error('Error in collectData:', err.message);
      const now = new Date();
      return {
        current: this.getEmptyHourlyData(now),
        hourly: this.getHourlyData(24),
        daily: this.getDailyData(7),
        system: this.getSystemMetrics(),
        alerts: []
      };
    }
  }

  // Пустые часовые данные
  getEmptyHourlyData(timestamp) {
    return {
      timestamp: timestamp.toISOString(),
      agentCount: 0,
      workingAgents: 0,
      idleAgents: 0,
      sleepingAgents: 0,
      errorAgents: 0,
      totalTokens: 0,
      avgTokensPerAgent: 0,
      system: this.getSystemMetrics(),
      topAgentsByTokens: []
    };
  }

  // Анализ агентов
  analyzeAgents(agents) {
    try {
      const totalTokens = agents.reduce((sum, agent) => {
        return sum + (agent.realMetrics?.totalTokens || 0);
      }, 0);

      const avgTokensPerAgent = agents.length > 0 ? Math.round(totalTokens / agents.length) : 0;

      // Топ агентов по использованию токенов
      const topAgentsByTokens = agents
        .filter(agent => agent.realMetrics?.totalTokens)
        .sort((a, b) => (b.realMetrics.totalTokens || 0) - (a.realMetrics.totalTokens || 0))
        .map(agent => ({
          id: agent.id,
          name: agent.name,
          tokens: agent.realMetrics.totalTokens,
          status: agent.status
        }));

      return {
        totalTokens,
        avgTokensPerAgent,
        topAgentsByTokens
      };
    } catch (err) {
      console.error('Error in analyzeAgents:', err.message);
      return {
        totalTokens: 0,
        avgTokensPerAgent: 0,
        topAgentsByTokens: []
      };
    }
  }

  // Получение системных метрик
  getSystemMetrics() {
    try {
      return {
        cpu: {
          loadAvg: os.loadavg(),
          cores: os.cpus().length,
          usage: process.cpuUsage()
        },
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usagePercent: Math.round((1 - os.freemem() / os.totalmem()) * 100)
        },
        uptime: os.uptime(),
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error('Error getting system metrics:', err.message);
      return {
        cpu: { loadAvg: [0, 0, 0], cores: 0, usage: { user: 0, system: 0 } },
        memory: { total: 0, free: 0, used: 0, usagePercent: 0 },
        uptime: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Обновление дневных агрегаций
  updateDailyAggregation(dayKey, hourlyData) {
    try {
      if (!this.dailyData[dayKey]) {
        this.dailyData[dayKey] = {
          date: dayKey,
          hourlyPoints: 0,
          maxAgents: 0,
          minAgents: Infinity,
          totalTokens: 0,
          avgWorkingAgents: 0,
          systemMetrics: []
        };
      }

      const daily = this.dailyData[dayKey];
      daily.hourlyPoints++;
      daily.maxAgents = Math.max(daily.maxAgents, hourlyData.agentCount);
      daily.minAgents = Math.min(daily.minAgents, hourlyData.agentCount);
      daily.totalTokens += hourlyData.totalTokens;
      daily.avgWorkingAgents = ((daily.avgWorkingAgents * (daily.hourlyPoints - 1)) + hourlyData.workingAgents) / daily.hourlyPoints;
      
      // Сохраняем системные метрики для этого часа
      daily.systemMetrics.push({
        timestamp: hourlyData.timestamp,
        cpuLoad: hourlyData.system.cpu.loadAvg[0],
        memoryUsage: hourlyData.system.memory.usagePercent
      });

      // Ограничиваем количество метрик
      if (daily.systemMetrics.length > 24) {
        daily.systemMetrics = daily.systemMetrics.slice(-24);
      }
    } catch (err) {
      console.error('Error in updateDailyAggregation:', err.message);
    }
  }

  // Получение часовых данных
  getHourlyData(hours = 24) {
    try {
      const now = new Date();
      const result = [];
      
      for (let i = hours - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourKey = time.toISOString().slice(0, 13);
        
        if (this.hourlyData[hourKey]) {
          result.push(this.hourlyData[hourKey]);
        } else {
          // Заполняем пропущенные данные
          result.push({
            timestamp: time.toISOString(),
            agentCount: 0,
            workingAgents: 0,
            idleAgents: 0,
            sleepingAgents: 0,
            errorAgents: 0,
            totalTokens: 0,
            avgTokensPerAgent: 0,
            system: { cpu: { loadAvg: [0, 0, 0] }, memory: { usagePercent: 0 } }
          });
        }
      }
      
      return result;
    } catch (err) {
      console.error('Error in getHourlyData:', err.message);
      return [];
    }
  }

  // Получение дневных данных
  getDailyData(days = 7) {
    try {
      const result = [];
      const now = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayKey = date.toISOString().slice(0, 10);
        
        if (this.dailyData[dayKey]) {
          result.push(this.dailyData[dayKey]);
        } else {
          // Заполняем пропущенные данные
          result.push({
            date: dayKey,
            hourlyPoints: 0,
            maxAgents: 0,
            minAgents: 0,
            totalTokens: 0,
            avgWorkingAgents: 0,
            systemMetrics: []
          });
        }
      }
      
      return result;
    } catch (err) {
      console.error('Error in getDailyData:', err.message);
      return [];
    }
  }

  // Генерация алертов
  generateAlerts(agents, systemMetrics) {
    try {
      const alerts = [];

      // Проверка на высокую загрузку CPU
      if (systemMetrics.cpu.loadAvg[0] > 2.0) {
        alerts.push({
          type: 'warning',
          level: 'high',
          message: `Высокая загрузка CPU: ${systemMetrics.cpu.loadAvg[0].toFixed(2)}`,
          timestamp: new Date().toISOString()
        });
      }

      // Проверка на высокое использование памяти
      if (systemMetrics.memory.usagePercent > 85) {
        alerts.push({
          type: 'critical',
          level: 'high',
          message: `Высокое использование памяти: ${systemMetrics.memory.usagePercent}%`,
          timestamp: new Date().toISOString()
        });
      }

      // Проверка на агентов с ошибками
      const errorAgents = agents.filter(a => a.status === 'error');
      if (errorAgents.length > 0) {
        alerts.push({
          type: 'error',
          level: 'medium',
          message: `${errorAgents.length} агентов в состоянии ошибки`,
          agents: errorAgents.map(a => a.name),
          timestamp: new Date().toISOString()
        });
      }

      // Проверка на неактивных агентов
      const inactiveAgents = agents.filter(a => a.status === 'sleeping' || a.status === 'idle');
      if (inactiveAgents.length > agents.length * 0.8 && agents.length > 0) {
        alerts.push({
          type: 'warning',
          level: 'low',
          message: `Большинство агентов неактивны (${inactiveAgents.length}/${agents.length})`,
          timestamp: new Date().toISOString()
        });
      }

      return alerts;
    } catch (err) {
      console.error('Error in generateAlerts:', err.message);
      return [];
    }
  }

  // Очистка старых данных
  cleanupOldData() {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Очищаем часовые данные старше недели
      Object.keys(this.hourlyData).forEach(key => {
        const date = new Date(key + ':00:00.000Z'); // Добавляем время для корректного парсинга
        if (date < weekAgo) {
          delete this.hourlyData[key];
        }
      });

      // Очищаем дневные данные старше 30 дней
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      Object.keys(this.dailyData).forEach(key => {
        const date = new Date(key + 'T00:00:00.000Z');
        if (date < monthAgo) {
          delete this.dailyData[key];
        }
      });
    } catch (err) {
      console.error('Error in cleanupOldData:', err.message);
    }
  }

  // Получение сводки аналитики
  getAnalyticsSummary() {
    try {
      const hourly = this.getHourlyData(24);
      const daily = this.getDailyData(7);
      
      if (hourly.length < 2) {
        return {
          summary: {
            currentAgents: 0,
            agentTrend: 0,
            currentTokens: 0,
            tokenTrend: 0,
            systemLoad: 0,
            memoryUsage: 0
          },
          hourly,
          daily
        };
      }
      
      // Рассчитываем тренды
      const currentHour = hourly[hourly.length - 1];
      const previousHour = hourly[hourly.length - 2];
      
      const agentTrend = currentHour.agentCount - previousHour.agentCount;
      const tokenTrend = currentHour.totalTokens - previousHour.totalTokens;
      
      return {
        summary: {
          currentAgents: currentHour.agentCount,
          agentTrend,
          currentTokens: currentHour.totalTokens,
          tokenTrend,
          systemLoad: currentHour.system.cpu.loadAvg[0],
          memoryUsage: currentHour.system.memory.usagePercent
        },
        hourly,
        daily
      };
    } catch (err) {
      console.error('Error in getAnalyticsSummary:', err.message);
      return {
        summary: {
          currentAgents: 0,
          agentTrend: 0,
          currentTokens: 0,
          tokenTrend: 0,
          systemLoad: 0,
          memoryUsage: 0
        },
        hourly: [],
        daily: []
      };
    }
  }
}

module.exports = AnalyticsModule;