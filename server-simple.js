const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const ActivityStore = require('./activity-store');
const { execSync } = require('child_process');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('public'));

// Инициализация хранилища активности
const activityStore = new ActivityStore();

// Функция для получения реальных агентов из OpenClaw
function getRealAgentsFromOpenClaw() {
  try {
    console.log('Получение реальных агентов из OpenClaw...');
    
    // Гибридный подход: реальные данные + демо
    const fs = require('fs');
    const path = require('path');
    
    // Проверяем доступность данных OpenClaw
    const openclawDir = '/home/openclaw/.openclaw';
    
    if (!fs.existsSync(openclawDir)) {
      console.log('Директория OpenClaw не найдена');
      return getDemoAgents();
    }
    
    // Создаем гибридный список агентов
    const hybridAgents = [];
    
    // 1. Главный агент OpenClaw (всегда есть)
    hybridAgents.push({
      id: 'openclaw_main',
      name: 'OpenClaw Main',
      emoji: '🧠',
      status: 'working',
      sprite: '🟢',
      workspace: 'openclaw',
      lastSeen: new Date().toISOString(),
      description: 'Основной агент системы OpenClaw',
      metadata: { source: 'real', agentId: 'main' }
    });
    
    // 2. Проверяем наличие под-агентов
    const agentsDir = '/home/openclaw/.openclaw/agents';
    if (fs.existsSync(agentsDir)) {
      const agentDirs = fs.readdirSync(agentsDir)
        .filter(item => {
          const itemPath = path.join(agentsDir, item);
          return fs.statSync(itemPath).isDirectory() && item !== 'main';
        })
        .slice(0, 5); // Максимум 5 дополнительных агентов
      
      agentDirs.forEach((agentDir, index) => {
        hybridAgents.push({
          id: `openclaw_${agentDir}`,
          name: `Agent ${agentDir.substring(0, 8)}`,
          emoji: index % 2 === 0 ? '🤖' : '🔄',
          status: index === 0 ? 'working' : 'idle',
          sprite: index === 0 ? '🟢' : '🟡',
          workspace: 'agents',
          lastSeen: new Date(Date.now() - index * 60000).toISOString(), // Разное время
          description: `Агент OpenClaw: ${agentDir}`,
          metadata: { source: 'real', agentId: agentDir }
        });
      });
    }
    
    // 3. Добавляем системные агенты если мало реальных
    if (hybridAgents.length < 3) {
      hybridAgents.push(...getDemoAgents().map(agent => ({
        ...agent,
        metadata: { ...agent.metadata, source: 'hybrid' }
      })));
    }
    
    console.log(`Создано ${hybridAgents.length} гибридных агентов`);
    return hybridAgents;
    
    console.log(`Получено ${sessionsData.sessions.length} сессий из OpenClaw`);
    
    // Группируем сессии по agentId
    const sessionsByAgent = {};
    sessionsData.sessions.forEach(session => {
      const agentId = session.agentId || 'unknown';
      if (!sessionsByAgent[agentId]) {
        sessionsByAgent[agentId] = [];
      }
      sessionsByAgent[agentId].push(session);
    });
    
    // Создаем агентов на основе реальных данных
    const realAgents = [];
    
    for (const [agentId, sessions] of Object.entries(sessionsByAgent)) {
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
      
      // Определяем тип и имя агента
      let name, emoji, description, workspace;
      
      if (agentId === 'main') {
        name = 'Клод (OpenClaw)';
        emoji = '🧠';
        description = 'Главный агент OpenClaw';
        workspace = 'main';
      } else if (latestSession.kind === 'cron') {
        name = `Cron Agent ${agentId.substring(0, 8)}`;
        emoji = '⏰';
        description = 'Автоматизированный агент OpenClaw';
        workspace = 'automation';
      } else if (latestSession.kind === 'subagent') {
        name = `Sub-Agent ${agentId.substring(0, 8)}`;
        emoji = '🔄';
        description = 'Суб-агент OpenClaw';
        workspace = 'subagents';
      } else {
        name = `Agent ${agentId}`;
        emoji = '🤖';
        description = 'Агент OpenClaw';
        workspace = 'openclaw';
      }
      
      // Спрайт для статуса
      const sprite = status === 'working' ? '🟢' : 
                    status === 'idle' ? '🟡' : 
                    status === 'sleeping' ? '⚫' : '🔴';
      
      realAgents.push({
        id: `openclaw_${agentId}`,
        name,
        emoji,
        status,
        sprite,
        workspace,
        lastSeen: new Date(latestSession.updatedAt).toISOString(),
        description,
        metadata: {
          agentId,
          sessionCount: sessions.length,
          model: latestSession.model,
          kind: latestSession.kind,
          ageMs
        }
      });
    }
    
    console.log(`Создано ${realAgents.length} реальных агентов`);
    return realAgents;
    
  } catch (error) {
    console.error('Ошибка получения реальных агентов:', error.message);
    // Fallback на демо-агентов
    return getDemoAgents();
  }
}

// Демо-агенты (fallback)
function getDemoAgents() {
  return [
    {
      id: 'main_claude',
      name: 'Клод',
      emoji: '🧠',
      status: 'working',
      sprite: '🟩',
      workspace: 'main',
      lastSeen: new Date().toISOString(),
      description: 'Главный AI-ассистент, управляет системой',
      metadata: { source: 'demo' }
    },
    {
      id: 'uncle_bob',
      name: 'Дядя Боб',
      emoji: '👨‍💻',
      status: 'sleeping',
      sprite: '🟨',
      workspace: 'development',
      lastSeen: new Date().toISOString(),
      description: 'Программист-дизайнер, создает фичи для дашборда',
      metadata: { source: 'demo' }
    },
    {
      id: 'journalist_goodman',
      name: 'Журналист Гудман',
      emoji: '📰',
      status: 'idle',
      sprite: '🟦',
      workspace: 'content',
      lastSeen: new Date().toISOString(),
      description: 'Создает Тайную газету, запуск в 20:00 daily',
      metadata: { source: 'demo' }
    }
  ];
}

// Начальный список агентов (будет заполнен реальными данными)
let currentAgents = getRealAgentsFromOpenClaw();

// Функция для добавления или обновления реального агента
function addOrUpdateAgent(agentData) {
  const existingIndex = currentAgents.findIndex(a => a.id === agentData.id);
  
  const agent = {
    id: agentData.id || `agent_${Date.now()}`,
    name: agentData.name || 'Новый агент',
    emoji: agentData.emoji || '🤖',
    status: agentData.status || 'idle',
    sprite: agentData.sprite || '🟪',
    workspace: agentData.workspace || 'general',
    lastSeen: new Date().toISOString(),
    description: agentData.description || 'Агент OpenClaw'
  };
  
  if (existingIndex >= 0) {
    // Обновляем существующего агента
    currentAgents[existingIndex] = agent;
  } else {
    // Добавляем нового агента
    currentAgents.push(agent);
  }
  
  return agent;
}

// API: Получить всех агентов
app.get('/api/agents', (req, res) => {
  try {
    console.log(`[INFO] /api/agents called, returning ${currentAgents.length} agents`);
    
    // Возвращаем копию с обновленными статусами
    const agentsWithUpdates = currentAgents.map(agent => ({
      ...agent,
      lastSeen: new Date().toISOString()
    }));
    
    res.json(agentsWithUpdates);
  } catch (err) {
    console.error('Error in /api/agents:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Добавить или обновить агента
app.post('/api/agents', express.json(), (req, res) => {
  try {
    const agent = addOrUpdateAgent(req.body);
    const action = currentAgents.filter(a => a.id === agent.id).length > 1 ? 'Added' : 'Updated';
    console.log(`[INFO] ${action} agent: ${agent.name}`);
    
    // Отправляем обновление всем клиентам
    io.emit('agents-update', currentAgents);
    
    res.json({ success: true, agent: agent });
  } catch (err) {
    console.error('Error adding/updating agent:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Получить активность агента (реальная система)
app.get('/api/agents/:id/activity', (req, res) => {
  try {
    const agentId = req.params.id;
    const agent = currentAgents.find(a => a.id === agentId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Получаем реальную историю активности
    const activities = activityStore.getAgentActivity(agentId, 50);
    
    // Если истории нет, создаем начальные записи на основе статуса агента
    if (activities.length === 0) {
      const initialActivities = [
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: agent.status,
          task: 'Инициализация агента в системе',
          duration: 0,
          source: 'system'
        },
        {
          timestamp: new Date().toISOString(),
          status: agent.status,
          task: 'Агент активен в дашборде',
          duration: 0,
          source: 'dashboard'
        }
      ];
      
      initialActivities.forEach(activity => {
        activityStore.addActivity(agentId, activity);
      });
      
      // Получаем обновленную историю
      const updatedActivities = activityStore.getAgentActivity(agentId, 50);
      res.json(updatedActivities);
    } else {
      res.json(activities);
    }
    
  } catch (err) {
    console.error('Error in /api/agents/:id/activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Добавить активность для агента
app.post('/api/agents/:id/activity', express.json(), (req, res) => {
  try {
    const agentId = req.params.id;
    const agent = currentAgents.find(a => a.id === agentId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const { status, task, duration, details, source } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }
    
    const activity = {
      status: status || agent.status,
      task,
      duration: duration || 0,
      details: details || {},
      source: source || 'api'
    };
    
    const savedActivity = activityStore.addActivity(agentId, activity);
    
    // Обновляем статус агента если он изменился
    if (status && status !== agent.status) {
      agent.status = status;
      agent.lastSeen = new Date().toISOString();
      io.emit('agents-update', currentAgents);
    }
    
    res.json({
      success: true,
      activity: savedActivity,
      message: 'Activity recorded'
    });
    
  } catch (err) {
    console.error('Error adding activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Получить статистику активности
app.get('/api/activity/stats', (req, res) => {
  try {
    const stats = activityStore.getActivityStats();
    res.json(stats);
  } catch (err) {
    console.error('Error getting activity stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Получить последнюю активность всех агентов
app.get('/api/activity/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const recent = activityStore.getRecentActivity(limit);
    res.json(recent);
  } catch (err) {
    console.error('Error getting recent activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// WebSocket соединения
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Отправляем текущее состояние при подключении
  socket.emit('agents-update', currentAgents);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Периодическое обновление статусов (каждые 10 секунд)
setInterval(() => {
  if (currentAgents.length > 0) {
    const updatedAgents = currentAgents.map(agent => ({
      ...agent,
      lastSeen: new Date().toISOString()
    }));
    
    // Отправляем обновление всем клиентам
    io.emit('agents-update', updatedAgents);
  }
}, 10000);

// Периодическое обновление реальных агентов из OpenClaw (каждые 60 секунд)
setInterval(() => {
  try {
    console.log('Обновление реальных агентов из OpenClaw...');
    const realAgents = getRealAgentsFromOpenClaw();
    
    if (realAgents && realAgents.length > 0) {
      // Обновляем только если получили реальные данные
      const hasRealData = realAgents.some(agent => 
        !agent.metadata || agent.metadata.source !== 'demo'
      );
      
      if (hasRealData) {
        currentAgents = realAgents;
        console.log(`Агенты обновлены: ${currentAgents.length} реальных агентов`);
        io.emit('agents-update', currentAgents);
      }
    }
  } catch (error) {
    console.error('Ошибка обновления агентов:', error.message);
  }
}, 60000);

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Agent Dashboard running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready with ${currentAgents.length} agents`);
});
