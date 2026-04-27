# Trading Monitor Panel — Документация

## Описание

Trading Monitor Panel — это новая панель на Agent Dashboard, которая в реальном времени отображает состояние всех торговых ботов, запущенных на сервере. Панель парсит логи торговых ботов и предоставляет консолидированную информацию о:

- Статусе каждого бота (активен/неактивен/ошибка)
- Открытых позициях с ценами и drawdown
- Балансах USDT
- Статистике сделок (покупки, продажи, ошибки)
- Истории сделок из JSON-файлов
- Последних строках лога в реальном времени

## Архитектура

### Backend (`server-simple.js`)

- **Конфигурация ботов**: `TRADING_BOTS` — массив с путями к логам, JSON-файлам и именам systemd-сервисов
- **Функция `parseTradeLog(botConfig)`**: парсит `.log` и `.json` файлы, извлекает структурированные данные
  - Читает только последние 1000 строк для производительности
  - Распознает: покупки (`✅ Buy`), продажи (`✅ Sell`), ошибки (`ERROR`, `❌`), балансы (`USDT: NNN`), позиции (`Уже держим`), цены (`SYM: $X.XX, dd=X.X%`)
  - Парсит JSON-логи сделок из `.json` файлов
- **Endpoint `/api/trading/monitor`**: возвращает JSON с `summary` и массивом `bots`

### Frontend (`public/trade-panel.js`)

- **Toggle panel**: кнопка в шапке панели, открывает/закрывает с автообновлением каждые 15 секунд
- **Summary bar**: консолидированная статистика (ботов, активных, покупок, продаж, ошибок, позиций)
- **Bot cards**: для каждого бота:
  - Emoji + название + service name
  - Статус (цветной badge: 🟢 активен, 🟡 неактивен, 🔴 нет данных)
  - Время последнего обновления
  - Статистика (размер лога, строк, запуск)
  - Баланс USDT
  - Открытые позиции с ценой и drawdown
  - Последние сделки (с эмодзи 🟢/🔴)
  - JSON-трейды
  - Лог с возможностью развернуть нажатием

### Интеграция (`public/index.html`)

- HTML-секция `<div id="trade-panel">` вставлена после `token-cost-panel`
- Скрипт `<script src="/trade-panel.js">` добавлен после `token-costs.js`

## API

### `GET /api/trading/monitor`

**Пример ответа:**

```json
{
  "success": true,
  "timestamp": "2026-04-27T08:07:12.839Z",
  "summary": {
    "totalBots": 4,
    "activeBots": 0,
    "totalBuys": 11,
    "totalSells": 0,
    "totalErrors": 200,
    "activePositions": 7
  },
  "bots": [
    {
      "id": "bybit-mean-reversion",
      "name": "Bybit Mean Reversion",
      "emoji": "📉",
      "serviceName": "bybit-trader",
      "serviceStatus": "unknown",
      "isActive": false,
      "secondsSinceUpdate": 15197,
      "exists": true,
      "sizeBytes": 1746380,
      "totalLines": 24478,
      "lastModified": "2026-04-27T03:53:55.493Z",
      "lastLine": "2026-04-27 07:53:55,494 - INFO - ИТОГО: 0 сделок",
      "recentTrades": [...],
      "balances": [...],
      "activePositions": [...],
      "totalBuys": 11,
      "totalSells": 0,
      "totalErrors": 0,
      "lastRunTime": "2026-04-27 07:53:32,863",
      "logExcerpt": "...",
      "totalTradesThisRun": 0,
      "jsonTrades": [...],
      "totalJsonTrades": 16
    }
  ]
}
```

## Тесты

Файл: `test-trading-monitor.js` (79 тестов)

Проверяет:
1. Smoke test — API отвечает
2. Базовая структура ответа (success, timestamp, summary, bots)
3. Summary содержит все поля
4. Каждый бот имеет корректную структуру (id, name, service, status, метрики, массивы)
5. Конкретные данные существующих ботов
6. JSON-трейды (если есть)
7. Фронтенд файлы существуют и корректны
8. Серверный код содержит endpoint

## Настройка

Для добавления нового торгового бота — добавьте запись в массив `TRADING_BOTS` в `server-simple.js`:

```js
{
  id: 'my-new-bot',
  name: 'My New Bot',
  emoji: '🤖',
  logPath: '/path/to/logs/trades.log',
  jsonPath: '/path/to/logs/trades.json', // опционально
  serviceName: 'my-bot-service'
}
```

## Измененные файлы

- `server-simple.js` — новый endpoint + функция парсинга
- `public/trade-panel.js` — новый фронтенд компонент
- `public/index.html` — добавлена панель и скрипт
- `test-trading-monitor.js` — новый файл тестов
- `docs/trading-monitor.md` — эта документация
