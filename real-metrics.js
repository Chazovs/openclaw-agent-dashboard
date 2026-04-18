#!/usr/bin/env node
// Скрипт для получения реальных метрик OpenClaw

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class RealOpenClawMetrics {
  constructor() {
    this.openclawDir = '/home/openclaw/.openclaw';
    this.sessionsFile = '/home/openclaw/.openclaw/agents/main/sessions/sessions.json';
    
    // Проверяем существование файла
    const fs = require('fs');
    if (!fs.existsSync(this.sessionsFile)) {
      console.log(`Файл не существует: ${this.sessionsFile}`);
      // Альтернативный путь
      this.sessionsFile = '/home/openclaw/.openclaw/agents/main/sessions/sessions.json';
    }
  }
  
  // Получить реальные сессии OpenClaw
  getRealSessions() {
    try {
      if (!fs.existsSync(this.sessionsFile)) {
        console.log('Файл сессий не найден');
        return { sessions: {} };
      }
      
      // Читаем файл с реальными данными
      const content = fs.readFileSync(this.sessionsFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Ошибка чтения сессий:', error.message);
      return { sessions: {} };
    }
  }
  
  // Получить реальные метрики системы
  getSystemMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        cpu: this.getCpuUsage(),
        memory: this.getMemoryUsage(),
        disk: this.getDiskUsage(),
        processes: this.getOpenClawProcesses(),
        network: this.getNetworkStats()
      };
      
      return metrics;
    } catch (error) {
      console.error('Ошибка получения метрик системы:', error.message);
      return {};
    }
  }
  
  // Использование CPU
  getCpuUsage() {
    try {
      const cpuInfo = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'", { encoding: 'utf8' }).trim();
      return parseFloat(cpuInfo) || 0;
    } catch {
      return 0;
    }
  }
  
  // Использование памяти
  getMemoryUsage() {
    try {
      const memInfo = execSync("free -m | awk 'NR==2{printf \"%.2f\", $3*100/$2}'", { encoding: 'utf8' }).trim();
      return parseFloat(memInfo) || 0;
    } catch {
      return 0;
    }
  }
  
  // Использование диска
  getDiskUsage() {
    try {
      const diskInfo = execSync("df -h /home | awk 'NR==2{print $5}'", { encoding: 'utf8' }).trim();
      return diskInfo.replace('%', '');
    } catch {
      return '0%';
    }
  }
  
  // Процессы OpenClaw
  getOpenClawProcesses() {
    try {
      const processes = execSync("ps aux | grep -E '(openclaw|node.*openclaw)' | grep -v grep | wc -l", { encoding: 'utf8' }).trim();
      return parseInt(processes) || 0;
    } catch {
      return 0;
    }
  }
  
  // Статистика сети
  getNetworkStats() {
    try {
      const connections = execSync("ss -tun | wc -l", { encoding: 'utf8' }).trim();
      return {
        connections: parseInt(connections) - 1 || 0,
        gatewayPort: 18789,
        dashboardPort: 3000
      };
    } catch {
      return { connections: 0 };
    }
  }
  
  // Преобразовать реальные сессии в агентов
  sessionsToRealAgents(sessionsData) {
    const realAgents = [];
    
    if (!sessionsData.sessions || typeof sessionsData.sessions !== 'object') {
      return realAgents;
    }
    
    // Обрабатываем каждую сессию
    for (const [sessionKey, session] of Object.entries(sessionsData.sessions)) {
      try {
        // Извлекаем информацию о сессии
        const agentId = this.extractAgentId(sessionKey);
        const sessionType = this.extractSessionType(sessionKey);
        
        // Определяем статус на основе реальных данных
        let status = 'unknown';
        if (session.status === 'running') {
          status = 'working';
        } else if (session.abortedLastRun) {
          status = 'error';
        } else {
          // Определяем по времени последнего обновления
          const ageMs = Date.now() - session.updatedAt;
          if (ageMs < 5 * 60 * 1000) { // 5 минут
            status = 'working';
          } else if (ageMs < 60 * 60 * 1000) { // 1 час
            status = 'idle';
          } else {
            status = 'sleeping';
          }
        }
        
        // Получаем реальные метрики сессии
        const sessionMetrics = {
          inputTokens: session.inputTokens || 0,
          outputTokens: session.outputTokens || 0,
          totalTokens: session.totalTokens || 0,
          model: session.model || 'unknown',
          modelProvider: session.modelProvider || 'unknown',
          contextTokens: session.contextTokens || 0,
          updatedAt: new Date(session.updatedAt).toISOString(),
          ageMs: Date.now() - session.updatedAt
        };
        
        // Создаем реального агента
        const realAgent = {
          id: `real_${agentId}_${sessionType}`,
          name: this.getRealAgentName(agentId, sessionType, session),
          emoji: this.getRealAgentEmoji(agentId, sessionType),
          status,
          sprite: this.getRealStatusSprite(status),
          workspace: this.getRealWorkspace(sessionType),
          lastSeen: new Date(session.updatedAt).toISOString(),
          description: this.getRealDescription(agentId, sessionType, session),
          realMetrics: sessionMetrics,
          metadata: {
            source: 'real_openclaw',
            agentId,
            sessionType,
            sessionKey,
            sessionId: session.sessionId,
            channel: session.lastChannel || session.deliveryContext?.channel || 'unknown',
            origin: session.origin?.provider || 'unknown'
          }
        };
        
        realAgents.push(realAgent);
        
      } catch (error) {
        console.log(`Ошибка обработки сессии ${sessionKey}:`, error.message);
      }
    }
    
    return realAgents;
  }
  
  // Извлечь ID агента из ключа сессии
  extractAgentId(sessionKey) {
    const parts = sessionKey.split(':');
    return parts[1] || 'main'; // agent:main:telegram:direct:602894445
  }
  
  // Извлечь тип сессии
  extractSessionType(sessionKey) {
    const parts = sessionKey.split(':');
    if (parts[2] === 'telegram') return 'telegram';
    if (parts[2] === 'cron') return 'cron';
    if (parts[2] === 'subagent') return 'subagent';
    if (parts[2] === 'main') return 'main';
    return parts[2] || 'direct';
  }
  
  // Получить реальное имя агента
  getRealAgentName(agentId, sessionType, session) {
    const names = {
      'main': 'Клод (OpenClaw)',
      'telegram': 'Telegram Bot',
      'cron': 'Cron Agent',
      'subagent': 'Sub-Agent',
      'direct': 'Direct Session'
    };
    
    const baseName = names[sessionType] || `Agent ${sessionType}`;
    
    // Добавляем информацию о канале если есть
    if (session.lastChannel) {
      return `${baseName} (${session.lastChannel})`;
    }
    
    return baseName;
  }
  
  // Получить emoji для реального агента
  getRealAgentEmoji(agentId, sessionType) {
    const emojis = {
      'main': '🧠',
      'telegram': '📱',
      'cron': '⏰',
      'subagent': '🔄',
      'direct': '💬'
    };
    
    return emojis[sessionType] || '🤖';
  }
  
  // Получить спрайт для реального статуса
  getRealStatusSprite(status) {
    const sprites = {
      'working': '🟢',
      'idle': '🟡',
      'sleeping': '⚫',
      'error': '🔴',
      'unknown': '⚪'
    };
    
    return sprites[status] || '⚪';
  }
  
  // Получить реальный workspace
  getRealWorkspace(sessionType) {
    const workspaces = {
      'main': 'core',
      'telegram': 'messaging',
      'cron': 'automation',
      'subagent': 'subagents',
      'direct': 'sessions'
    };
    
    return workspaces[sessionType] || 'openclaw';
  }
  
  // Получить реальное описание
  getRealDescription(agentId, sessionType, session) {
    const model = session.model || 'unknown';
    const tokens = session.totalTokens || 0;
    
    if (sessionType === 'telegram') {
      return `Telegram бот, модель: ${model}, токенов: ${tokens}`;
    } else if (sessionType === 'cron') {
      return `Автоматизированная задача, модель: ${model}`;
    } else if (sessionType === 'main') {
      return `Основной агент OpenClaw, модель: ${model}, токенов: ${tokens}`;
    }
    
    return `Сессия OpenClaw, тип: ${sessionType}, модель: ${model}`;
  }
  
  // Получить всех реальных агентов
  getAllRealAgents() {
    try {
      console.log('Получение реальных метрик OpenClaw...');
      
      // Получаем реальные сессии
      const sessionsData = this.getRealSessions();
      console.log(`Найдено ${Object.keys(sessionsData.sessions || {}).length} реальных сессий`);
      
      // Преобразуем в агентов
      const realAgents = this.sessionsToRealAgents(sessionsData);
      console.log(`Создано ${realAgents.length} реальных агентов`);
      
      // Получаем системные метрики
      const systemMetrics = this.getSystemMetrics();
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        agents: realAgents,
        system: systemMetrics,
        summary: {
          totalAgents: realAgents.length,
          workingAgents: realAgents.filter(a => a.status === 'working').length,
          totalTokens: realAgents.reduce((sum, a) => sum + (a.realMetrics?.totalTokens || 0), 0),
          uniqueModels: [...new Set(realAgents.map(a => a.realMetrics?.model).filter(Boolean))]
        }
      };
      
    } catch (error) {
      console.error('Ошибка получения реальных агентов:', error);
      return {
        success: false,
        error: error.message,
        agents: [],
        system: {}
      };
    }
  }
}

// Экспорт для использования в server-simple.js
module.exports = RealOpenClawMetrics;

// Если запущен напрямую
if (require.main === module) {
  const metrics = new RealOpenClawMetrics();
  
  console.log('🚀 Тестирование реальных метрик OpenClaw');
  console.log('=======================================');
  
  const result = metrics.getAllRealAgents();
  
  if (result.success) {
    console.log('\n📊 Реальные агенты OpenClaw:');
    result.agents.forEach((agent, index) => {
      console.log(`${index + 1}. ${agent.name} (${agent.id})`);
      console.log(`   Статус: ${agent.status}, Workspace: ${agent.workspace}`);
      console.log(`   Модель: ${agent.realMetrics?.model}, Токенов: ${agent.realMetrics?.totalTokens}`);
      console.log(`   Последняя активность: ${new Date(agent.lastSeen).toLocaleString()}`);
    });
    
    console.log('\n📈 Системные метрики:');
    console.log(`   CPU: ${result.system.cpu}%`);
    console.log(`   Память: ${result.system.memory}%`);
    console.log(`   Диск: ${result.system.disk}`);
    console.log(`   Процессы OpenClaw: ${result.system.processes}`);
    
    console.log('\n📊 Сводка:');
    console.log(`   Всего агентов: ${result.summary.totalAgents}`);
    console.log(`   Работающих: ${result.summary.workingAgents}`);
    console.log(`   Всего токенов: ${result.summary.totalTokens}`);
    console.log(`   Уникальных моделей: ${result.summary.uniqueModels.length}`);
    
  } else {
    console.error('❌ Ошибка:', result.error);
  }
}