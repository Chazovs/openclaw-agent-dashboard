// Система хранения истории активности агентов
const fs = require('fs');
const path = require('path');

class ActivityStore {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.ensureDataDir();
    this.loadData();
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
  
  // Добавить активность для агента
  addActivity(agentId, activity) {
    if (!this.activities[agentId]) {
      this.activities[agentId] = [];
    }
    
    const activityEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      status: activity.status || 'unknown',
      task: activity.task || 'Unknown task',
      duration: activity.duration || 0,
      details: activity.details || {},
      source: activity.source || 'system'
    };
    
    this.activities[agentId].push(activityEntry);
    
    // Храним только последние 100 записей на агента
    if (this.activities[agentId].length > 100) {
      this.activities[agentId] = this.activities[agentId].slice(-100);
    }
    
    this.saveData();
    return activityEntry;
  }
  
  // Получить историю активности агента
  getAgentActivity(agentId, limit = 50) {
    if (!this.activities[agentId]) {
      return [];
    }
    
    // Сортируем по времени (новые сначала)
    const activities = [...this.activities[agentId]]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    
    return activities;
  }
  
  // Получить последнюю активность всех агентов
  getRecentActivity(limit = 20) {
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
  
  // Получить статистику активности
  getActivityStats() {
    const stats = {
      totalAgents: Object.keys(this.activities).length,
      totalActivities: 0,
      activitiesByStatus: {},
      recentActivityCount: 0
    };
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    for (const agentId in this.activities) {
      const agentActivities = this.activities[agentId];
      stats.totalActivities += agentActivities.length;
      
      // Активности за последние 24 часа
      const recent = agentActivities.filter(a => new Date(a.timestamp) > oneDayAgo);
      stats.recentActivityCount += recent.length;
      
      // Статистика по статусам
      agentActivities.forEach(activity => {
        if (!stats.activitiesByStatus[activity.status]) {
          stats.activitiesByStatus[activity.status] = 0;
        }
        stats.activitiesByStatus[activity.status]++;
      });
    }
    
    return stats;
  }
}

module.exports = ActivityStore;