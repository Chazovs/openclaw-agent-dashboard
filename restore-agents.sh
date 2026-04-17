#!/bin/bash
# Скрипт для восстановления агентов после перезагрузки

DASHBOARD_URL="http://localhost:3000"
SLEEP_TIME=10

echo "Ожидание запуска дашборда..."
sleep $SLEEP_TIME

# Проверяем, доступен ли дашборд
if curl -s --head --request GET $DASHBOARD_URL | grep "200 OK" > /dev/null; then
    echo "Дашборд доступен"
    
    # Проверяем, есть ли уже агент Клод
    AGENTS=$(curl -s "$DASHBOARD_URL/api/agents")
    if echo "$AGENTS" | grep -q "main_claude"; then
        echo "Агент Клод уже существует"
    else
        echo "Добавляем агента Клод..."
        curl -X POST "$DASHBOARD_URL/api/agents" \
            -H "Content-Type: application/json" \
            -d '{
                "id": "main_claude",
                "name": "Клод",
                "emoji": "🧠",
                "status": "working",
                "workspace": "main",
                "description": "Главный AI-ассистент, управляет системой"
            }'
        echo ""
        echo "Агент Клод добавлен"
    fi
else
    echo "Дашборд не доступен, пропускаем восстановление агентов"
fi

echo "Восстановление агентов завершено"