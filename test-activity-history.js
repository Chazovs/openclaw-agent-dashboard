#!/usr/bin/env node

/**
 * Тесты для функциональности истории активности агентов
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';
const TEST_AGENT_ID = 'test_agent_' + Date.now();

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
    console.log(`\n🔍 Тест: ${name}`);
    try {
        testFn();
        console.log(`✅ ${name} - ПРОЙДЕН`);
        testsPassed++;
    } catch (error) {
        console.log(`❌ ${name} - ПРОВАЛЕН`);
        console.log(`   Ошибка: ${error.message}`);
        testsFailed++;
    }
}

function httpRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = responseData ? JSON.parse(responseData) : {};
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: responseData
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function testActivityHistoryAPI() {
    console.log('🚀 Запуск тестов истории активности агентов');
    console.log('=' .repeat(50));

    // Тест 1: Получение списка агентов
    await runTest('Получение списка агентов', async () => {
        const response = await httpRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/agents',
            method: 'GET'
        });

        if (response.statusCode !== 200) {
            throw new Error(`Ожидался статус 200, получен ${response.statusCode}`);
        }

        if (!Array.isArray(response.data)) {
            throw new Error('Ответ должен быть массивом');
        }

        console.log(`   Найдено агентов: ${response.data.length}`);
    });

    // Тест 2: Получение истории активности существующего агента
    await runTest('Получение истории активности агента', async () => {
        const response = await httpRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/agents/main_claude/activity',
            method: 'GET'
        });

        if (response.statusCode !== 200) {
            throw new Error(`Ожидался статус 200, получен ${response.statusCode}`);
        }

        if (!response.data.success) {
            throw new Error('Ответ должен содержать success: true');
        }

        if (response.data.agentId !== 'main_claude') {
            throw new Error(`Ожидался agentId: main_claude, получен: ${response.data.agentId}`);
        }

        if (!Array.isArray(response.data.activity)) {
            throw new Error('Activity должен быть массивом');
        }

        console.log(`   Записей активности: ${response.data.activity.length}`);
        
        // Проверяем структуру записи активности
        if (response.data.activity.length > 0) {
            const activity = response.data.activity[0];
            const requiredFields = ['timestamp', 'status', 'task', 'duration'];
            for (const field of requiredFields) {
                if (!(field in activity)) {
                    throw new Error(`Запись активности должна содержать поле: ${field}`);
                }
            }
        }
    });

    // Тест 3: Получение истории активности с лимитом
    await runTest('Получение истории активности с лимитом', async () => {
        const response = await httpRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/agents/main_claude/activity?limit=1',
            method: 'GET'
        });

        if (response.statusCode !== 200) {
            throw new Error(`Ожидался статус 200, получен ${response.statusCode}`);
        }

        if (response.data.activity.length > 1) {
            throw new Error(`Лимит 1 не соблюден, получено: ${response.data.activity.length} записей`);
        }

        console.log(`   Записей с лимитом 1: ${response.data.activity.length}`);
    });

    // Тест 4: Получение истории активности несуществующего агента
    await runTest('Получение истории активности несуществующего агента', async () => {
        const response = await httpRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/agents/nonexistent_agent/activity',
            method: 'GET'
        });

        if (response.statusCode !== 200) {
            throw new Error(`Ожидался статус 200, получен ${response.statusCode}`);
        }

        if (!response.data.success) {
            throw new Error('Ответ должен содержать success: true даже для несуществующего агента');
        }

        if (response.data.activity.length !== 0) {
            throw new Error('Для несуществующего агента должен возвращаться пустой массив');
        }

        console.log(`   Записей для несуществующего агента: ${response.data.activity.length}`);
    });

    // Тест 5: Обновление статуса агента (должно создавать запись в истории)
    await runTest('Обновление статуса агента создает запись в истории', async () => {
        // Сначала получаем текущую историю
        const beforeResponse = await httpRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/agents/main_claude/activity',
            method: 'GET'
        });

        const beforeCount = beforeResponse.data.activity.length;

        // Обновляем статус
        const updateResponse = await httpRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/agents/main_claude/status',
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        }, {
            status: 'working',
            task: 'Тестовая задача'
        });

        if (updateResponse.statusCode !== 200) {
            throw new Error(`Ожидался статус 200 при обновлении, получен ${updateResponse.statusCode}`);
        }

        // Ждем немного
        await new Promise(resolve => setTimeout(resolve, 100));

        // Проверяем, что история обновилась
        const afterResponse = await httpRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/agents/main_claude/activity',
            method: 'GET'
        });

        const afterCount = afterResponse.data.activity.length;

        if (afterCount <= beforeCount) {
            throw new Error(`История не обновилась. Было: ${beforeCount}, стало: ${afterCount}`);
        }

        console.log(`   Записей до обновления: ${beforeCount}, после: ${afterCount}`);
    });

    // Тест 6: Структура записи активности
    await runTest('Проверка структуры записи активности', async () => {
        const response = await httpRequest({
            hostname: 'localhost',
            port: 3001,
            path: '/api/agents/main_claude/activity?limit=1',
            method: 'GET'
        });

        if (response.data.activity.length > 0) {
            const activity = response.data.activity[0];
            
            // Проверяем типы данных
            if (typeof activity.timestamp !== 'string') {
                throw new Error('timestamp должен быть строкой');
            }
            
            if (typeof activity.status !== 'string') {
                throw new Error('status должен быть строкой');
            }
            
            if (!['working', 'idle', 'error'].includes(activity.status)) {
                throw new Error(`Недопустимый статус: ${activity.status}`);
            }
            
            if (typeof activity.task !== 'string') {
                throw new Error('task должен быть строкой');
            }
            
            if (typeof activity.duration !== 'number') {
                throw new Error('duration должен быть числом');
            }
            
            console.log(`   Структура записи корректна: ${JSON.stringify(activity, null, 2)}`);
        }
    });

    console.log('\n' + '=' .repeat(50));
    console.log('📊 ИТОГИ ТЕСТОВ:');
    console.log(`✅ Пройдено: ${testsPassed}`);
    console.log(`❌ Провалено: ${testsFailed}`);
    
    if (testsFailed === 0) {
        console.log('\n🎉 Все тесты пройдены успешно!');
        process.exit(0);
    } else {
        console.log('\n💥 Обнаружены ошибки в тестах');
        process.exit(1);
    }
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
});

// Запуск тестов
testActivityHistoryAPI().catch(error => {
    console.error('❌ Ошибка при запуске тестов:', error);
    process.exit(1);
});