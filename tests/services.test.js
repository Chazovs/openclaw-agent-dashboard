#!/usr/bin/env node
/**
 * Тесты для Services & Cron Monitor — новая панель дашборда
 * 
 * Запуск: node tests/services.test.js
 * 
 * Тесты проверяют:
 * 1. API endpoint /api/services отдаёт корректные данные
 * 2. API endpoint /api/services/:name/logs отдаёт логи
 * 3. Фронтенд рендерит панель сервисов
 */

const http = require('http');
const BASE_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(BASE_URL + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    }).on('error', reject);
  });
}

let passed = 0;
let failed = 0;

async function runTests() {
  console.log('\n🧪 Services & Cron Monitor — Тесты API\n');

  // Test 1: GET /api/services returns 200
  try {
    const res = await httpGet('/api/services');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    console.log('  ✅ GET /api/services — статус 200');
    passed++;
  } catch (e) {
    console.log('  ❌ GET /api/services — статус 200:', e.message);
    failed++;
  }

  // Test 2: Response structure
  try {
    const { data } = await httpGet('/api/services');
    if (!data.success) throw new Error('success !== true');
    if (!Array.isArray(data.services)) throw new Error('services не массив');
    if (typeof data.total !== 'number') throw new Error('total не число');
    if (data.services.length !== data.total) throw new Error('total не совпадает');
    console.log('  ✅ GET /api/services — корректная структура ответа');
    passed++;
  } catch (e) {
    console.log('  ❌ GET /api/services — корректная структура ответа:', e.message);
    failed++;
  }

  // Test 3: Required fields
  try {
    const { data } = await httpGet('/api/services');
    for (const svc of data.services) {
      if (!svc.name) throw new Error(`${svc.file} не имеет name`);
      if (!svc.file) throw new Error(`${svc.name} не имеет file`);
      if (!Array.isArray(svc.timers)) throw new Error(`${svc.name} не имеет timers`);
    }
    console.log(`  ✅ GET /api/services — ${data.services.length} сервисов с обязательными полями`);
    passed++;
  } catch (e) {
    console.log('  ❌ GET /api/services — обязательные поля:', e.message);
    failed++;
  }

  // Test 4: Timer structure
  try {
    const { data } = await httpGet('/api/services');
    let hasTimerServices = false;
    for (const svc of data.services) {
      if (svc.timers.length > 0) {
        hasTimerServices = true;
        for (const timer of svc.timers) {
          if (!timer.file) throw new Error(`Таймер ${svc.name} без file`);
        }
      }
    }
    if (!hasTimerServices) throw new Error('Нет сервисов с таймерами');
    console.log('  ✅ GET /api/services — структура таймеров корректна');
    passed++;
  } catch (e) {
    console.log('  ❌ GET /api/services — структура таймеров:', e.message);
    failed++;
  }

  // Test 5: Service logs
  try {
    const { data: svcData } = await httpGet('/api/services');
    if (svcData.services.length === 0) throw new Error('Нет сервисов');
    const firstSvc = svcData.services[0];
    const res = await httpGet(`/api/services/${encodeURIComponent(firstSvc.name)}/logs?lines=5`);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (typeof res.data.log !== 'string') throw new Error('log не строка');
    console.log(`  ✅ GET /api/services/:name/logs — логи для ${firstSvc.name} (${res.data.source})`);
    passed++;
  } catch (e) {
    console.log('  ❌ GET /api/services/:name/logs:', e.message);
    failed++;
  }

  // Test 6: HTML includes services panel
  try {
    const res = await httpGet('/');
    if (typeof res.data !== 'string') throw new Error('Not HTML');
    if (!res.data.includes('Сервисы и Cron задачи')) throw new Error('Заголовок не найден');
    if (!res.data.includes('services-body')) throw new Error('services-body не найден');
    if (!res.data.includes('loadServicesPanel')) throw new Error('JS loadServicesPanel не найдена');
    if (!res.data.includes('service-card')) throw new Error('CSS service-card не найден');
    console.log('  ✅ GET / — HTML содержит панель "Сервисы и Cron задачи"');
    passed++;
  } catch (e) {
    console.log('  ❌ GET / — HTML содержит панель:', e.message);
    failed++;
  }

  // Results
  console.log(`\n📊 Результаты: ${passed} ✅ пройдено, ${failed} ❌ провалено\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
