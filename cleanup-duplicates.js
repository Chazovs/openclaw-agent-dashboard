// Скрипт для очистки дубликатов агентов в server-simple.js
const fs = require('fs');

// Читаем текущий код
const code = fs.readFileSync('server-simple.js', 'utf8');

// Заменяем начальный список агентов на чистый (без дубликатов)
const cleanAgents = `let currentAgents = [
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
];`;

// Находим и заменяем объявление currentAgents
const lines = code.split('\n');
let inAgentsArray = false;
let agentsStart = -1;
let agentsEnd = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('let currentAgents = [')) {
    agentsStart = i;
    inAgentsArray = true;
  }
  if (inAgentsArray && lines[i].trim() === '];') {
    agentsEnd = i;
    break;
  }
}

if (agentsStart >= 0 && agentsEnd >= 0) {
  // Заменяем блок
  const newLines = [
    ...lines.slice(0, agentsStart),
    cleanAgents,
    ...lines.slice(agentsEnd + 1)
  ];
  
  fs.writeFileSync('server-simple.js', newLines.join('\n'));
  console.log('✅ Дубликаты очищены! Начальный список восстановлен (3 агента)');
} else {
  console.log('⚠️ Не удалось найти currentAgents в коде');
}