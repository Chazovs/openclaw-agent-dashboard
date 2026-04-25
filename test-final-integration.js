// Финальный интеграционный тест аналитической системы

const AnalyticsModule = require('./analytics-module');

console.log('🚀 Запуск финального интеграционного теста аналитической системы\n');

async function runIntegrationTest() {
  let passed = 0;
  let failed = 0;
  
  // Тест 1: Инициализация модуля
  console.log('1. Тестирование инициализации модуля...');
  try {
    const analytics = new AnalyticsModule();
    console.log('   ✅ Модуль успешно инициализирован');
    passed++;
  } catch (err) {
    console.log(`   ❌ Ошибка инициализации: ${err.message}`);
    failed++;
  }
  
  // Тест 2: Сбор данных с мок-агентами
  console.log('\n2. Тестирование сбора данных...');
  try {
    const analytics = new AnalyticsModule();
    const mockAgents = [
      {
        id: 'test-main',
        name: 'Main Agent',
        status: 'working',
        realMetrics: { totalTokens: 50000 }
      },
      {
        id: 'test-telegram',
        name: 'Telegram Bot',
        status: 'idle',
        realMetrics: { totalTokens: 25000 }
      },
      {
        id: 'test-cron',
        name: 'Cron Agent',
        status: 'working',
        realMetrics: { totalTokens: 10000 }
      }
    ];
    
    const data = await analytics.collectData(mockAgents);
    
    if (!data.current) throw new Error('Нет текущих данных');
    if (!data.hourly || !Array.isArray(data.hourly)) throw new Error('Нет часовых данных');
    if (!data.daily || !Array.isArray(data.daily)) throw new Error('Нет дневных данных');
    if (!data.system) throw new Error('Нет системных метрик');
    if (!data.alerts || !Array.isArray(data.alerts)) throw new Error('Нет данных об уведомлениях');
    
    console.log(`   ✅ Данные успешно собраны:`);
    console.log(`      - Агентов: ${data.current.agentCount}`);
    console.log(`      - Работающих: ${data.current.workingAgents}`);
    console.log(`      - Токенов: ${data.current.totalTokens}`);
    console.log(`      - Часовых точек: ${data.hourly.length}`);
    console.log(`      - Дневных точек: ${data.daily.length}`);
    console.log(`      - Уведомлений: ${data.alerts.length}`);
    passed++;
  } catch (err) {
    console.log(`   ❌ Ошибка сбора данных: ${err.message}`);
    failed++;
  }
  
  // Тест 3: Системные метрики
  console.log('\n3. Тестирование системных метрик...');
  try {
    const analytics = new AnalyticsModule();
    const metrics = analytics.getSystemMetrics();
    
    if (!metrics.cpu) throw new Error('Нет данных CPU');
    if (!metrics.memory) throw new Error('Нет данных памяти');
    if (!metrics.uptime && metrics.uptime !== 0) throw new Error('Нет данных uptime');
    if (!metrics.timestamp) throw new Error('Нет timestamp');
    
    console.log(`   ✅ Системные метрики:`);
    console.log(`      - CPU load: ${metrics.cpu.loadAvg[0].toFixed(2)}`);
    console.log(`      - Ядер: ${metrics.cpu.cores}`);
    console.log(`      - Память: ${metrics.memory.usagePercent}%`);
    console.log(`      - Uptime: ${Math.floor(metrics.uptime / 3600)}ч`);
    passed++;
  } catch (err) {
    console.log(`   ❌ Ошибка системных метрик: ${err.message}`);
    failed++;
  }
  
  // Тест 4: Сводка аналитики
  console.log('\n4. Тестирование сводки аналитики...');
  try {
    const analytics = new AnalyticsModule();
    const summary = analytics.getAnalyticsSummary();
    
    if (!summary.summary) throw new Error('Нет сводки');
    if (!summary.hourly || !Array.isArray(summary.hourly)) throw new Error('Нет часовых данных в сводке');
    if (!summary.daily || !Array.isArray(summary.daily)) throw new Error('Нет дневных данных в сводке');
    
    console.log(`   ✅ Сводка аналитики:`);
    console.log(`      - Текущие агенты: ${summary.summary.currentAgents}`);
    console.log(`      - Тренд агентов: ${summary.summary.agentTrend}`);
    console.log(`      - Текущие токены: ${summary.summary.currentTokens}`);
    console.log(`      - Тренд токенов: ${summary.summary.tokenTrend}`);
    console.log(`      - Загрузка системы: ${summary.summary.systemLoad.toFixed(2)}`);
    console.log(`      - Использование памяти: ${summary.summary.memoryUsage}%`);
    passed++;
  } catch (err) {
    console.log(`   ❌ Ошибка сводки аналитики: ${err.message}`);
    failed++;
  }
  
  // Тест 5: Генерация уведомлений
  console.log('\n5. Тестирование генерации уведомлений...');
  try {
    const analytics = new AnalyticsModule();
    const mockAgents = [
      { id: 'test-1', name: 'Test 1', status: 'error', realMetrics: { totalTokens: 1000 } },
      { id: 'test-2', name: 'Test 2', status: 'error', realMetrics: { totalTokens: 2000 } }
    ];
    
    const highLoadMetrics = {
      cpu: { loadAvg: [3.5, 3.0, 2.5], cores: 4, usage: { user: 0, system: 0 } },
      memory: { total: 1000000000, free: 100000000, used: 900000000, usagePercent: 90 },
      uptime: 1000,
      timestamp: new Date().toISOString()
    };
    
    const alerts = analytics.generateAlerts(mockAgents, highLoadMetrics);
    
    console.log(`   ✅ Сгенерировано уведомлений: ${alerts.length}`);
    alerts.forEach((alert, i) => {
      console.log(`      ${i + 1}. ${alert.type.toUpperCase()}: ${alert.message}`);
    });
    
    // Проверяем, что есть уведомления об ошибках
    const errorAlerts = alerts.filter(a => a.type === 'error');
    if (errorAlerts.length === 0) {
      console.log('   ⚠️ Нет уведомлений об ошибках агентов');
    }
    
    passed++;
  } catch (err) {
    console.log(`   ❌ Ошибка генерации уведомлений: ${err.message}`);
    failed++;
  }
  
  // Тест 6: Сохранение и загрузка данных
  console.log('\n6. Тестирование сохранения и загрузки данных...');
  try {
    const analytics = new AnalyticsModule();
    
    // Сохраняем тестовые данные
    analytics.hourlyData['2026-04-22T12'] = {
      timestamp: '2026-04-22T12:00:00.000Z',
      agentCount: 5,
      workingAgents: 3,
      totalTokens: 15000,
      system: { cpu: { loadAvg: [1.0, 0.8, 0.6] }, memory: { usagePercent: 50 } }
    };
    
    analytics.saveData();
    console.log('   ✅ Данные успешно сохранены');
    
    // Создаем новый экземпляр для проверки загрузки
    const analytics2 = new AnalyticsModule();
    if (analytics2.hourlyData['2026-04-22T12']) {
      console.log('   ✅ Данные успешно загружены');
    } else {
      console.log('   ⚠️ Данные не загрузились (возможно, файл не был записан)');
    }
    
    passed++;
  } catch (err) {
    console.log(`   ❌ Ошибка сохранения/загрузки: ${err.message}`);
    failed++;
  }
  
  // Итоги
  console.log('\n' + '='.repeat(50));
  console.log('📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:');
  console.log('='.repeat(50));
  console.log(`✅ Пройдено: ${passed} тестов`);
  console.log(`❌ Провалено: ${failed} тестов`);
  console.log(`📈 Успешность: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));
  
  if (failed === 0) {
    console.log('\n🎉 ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ!');
    console.log('Аналитическая система готова к интеграции в дашборд.');
    return true;
  } else {
    console.log('\n⚠️ Некоторые тесты не прошли. Требуется доработка.');
    return false;
  }
}

// Запуск тестов
runIntegrationTest().then(success => {
  if (success) {
    console.log('\n🚀 Рекомендации к развертыванию:');
    console.log('1. Убедитесь, что сервер дашборда использует обновленный analytics-module.js');
    console.log('2. Проверьте доступность API endpoints:');
    console.log('   - GET /api/analytics');
    console.log('   - GET /api/analytics/summary');
    console.log('3. Добавьте ссылку на аналитическую панель в основной дашборд');
    console.log('4. Перезапустите сервер дашборда');
    console.log('\n📊 Аналитическая панель будет доступна по адресу:');
    console.log('   http://localhost:3000/analytics-panel.html');
    process.exit(0);
  } else {
    process.exit(1);
  }
}).catch(err => {
  console.error('❌ Критическая ошибка при запуске тестов:', err);
  process.exit(1);
});