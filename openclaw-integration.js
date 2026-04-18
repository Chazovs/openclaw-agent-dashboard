#!/usr/bin/env node
// Интеграция с реальными данными OpenClaw

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class OpenClawIntegration {
  constructor() {
    this.openclawPath = '/home/openclaw/.npm-global/bin/openclaw';
  }
  
  // Получить сессии OpenClaw
  getOpenClawSessions() {
    try {
      const command = `${this.openclawPath} sessions --json`;
      const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
      return JSON.parse(output);
    } catch (error) {
      console.error('Ошибка получения сессий OpenClaw:', error.message);
      return { sessions: [] };
    }
  }
  
  // Получить статус OpenClaw
  getOpenClawStatus() {
    try {
      const command = `${this.openclawPath} status --json`;
      const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
      return JSON.parse(output);
    } catch (error) {
      console.error('Ошибка получения статуса OpenClaw:', error.message);
      return {};
    }
  }
  
  // Преобразовать сессии OpenClaw в агентов для дашборда
  sessionsToAgents(sessionsData) {
    const agents = [];
    const seenAgents = new Set();
    
    if (!sessionsData.sessions || !Array.isArray(sessionsData.sessions)) {
      return agents;
    }
    
    // Группируем сессии по agentId
    const sessionsByAgent = {};
    
    sessionsData.sessions.forEach(session => {
      const agentId = session.agentId || 'unknown';
      if (!sessionsByAgent[agentId]) {
        sessionsByAgent[agentId] = [];
      }
      sessionsByAgent[agentId].push(session);
    });
    
    // Создаем агентов на основе сессий
    for (const [agentId, sessions] of Object.entries(sessionsByAgent)) {
      if (seenAgents.has(agentId)) continue;
      
      // Находим самую свежую сессию
      const latestSession = sessions.reduce((latest, current) => {
        return current.updatedAt > latest.updatedAt ? current : latest;
      });
      
      // Определяем статус на основе активности
      const ageMs = Date.now() - latestSession.updatedAt;
      let status = 'idle';
      if (ageMs < 5 * 60 * 1000) { // 5 минут
        status = 'working';
      } else if (ageMs > 60 * 60 * 1000) { // 1 час
        status = 'sleeping';
      }
      
      // Определяем тип агента на основе kind
      let emoji = '🤖';
      let description = 'OpenClaw агент';
      let workspace = 'openclaw';
      
      if (agentId === 'main') {
        emoji = '🧠';
        description = 'Главный агент OpenClaw';
        workspace = 'main';
      } else if (latestSession.kind === 'cron') {
        emoji = '⏰';
        description = 'Cron-агент OpenClaw';
        workspace = 'automation';
      } else if (latestSession.kind === 'subagent') {
        emoji = '🔄';
        description = 'Суб-агент OpenClaw';
        workspace = 'subagents';
      }
      
      // Создаем агента
      const agent = {
        id: `openclaw_${agentId}`,
        name: this.getAgentName(agentId, latestSession),
        emoji,
        status,
        sprite: this.getStatusSprite(status),
        workspace,
        lastSeen: new Date(latestSession.updatedAt).toISOString(),
        description,
        metadata: {
          agentId,
          sessionCount: sessions.length,
          totalTokens: sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0),
          model: latestSession.model,
          kind: latestSession.kind
        }
      };
      
      agents.push(agent);
      seenAgents.add(agentId);
    }
    
    return agents;
  }
  
  // Генерация имени агента
  getAgentName(agentId, session) {
    const names = {
      'main': 'Клод (OpenClaw)',
      'default': 'OpenClaw Agent'
    };
    
    if (names[agentId]) {
      return names[agentId];
    }
    
    // Генерация имени на основе kind
    if (session.kind === 'cron') {
      return `Cron Agent ${agentId.substring(0, 8)}`;
    } else if (session.kind === 'subagent') {
      return `Sub-Agent ${agentId.substring(0, 8)}`;
    }
    
    return `Agent ${agentId}`;
  }
  
  // Получить спрайт для статуса
  getStatusSprite(status) {
    const sprites = {
      'working': '🟢',
      'idle': '🟡',
      'sleeping': '⚫',
      'error': '🔴'
    };
    return sprites[status] || '⚪';
  }
  
  // Получить реальных агентов OpenClaw
  getRealAgents() {
    try {
      console.log('Получение реальных данных из OpenClaw...');
      
      // Получаем сессии
      const sessionsData = this.getOpenClawSessions();
      console.log(`Найдено ${sessionsData.sessions?.length || 0} сессий`);
      
      // Преобразуем в агентов
      const agents = this.sessionsToAgents(sessionsData);
      console.log(`Создано ${agents.length} агентов из реальных данных`);
      
      // Добавляем системных агентов если реальных мало
      if (agents.length < 3) {
        agents.push(...this.getSystemAgents());
      }
      
      return agents;
      
    } catch (error) {
      console.error('Ошибка получения реальных агентов:', error);
      return this.getSystemAgents(); // Fallback
    }
  }
  
  // Системные агенты (fallback)
  getSystemAgents() {
    return [
      {
        id: 'system_main',
        name: 'Системный монитор',
        emoji: '🖥️',
        status: 'working',
        sprite: '🟢',
        workspace: 'system',
        lastSeen: new Date().toISOString(),
        description: 'Мониторинг системы OpenClaw'
      },
      {
        id: 'system_dashboard',
        name: 'Дашборд',
        emoji: '📊',
        status: 'working',
        sprite: '🟢',
        workspace: 'dashboard',
        lastSeen: new Date().toISOString(),
        description: 'Панель управления агентами'
      }
    ];
  }
  
  // Сохранить агентов в файл для бэкенда
  saveAgentsToFile(agents, filePath) {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        source: 'openclaw-integration',
        agents
      };
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Агенты сохранены в ${filePath}`);
      return true;
    } catch (error) {
      console.error('Ошибка сохранения агентов:', error);
      return false;
    }
  }
}

// Экспорт для использования в server-simple.js
module.exports = OpenClawIntegration;

// Если запущен напрямую
if (require.main === module) {
  const integration = new OpenClawIntegration();
  
  console.log('🚀 Тестирование интеграции с OpenClaw');
  console.log('====================================');
  
  const agents = integration.getRealAgents();
  
  console.log('\n📊 Полученные агенты:');
  agents.forEach((agent, index) => {
    console.log(`${index + 1}. ${agent.name} (${agent.id})`);
    console.log(`   Статус: ${agent.status}, Workspace: ${agent.workspace}`);
    console.log(`   Описание: ${agent.description}`);
  });
  
  // Сохраняем в файл для бэкенда
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const agentsFile = path.join(dataDir, 'real-agents.json');
  integration.saveAgentsToFile(agents, agentsFile);
  
  console.log(`\n✅ Интеграция завершена. Агенты сохранены в ${agentsFile}`);
}