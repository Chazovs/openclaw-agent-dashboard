#!/usr/bin/env node
// Скрипт для записи активности агентов в реальном времени

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';

// Конфигурация агентов и их типичных задач
const AGENT_TASKS = {
  'main_claude': [
    'Управление системой OpenClaw',
    'Обработка пользовательских запросов',
    'Координация работы агентов',
    'Мониторинг дашборда',
    'Обновление конфигурации'
  ],
  'uncle_bob': [
    'Разработка новой функциональности',
    'Рефакторинг кода',
    'Оптимизация производительности',
    'Исправление багов',
    'Документирование кода'
  ],
  'journalist_goodman': [
    'Сбор материалов для Тайной газеты',
    'Написание статей',
    'Редактирование контента',
    'Публикация в Telegram',
    'Исследование тем'
  ]
};

// Статусы и их вероятности
const STATUSES = [
  { status: 'working', weight: 0.6 },
  { status: 'idle', weight: 0.3 },
  { status: 'sleeping', weight: 0.1 }
];

// Генератор случайных задач
function getRandomTask(agentId) {
  const tasks = AGENT_TASKS[agentId] || ['Неизвестная задача'];
  return tasks[Math.floor(Math.random() * tasks.length)];
}

// Генератор случайного статуса
function getRandomStatus() {
  const random = Math.random();
  let cumulative = 0;
  
  for (const status of STATUSES) {
    cumulative += status.weight;
    if (random <= cumulative) {
      return status.status;
    }
  }
  
  return 'idle';
}

// Запись активности агента
async function recordAgentActivity(agentId, agentName) {
  try {
    const status = getRandomStatus();
    const task = getRandomTask(agentId);
    const duration = Math.floor(Math.random() * 30 + 5) * 60000; // 5-35 минут
    
    const activity = {
      status,
      task,
      duration,
      details: {
        agentName,
        timestamp: new Date().toISOString(),
        source: 'activity-recorder'
      },
      source: 'recorder'
    };
    
    const response = await axios.post(`${API_BASE}/agents/${agentId}/activity`, activity);
    
    console.log(`[${new Date().toLocaleTimeString()}] Записана активность для ${agentName}: ${task} (${status})`);
    return response.data;
    
  } catch (error) {
    console.error(`Ошибка записи активности для ${agentName}:`, error.message);
    return null;
  }
}

// Основная функция
async function main() {
  console.log('🚀 Запуск системы записи активности агентов');
  console.log('==========================================');
  
  // Получаем список агентов
  try {
    const response = await axios.get(`${API_BASE}/agents`);
    const agents = response.data;
    
    console.log(`Найдено ${agents.length} агентов:`);
    agents.forEach(agent => {
      console.log(`  • ${agent.name} (${agent.id}) - ${agent.status}`);
    });
    console.log('');
    
    // Записываем начальную активность для каждого агента
    for (const agent of agents) {
      await recordAgentActivity(agent.id, agent.name);
    }
    
    // Настраиваем периодическую запись
    const interval = 5 * 60 * 1000; // Каждые 5 минут
    console.log(`\n📝 Автоматическая запись активности каждые ${interval / 60000} минут`);
    console.log('Нажмите Ctrl+C для остановки\n');
    
    setInterval(async () => {
      const agent = agents[Math.floor(Math.random() * agents.length)];
      await recordAgentActivity(agent.id, agent.name);
    }, interval);
    
  } catch (error) {
    console.error('Ошибка получения списка агентов:', error.message);
    console.log('Убедитесь что дашборд запущен на порту 3000');
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  main().catch(error => {
    console.error('Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = { recordAgentActivity };