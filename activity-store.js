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
  
  // Получить активность агента (ТОЛЬКО реальные данные из OpenClaw)
  getAgentActivity(agentId, limit = 20) {
    try {
      // Получаем ТОЛЬКО реальные данные из OpenClaw
      const realActivities = this.realHistory.getRealActivityHistory(limit * 3);
      
      if (realActivities.length === 0) {
        console.log(`Нет реальных данных в OpenClaw для любого агента`);
        return [];
      }
      
      // Фильтруем для конкретного агента
      const agentRealActivities = realActivities.filter(activity => {
        // 1. Прямое совпадение ID
        if (activity.agentId === agentId) {
          return true;
        }
        
        // 2. Совпадение по имени агента
        const agentName = activity.agentName || '';
        if (agentName.toLowerCase().includes(agentId.toLowerCase())) {
          return true;
        }
        
        // 3. Для реальных агентов OpenClaw: улучшенное сопоставление
        if (agentId.startsWith('real_')) {
          // Извлекаем компоненты из ID агента
          const agentParts = agentId.split('_');
          // Пример: real_main_telegram_agent_main_telegram_direct_602894445
          // Части: ['real', 'main', 'telegram', 'agent', 'main', 'telegram', 'direct', '602894445']
          
          // Извлекаем базовые компоненты
          const agentBase = agentParts[1]; // 'main'
          const agentType = agentParts[2]; // 'telegram', 'subagent', 'main', etc.
          
          // Извлекаем компоненты из ID активности
          const activityParts = activity.agentId ? activity.agentId.split('_') : [];
          const activityBase = activityParts.length > 1 ? activityParts[1] : '';
          const activityType = activityParts.length > 2 ? activityParts[2] : '';
          
          // Сопоставляем по базе и типу
          if (agentBase && activityBase && agentBase === activityBase) {
            // Если тип агента совпадает с типом активности
            if (agentType && activityType && agentType === activityType) {
              return true;
            }
            
            // Для main агента: показываем все активности main
            if (agentType === 'main' && activityType === 'main') {
              return true;
            }
            
            // Для telegram агента: показываем все telegram активности
            if (agentType === 'telegram' && activityType === 'telegram') {
              return true;
            }
            
            // Для subagent агента: показываем все subagent активности
            if (agentType === 'subagent' && activityType === 'subagent') {
              return true;
            }
          }
        }
        
        // 4. Для Telegram агентов
        const agentMetadata = activity.metadata || {};
        if (agentMetadata.channel === 'telegram' && agentId.includes('telegram')) {
          return true;
        }
        
        return false;
      });
      
      if (agentRealActivities.length > 0) {
        console.log(`Используем ${agentRealActivities.length} реальных записей для агента ${agentId}`);
        return agentRealActivities.slice(0, limit);
      }
      
      // Если для этого агента нет реальных данных - пустой массив
      console.log(`Нет реальных данных для агента ${agentId}`);
      return [];
        
    } catch (error) {
      console.error(`Ошибка получения реальной истории для агента ${agentId}:`, error);
      return [];
    }
  }
  
  // Получить недавнюю активность (ТОЛЬКО реальные данные из OpenClaw)
  getRecentActivity(limit = 20) {
    try {
      // Получаем ТОЛЬКО реальные данные из OpenClaw
      const realActivities = this.realHistory.getRealActivityHistory(limit);
      
      if (realActivities.length > 0) {
        console.log(`Используем ${realActivities.length} реальных записей истории из OpenClaw`);
        return realActivities;
      }
      
      // Если реальных данных нет - пустой массив (НЕТ демо)
      console.log('Нет реальных данных в OpenClaw');
      return [];
        
    } catch (error) {
      console.error('Ошибка получения реальной истории:', error);
      return [];
    }
  }
  
  // Получить статистику активности (ТОЛЬКО реальные данные из OpenClaw)
  getActivityStats() {
    try {
      // Получаем ТОЛЬКО реальную статистику из OpenClaw
      const realStats = this.realHistory.getRealActivityStats();
      
      if (realStats.success && realStats.stats.totalActivities > 0) {
        console.log('Используем реальную статистику из OpenClaw');
        return {
          source: 'real_openclaw',
          timestamp: realStats.timestamp,
          ...realStats.stats
        };
      }
      
      // Если реальных данных нет - пустая статистика (НЕТ демо)
      console.log('Нет реальной статистики в OpenClaw');
      return {
        source: 'real_openclaw_empty',
        totalActivities: 0,
        byAgent: {},
        byAction: {},
        recent24h: 0,
        topAgents: [],
        topActions: []
      };
      
    } catch (error) {
      console.error('Ошибка получения реальной статистики:', error);
      return {
        source: 'error',
        totalActivities: 0,
        byAgent: {},
        byAction: {},
        recent24h: 0,
        topAgents: [],
        topActions: []
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