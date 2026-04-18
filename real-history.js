#!/usr/bin/env node
// Система для получения реальной истории активности из OpenClaw

const fs = require('fs');
const path = require('path');

class RealOpenClawHistory {
  constructor() {
    this.openclawDir = '/home/openclaw/.openclaw';
    this.sessionsDir = '/home/openclaw/.openclaw/agents/main/sessions';
    this.logsDir = '/home/openclaw/.openclaw/logs';
  }
  
  // Получить реальную историю из файлов сессий OpenClaw
  getRealActivityHistory(limit = 20) {
    try {
      console.log('Получение реальной истории из OpenClaw...');
      
      if (!fs.existsSync(this.sessionsDir)) {
        console.log('Директория сессий не найдена');
        return [];
      }
      
      // Получаем все файлы сессий
      const sessionFiles = fs.readdirSync(this.sessionsDir)
        .filter(file => file.endsWith('.jsonl') && !file.includes('.checkpoint.'))
        .map(file => path.join(this.sessionsDir, file));
      
      console.log(`Найдено ${sessionFiles.length} файлов сессий`);
      
      const allActivities = [];
      
      // Читаем каждую сессию
      for (const sessionFile of sessionFiles.slice(0, 10)) { // Ограничиваем для производительности
        try {
          const sessionActivities = this.parseSessionFile(sessionFile);
          allActivities.push(...sessionActivities);
        } catch (error) {
          console.log(`Ошибка чтения ${sessionFile}:`, error.message);
        }
      }
      
      // Сортируем по времени (новые сначала)
      allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Ограничиваем количество
      const limitedActivities = allActivities.slice(0, limit);
      
      console.log(`Получено ${limitedActivities.length} реальных записей истории`);
      return limitedActivities;
      
    } catch (error) {
      console.error('Ошибка получения реальной истории:', error.message);
      return [];
    }
  }
  
  // Парсинг файла сессии .jsonl
  parseSessionFile(sessionFile) {
    const activities = [];
    
    try {
      const content = fs.readFileSync(sessionFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      let sessionInfo = this.extractSessionInfo(sessionFile);
      
      // Парсим каждую строку как JSON
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          
          // Определяем тип активности на основе записи
          const activity = this.parseOpenClawEntry(entry, sessionInfo);
          if (activity) {
            activities.push(activity);
          }
        } catch (parseError) {
          // Пропускаем некорректные строки
        }
      }
      
    } catch (error) {
      console.log(`Ошибка парсинга ${sessionFile}:`, error.message);
    }
    
    return activities;
  }
  
  // Извлечение информации о сессии из имени файла
  extractSessionInfo(sessionFile) {
    const filename = path.basename(sessionFile, '.jsonl');
    const sessionId = filename;
    
    // Пытаемся получить информацию из sessions.json
    try {
      const sessionsFile = '/home/openclaw/.openclaw/agents/main/sessions/sessions.json';
      if (fs.existsSync(sessionsFile)) {
        const sessionsData = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
        
        // Ищем сессию по ID
        for (const [sessionKey, session] of Object.entries(sessionsData)) {
          if (session.sessionId === sessionId) {
            return {
              sessionId,
              sessionKey,
              agentId: sessionKey.split(':')[1] || 'main',
              sessionType: sessionKey.split(':')[2] || 'direct',
              channel: session.lastChannel || session.deliveryContext?.channel || 'unknown',
              model: session.model || 'unknown',
              updatedAt: session.updatedAt
            };
          }
        }
      }
    } catch (error) {
      // Если не получилось, используем базовую информацию
    }
    
    return {
      sessionId,
      agentId: 'main',
      sessionType: 'unknown',
      channel: 'unknown',
      model: 'unknown'
    };
  }
  
  // Парсинг записи OpenClaw JSONL
  parseOpenClawEntry(entry, sessionInfo) {
    // Определяем тип записи по полю 'type'
    const entryType = entry.type || 'unknown';
    
    let action = 'unknown';
    let agentName = 'Unknown';
    let details = {};
    let timestamp = entry.timestamp || new Date().toISOString();
    
    // Определяем имя агента
    if (sessionInfo.sessionType === 'telegram') {
      agentName = `Telegram Bot (${sessionInfo.channel})`;
    } else if (sessionInfo.sessionType === 'cron') {
      agentName = `Cron Agent (${sessionInfo.sessionId.substring(0, 8)})`;
    } else if (sessionInfo.sessionType === 'subagent') {
      agentName = `Sub-Agent (${sessionInfo.sessionId.substring(0, 8)})`;
    } else if (sessionInfo.agentId === 'main') {
      agentName = 'Клод (OpenClaw)';
    } else {
      agentName = `Agent ${sessionInfo.agentId}`;
    }
    
    // Обрабатываем разные типы записей OpenClaw
    switch (entryType) {
      case 'message':
        if (entry.message && entry.message.role === 'user') {
          action = 'message_received';
          const content = this.extractContent(entry.message.content);
          details = {
            content: this.sanitizeContent(content.substring(0, 150)) + '...',
            length: content.length,
            type: 'user_message',
            role: 'user'
          };
        } else if (entry.message && entry.message.role === 'assistant') {
          action = 'message_sent';
          const content = this.extractContent(entry.message.content);
          details = {
            content: this.sanitizeContent(content.substring(0, 150)) + '...',
            length: content.length,
            type: 'assistant_response',
            role: 'assistant'
          };
        }
        break;
        
      case 'tool_call':
        action = 'tool_executed';
        details = {
          toolName: entry.function?.name || 'unknown',
          arguments: entry.function?.arguments || {},
          type: 'tool_call'
        };
        break;
        
      case 'tool_result':
        action = 'tool_result';
        const resultContent = this.extractContent(entry.content);
        details = {
          content: this.sanitizeContent(resultContent.substring(0, 100)) + '...',
          length: resultContent.length,
          type: 'tool_result'
        };
        break;
        
      case 'session_start':
        action = 'session_started';
        details = {
          provider: entry.provider || 'unknown',
          modelId: entry.modelId || 'unknown',
          type: 'session_start'
        };
        break;
        
      case 'thinking':
        action = 'thinking';
        details = {
          level: entry.thinkingLevel || 'unknown',
          type: 'thinking'
        };
        break;
        
      default:
        // Для неизвестных типов пытаемся определить по содержимому
        if (entry.message) {
          return this.parseOpenClawEntry({
            type: 'message',
            ...entry
          }, sessionInfo);
        }
        return null;
    }
    
    // Создаем активность с улучшенным agentId для лучшего сопоставления
    // Формат: real_<base>_<type>_agent_<base>_<type>_<subtype>_<id>
    // Пример: real_main_telegram_agent_main_telegram_direct_602894445
    const agentIdParts = [
      'real',
      sessionInfo.agentId || 'main',
      sessionInfo.sessionType || 'unknown',
      'agent',
      sessionInfo.agentId || 'main',
      sessionInfo.sessionType || 'unknown',
      sessionInfo.channel || 'direct',
      sessionInfo.sessionId.substring(0, 8) || 'unknown'
    ];
    
    const fullAgentId = agentIdParts.join('_');
    
    return {
      id: `${sessionInfo.sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentId: fullAgentId,
      agentName,
      action,
      details,
      timestamp,
      source: 'real_openclaw',
      metadata: {
        sessionId: sessionInfo.sessionId,
        sessionType: sessionInfo.sessionType,
        channel: sessionInfo.channel,
        model: sessionInfo.model,
        dataSource: 'session_jsonl',
        entryType: entryType
      }
    };
  }
  
  // Получить статистику реальной активности
  getRealActivityStats() {
    try {
      const activities = this.getRealActivityHistory(100);
      
      const stats = {
        totalActivities: activities.length,
        byAction: {},
        byAgent: {},
        byHour: {},
        recentCount: 0
      };
      
      // Группируем по действиям
      activities.forEach(activity => {
        // По действию
        stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;
        
        // По агенту
        stats.byAgent[activity.agentName] = (stats.byAgent[activity.agentName] || 0) + 1;
        
        // По часу
        const hour = new Date(activity.timestamp).getHours();
        stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
        
        // Недавние (последние 24 часа)
        const ageMs = Date.now() - new Date(activity.timestamp).getTime();
        if (ageMs < 24 * 60 * 60 * 1000) {
          stats.recentCount++;
        }
      });
      
      // Сортируем
      stats.topAgents = Object.entries(stats.byAgent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
      
      stats.topActions = Object.entries(stats.byAction)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([action, count]) => ({ action, count }));
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        stats,
        sampleCount: activities.length
      };
      
    } catch (error) {
      console.error('Ошибка получения статистики:', error.message);
      return {
        success: false,
        error: error.message,
        stats: {}
      };
    }
  }
  
  // Извлечение контента из разных форматов OpenClaw
  extractContent(content) {
    if (!content) return '';
    
    // Если content это массив (например, [{type: 'text', text: '...'}]) 
    if (Array.isArray(content)) {
      return content
        .map(item => {
          if (item.type === 'text' && item.text) {
            return item.text;
          }
          return '';
        })
        .join(' ')
        .trim();
    }
    
    // Если content это строка
    if (typeof content === 'string') {
      return content;
    }
    
    // Если content это объект
    if (typeof content === 'object') {
      return JSON.stringify(content);
    }
    
    return String(content);
  }
  
  // Очистка контента от спецсимволов
  sanitizeContent(content) {
    if (!content) return '';
    return content
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, ' ')  // Удаляем управляющие символы
      .replace(/\s+/g, ' ')              // Множественные пробелы в один
      .trim();
  }
}

// Экспорт для использования в server-simple.js
module.exports = RealOpenClawHistory;

// Если запущен напрямую
if (require.main === module) {
  const history = new RealOpenClawHistory();
  
  console.log('🚀 Тестирование реальной истории OpenClaw');
  console.log('========================================');
  
  // Тестируем получение истории
  const activities = history.getRealActivityHistory(10);
  
  if (activities.length > 0) {
    console.log(`\n📜 РЕАЛЬНАЯ ИСТОРИЯ АКТИВНОСТИ (${activities.length} записей):`);
    
    activities.forEach((activity, index) => {
      console.log(`\n${index + 1}. ${activity.agentName}`);
      console.log(`   Действие: ${activity.action}`);
      console.log(`   Время: ${new Date(activity.timestamp).toLocaleString()}`);
      console.log(`   Источник: ${activity.source}`);
      
      if (activity.details && Object.keys(activity.details).length > 0) {
        console.log(`   Детали: ${JSON.stringify(activity.details)}`);
      }
    });
    
    // Тестируем статистику
    console.log('\n📊 СТАТИСТИКА РЕАЛЬНОЙ АКТИВНОСТИ:');
    const stats = history.getRealActivityStats();
    
    if (stats.success) {
      console.log(`   Всего записей: ${stats.stats.totalActivities}`);
      console.log(`   За последние 24 часа: ${stats.stats.recentCount}`);
      
      console.log('\n   Топ агентов:');
      stats.stats.topAgents.forEach((agent, i) => {
        console.log(`     ${i + 1}. ${agent.name}: ${agent.count} действий`);
      });
      
      console.log('\n   Топ действий:');
      stats.stats.topActions.forEach((action, i) => {
        console.log(`     ${i + 1}. ${action.action}: ${action.count} раз`);
      });
    }
    
  } else {
    console.log('❌ Реальная история не найдена');
  }
}