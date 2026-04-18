const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

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

// Функция для добавления реального агента
function addRealAgent(agentData) {
  const newAgent = {
    id: agentData.id || `agent_${Date.now()}`,
    name: agentData.name || 'Новый агент',
    emoji: agentData.emoji || '🤖',
    status: agentData.status || 'idle',
    sprite: agentData.sprite || '🟪',
    workspace: agentData.workspace || 'general',
    lastSeen: new Date().toISOString(),
    description: agentData.description || 'Агент OpenClaw'
  };
  
  currentAgents.push(newAgent);
  return newAgent;
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

// API: Добавить агента
app.post('/api/agents', express.json(), (req, res) => {
  try {
    const newAgent = addRealAgent(req.body);
    console.log(`[INFO] Added new agent: ${newAgent.name}`);
    
    // Отправляем обновление всем клиентам
    io.emit('agents-update', currentAgents);
    
    res.json({ success: true, agent: newAgent });
  } catch (err) {
    console.error('Error adding agent:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Получить активность агента
app.get('/api/agents/:id/activity', (req, res) => {
  try {
    const agentId = req.params.id;
    const agent = currentAgents.find(a => a.id === agentId);
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Демо история активности
    const demoActivity = [
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        status: 'working',
        task: 'Анализ данных',
        duration: 1200000
      },
      {
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        status: 'idle',
        task: 'Ожидание задач',
        duration: 600000
      },
      {
        timestamp: new Date(Date.now() - 600000).toISOString(),
        status: 'working',
        task: 'Разработка новой фичи',
        duration: 300000
      }
    ];
    
    res.json(demoActivity);
  } catch (err) {
    console.error('Error in /api/agents/:id/activity:', err);
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
