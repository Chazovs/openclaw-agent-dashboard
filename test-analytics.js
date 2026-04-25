/**
 * Тесты для модуля аналитики производительности
 */

const AnalyticsEngine = require('./analytics-engine');
const assert = require('assert');

console.log('🚀 Запуск тестов модуля аналитики...\n');

// Тест 1: Создание экземпляра AnalyticsEngine
console.log('📋 Тест 1: Инициализация AnalyticsEngine');
try {
    const analytics = new AnalyticsEngine();
    assert(analytics, 'Экземпляр AnalyticsEngine должен быть создан');
    assert(analytics.metricsHistory, 'Должна существовать история метрик');
    assert(Array.isArray(analytics.metricsHistory), 'История метрик должна быть массивом');
    console.log('✅ Тест 1 пройден\n');
} catch (error) {
    console.error('❌ Тест 1 не пройден:', error.message);
    process.exit(1);
}

// Тест 2: Анализ агентов
console.log('📋 Тест 2: Анализ агентов');
try {
    const analytics = new AnalyticsEngine();
    
    const testAgents = [
        {
            id: 'test_agent_1',
            name: 'Тестовый агент 1',
            status: 'working',
            workspace: 'test',
            realMetrics: {
                totalTokens: 50000,
                ageMs: 3600000 // 1 час
            }
        },
        {
            id: 'test_agent_2',
            name: 'Тестовый агент 2',
            status: 'sleeping',
            workspace: 'test',
            realMetrics: {
                totalTokens: 10000,
                ageMs: 7200000 // 2 часа
            }
        },
        {
            id: 'test_agent_3',
            name: 'Тестовый агент 3',
            status: 'error',
            workspace: 'another',
            realMetrics: {
                totalTokens: 150000,
                ageMs: 1800000 // 0.5 часа
            }
        }
    ];
    
    const result = analytics.analyzeAgents(testAgents);
    
    // Проверка базовых метрик
    assert.strictEqual(result.totalAgents, 3, 'Должно быть 3 агента');
    assert.strictEqual(result.byStatus.working, 1, 'Должен быть 1 работающий агент');
    assert.strictEqual(result.byStatus.sleeping, 1, 'Должен быть 1 спящий агент');
    assert.strictEqual(result.byStatus.error, 1, 'Должен быть 1 агент с ошибкой');
    
    // Проверка использования токенов
    assert.strictEqual(result.tokenUsage.total, 210000, 'Общее использование токенов должно быть 210000');
    assert.strictEqual(result.tokenUsage.average, 70000, 'Среднее использование токенов должно быть 70000');
    assert.strictEqual(result.tokenUsage.max, 150000, 'Максимальное использование токенов должно быть 150000');
    
    // Проверка workspace
    assert.strictEqual(result.byWorkspace.test, 2, 'Должно быть 2 агента в workspace test');
    assert.strictEqual(result.byWorkspace.another, 1, 'Должен быть 1 агент в workspace another');
    
    console.log('✅ Тест 2 пройден\n');
} catch (error) {
    console.error('❌ Тест 2 не пройден:', error.message);
    process.exit(1);
}

// Тест 3: Проверка оповещений
console.log('📋 Тест 3: Генерация оповещений');
try {
    const analytics = new AnalyticsEngine();
    
    const highUsageAgent = {
        id: 'high_usage',
        name: 'Агент с высоким использованием',
        status: 'working',
        workspace: 'test',
        realMetrics: {
            totalTokens: 150000, // Выше порога 100000
            ageMs: 7200000 // 2 часа
        }
    };
    
    const errorAgent = {
        id: 'error_agent',
        name: 'Агент с ошибкой',
        status: 'error',
        workspace: 'test',
        realMetrics: {
            totalTokens: 5000,
            ageMs: 3600000
        }
    };
    
    const result = analytics.analyzeAgents([highUsageAgent, errorAgent]);
    
    // Проверка оповещений
    assert(Array.isArray(result.alerts), 'Оповещения должны быть массивом');
    assert(result.alerts.length >= 2, 'Должно быть как минимум 2 оповещения');
    
    const highTokenAlert = result.alerts.find(a => a.type === 'high_token_usage');
    const errorAlert = result.alerts.find(a => a.type === 'agent_error');
    
    assert(highTokenAlert, 'Должно быть оповещение о высоком использовании токенов');
    assert(errorAlert, 'Должно быть оповещение об ошибке агента');
    
    assert.strictEqual(highTokenAlert.level, 'warning', 'Уровень оповещения должен быть warning');
    assert.strictEqual(errorAlert.level, 'error', 'Уровень оповещения должен быть error');
    
    console.log('✅ Тест 3 пройден\n');
} catch (error) {
    console.error('❌ Тест 3 не пройден:', error.message);
    process.exit(1);
}

// Тест 4: Исторические данные
console.log('📋 Тест 4: Работа с историческими данными');
try {
    const analytics = new AnalyticsEngine();
    
    // Добавим тестовые данные
    for (let i = 0; i < 5; i++) {
        analytics.analyzeAgents([
            {
                id: `test_${i}`,
                name: `Тестовый агент ${i}`,
                status: 'working',
                workspace: 'test',
                realMetrics: {
                    totalTokens: 10000 * (i + 1),
                    ageMs: 3600000
                }
            }
        ]);
    }
    
    // Получение исторических данных
    const historicalData = analytics.getHistoricalData(24);
    
    assert(historicalData, 'Должны быть возвращены исторические данные');
    assert(historicalData.raw, 'Должны быть сырые данные');
    assert(historicalData.charts, 'Должны быть данные для графиков');
    assert(historicalData.summary, 'Должна быть сводка');
    
    assert(Array.isArray(historicalData.raw), 'Сырые данные должны быть массивом');
    assert(historicalData.raw.length > 0, 'Должна быть хотя бы одна запись');
    
    console.log('✅ Тест 4 пройден\n');
} catch (error) {
    console.error('❌ Тест 4 не пройден:', error.message);
    process.exit(1);
}

// Тест 5: Статистика workspace
console.log('📋 Тест 5: Статистика по workspace');
try {
    const analytics = new AnalyticsEngine();
    
    // Добавим тестовые данные
    analytics.analyzeAgents([
        { id: 'a1', name: 'Агент 1', status: 'working', workspace: 'core', realMetrics: { totalTokens: 50000, ageMs: 3600000 } },
        { id: 'a2', name: 'Агент 2', status: 'sleeping', workspace: 'core', realMetrics: { totalTokens: 30000, ageMs: 7200000 } },
        { id: 'a3', name: 'Агент 3', status: 'working', workspace: 'messaging', realMetrics: { totalTokens: 80000, ageMs: 1800000 } },
        { id: 'a4', name: 'Агент 4', status: 'idle', workspace: 'automation', realMetrics: { totalTokens: 20000, ageMs: 3600000 } }
    ]);
    
    const workspaceStats = analytics.getWorkspaceStats();
    
    assert(workspaceStats, 'Должна быть возвращена статистика workspace');
    assert(workspaceStats.core, 'Должна быть статистика для workspace core');
    assert(workspaceStats.messaging, 'Должна быть статистика для workspace messaging');
    assert(workspaceStats.automation, 'Должна быть статистика для workspace automation');
    
    assert.strictEqual(workspaceStats.core.count, 2, 'В workspace core должно быть 2 агента');
    assert.strictEqual(workspaceStats.messaging.count, 1, 'В workspace messaging должен быть 1 агент');
    assert.strictEqual(workspaceStats.automation.count, 1, 'В workspace automation должен быть 1 агент');
    
    console.log('✅ Тест 5 пройден\n');
} catch (error) {
    console.error('❌ Тест 5 не пройден:', error.message);
    process.exit(1);
}

// Тест 6: Сводка производительности
console.log('📋 Тест 6: Сводка производительности');
try {
    const analytics = new AnalyticsEngine();
    
    // Добавим тестовые данные
    analytics.analyzeAgents([
        { id: 'test', name: 'Тестовый агент', status: 'working', workspace: 'test', realMetrics: { totalTokens: 75000, ageMs: 3600000 } }
    ]);
    
    const summary = analytics.getPerformanceSummary();
    
    assert(summary, 'Должна быть возвращена сводка производительности');
    assert(summary.current, 'Должны быть текущие метрики');
    assert(summary.trends, 'Должны быть тренды');
    assert(summary.recommendations, 'Должны быть рекомендации');
    
    assert.strictEqual(summary.current.totalAgents, 1, 'Должен быть 1 агент в текущих метриках');
    assert(summary.current.totalTokens > 0, 'Должно быть положительное использование токенов');
    
    console.log('✅ Тест 6 пройден\n');
} catch (error) {
    console.error('❌ Тест 6 не пройден:', error.message);
    process.exit(1);
}

// Тест 7: Расчет эффективности
console.log('📋 Тест 7: Расчет эффективности');
try {
    const analytics = new AnalyticsEngine();
    
    const agents = [
        {
            id: 'eff_test',
            name: 'Тест эффективности',
            status: 'working',
            workspace: 'test',
            realMetrics: {
                totalTokens: 36000, // 36K токенов
                ageMs: 7200000 // 2 часа = 7200 секунд
            }
        }
    ];
    
    const result = analytics.analyzeAgents(agents);
    
    // Эффективность = токены / время в часах
    // 36000 токенов / 2 часа = 18000 токенов/час
    const expectedEfficiency = 18000;
    const actualEfficiency = result.efficiency.byAgent[0]?.efficiency;
    
    assert(actualEfficiency, 'Должна быть рассчитана эффективность');
    assert(
        Math.abs(actualEfficiency - expectedEfficiency) < 1,
        `Эффективность должна быть около ${expectedEfficiency}, получено ${actualEfficiency}`
    );
    
    console.log('✅ Тест 7 пройден\n');
} catch (error) {
    console.error('❌ Тест 7 не пройден:', error.message);
    process.exit(1);
}

// Тест 8: Генерация рекомендаций
console.log('📋 Тест 8: Генерация рекомендаций');
try {
    const analytics = new AnalyticsEngine();
    
    // Агент с высокой нагрузкой для генерации рекомендаций
    const agents = [
        {
            id: 'rec_test',
            name: 'Тест рекомендаций',
            status: 'error', // Ошибка для генерации рекомендации
            workspace: 'test',
            realMetrics: {
                totalTokens: 200000, // Высокая нагрузка для рекомендации
                ageMs: 3600000
            }
        }
    ];
    
    const result = analytics.analyzeAgents(agents);
    const summary = analytics.getPerformanceSummary();
    
    assert(summary.recommendations, 'Должны быть сгенерированы рекомендации');
    assert(summary.recommendations.length > 0, 'Должна быть хотя бы одна рекомендация');
    
    const hasErrorRecommendation = summary.recommendations.some(r => 
        r.type === 'maintenance' && r.title.includes('ошибк')
    );
    
    assert(hasErrorRecommendation, 'Должна быть рекомендация по ошибкам');
    
    console.log('✅ Тест 8 пройден\n');
} catch (error) {
    console.error('❌ Тест 8 не пройден:', error.message);
    process.exit(1);
}

// Тест 9: Ограничение истории
console.log('📋 Тест 9: Ограничение размера истории');
try {
    const analytics = new AnalyticsEngine();
    
    // Добавим больше записей, чем максимальный размер
    const maxSize = analytics.maxHistorySize;
    const extraRecords = 10;
    
    for (let i = 0; i < maxSize + extraRecords; i++) {
        analytics.analyzeAgents([
            {
                id: `limit_test_${i}`,
                name: `Тест ограничения ${i}`,
                status: 'working',
                workspace: 'test',
                realMetrics: {
                    totalTokens: 1000,
                    ageMs: 3600000
                }
            }
        ]);
    }
    
    assert(
        analytics.metricsHistory.length <= maxSize,
        `Размер истории не должен превышать ${maxSize}, текущий размер: ${analytics.metricsHistory.length}`
    );
    
    console.log('✅ Тест 9 пройден\n');
} catch (error) {
    console.error('❌ Тест 9 не пройден:', error.message);
    process.exit(1);
}

// Тест 10: Расчет трендов
console.log('📋 Тест 10: Расчет трендов');
try {
    const analytics = new AnalyticsEngine();
    
    // Тестовые данные для тренда
    const testData = [100, 150, 200, 250, 300]; // Рост на 50%
    const trend = analytics.calculateTrend(testData);
    
    assert.strictEqual(trend, 200, 'Тренд роста должен быть 200% (со 100 до 300)');
    
    // Тест с нулевым начальным значением
    const zeroStartData = [0, 100, 200];
    const zeroTrend = analytics.calculateTrend(zeroStartData);
    
    assert.strictEqual(zeroTrend, 100, 'При росте с 0 до >0 тренд должен быть 100%');
    
    // Тест с отрицательным трендом
    const negativeData = [300, 250, 200, 150, 100]; // Падение на 66.67%
    const negativeTrend = analytics.calculateTrend(negativeData);
    
    assert(negativeTrend < 0, 'При падении тренд должен быть отрицательным');
    
    console.log('✅ Тест 10 пройден\n');
} catch (error) {
    console.error('❌ Тест 10 не пройден:', error.message);
    process.exit(1);
}

console.log('🎉 Все тесты успешно пройдены!');
console.log('\n📊 Итог:');
console.log('   ✅ 10/10 тестов пройдены');
console.log('   📈 Модуль аналитики готов к использованию');
console.log('   🔧 Рекомендуется запустить интеграционные тесты с реальными данными');