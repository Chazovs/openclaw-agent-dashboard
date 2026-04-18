// Система хранения истории активности агентов с РЕАЛЬНЫМИ данными из OpenClaw
const fs = require('fs');
const path = require('path');
const RealOpenClawHistory = require('./real-history');

class ActivityStore {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.ensureDataDir();
    this.loadData();
    this.realHistory = new RealOpenClawHistory();
  }
  
  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }
  
  loadData() {
    try {
      const dataFile = path.join(this.dataDir, 'activity.json');
      if (fs.existsSync(dataFile)) {
        const rawData = fs.readFileSync(dataFile, 'utf8');
        this.activities = JSON.parse(rawData);
      } else {
        this.activities = {};
        this.saveData();
      }
    } catch (err) {
      console.error('Error loading activity data:', err);
      this.activities = {};
    }
  }
  
  saveData() {
    try {
      const dataFile = path.join(this.dataDir, 'activity.json');
      fs.writeFileSync(dataFile, JSON.stringify(this.activities, null, 2), 'utf8');
    } catch (err) {
      console.error('Error saving activity data:', err);
    }
  }
  
  // Добавить активность для агента (для демо-данных)
  addActivity(agentId, activity) {
    if (!this.activities[agentId]) {
      this.activities[agentId] = [];
    }
    
    const activityEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      agentId,
      agentName: activity.agentName || 'Unknown',
      action: activity.action || 'unknown',
      details: activity.details || {},
      timestamp: activity.timestamp || new Date().toISOString(),
      source: activity.source || 'dashboard'
    };
    
    this.activities[agentId].push(activityEntry);
    
    // Ограничиваем историю для каждого агента (макс 100 записей)
    if (this.activities[agentId].length > 100) {
      this.activities[agentId] = this.activities[agentId].slice(-100);
    }
    
    this.saveData();
    return activityEntry;
  }
  
  // Получить активность агента (РЕАЛЬНЫЕ данные из OpenClaw)
  getAgentActivity(agentId, limit = 20) {
    try {
      // Пытаемся получить РЕАЛЬНЫЕ данные для этого агента
      const realActivities = this.realHistory.getRealActivityHistory(limit * 2);
      
      // Фильтруем по agentId
      const agentRealActivities = realActivities.filter(activity => 
        activity.agentId === agentId || 
        activity.agentName.toLowerCase().includes(agentId.toLowerCase())
      );
      
      if (agentRealActivities.length > 0) {
        console.log(`Используем ${agentRealActivities.length} реальных записей для агента ${agentId}`);
        return agentRealActivities.slice(0, limit);
      }
      
      // Если реальных данных нет, используем демо
      console.log(`Нет реальных данных для агента ${agentId}, используем демо`);
      return this.activities[agentId] ? 
        this.activities[agentId].slice(-limit).reverse() : 
        [];
        
    } catch (error) {
      console.error(`Ошибка получения реальной истории для агента ${agentId}:`, error);
      return this.activities[agentId] ? 
        this.activities[agentId].slice(-limit).reverse() : 
        [];
    }
  }
  
  // Получить недавнюю активность (РЕАЛЬНЫЕ данные из OpenClaw)
  getRecentActivity(limit = 20) {
    try {
      // Пытаемся получить РЕАЛЬНЫЕ данные из OpenClaw
      const realActivities = this.realHistory.getRealActivityHistory(limit);
      
      if (realActivities.length > 0) {
        console.log(`Используем ${realActivities.length} реальных записей истории из OpenClaw`);
        return realActivities;
      }
      
      // Если реальных данных нет, используем демо
      console.log('Нет реальных данных, используем демо историю');
      const allActivities = [];
      
      for (const agentId in this.activities) {
        const agentActivities = this.activities[agentId];
        if (agentActivities && agentActivities.length > 0) {
          const latest = agentActivities[agentActivities.length - 1];
          allActivities.push({
            agentId,
            ...latest
          });
        }
      }
      
      // Сортируем по времени (новые сначала)
      return allActivities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
        
    } catch (error) {
      console.error('Ошибка получения реальной истории:', error);
      // Fallback на пустой массив
      return [];
    }
  }
  
  // Получить статистику активности (РЕАЛЬНЫЕ данные из OpenClaw)
  getActivityStats() {
    try {
      // Пытаемся получить РЕАЛЬНУЮ статистику из OpenClaw
      const realStats = this.realHistory.getRealActivityStats();
      
      if (realStats.success && realStats.stats.totalActivities > 0) {
        console.log('Используем реальную статистику из OpenClaw');
        return {
          source: 'real_openclaw',
          timestamp: realStats.timestamp,
          ...realStats.stats
        };
      }
      
      // Если реальных данных нет, используем демо
      console.log('Нет реальной статистики, используем демо');
      const allActivities = [];
      
      for (const agentId in this.activities) {
        const agentActivities = this.activities[agentId];
        if (agentActivities && agentActivities.length > 0) {
          agentActivities.forEach(activity => {
            allActivities.push({
              agentId,
              ...activity
            });
          });
        }
      }
      
      const stats = {
        source: 'demo',
        totalActivities: allActivities.length,
        byAgent: {},
        byAction: {},
        recent24h: 0
      };
      
      allActivities.forEach(activity => {
        stats.byAgent[activity.agentName] = (stats.byAgent[activity.agentName] || 0) + 1;
        stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;
        
        const ageMs = Date.now() - new Date(activity.timestamp).getTime();
        if (ageMs < 24 * 60 * 60 * 1000) {
          stats.recent24h++;
        }
      });
      
      stats.topAgents = Object.entries(stats.byAgent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
      
      stats.topActions = Object.entries(stats.byAction)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([action, count]) => ({ action, count }));
      
      return stats;
      
    } catch (error) {
      console.error('Ошибка получения реальной статистики:', error);
      return {
        source: 'error',
        totalActivities: 0,
        byAgent: {},
        byAction: {},
        recent24h: 0
      };
    }
  }
  
  // Очистить историю агента
  clearAgentActivity(agentId) {
    if (this.activities[agentId]) {
      delete this.activities[agentId];
      this.saveData();
      return true;
    }
    return false;
  }
  
  // Очистить всю историю
  clearAllActivity() {
    this.activities = {};
    this.saveData();
    return true;
  }
}

module.exports = ActivityStore;