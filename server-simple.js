const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const ActivityStore = require('./activity-store');
const AnalyticsEngine = require('./analytics-engine');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

// Инициализация движка аналитики
const analyticsEngine = new AnalyticsEngine();

// Функция для получения реальных агентов из OpenClaw
function getRealAgentsFromOpenClaw() {
  try {
    console.log('Получение РЕАЛЬНЫХ данных из OpenClaw...');
    
    // Путь к файлу сессий
    const sessionsFile = '/home/openclaw/.openclaw/agents/main/sessions/sessions.json';
    
    if (!fs.existsSync(sessionsFile)) {
      console.log('Файл сессий OpenClaw не найден');
      return getDemoAgents();
    }
    
    // Читаем реальные данные
    const sessionsContent = fs.readFileSync(sessionsFile, 'utf8');
    const sessionsData = JSON.parse(sessionsContent);
    
    if (!sessionsData || typeof sessionsData !== 'object') {
      throw new Error('Некорректный формат данных сессий');
    }
    
    const sessions = sessionsData;
    const sessionKeys = Object.keys(sessions);
    
    console.log(`Найдено ${sessionKeys.length} реальных сессий OpenClaw`);
    
    // Создаем реальных агентов
    const realAgents = [];
    
    for (const sessionKey of sessionKeys) {
      try {
        const session = sessions[sessionKey];
        
        // Извлекаем информацию из ключа сессии
        // Формат: agent:main:telegram:direct:602894445
        const parts = sessionKey.split(':');
        const agentId = parts[1] || 'main';
        const sessionType = parts[2] || 'direct';
        
        // Определяем РЕАЛЬНЫЙ статус
        let status = 'unknown';
        if (session.status === 'running') {
          status = 'working';
        } else if (session.abortedLastRun) {
          status = 'error';
        } else {
          // Определяем по времени
          const ageMs = Date.now() - session.updatedAt;
          if (ageMs < 5 * 60 * 1000) { // 5 минут
            status = 'working';
          } else if (ageMs < 60 * 60 * 1000) { // 1 час
            status = 'idle';
          } else {
            status = 'sleeping';
          }
        }
        
        // РЕАЛЬНЫЕ метрики
        const realMetrics = {
          inputTokens: session.inputTokens || 0,
          outputTokens: session.outputTokens || 0,
          totalTokens: session.totalTokens || 0,
          model: session.model || 'unknown',
          modelProvider: session.modelProvider || 'unknown',
          contextTokens: session.contextTokens || 0,
          updatedAt: new Date(session.updatedAt).toISOString(),
          ageMs: Date.now() - session.updatedAt,
          channel: session.lastChannel || session.deliveryContext?.channel || 'unknown',
          origin: session.origin?.provider || 'unknown'
        };
        
        // Определяем имя на основе реальных данных
        let name = 'OpenClaw Agent';
        if (sessionType === 'telegram') {
          name = 'Telegram Bot';
          if (realMetrics.channel && realMetrics.channel !== 'unknown') {
            name = `Telegram (${realMetrics.channel})`;
          }
        } else if (sessionType === 'cron') {
          name = 'Cron Agent';
        } else if (sessionType === 'subagent') {
          name = 'Sub-Agent';
        } else if (agentId === 'main') {
          name = 'Клод (OpenClaw)';
        }
        
        // Emoji на основе типа
        const emoji = sessionType === 'telegram' ? '📱' :
                     sessionType === 'cron' ? '⏰' :
                     sessionType === 'subagent' ? '🔄' :
                     agentId === 'main' ? '🧠' : '🤖';
        
        // Спрайт статуса
        const sprite = status === 'working' ? '🟢' :
                      status === 'idle' ? '🟡' :
                      status === 'sleeping' ? '⚫' :
                      status === 'error' ? '🔴' : '⚪';
        
        // Workspace
        const workspace = sessionType === 'telegram' ? 'messaging' :
                         sessionType === 'cron' ? 'automation' :
                         sessionType === 'subagent' ? 'subagents' :
                         agentId === 'main' ? 'core' : 'openclaw';
        
        // Описание с реальными метриками
        const description = realMetrics.model !== 'unknown' ? 
          `${name}, модель: ${realMetrics.model}, токенов: ${realMetrics.totalTokens}` :
          `${name}, сессия OpenClaw`;
        
        // Создаем РЕАЛЬНОГО агента
        const realAgent = {
          id: `real_${agentId}_${sessionType}_${sessionKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
          name,
          emoji,
          status,
          sprite,
          workspace,
          lastSeen: new Date(session.updatedAt).toISOString(),
          description,
          realMetrics,
          metadata: {
            source: 'real_openclaw',
            agentId,
            sessionType,
            sessionKey,
            sessionId: session.sessionId,
            isReal: true,
            dataSource: 'sessions.json',
            timestamp: new Date().toISOString()
          }
        };
        
        realAgents.push(realAgent);
        
      } catch (error) {
        console.log(`Ошибка обработки сессии ${sessionKey}:`, error.message);
      }
    }
    
    console.log(`Создано ${realAgents.length} РЕАЛЬНЫХ агентов из OpenClaw`);
    
    // Если реальных агентов нет - пустой массив (НЕТ демо)
    if (realAgents.length === 0) {
      console.log('Нет реальных агентов в OpenClaw');
      return [];
    }
    
    // Добавляем системную информацию как отдельного агента (только если есть реальные агенты)
    realAgents.push({
      id: 'system_monitor',
      name: 'System Monitor',
      emoji: '📊',
      status: 'working',
      sprite: '🟢',
      workspace: 'system',
      lastSeen: new Date().toISOString(),
      description: 'Мониторинг системы OpenClaw',
      metadata: {
        source: 'system',
        agentCount: realAgents.length,
        sessionCount: sessionKeys.length,
        isReal: true
      }
    });
    
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
    
    // Получаем РЕАЛЬНУЮ историю активности из OpenClaw
    const activities = activityStore.getAgentActivity(agentId, 50);
    
    // Всегда возвращаем реальные данные (даже если пустой массив)
    res.json(activities);
    
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

// API: Аналитика производительности агентов
app.get('/api/analytics/performance', (req, res) => {
  try {
    console.log('[INFO] /api/analytics/performance called');
    
    // Получаем текущих агентов
    const agents = currentAgents;
    
    // Анализируем агентов
    const analytics = analyticsEngine.analyzeAgents(agents);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      analytics
    });
  } catch (err) {
    console.error('Error in /api/analytics/performance:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Исторические данные для графиков
app.get('/api/analytics/history', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    console.log(`[INFO] /api/analytics/history called for ${hours} hours`);
    
    const historicalData = analyticsEngine.getHistoricalData(hours);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      hours,
      ...historicalData
    });
  } catch (err) {
    console.error('Error in /api/analytics/history:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Статистика по workspace
app.get('/api/analytics/workspaces', (req, res) => {
  try {
    console.log('[INFO] /api/analytics/workspaces called');
    
    const workspaceStats = analyticsEngine.getWorkspaceStats();
    const performanceSummary = analyticsEngine.getPerformanceSummary();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      workspaceStats,
      performanceSummary
    });
  } catch (err) {
    console.error('Error in /api/analytics/workspaces:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Сводка производительности
app.get('/api/analytics/summary', (req, res) => {
  try {
    console.log('[INFO] /api/analytics/summary called');
    
    const summary = analyticsEngine.getPerformanceSummary();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary
    });
  } catch (err) {
    console.error('Error in /api/analytics/summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// Цены моделей OpenAI/DeepSeek за 1K токенов (в USD)
const MODEL_PRICING = {
  'deepseek-chat': { input: 0.00027, output: 0.0011 },
  'deepseek-reasoner': { input: 0.00055, output: 0.00219 },
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'unknown': { input: 0.00027, output: 0.0011 } // fallback = deepseek-chat
};

// API: Получить метрики использования токенов и оценку стоимости
app.get('/api/tokens/costs', (req, res) => {
  try {
    console.log('[INFO] /api/tokens/costs called');
    const agents = currentAgents.filter(a => a.realMetrics && a.realMetrics.totalTokens > 0);
    
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const byAgent = [];
    const byWorkspace = {};
    const byModel = {};
    
    agents.forEach(agent => {
      const m = agent.realMetrics || {};
      const model = (m.model || 'unknown').toLowerCase();
      const pricing = MODEL_PRICING[model] || MODEL_PRICING['unknown'];
      const inTokens = m.inputTokens || 0;
      const outTokens = m.outputTokens || 0;
      const tokTotal = m.totalTokens || (inTokens + outTokens);
      
      // Стоимость: input и output считаются отдельно
      const cost = (inTokens / 1000) * pricing.input + (outTokens / 1000) * pricing.output;
      
      totalInputTokens += inTokens;
      totalOutputTokens += outTokens;
      totalTokens += tokTotal;
      totalCost += cost;
      
      // Per-agent
      byAgent.push({
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        workspace: agent.workspace,
        status: agent.status,
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalTokens: tokTotal,
        cost: parseFloat(cost.toFixed(6)),
        model: model,
        costPerModel: pricing
      });
      
      // Per workspace
      const ws = agent.workspace || 'unknown';
      if (!byWorkspace[ws]) {
        byWorkspace[ws] = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, agentCount: 0 };
      }
      byWorkspace[ws].inputTokens += inTokens;
      byWorkspace[ws].outputTokens += outTokens;
      byWorkspace[ws].totalTokens += tokTotal;
      byWorkspace[ws].cost += cost;
      byWorkspace[ws].agentCount++;
      
      // Per model
      if (!byModel[model]) {
        byModel[model] = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, agentCount: 0 };
      }
      byModel[model].inputTokens += inTokens;
      byModel[model].outputTokens += outTokens;
      byModel[model].totalTokens += tokTotal;
      byModel[model].cost += cost;
      byModel[model].agentCount++;
    });
    
    // Sort by cost descending
    byAgent.sort((a, b) => b.cost - a.cost);
    
    // Round workspace costs
    for (const ws of Object.keys(byWorkspace)) {
      byWorkspace[ws].cost = parseFloat(byWorkspace[ws].cost.toFixed(6));
    }
    for (const mdl of Object.keys(byModel)) {
      byModel[mdl].cost = parseFloat(byModel[mdl].cost.toFixed(6));
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalAgents: agents.length,
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        totalCost: parseFloat(totalCost.toFixed(6)),
        avgCostPerAgent: agents.length > 0 ? parseFloat((totalCost / agents.length).toFixed(6)) : 0,
        topModel: Object.entries(byModel).sort((a, b) => b[1].totalTokens - a[1].totalTokens)[0]?.[0] || 'unknown'
      },
      byAgent,
      byWorkspace,
      byModel
    });
  } catch (err) {
    console.error('Error in /api/tokens/costs:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Тренды токенов (снапшоты с временными метками)
app.get('/api/tokens/trends', (req, res) => {
  try {
    console.log('[INFO] /api/tokens/trends called');
    const hours = parseInt(req.query.hours) || 24;
    
    // Получаем исторические снапшоты из analytics engine
    const history = analyticsEngine.getHistoricalData(hours);
    const rawSnapshots = history.raw || [];
    
    // Превращаем снапшоты в временной ряд
    const trends = rawSnapshots.map(snap => ({
      timestamp: snap.timestamp,
      totalTokens: snap.tokenUsage?.total || 0,
      totalAgents: snap.totalAgents || 0,
      byStatus: snap.byStatus || {},
      // Стоимость оцениваем из снапшота (fallback для старых снапшотов)
      estimatedCost: snap.tokenUsage?.total 
        ? parseFloat(((snap.tokenUsage.total / 1000) * 0.0005).toFixed(6)) 
        : 0
    }));
    
    // Сортируем по времени
    trends.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      hours,
      dataPoints: trends.length,
      trends
    });
  } catch (err) {
    console.error('Error in /api/tokens/trends:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Получить системную статистику здоровья
app.get('/api/system/health', (req, res) => {
  try {
    const os = require('os');
    // os-utils not available, using OS built-ins
    
    // CPU info
    const cpus = os.cpus();
    const cpuCores = cpus.length;
    
    // Memory info
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    
    // Load average
    const loadAvg = os.loadavg();
    
    // Uptime
    const uptime = os.uptime();
    
    // Disk info (try reading /proc/mounts or using df)
    let diskInfo = { total: 0, used: 0, free: 0, usagePercent: 0 };
    try {
      const dfOutput = require('child_process').execSync('df -B1 / | tail -1').toString().trim().split(/\s+/);
      if (dfOutput.length >= 4) {
        diskInfo.total = parseInt(dfOutput[1]) || 0;
        diskInfo.used = parseInt(dfOutput[2]) || 0;
        diskInfo.free = parseInt(dfOutput[3]) || 0;
        diskInfo.usagePercent = Math.round((diskInfo.used / (diskInfo.total || 1)) * 100);
      }
    } catch (e) { /* df failed, use statvfs or zero */ }
    
    // Get disk usage for specific paths
    let diskPaths = [];
    try {
      const dfAll = require('child_process').execSync('df -B1 --type=ext4 --type=ext3 --type=ext2 --type=xfs --type=btrfs 2>/dev/null | tail -n +2').toString().trim();
      if (dfAll) {
        dfAll.split('\n').forEach(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 6) {
            diskPaths.push({
              filesystem: parts[0],
              total: parseInt(parts[1]) || 0,
              used: parseInt(parts[2]) || 0,
              free: parseInt(parts[3]) || 0,
              usagePercent: parseInt(parts[4]) || 0,
              mount: parts[5]
            });
          }
        });
      }
    } catch (e) { /* silent */ }
    
    // Running processes
    let processCount = 0;
    try {
      const psOutput = require('child_process').execSync('ps aux | wc -l').toString().trim();
      processCount = parseInt(psOutput) - 1 || 0;
    } catch (e) { /* silent */ }
    
    // Network connections
    let netConnections = { total: 0, listen: 0, established: 0, timeWait: 0 };
    try {
      const ssOutput = require('child_process').execSync('ss -tlnp 2>/dev/null | tail -n +2 | wc -l').toString().trim();
      netConnections.listen = parseInt(ssOutput) || 0;
      
      const estOutput = require('child_process').execSync('ss -tnp 2>/dev/null | tail -n +2 | wc -l').toString().trim();
      netConnections.established = parseInt(estOutput) || 0;
      
      netConnections.total = netConnections.listen + netConnections.established;
    } catch (e) { /* silent */ }
    
    // Calculate health score (0-100)
    const cpuLoadPercent = loadAvg[0] / cpuCores;
    const healthScore = Math.max(0, Math.min(100, Math.round(
      100 - (cpuLoadPercent * 30) - (memPercent * 0.3) - (diskInfo.usagePercent * 0.2) - (loadAvg[2] / cpuCores * 10)
    )));
    
    // Determine health status
    let healthStatus = 'healthy';
    if (healthScore < 40) healthStatus = 'critical';
    else if (healthScore < 60) healthStatus = 'warning';
    else if (healthScore < 80) healthStatus = 'fair';
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      platform: os.platform() + ' ' + os.release(),
      health: {
        score: healthScore,
        status: healthStatus
      },
      cpu: {
        cores: cpuCores,
        loadAvg1: loadAvg[0],
        loadAvg5: loadAvg[1],
        loadAvg15: loadAvg[2],
        loadPercent: Math.round(cpuLoadPercent * 100)
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: memPercent
      },
      disk: {
        total: diskInfo.total,
        used: diskInfo.used,
        free: diskInfo.free,
        usagePercent: diskInfo.usagePercent,
        mounts: diskPaths
      },
      system: {
        uptime: uptime,
        processes: processCount,
        network: netConnections,
        nodeVersion: process.version,
        pid: process.pid
      }
    });
  } catch (err) {
    console.error('Error in /api/system/health:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Получить последние строки из логов OpenClaw
app.get('/api/system/logs', (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 15;
    const logFiles = [
      '/home/openclaw/.openclaw/workspace/agent-dashboard/server.log',
      '/home/openclaw/.openclaw/workspace/tinkoff-trader.log',
      '/home/openclaw/.openclaw/workspace/uncle-bob.log',
      '/home/openclaw/.openclaw/workspace/secret-newspaper.log',
      '/home/openclaw/.openclaw/workspace/telegram-send.log',
      '/home/openclaw/.openclaw/workspace/agent-dashboard/server-test.log'
    ];
    
    const logEntries = [];
    
    logFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          const allLines = content.split('\n').filter(l => l.trim());
          const lastLines = allLines.slice(-lines);
          
          lastLines.forEach(line => {
            logEntries.push({
              file: path.basename(file),
              line: line,
              timestamp: new Date(fs.statSync(file).mtime).toISOString()
            });
          });
        }
      } catch (e) { /* skip problematic files */ }
    });
    
    // Sort by timestamp (latest first within reason)
    logEntries.reverse();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalEntries: logEntries.length,
      entries: logEntries.slice(0, 50)
    });
  } catch (err) {
    console.error('Error in /api/system/logs:', err);
    res.status(500).json({ error: err.message });
  }
});

// API endpoint для получения списка сервисов и таймеров
app.get('/api/services', (req, res) => {
  try {
    const workspacePath = '/home/openclaw/.openclaw/workspace';
    const files = fs.readdirSync(workspacePath);
    
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
    
    serviceFiles.forEach(sf => {
      const baseName = sf.replace('.service', '');
      
      let serviceContent = '';
      try {
        serviceContent = fs.readFileSync(path.join(workspacePath, sf), 'utf8');
      } catch (e) { serviceContent = ''; }
      
      const execMatch = serviceContent.match(/ExecStart=(.+)/);
      const descMatch = serviceContent.match(/Description=(.+)/);
      const workingDirMatch = serviceContent.match(/WorkingDirectory=(.+)/);
      
      const timerFilesForService = timerMap[baseName] || [];
      const timers = [];
      timerFilesForService.forEach(timerFile => {
        let timerContent = '';
        try {
          timerContent = fs.readFileSync(path.join(workspacePath, timerFile), 'utf8');
        } catch (e) {}
        
        const onCalendarMatch = timerContent.match(/OnCalendar=(.+)/);
        const onBootMatch = timerContent.match(/OnBootSec=(.+)/);
        
        timers.push({
          file: timerFile,
          onCalendar: onCalendarMatch ? onCalendarMatch[1].trim() : null,
          onBootSec: onBootMatch ? onBootMatch[1].trim() : null
        });
      });
      
      // Try systemd status
      let systemdActive = false;
      let systemdStatus = 'unknown';
      let systemdEnabled = false;
      let lastRunTime = null;
      let nextRunTime = null;
      
      try {
        const statusOut = execSync('systemctl is-active ' + baseName + ' 2>/dev/null', { timeout: 3000 }).toString().trim();
        systemdActive = statusOut === 'active';
        systemdStatus = statusOut;
        
        const enabledOut = execSync('systemctl is-enabled ' + baseName + ' 2>/dev/null', { timeout: 3000 }).toString().trim();
        systemdEnabled = enabledOut === 'enabled';
        
        if (timerFilesForService.length > 0) {
          try {
            const timerInfo = execSync('systemctl show ' + timerFilesForService[0].replace('.timer', '') + '.timer --property=LastTriggerUSec --property=NextElapseUSecReal 2>/dev/null', { timeout: 3000 }).toString().trim();
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
          } catch (e) {}
        }
      } catch (e) {}
      
      // Calculate log file size for status indication
      let logSizeBytes = 0;
      const logPath = path.join(workspacePath, baseName + '.log');
      try {
        if (fs.existsSync(logPath)) {
          logSizeBytes = fs.statSync(logPath).size;
        }
      } catch (e) {}
      
      services.push({
        name: baseName,
        file: sf,
        description: descMatch ? descMatch[1].trim() : baseName,
        execStart: execMatch ? execMatch[1].trim() : 'N/A',
        workingDirectory: workingDirMatch ? workingDirMatch[1].trim() : workspacePath,
        timers,
        systemd: {
          active: systemdActive,
          status: systemdStatus,
          enabled: systemdEnabled,
          lastRun: lastRunTime,
          nextRun: nextRunTime
        },
        logSizeBytes
      });
    });
    
    services.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      serviceDir: workspacePath,
      total: services.length,
      services
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// TRADING MONITOR API — анализ логов торговых ботов
// ============================================================

// Конфигурация торговых ботов
const TRADING_BOTS = [
  {
    id: 'bybit-mean-reversion',
    name: 'Bybit Mean Reversion',
    emoji: '📉',
    logPath: '/home/openclaw/.openclaw/workspace/bybit-trades.log',
    jsonPath: '/home/openclaw/.openclaw/workspace/bybit-trades.json',
    serviceName: 'bybit-trader'
  },
  {
    id: 'bybit-scalp',
    name: 'Bybit Scalp',
    emoji: '⚡',
    logPath: '/home/openclaw/.openclaw/workspace/bybit-aggressive-trades.log',
    jsonPath: '/home/openclaw/.openclaw/workspace/bybit-aggressive-trades.json',
    serviceName: 'bybit-aggressive-trader'
  },
  {
    id: 'memecoin-trader',
    name: 'Memecoin Trader',
    emoji: '🔥',
    logPath: '/home/openclaw/.openclaw/workspace/memecoins-trades.log',
    serviceName: 'memecoin-trader'
  },
  {
    id: 'tinkoff-trader',
    name: 'Тинькофф Трейдер',
    emoji: '🏦',
    logPath: '/home/openclaw/.openclaw/workspace/tinkoff-trader.log',
    serviceName: 'tinkoff-trader'
  }
];

// Парсинг торговых логов
function parseTradeLog(botConfig) {
  try {
    if (!fs.existsSync(botConfig.logPath)) {
      return { exists: false };
    }

    const stat = fs.statSync(botConfig.logPath);
    const content = fs.readFileSync(botConfig.logPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    const result = {
      exists: true,
      sizeBytes: stat.size,
      totalLines: lines.length,
      lastModified: stat.mtime.toISOString(),
      lastLine: lines.length > 0 ? lines[lines.length - 1] : '',
      recentTrades: [],
      balances: [],
      activePositions: [],
      totalBuys: 0,
      totalSells: 0,
      totalErrors: 0,
      lastRunTime: null,
      logExcerpt: lines.slice(-30).join('\n')
    };

    // Парсим только последние 1000 строк для производительности
    const recentLines = lines.slice(-1000);

    recentLines.forEach(line => {
      if (line.includes('✅ Buy') || line.includes('✅ Купили') || line.includes('✅ Куплено')) {
        result.totalBuys++;
        const match = line.match(/Buy\s+([\d.]+)\s+(\w+)/);
        if (match) {
          result.recentTrades.push({ type: 'buy', symbol: match[2], qty: parseFloat(match[1]), time: line.substring(0, 23), raw: line });
        }
      }

      if (line.includes('✅ Sell') || line.includes('✅ Продали')) {
        result.totalSells++;
        const match = line.match(/Sell\s+([\d.]+)\s+(\w+)/);
        if (match) {
          result.recentTrades.push({ type: 'sell', symbol: match[2], qty: parseFloat(match[1]), time: line.substring(0, 23), raw: line });
        }
      }

      if (line.includes('ERROR') || line.includes('❌')) {
        result.totalErrors++;
      }

      const balMatch = line.match(/USDT[^\d]*([\d.]+)/);
      if (balMatch && !result.balances.some(b => b.time === line.substring(0, 23) && Math.abs(b.amount - parseFloat(balMatch[1])) < 0.01)) {
        result.balances.push({ time: line.substring(0, 23), amount: parseFloat(balMatch[1]) });
      }

      if (line.includes('Уже держим') || line.includes('✅ Держим')) {
        const posMatch = line.match(/держим\s+([\d.]+)\s+(\w+)/);
        if (posMatch && !result.activePositions.some(p => p.symbol === posMatch[2])) {
          result.activePositions.push({ symbol: posMatch[2], qty: parseFloat(posMatch[1]), time: line.substring(0, 23) });
        }
      }

      const priceMatch = line.match(/(\w+USDT):\s*\$([\d.]+),\s*dd=([-\d.]+)%/);
      if (priceMatch) {
        const existing = result.activePositions.find(p => p.symbol === priceMatch[1]);
        if (existing) {
          existing.price = parseFloat(priceMatch[2]);
          existing.drawdown = parseFloat(priceMatch[3]);
        } else {
          result.activePositions.push({ symbol: priceMatch[1], price: parseFloat(priceMatch[2]), drawdown: parseFloat(priceMatch[3]), time: line.substring(0, 23) });
        }
      }

      if (line.includes('SCALP') || line.includes('MEAN REVERSION') || line.includes('MEMECOIN TRADER') || line.includes('Тинькофф Трейдер')) {
        result.lastRunTime = line.substring(0, 23);
      }

      const итогоMatch = line.match(/ИТОГО:\s*(\d+)/);
      if (итогоMatch) result.totalTradesThisRun = parseInt(итогоMatch[1]);
    });

    result.recentTrades = result.recentTrades.slice(-20).reverse();
    result.balances = result.balances.slice(-10);

    if (botConfig.jsonPath && fs.existsSync(botConfig.jsonPath)) {
      try {
        const jsonContent = fs.readFileSync(botConfig.jsonPath, 'utf8');
        const tradeEntries = jsonContent.split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
        result.jsonTrades = tradeEntries.slice(-10);
        result.totalJsonTrades = tradeEntries.length;
      } catch (e) { result.jsonParseError = e.message; }
    }

    return result;
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

// API: Получить мониторинг торговли
app.get('/api/trading/monitor', function(req, res) {
  try {
    var bots = TRADING_BOTS.map(function(bot) {
      var data = parseTradeLog(bot);
      var serviceStatus = 'unknown';
      var isActive = false;
      try {
        var out = execSync('systemctl is-active ' + bot.serviceName + ' 2>/dev/null || echo unknown', { timeout: 3000, encoding: 'utf8' }).toString().trim();
        isActive = out === 'active';
        serviceStatus = out;
      } catch (e) {}

      var secondsSinceUpdate = null;
      if (data.exists && data.lastModified) {
        secondsSinceUpdate = Math.floor((Date.now() - new Date(data.lastModified).getTime()) / 1000);
      }

      return {
        id: bot.id,
        name: bot.name,
        emoji: bot.emoji,
        serviceName: bot.serviceName,
        serviceStatus: serviceStatus,
        isActive: isActive,
        secondsSinceUpdate: secondsSinceUpdate,
        exists: data.exists,
        sizeBytes: data.sizeBytes,
        totalLines: data.totalLines,
        lastModified: data.lastModified,
        lastLine: data.lastLine,
        recentTrades: data.recentTrades || [],
        balances: data.balances || [],
        activePositions: data.activePositions || [],
        totalBuys: data.totalBuys || 0,
        totalSells: data.totalSells || 0,
        totalErrors: data.totalErrors || 0,
        lastRunTime: data.lastRunTime,
        logExcerpt: data.logExcerpt || '',
        totalTradesThisRun: data.totalTradesThisRun,
        jsonTrades: data.jsonTrades || [],
        totalJsonTrades: data.totalJsonTrades || 0
      };
    });

    var summary = {
      totalBots: bots.length,
      activeBots: bots.filter(function(b) { return b.isActive; }).length,
      totalBuys: bots.reduce(function(s, b) { return s + (b.totalBuys || 0); }, 0),
      totalSells: bots.reduce(function(s, b) { return s + (b.totalSells || 0); }, 0),
      totalErrors: bots.reduce(function(s, b) { return s + (b.totalErrors || 0); }, 0),
      activePositions: bots.reduce(function(s, b) { return s + (b.activePositions ? b.activePositions.length : 0); }, 0)
    };

    res.json({ success: true, timestamp: new Date().toISOString(), summary: summary, bots: bots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API endpoint для получения логов сервиса
app.get('/api/services/:name/logs', (req, res) => {
  try {
    const serviceName = req.params.name;
    const lines = parseInt(req.query.lines) || 20;
    const workspacePath = '/home/openclaw/.openclaw/workspace';
    
    const logPatterns = [
      path.join(workspacePath, serviceName + '.log'),
      path.join(workspacePath, serviceName + '-trades.log'),
      path.join(workspacePath, serviceName + '.json')
    ];
    
    let logContent = '';
    let sourceFile = '';
    for (const logPath of logPatterns) {
      if (fs.existsSync(logPath)) {
        try {
          const content = fs.readFileSync(logPath, 'utf8');
          const allLines = content.split('\n').filter(l => l.trim());
          const lastLines = allLines.slice(-lines);
          logContent = lastLines.join('\n');
          sourceFile = path.basename(logPath);
          break;
        } catch (e) { continue; }
      }
    }
    
    // Try journalctl
    if (!logContent) {
      try {
        const journalOut = execSync('journalctl -u ' + serviceName + ' --no-pager -n ' + lines + ' 2>/dev/null', { timeout: 3000 }).toString().trim();
        if (journalOut) {
          logContent = journalOut;
          sourceFile = 'journalctl';
        }
      } catch (e) {}
    }
    
    res.json({
      success: true,
      service: serviceName,
      source: sourceFile,
      lines: logContent ? logContent.split('\n').length : 0,
      log: logContent
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
