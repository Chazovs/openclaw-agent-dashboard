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

// Начально пустой список агентов
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
  }
];

// История активности агентов
let agentActivityHistory = {
  'main_claude': [
    {
      timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 час назад
      status: 'working',
      task: 'Анализ дашборда',
      duration: 1200000 // 20 минут
    },
    {
      timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 минут назад
      status: 'idle',
      task: 'Ожидание задач',
      duration: 600000 // 10 минут
    },
    {
      timestamp: new Date(Date.now() - 600000).toISOString(), // 10 минут назад
      status: 'working',
      task: 'Разработка новой фичи',
      duration: 300000 // 5 минут
    }
  ]
};

// Функция для добавления реального агента
function addRealAgent(agentData) {
  const newAgent = {
    id: agentData.id || `agent_${Date.now()}`,
    name: agentData.name || 'Новый агент',
    emoji: agentData.emoji || '🤖',
    status: agentData.status || 'idle',
    sprite: getSpriteForStatus(agentData.status || 'idle'),
    workspace: agentData.workspace || 'main',
    lastSeen: new Date().toISOString(),
    description: agentData.description || 'AI-агент'
  };
  
  currentAgents.push(newAgent);
  
  // Инициализируем историю активности для нового агента
  if (!agentActivityHistory[newAgent.id]) {
    agentActivityHistory[newAgent.id] = [{
      timestamp: new Date().toISOString(),
      status: newAgent.status,
      task: 'Агент создан',
      duration: 0
    }];
  }
  
  return newAgent;
}

// Функция для удаления агента
function removeAgent(agentId) {
  currentAgents = currentAgents.filter(agent => agent.id !== agentId);
}

// Функция для обновления статуса агента
function updateAgentStatus(agentId, newStatus, task = null) {
  const agent = currentAgents.find(a => a.id === agentId);
  if (agent) {
    // Добавляем запись в историю
    addActivityRecord(agentId, {
      timestamp: new Date().toISOString(),
      status: newStatus,
      task: task || `Изменение статуса на ${newStatus}`,
      duration: 0 // Будет обновлено при следующем изменении статуса
    });
    
    agent.status = newStatus;
    agent.sprite = getSpriteForStatus(newStatus);
    agent.lastSeen = new Date().toISOString();
  }
}

// Функция для добавления записи активности
function addActivityRecord(agentId, activity) {
  if (!agentActivityHistory[agentId]) {
    agentActivityHistory[agentId] = [];
  }
  
  // Обновляем продолжительность предыдущей записи
  const history = agentActivityHistory[agentId];
  if (history.length > 0) {
    const lastActivity = history[history.length - 1];
    const lastTimestamp = new Date(lastActivity.timestamp);
    const currentTimestamp = new Date(activity.timestamp);
    lastActivity.duration = currentTimestamp - lastTimestamp;
  }
  
  // Добавляем новую запись
  history.push(activity);
  
  // Ограничиваем историю последними 50 записями
  if (history.length > 50) {
    agentActivityHistory[agentId] = history.slice(-50);
  }
}

// Функция для получения истории активности агента
function getAgentActivityHistory(agentId, limit = 20) {
  if (!agentActivityHistory[agentId]) {
    return [];
  }
  return agentActivityHistory[agentId].slice(-limit);
}

// Получение спрайта по статусу
function getSpriteForStatus(status) {
  const sprites = {
    'working': '🟩',
    'idle': '🟨',
    'error': '🟥',
    'offline': '⬛'
  };
  return sprites[status] || '🟨';
}

// API endpoint для получения агентов
app.get('/api/agents', async (req, res) => {
  try {
    console.log('GET /api/agents - currentAgents:', currentAgents.length, 'agents');
    
    // Если агентов нет, возвращаем пустой массив
    if (currentAgents.length === 0) {
      console.log('No agents, returning empty array');
      res.json([]);
      return;
    }
    
    console.log('Agents found:', currentAgents.map(a => ({ name: a.name, status: a.status })));
    
    // Обновляем статусы для демо (если есть агенты)
    const agents = currentAgents.map(agent => ({
      ...agent,
      status: getRandomStatus(agent.status),
      lastSeen: new Date().toISOString()
    }));
    
    // Обновляем текущий список
    currentAgents = agents;
    
    res.json(agents);
  } catch (err) {
    console.error('Error in /api/agents:', err);
    res.status(500).json({ error: err.message });
  }
});

// API для добавления агента
app.post('/api/agents', express.json(), (req, res) => {
  try {
    const agentData = req.body;
    const newAgent = addRealAgent(agentData);
    
    // Уведомляем всех клиентов через WebSocket
    io.emit('agent-added', newAgent);
    io.emit('agents-update', currentAgents);
    
    res.json({ success: true, agent: newAgent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API для удаления агента
app.delete('/api/agents/:id', (req, res) => {
  try {
    const agentId = req.params.id;
    removeAgent(agentId);
    
    // Уведомляем всех клиентов через WebSocket
    io.emit('agent-removed', agentId);
    io.emit('agents-update', currentAgents);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API для обновления статуса агента
app.put('/api/agents/:id/status', express.json(), (req, res) => {
  try {
    const agentId = req.params.id;
    const { status, task } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    updateAgentStatus(agentId, status, task);
    
    // Уведомляем всех клиентов через WebSocket
    io.emit('agent-status-updated', { agentId, status });
    io.emit('agents-update', currentAgents);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API для получения истории активности агента
app.get('/api/agents/:id/activity', (req, res) => {
  try {
    const agentId = req.params.id;
    const limit = parseInt(req.query.limit) || 20;
    
    const activity = getAgentActivityHistory(agentId, limit);
    
    res.json({
      success: true,
      agentId,
      activity,
      total: activity.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Статический HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// WebSocket соединения
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Отправляем текущих агентов (может быть пустой массив)
  socket.emit('agents-update', currentAgents);
  
  // Периодические обновления (только если есть агенты)
  const interval = setInterval(() => {
    if (currentAgents.length > 0) {
      const updatedAgents = currentAgents.map(agent => {
        const newStatus = getRandomStatus(agent.status);
        
        // Добавляем запись в историю при изменении статуса
        if (newStatus !== agent.status) {
          const task = getRandomTask(newStatus);
          addActivityRecord(agent.id, {
            timestamp: new Date().toISOString(),
            status: newStatus,
            task: task,
            duration: 0
          });
        }
        
        return {
          ...agent,
          status: newStatus,
          lastSeen: new Date().toISOString()
        };
      });
      
      // Обновляем текущий список
      currentAgents = updatedAgents;
      
      // Отправляем обновление всем клиентам
      io.emit('agents-update', updatedAgents);
    }
  }, 5000);
  
  // Обработка команд от клиента
  socket.on('add-agent', (agentData) => {
    const newAgent = addRealAgent(agentData);
    io.emit('agent-added', newAgent);
    io.emit('agents-update', currentAgents);
  });
  
  socket.on('remove-agent', (agentId) => {
    removeAgent(agentId);
    io.emit('agent-removed', agentId);
    io.emit('agents-update', currentAgents);
  });
  
  socket.on('update-agent-status', ({ agentId, status, task }) => {
    updateAgentStatus(agentId, status, task);
    io.emit('agent-status-updated', { agentId, status });
    io.emit('agents-update', currentAgents);
  });
  
  // Запрос истории активности
  socket.on('get-agent-activity', (agentId) => {
    const activity = getAgentActivityHistory(agentId);
    socket.emit('agent-activity', { agentId, activity });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    clearInterval(interval);
  });
});

// Случайный статус для демо
function getRandomStatus(currentStatus) {
  const statuses = ['working', 'idle', 'error'];
  // 80% шанс сохранить текущий статус, 20% изменить
  if (Math.random() > 0.2) return currentStatus;
  return statuses[Math.floor(Math.random() * statuses.length)];
}

// Случайная задача для демо
function getRandomTask(status) {
  const tasks = {
    'working': [
      'Анализ данных',
      'Обработка запросов',
      'Обучение модели',
      'Генерация контента',
      'Оптимизация кода',
      'Тестирование системы'
    ],
    'idle': [
      'Ожидание задач',
      'Пауза',
      'Перезагрузка',
      'Обновление конфигурации'
    ],
    'error': [
      'Ошибка выполнения',
      'Сбой соединения',
      'Проблема с памятью',
      'Исключение в коде'
    ]
  };
  
  const statusTasks = tasks[status] || ['Неизвестная задача'];
  return statusTasks[Math.floor(Math.random() * statusTasks.length)];
}

// Запуск сервера
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Agent Dashboard running on http://localhost:${PORT}`);
  console.log('WebSocket server ready with demo data');
});