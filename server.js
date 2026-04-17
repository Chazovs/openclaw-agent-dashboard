const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
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

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || '/home/openclaw/.openclaw';
const WORKSPACE_PATH = path.join(OPENCLAW_HOME, 'workspace');
const WORKSPACE_GLOB = path.join(OPENCLAW_HOME, 'workspace*');

// Пиксель-арт спрайты (базовые цвета)
const AGENT_SPRITES = {
  'default': '🟦',
  'working': '🟩',
  'idle': '🟨',
  'error': '🟥',
  'offline': '⬛'
};

// Функция для получения списка агентов
async function getAgents() {
  const agents = [];
  
  try {
    // Поиск всех workspace директорий
    const workspaceDirs = [];
    
    // Основной workspace
    if (await fs.pathExists(WORKSPACE_PATH)) {
      workspaceDirs.push({ path: WORKSPACE_PATH, id: 'main' });
    }
    
    // workspace-* директории
    try {
      const files = await fs.readdir(OPENCLAW_HOME);
      for (const file of files) {
        if (file.startsWith('workspace-')) {
          const dirPath = path.join(OPENCLAW_HOME, file);
          const stat = await fs.stat(dirPath);
          if (stat.isDirectory()) {
            workspaceDirs.push({ path: dirPath, id: file });
          }
        }
      }
    } catch (err) {
      console.error('Error reading workspace directories:', err.message);
    }
    
    // Чтение агентов из каждой директории
    for (const workspace of workspaceDirs) {
      try {
        // Проверяем IDENTITY.md в корне workspace
        const rootIdentityPath = path.join(workspace.path, 'IDENTITY.md');
        if (await fs.pathExists(rootIdentityPath)) {
          try {
            const identityContent = await fs.readFile(rootIdentityPath, 'utf8');
            const nameMatch = identityContent.match(/Name:\s*(.+)/);
            const emojiMatch = identityContent.match(/Emoji:\s*(.+)/);
            
            agents.push({
              id: workspace.id,
              name: nameMatch ? nameMatch[1].trim() : `Agent_${workspace.id}`,
              emoji: emojiMatch ? emojiMatch[1].trim() : '🤖',
              status: 'working',
              sprite: AGENT_SPRITES.working,
              workspace: workspace.id,
              lastSeen: new Date().toISOString()
            });
          } catch (err) {
            console.error(`Error reading ${rootIdentityPath}:`, err.message);
          }
        }
        
        // Также ищем поддиректории с агентами
        const items = await fs.readdir(workspace.path);
        
        for (const item of items) {
          const itemPath = path.join(workspace.path, item);
          const stat = await fs.stat(itemPath);
          
          if (stat.isDirectory()) {
            // Проверяем наличие IDENTITY.md
            const identityPath = path.join(itemPath, 'IDENTITY.md');
            if (await fs.pathExists(identityPath)) {
              try {
                const identityContent = await fs.readFile(identityPath, 'utf8');
                const nameMatch = identityContent.match(/Name:\s*(.+)/);
                const emojiMatch = identityContent.match(/Emoji:\s*(.+)/);
                
                agents.push({
                  id: `${workspace.id}_${item}`,
                  name: nameMatch ? nameMatch[1].trim() : `Agent_${item}`,
                  emoji: emojiMatch ? emojiMatch[1].trim() : '🤖',
                  status: 'idle',
                  sprite: AGENT_SPRITES.idle,
                  workspace: workspace.id,
                  lastSeen: new Date().toISOString()
                });
              } catch (err) {
                console.error(`Error reading ${identityPath}:`, err.message);
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error reading workspace ${workspace.path}:`, err.message);
      }
    }
    
    // Если агентов нет, создаем демо-агента
    if (agents.length === 0) {
      agents.push({
        id: 'demo_agent',
        name: 'Клод',
        emoji: '🧠',
        status: 'working',
        sprite: AGENT_SPRITES.working,
        workspace: 'main',
        lastSeen: new Date().toISOString()
      });
    }
    
  } catch (err) {
    console.error('Error reading agents:', err.message);
  }
  
  return agents;
}

// Мониторинг изменений в workspace
function watchWorkspace() {
  const watcher = chokidar.watch(WORKSPACE_PATH, {
    persistent: true,
    ignoreInitial: true,
    depth: 2
  });

  watcher.on('add', (filePath) => updateAgents());
  watcher.on('change', (filePath) => updateAgents());
  watcher.on('unlink', (filePath) => updateAgents());
  
  console.log(`Watching ${WORKSPACE_PATH} for changes...`);
}

// Обновление списка агентов и отправка клиентам
async function updateAgents() {
  try {
    const agents = await getAgents();
    io.emit('agents-update', agents);
    console.log(`Sent update for ${agents.length} agents`);
  } catch (err) {
    console.error('Error updating agents:', err);
  }
}

// API endpoint для получения агентов
app.get('/api/agents', async (req, res) => {
  try {
    const agents = await getAgents();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Статический HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket соединения
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Отправляем текущий список агентов
  getAgents().then(agents => {
    socket.emit('agents-update', agents);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Запуск мониторинга и сервера
async function startServer() {
  try {
    // Проверяем доступность OpenClaw директории
    if (!await fs.pathExists(OPENCLAW_HOME)) {
      console.warn(`OpenClaw directory not found at ${OPENCLAW_HOME}`);
    } else {
      console.log(`Using OpenClaw directory: ${OPENCLAW_HOME}`);
      watchWorkspace();
    }
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Agent Dashboard running on http://localhost:${PORT}`);
      console.log('WebSocket server ready');
    });
    
    // Первоначальное обновление
    updateAgents();
    
    // Периодическое обновление каждые 30 секунд
    setInterval(updateAgents, 30000);
    
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();