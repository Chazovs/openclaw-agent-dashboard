const AnalyticsModule = require('./analytics-module');

// Мок-данные для тестирования
const mockAgents = [
    {
        id: 'agent-1',
        name: 'Test Agent 1',
        status: 'working',
        realMetrics: {
            totalTokens: 1000,
            model: 'deepseek-chat'
        }
    },
    {
        id: 'agent-2',
        name: 'Test Agent 2',
        status: 'idle',
        realMetrics: {
            totalTokens: 500,
            model: 'deepseek-chat'
        }
    },
    {
        id: 'agent-3',
        name: 'Test Agent 3',
        status: 'sleeping',
        realMetrics: {
            totalTokens: 200,
            model: 'deepseek-chat'
        }
    },
    {
        id: 'agent-4',
        name: 'Test Agent 4',
        status: 'error',
        realMetrics: {
            totalTokens: 100,
            model: 'deepseek-chat'
        }
    }
];

// Тесты для AnalyticsModule
async function runTests() {
    console.log('🧪 Running Analytics Module Unit Tests\n');
    
    let passed = 0;
    let failed = 0;
    
    // Тест 1: Инициализация модуля
    try {
        const analytics = new AnalyticsModule();
        console.log('✅ Test 1: Module initialization passed');
        passed++;
    } catch (err) {
        console.error('❌ Test 1: Module initialization failed:', err.message);
        failed++;
    }
    
    // Тест 2: Анализ агентов
    try {
        const analytics = new AnalyticsModule();
        const agentMetrics = analytics.analyzeAgents(mockAgents);
        
        if (agentMetrics.totalTokens !== 1800) {
            throw new Error(`Expected totalTokens=1800, got ${agentMetrics.totalTokens}`);
        }
        
        if (agentMetrics.avgTokensPerAgent !== 450) {
            throw new Error(`Expected avgTokensPerAgent=450, got ${agentMetrics.avgTokensPerAgent}`);
        }
        
        if (agentMetrics.topAgentsByTokens.length !== 4) {
            throw new Error(`Expected 4 top agents, got ${agentMetrics.topAgentsByTokens.length}`);
        }
        
        // Проверяем сортировку
        if (agentMetrics.topAgentsByTokens[0].tokens !== 1000) {
            throw new Error('Top agent should have 1000 tokens');
        }
        
        console.log('✅ Test 2: Agent analysis passed');
        passed++;
    } catch (err) {
        console.error('❌ Test 2: Agent analysis failed:', err.message);
        failed++;
    }
    
    // Тест 3: Генерация алертов
    try {
        const analytics = new AnalyticsModule();
        
        // Мок системных метрик с высокой загрузкой
        const highLoadMetrics = {
            cpu: { loadAvg: [3.0, 2.5, 2.0], cores: 4 },
            memory: { usagePercent: 90 },
            disk: { total: 0, free: 0, used: 0 },
            uptime: 1000,
            timestamp: new Date().toISOString()
        };
        
        const alerts = analytics.generateAlerts(mockAgents, highLoadMetrics);
        
        // Должны быть алерты для высокой загрузки CPU и памяти
        const cpuAlert = alerts.find(a => a.message.includes('CPU'));
        const memoryAlert = alerts.find(a => a.message.includes('памяти'));
        const errorAlert = alerts.find(a => a.message.includes('ошибки'));
        
        if (!cpuAlert) throw new Error('Missing CPU load alert');
        if (!memoryAlert) throw new Error('Missing memory usage alert');
        if (!errorAlert) throw new Error('Missing error agents alert');
        
        console.log('✅ Test 3: Alert generation passed');
        passed++;
    } catch (err) {
        console.error('❌ Test 3: Alert generation failed:', err.message);
        failed++;
    }
    
    // Тест 4: Получение часовых данных
    try {
        const analytics = new AnalyticsModule();
        
        // Добавляем тестовые данные
        const now = new Date();
        const hourKey = now.toISOString().slice(0, 13);
        
        analytics.hourlyData[hourKey] = {
            timestamp: now.toISOString(),
            agentCount: 4,
            workingAgents: 1,
            idleAgents: 1,
            sleepingAgents: 1,
            errorAgents: 1,
            totalTokens: 1800,
            avgTokensPerAgent: 450,
            system: { cpu: { loadAvg: [1.0, 0.8, 0.6] }, memory: { usagePercent: 50 } }
        };
        
        const hourlyData = analytics.getHourlyData(24);
        
        if (hourlyData.length !== 24) {
            throw new Error(`Expected 24 hours of data, got ${hourlyData.length}`);
        }
        
        // Последний элемент должен быть нашим тестовым данным
        const lastHour = hourlyData[hourlyData.length - 1];
        if (lastHour.agentCount !== 4) {
            throw new Error(`Expected last hour agentCount=4, got ${lastHour.agentCount}`);
        }
        
        console.log('✅ Test 4: Hourly data retrieval passed');
        passed++;
    } catch (err) {
        console.error('❌ Test 4: Hourly data retrieval failed:', err.message);
        failed++;
    }
    
    // Тест 5: Получение дневных данных
    try {
        const analytics = new AnalyticsModule();
        
        // Добавляем тестовые данные
        const today = new Date().toISOString().slice(0, 10);
        
        analytics.dailyData[today] = {
            date: today,
            hourlyPoints: 24,
            maxAgents: 10,
            minAgents: 2,
            totalTokens: 50000,
            avgWorkingAgents: 5,
            systemMetrics: []
        };
        
        const dailyData = analytics.getDailyData(7);
        
        if (dailyData.length !== 7) {
            throw new Error(`Expected 7 days of data, got ${dailyData.length}`);
        }
        
        // Первый элемент должен быть сегодняшним днем
        const todayData = dailyData[dailyData.length - 1];
        if (todayData.maxAgents !== 10) {
            throw new Error(`Expected today maxAgents=10, got ${todayData.maxAgents}`);
        }
        
        console.log('✅ Test 5: Daily data retrieval passed');
        passed++;
    } catch (err) {
        console.error('❌ Test 5: Daily data retrieval failed:', err.message);
        failed++;
    }
    
    // Тест 6: Сводка аналитики
    try {
        const analytics = new AnalyticsModule();
        
        // Добавляем тестовые данные
        const now = new Date();
        const hourKey = now.toISOString().slice(0, 13);
        const prevHourKey = new Date(now.getTime() - 60 * 60 * 1000).toISOString().slice(0, 13);
        
        analytics.hourlyData[hourKey] = {
            timestamp: now.toISOString(),
            agentCount: 5,
            workingAgents: 3,
            totalTokens: 2000,
            system: { cpu: { loadAvg: [1.5, 1.2, 1.0] }, memory: { usagePercent: 60 } }
        };
        
        analytics.hourlyData[prevHourKey] = {
            timestamp: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
            agentCount: 4,
            workingAgents: 2,
            totalTokens: 1500,
            system: { cpu: { loadAvg: [1.0, 0.9, 0.8] }, memory: { usagePercent: 55 } }
        };
        
        const summary = analytics.getAnalyticsSummary();
        
        if (!summary.summary) throw new Error('Missing summary data');
        if (summary.summary.currentAgents !== 5) throw new Error('Wrong current agents');
        if (summary.summary.agentTrend !== 1) throw new Error('Wrong agent trend');
        if (summary.summary.currentTokens !== 2000) throw new Error('Wrong current tokens');
        if (summary.summary.tokenTrend !== 500) throw new Error('Wrong token trend');
        
        console.log('✅ Test 6: Analytics summary passed');
        passed++;
    } catch (err) {
        console.error('❌ Test 6: Analytics summary failed:', err.message);
        failed++;
    }
    
    // Итоги
    console.log('\n📊 Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log('\n🎉 All tests passed successfully!');
        process.exit(0);
    } else {
        console.log('\n⚠️ Some tests failed');
        process.exit(1);
    }
}

// Запуск тестов
runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});