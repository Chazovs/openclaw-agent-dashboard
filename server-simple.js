const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const ActivityStore = require('./activity-store');

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

// Начальный список агентов
let currentAgents = [
  {
    id: 'main_claude',
    name: 'Клод',
    emoji: '🧠',
    status: 'working',
    sprite: '🟩',
    workspace: 'main',
    lastSeen: new Date().toISOString(),
    description: 'Главный AI-ассистент, управляет системой'
  },
  {
    id: 'uncle_bob',
    name: 'Дядя Боб',
    emoji: '👨‍💻',
    status: 'sleeping',
    sprite: '🟨',
    workspace: 'development',
    lastSeen: new Date().toISOString(),
    description: 'Программист-дизайнер, создает фичи для дашборда'
  },
  {
    id: 'journalist_goodman',
    name: 'Журналист Гудман',
    emoji: '📰',
    status: 'idle',
    sprite: '🟦',
    workspace: 'content',
    lastSeen: new Date().toISOString(),
    description: 'Создает Тайную газету, запуск в 20:00 daily'
  }
];

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

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Agent Dashboard running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready with ${currentAgents.length} agents`);
});
