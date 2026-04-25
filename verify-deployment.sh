#!/bin/bash

# Скрипт проверки развертывания аналитической панели

echo "🔍 Проверка развертывания аналитической панели OpenClaw Dashboard"
echo "================================================================"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода статуса
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Функция для проверки файла
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ Файл найден: $1${NC}"
        return 0
    else
        echo -e "${RED}❌ Файл не найден: $1${NC}"
        return 1
    fi
}

# Функция для проверки сервера
check_server() {
    echo -e "${BLUE}Проверка сервера на порту 3000...${NC}"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -q "200"; then
        echo -e "${GREEN}✅ Сервер работает на http://localhost:3000/${NC}"
        return 0
    else
        echo -e "${RED}❌ Сервер не отвечает на порту 3000${NC}"
        return 1
    fi
}

# Функция для проверки API
check_api() {
    local endpoint=$1
    local name=$2
    echo -e "${BLUE}Проверка API: $name...${NC}"
    
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$endpoint" | grep -q "200"; then
        echo -e "${GREEN}✅ API работает: $endpoint${NC}"
        
        # Проверяем структуру ответа
        if curl -s "http://localhost:3000$endpoint" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print('${GREEN}✅ Структура данных корректна${NC}')
except:
    print('${YELLOW}⚠️  Ответ не в формате JSON${NC}')
" 2>/dev/null; then
            return 0
        else
            return 1
        fi
    else
        echo -e "${RED}❌ API не отвечает: $endpoint${NC}"
        return 1
    fi
}

# Начало проверки
echo -e "${BLUE}1. Проверка файлов...${NC}"
echo ""

# Проверяем основные файлы
check_file "analytics-module.js"
FILE_MODULE=$?

check_file "public/analytics.html"
FILE_HTML=$?

check_file "public/analytics.js"
FILE_JS=$?

check_file "server.js"
FILE_SERVER=$?

echo ""
echo -e "${BLUE}2. Проверка интеграции в server.js...${NC}"
echo ""

# Проверяем импорт аналитического модуля
if grep -q "const AnalyticsModule = require('./analytics-module')" server.js; then
    echo -e "${GREEN}✅ Импорт AnalyticsModule найден${NC}"
    IMPORT_OK=0
else
    echo -e "${RED}❌ Импорт AnalyticsModule не найден${NC}"
    IMPORT_OK=1
fi

# Проверяем инициализацию модуля
if grep -q "const analyticsModule = new AnalyticsModule()" server.js; then
    echo -e "${GREEN}✅ Инициализация analyticsModule найдена${NC}"
    INIT_OK=0
else
    echo -e "${RED}❌ Инициализация analyticsModule не найдена${NC}"
    INIT_OK=1
fi

# Проверяем API endpoints
if grep -q "app.get('/api/analytics'" server.js; then
    echo -e "${GREEN}✅ API endpoint /api/analytics найден${NC}"
    API_ANALYTICS_OK=0
else
    echo -e "${RED}❌ API endpoint /api/analytics не найден${NC}"
    API_ANALYTICS_OK=1
fi

if grep -q "app.get('/api/analytics/summary'" server.js; then
    echo -e "${GREEN}✅ API endpoint /api/analytics/summary найден${NC}"
    API_SUMMARY_OK=0
else
    echo -e "${RED}❌ API endpoint /api/analytics/summary не найден${NC}"
    API_SUMMARY_OK=1
fi

echo ""
echo -e "${BLUE}3. Проверка сервера и API...${NC}"
echo ""

# Проверяем сервер
check_server
SERVER_OK=$?

if [ $SERVER_OK -eq 0 ]; then
    # Проверяем API endpoints
    check_api "/api/analytics" "Analytics API"
    API_TEST_ANALYTICS=$?
    
    check_api "/api/analytics/summary" "Analytics Summary API"
    API_TEST_SUMMARY=$?
    
    # Проверяем доступность аналитической панели
    echo -e "${BLUE}Проверка аналитической панели...${NC}"
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/analytics.html | grep -q "200"; then
        echo -e "${GREEN}✅ Аналитическая панель доступна: http://localhost:3000/analytics.html${NC}"
        PANEL_OK=0
    else
        echo -e "${RED}❌ Аналитическая панель недоступна${NC}"
        PANEL_OK=1
    fi
else
    API_TEST_ANALYTICS=1
    API_TEST_SUMMARY=1
    PANEL_OK=1
fi

echo ""
echo -e "${BLUE}4. Итоги проверки...${NC}"
echo "================================================================"

# Считаем успешные проверки
TOTAL_CHECKS=0
SUCCESS_CHECKS=0

# Файлы
[ $FILE_MODULE -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

[ $FILE_HTML -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

[ $FILE_JS -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

[ $FILE_SERVER -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Интеграция
[ $IMPORT_OK -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

[ $INIT_OK -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

[ $API_ANALYTICS_OK -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

[ $API_SUMMARY_OK -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Сервер и API
[ $SERVER_OK -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

[ $API_TEST_ANALYTICS -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

[ $API_TEST_SUMMARY -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

[ $PANEL_OK -eq 0 ] && SUCCESS_CHECKS=$((SUCCESS_CHECKS + 1))
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

# Выводим итоги
SUCCESS_RATE=$((SUCCESS_CHECKS * 100 / TOTAL_CHECKS))

echo ""
echo -e "${BLUE}📊 Статистика проверки:${NC}"
echo -e "   Всего проверок: $TOTAL_CHECKS"
echo -e "   Успешных: $SUCCESS_CHECKS"
echo -e "   Успешность: $SUCCESS_RATE%"
echo ""

if [ $SUCCESS_RATE -eq 100 ]; then
    echo -e "${GREEN}🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!${NC}"
    echo ""
    echo -e "${BLUE}🚀 Аналитическая панель готова к использованию:${NC}"
    echo -e "   📊 Панель: http://localhost:3000/analytics.html"
    echo -e "   📋 Основной дашборд: http://localhost:3000/"
    echo -e "   🔧 API endpoints:"
    echo -e "      - GET /api/analytics"
    echo -e "      - GET /api/analytics/summary"
    echo ""
    echo -e "${GREEN}✅ Развертывание завершено успешно!${NC}"
    exit 0
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  БОЛЬШИНСТВО ПРОВЕРОК ПРОЙДЕНЫ${NC}"
    echo ""
    echo -e "${BLUE}📝 Рекомендации:${NC}"
    echo "   Проверьте ошибки выше и исправьте их"
    echo "   Основная функциональность должна работать"
    echo ""
    echo -e "${YELLOW}⚠️  Требуется доработка${NC}"
    exit 1
else
    echo -e "${RED}❌ МНОГИЕ ПРОВЕРКИ НЕ ПРОЙДЕНЫ${NC}"
    echo ""
    echo -e "${BLUE}🔧 Необходимые действия:${NC}"
    echo "   1. Проверьте наличие всех файлов"
    echo "   2. Убедитесь в правильности интеграции в server.js"
    echo "   3. Запустите сервер дашборда"
    echo "   4. Проверьте доступность API endpoints"
    echo ""
    echo -e "${RED}❌ Развертывание требует исправлений${NC}"
    exit 1
fi