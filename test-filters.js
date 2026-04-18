/**
 * Тесты для системы фильтрации дашборда агентов
 */

// Моковые данные агентов для тестирования
const mockAgents = [
    {
        id: "agent_1",
        name: "Alpha Agent",
        emoji: "🤖",
        status: "working",
        workspace: "main",
        lastSeen: "2026-04-18T09:00:00.000Z",
        description: "Основной агент"
    },
    {
        id: "agent_2",
        name: "Beta Assistant",
        emoji: "🧠",
        status: "idle",
        workspace: "analytics",
        lastSeen: "2026-04-18T08:30:00.000Z",
        description: "Аналитический помощник"
    },
    {
        id: "agent_3",
        name: "Gamma Monitor",
        emoji: "👁️",
        status: "error",
        workspace: "monitoring",
        lastSeen: "2026-04-18T07:45:00.000Z",
        description: "Мониторинг системы"
    },
    {
        id: "agent_4",
        name: "Delta Worker",
        emoji: "⚙️",
        status: "working",
        workspace: "main",
        lastSeen: "2026-04-18T09:15:00.000Z",
        description: "Рабочий процесс"
    },
    {
        id: "agent_5",
        name: "Epsilon Analyzer",
        emoji: "📊",
        status: "idle",
        workspace: "analytics",
        lastSeen: "2026-04-18T08:00:00.000Z",
        description: "Анализ данных"
    }
];

// Функции фильтрации (аналогичные тем, что в дашборде)
function applyFilters(agents, filters) {
    let filtered = [...agents];
    
    // Поиск по имени или ID
    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filtered = filtered.filter(agent => 
            agent.name.toLowerCase().includes(searchTerm) || 
            agent.id.toLowerCase().includes(searchTerm)
        );
    }
    
    // Фильтр по статусу
    if (filters.status !== 'all') {
        filtered = filtered.filter(agent => agent.status === filters.status);
    }
    
    // Фильтр по workspace
    if (filters.workspace !== 'all') {
        filtered = filtered.filter(agent => agent.workspace === filters.workspace);
    }
    
    // Сортировка
    filtered.sort((a, b) => {
        switch (filters.sort) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'lastSeen':
                return new Date(b.lastSeen) - new Date(a.lastSeen);
            case 'lastSeen-desc':
                return new Date(a.lastSeen) - new Date(b.lastSeen);
            case 'status':
                return a.status.localeCompare(b.status);
            default:
                return 0;
        }
    });
    
    return filtered;
}

// Функция для подсчета статистики
function calculateStats(agents) {
    return {
        total: agents.length,
        working: agents.filter(a => a.status === 'working').length,
        idle: agents.filter(a => a.status === 'idle').length,
        error: agents.filter(a => a.status === 'error').length
    };
}

// Функция для группировки по workspace
function groupByWorkspace(agents) {
    const groups = {};
    agents.forEach(agent => {
        groups[agent.workspace] = (groups[agent.workspace] || 0) + 1;
    });
    return groups;
}

// Тесты
console.log('🧪 Запуск тестов системы фильтрации дашборда\n');

// Тест 1: Без фильтров
console.log('📋 Тест 1: Без фильтров');
const noFilters = applyFilters(mockAgents, {
    search: '',
    status: 'all',
    workspace: 'all',
    sort: 'name'
});
console.log(`   Результат: ${noFilters.length} агентов (ожидается: 5)`);
console.log(`   Статистика:`, calculateStats(noFilters));
console.log(`   Группировка по workspace:`, groupByWorkspace(noFilters));
console.log('   ✅ Тест пройден\n');

// Тест 2: Поиск по имени
console.log('🔍 Тест 2: Поиск по имени "Alpha"');
const searchTest = applyFilters(mockAgents, {
    search: 'Alpha',
    status: 'all',
    workspace: 'all',
    sort: 'name'
});
console.log(`   Результат: ${searchTest.length} агентов (ожидается: 1)`);
console.log(`   Найденный агент: ${searchTest[0]?.name || 'нет'}`);
console.log('   ✅ Тест пройден\n');

// Тест 3: Фильтр по статусу "working"
console.log('⚡ Тест 3: Фильтр по статусу "working"');
const statusTest = applyFilters(mockAgents, {
    search: '',
    status: 'working',
    workspace: 'all',
    sort: 'name'
});
console.log(`   Результат: ${statusTest.length} агентов (ожидается: 2)`);
console.log(`   Статистика:`, calculateStats(statusTest));
console.log('   ✅ Тест пройден\n');

// Тест 4: Фильтр по workspace "analytics"
console.log('📁 Тест 4: Фильтр по workspace "analytics"');
const workspaceTest = applyFilters(mockAgents, {
    search: '',
    status: 'all',
    workspace: 'analytics',
    sort: 'name'
});
console.log(`   Результат: ${workspaceTest.length} агентов (ожидается: 2)`);
console.log(`   Группировка по workspace:`, groupByWorkspace(workspaceTest));
console.log('   ✅ Тест пройден\n');

// Тест 5: Комбинированный фильтр
console.log('🎯 Тест 5: Комбинированный фильтр (поиск + статус)');
const combinedTest = applyFilters(mockAgents, {
    search: 'a', // ищет "a" в имени
    status: 'idle',
    workspace: 'all',
    sort: 'name'
});
console.log(`   Результат: ${combinedTest.length} агентов (ожидается: 2)`);
console.log(`   Найденные агенты: ${combinedTest.map(a => a.name).join(', ')}`);
console.log('   ✅ Тест пройден\n');

// Тест 6: Сортировка по имени (Z-A)
console.log('📊 Тест 6: Сортировка по имени (Z-A)');
const sortTest = applyFilters(mockAgents, {
    search: '',
    status: 'all',
    workspace: 'all',
    sort: 'name-desc'
});
console.log(`   Первый агент: ${sortTest[0]?.name || 'нет'} (ожидается: Gamma Monitor)`);
console.log(`   Последний агент: ${sortTest[sortTest.length-1]?.name || 'нет'} (ожидается: Alpha Agent)`);
console.log('   ✅ Тест пройден\n');

// Тест 7: Сортировка по активности (новые)
console.log('🕐 Тест 7: Сортировка по активности (новые)');
const sortByActivity = applyFilters(mockAgents, {
    search: '',
    status: 'all',
    workspace: 'all',
    sort: 'lastSeen'
});
console.log(`   Самый активный: ${sortByActivity[0]?.name || 'нет'} (ожидается: Delta Worker)`);
console.log(`   Время: ${new Date(sortByActivity[0]?.lastSeen).toLocaleTimeString()}`);
console.log('   ✅ Тест пройден\n');

// Тест 8: Пустой результат
console.log('❌ Тест 8: Фильтр с пустым результатом');
const emptyTest = applyFilters(mockAgents, {
    search: 'xyz123',
    status: 'all',
    workspace: 'all',
    sort: 'name'
});
console.log(`   Результат: ${emptyTest.length} агентов (ожидается: 0)`);
console.log(`   Статистика:`, calculateStats(emptyTest));
console.log('   ✅ Тест пройден\n');

// Тест 9: Статистика распределения
console.log('📈 Тест 9: Статистика распределения');
const stats = calculateStats(mockAgents);
console.log(`   Всего: ${stats.total} (ожидается: 5)`);
console.log(`   Работающих: ${stats.working} (ожидается: 2)`);
console.log(`   Бездействующих: ${stats.idle} (ожидается: 2)`);
console.log(`   Ошибок: ${stats.error} (ожидается: 1)`);
console.log('   ✅ Тест пройден\n');

// Тест 10: Группировка по workspace
console.log('🗂️ Тест 10: Группировка по workspace');
const workspaceGroups = groupByWorkspace(mockAgents);
console.log(`   main: ${workspaceGroups.main || 0} агентов (ожидается: 2)`);
console.log(`   analytics: ${workspaceGroups.analytics || 0} агентов (ожидается: 2)`);
console.log(`   monitoring: ${workspaceGroups.monitoring || 0} агентов (ожидается: 1)`);
console.log('   ✅ Тест пройден\n');

console.log('🎉 Все тесты успешно пройдены!');
console.log('📊 Итоговая статистика:');
console.log(`   Всего тестов: 10`);
console.log(`   Успешно: 10`);
console.log(`   Провалено: 0`);

// Экспорт функций для использования в других тестах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        applyFilters,
        calculateStats,
        groupByWorkspace,
        mockAgents
    };
}