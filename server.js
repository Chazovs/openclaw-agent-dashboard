const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const cors = require('cors');
const { execSync } = require('child_process');
const AnalyticsModule = require('./analytics-module');

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

// Инициализация аналитического модуля
const analyticsModule = new AnalyticsModule();

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
    
    // Собираем аналитические данные
    try {
      const analytics = await analyticsModule.collectData(agents);
      io.emit('analytics-update', analytics);
    } catch (analyticsErr) {
      console.error('Error collecting analytics:', analyticsErr);
    }
    
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

// API endpoint для получения аналитики
app.get('/api/analytics', async (req, res) => {
  try {
    const agents = await getAgents();
    const analytics = await analyticsModule.collectData(agents);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API endpoint для получения списка сервисов и таймеров
app.get('/api/services', async (req, res) => {
  try {
    const servicesDir = WORKSPACE_PATH;
    const files = await fs.readdir(servicesDir);
    
    const serviceFiles = files.filter(f => f.endsWith('.service'));
    const timerFiles = files.filter(f => f.endsWith('.timer'));
    
    // Map timers to services
    const timerMap = {};
    timerFiles.forEach(tf => {
      const baseName = tf.replace('.timer', '');
      if (!timerMap[baseName]) timerMap[baseName] = [];
      timerMap[baseName].push(tf);
    });
    
    const services = [];
    
    for (const sf of serviceFiles) {
      const baseName = sf.replace('.service', '');
      
      // Read service file contents
      let serviceContent = '';
      try {
        serviceContent = await fs.readFile(path.join(servicesDir, sf), 'utf8');
      } catch (e) { serviceContent = 'Cannot read file'; }
      
      // Extract ExecStart
      const execMatch = serviceContent.match(/ExecStart=(.+)/);
      const descMatch = serviceContent.match(/Description=(.+)/);
      const workingDirMatch = serviceContent.match(/WorkingDirectory=(.+)/);
      
      // Get timer info if exists
      const timerFilesForService = timerMap[baseName] || [];
      const timers = [];
      for (const timerFile of timerFilesForService) {
        let timerContent = '';
        try {
          timerContent = await fs.readFile(path.join(servicesDir, timerFile), 'utf8');
        } catch (e) { timerContent = ''; }
        
        const onCalendarMatch = timerContent.match(/OnCalendar=(.+)/);
        const onBootMatch = timerContent.match(/OnBootSec=(.+)/);
        
        timers.push({
          file: timerFile,
          onCalendar: onCalendarMatch ? onCalendarMatch[1].trim() : null,
          onBootSec: onBootMatch ? onBootMatch[1].trim() : null
        });
      }
      
      // Try to get systemd status
      let systemdStatus = 'unknown';
      let systemdActive = false;
      let systemdEnabled = false;
      let lastRunTime = null;
      let nextRunTime = null;
      try {
        const statusOut = execSync(`systemctl is-active ${baseName} 2>/dev/null`, { timeout: 3000 }).toString().trim();
        systemdActive = statusOut === 'active';
        systemdStatus = statusOut;
        
        const enabledOut = execSync(`systemctl is-enabled ${baseName} 2>/dev/null`, { timeout: 3000 }).toString().trim();
        systemdEnabled = enabledOut === 'enabled';
        
        // Get timer status for last trigger
        if (timers.length > 0) {
          try {
            const timerInfo = execSync(`systemctl show ${timerFilesForService[0].replace('.timer', '')}.timer --property=LastTriggerUSec --property=NextElapseUSecReal 2>/dev/null`, { timeout: 3000 }).toString().trim();
            timerInfo.split('\n').forEach(line => {
              if (line.startsWith('LastTriggerUSec=')) {
                const val = line.split('=')[1];
                if (val && val !== '') lastRunTime = val;
              }
              if (line.startsWith('NextElapseUSecReal=')) {
                const val = line.split('=')[1];
                if (val && val !== '') nextRunTime = val;
              }
            });
          } catch (e) { /* timer not registered */ }
        }
      } catch (e) { /* not a systemd service */ }
      
      services.push({
        name: baseName,
        file: sf,
        description: descMatch ? descMatch[1].trim() : baseName,
        execStart: execMatch ? execMatch[1].trim() : 'N/A',
        workingDirectory: workingDirMatch ? workingDirMatch[1].trim() : servicesDir,
        timers,
        systemd: {
          active: systemdActive,
          status: systemdStatus,
          enabled: systemdEnabled,
          lastRun: lastRunTime,
          nextRun: nextRunTime
        }
      });
    }
    
    // Sort by name
    services.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      serviceDir: servicesDir,
      total: services.length,
      services
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API endpoint для получения последних логов сервиса
app.get('/api/services/:name/logs', async (req, res) => {
  try {
    const serviceName = req.params.name;
    const lines = parseInt(req.query.lines) || 20;
    
    // Look for log files in workspace
    const logPatterns = [
      path.join(WORKSPACE_PATH, `${serviceName}.log`),
      path.join(WORKSPACE_PATH, `${serviceName}-trades.log`),
      path.join(WORKSPACE_PATH, `${serviceName}.json`)
    ];
    
    let logContent = '';
    for (const logPath of logPatterns) {
      if (await fs.pathExists(logPath)) {
        try {
          const content = await fs.readFile(logPath, 'utf8');
          const allLines = content.split('\n').filter(l => l.trim());
          const lastLines = allLines.slice(-lines);
          logContent = lastLines.join('\n');
          break;
        } catch (e) { continue; }
      }
    }
    
    // Try journalctl for systemd services
    if (!logContent) {
      try {
        const journalOut = execSync(`journalctl -u ${serviceName} --no-pager -n ${lines} 2>/dev/null`, { timeout: 3000 }).toString().trim();
        if (journalOut) {
          logContent = journalOut;
        }
      } catch (e) { /* journalctl not available */ }
    }
    
    res.json({
      success: true,
      service: serviceName,
      lines: logContent ? logContent.split('\n').length : 0,
      log: logContent
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API endpoint для ручного запуска сервиса
app.post('/api/services/:name/restart', async (req, res) => {
  try {
    const serviceName = req.params.name;
    
    try {
      const out = execSync(`sudo systemctl restart ${serviceName} 2>&1`, { timeout: 10000 }).toString().trim();
      res.json({ success: true, message: `Service ${serviceName} restarted`, output: out });
    } catch (e) {
      res.status(500).json({ success: false, error: e.stderr ? e.stderr.toString().trim() : e.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API endpoint для получения статуса служб через systemctl list-units
app.get('/api/services/systemd', async (req, res) => {
  try {
    const out = execSync(`systemctl list-units --type=service --all --no-pager --no-legend 2>/dev/null | head -50`, { timeout: 5000 }).toString().trim();
    const units = out.split('\n').filter(l => l.trim()).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        unit: parts[0] || '',
        load: parts[1] || '',
        active: parts[2] || '',
        sub: parts[3] || '',
        description: parts.slice(4).join(' ') || ''
      };
    });
    res.json({ success: true, units });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});