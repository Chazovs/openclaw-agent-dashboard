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
  return newAgent;
}

// Функция для удаления агента
function removeAgent(agentId) {
  currentAgents = currentAgents.filter(agent => agent.id !== agentId);
}

// Функция для обновления статуса агента
function updateAgentStatus(agentId, newStatus) {
  const agent = currentAgents.find(a => a.id === agentId);
  if (agent) {
    agent.status = newStatus;
    agent.sprite = getSpriteForStatus(newStatus);
    agent.lastSeen = new Date().toISOString();
  }
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
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    updateAgentStatus(agentId, status);
    
    // Уведомляем всех клиентов через WebSocket
    io.emit('agent-status-updated', { agentId, status });
    io.emit('agents-update', currentAgents);
    
    res.json({ success: true });
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
      const updatedAgents = currentAgents.map(agent => ({
        ...agent,
        status: getRandomStatus(agent.status),
        lastSeen: new Date().toISOString()
      }));
      
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
  
  socket.on('update-agent-status', ({ agentId, status }) => {
    updateAgentStatus(agentId, status);
    io.emit('agent-status-updated', { agentId, status });
    io.emit('agents-update', currentAgents);
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

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Agent Dashboard running on http://localhost:${PORT}`);
  console.log('WebSocket server ready with demo data');
});