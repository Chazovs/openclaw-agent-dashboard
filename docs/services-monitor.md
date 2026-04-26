# Services & Cron Monitor — Панель управления сервисами

## Описание

Новая панель на дашборде агентов, которая отображает все systemd-совместимые сервисы и таймеры из `workspace/`.

**Скриншот:** *(панель находится под панелью стоимости токенов, над панелью здоровья системы)*

## Возможности

- 📋 **Список всех .service файлов** из рабочей директории с их описаниями
- 🕐 **Расписания таймеров** — читает .timer файлы и отображает их в человеко-читаемом формате
- 🔴/🟢 **Индикаторы статуса** — зелёная точка для активных сервисов, красная для неактивных
- 📊 **Сводная статистика** — общее количество сервисов, активные, с таймерами, размер логов
- 📄 **Просмотр последних логов** — inline-вьювер для каждого сервиса
- ⏱ **Автообновление** каждые 15 секунд при открытой панели
- 🎯 **Клик для раскрытия** — детальная информация о каждом сервисе

## Установка

Панель уже встроена в дашборд. После перезапуска контейнера новая секция "Сервисы и Cron задачи" появляется под панелью стоимости токенов.

## API Endpoints

### GET /api/services

Возвращает список всех сервисов из рабочей директории.

```json
{
  "success": true,
  "timestamp": "2026-04-26T08:05:50Z",
  "serviceDir": "...",
  "total": 8,
  "services": [
    {
      "name": "tinkoff-trader",
      "file": "tinkoff-trader.service",
      "description": "Tinkoff Trader",
      "execStart": "/usr/bin/python3 ...",
      "workingDirectory": "...",
      "timers": [
        {
          "file": "tinkoff-trader.timer",
          "onCalendar": "*:0/5",
          "onBootSec": null
        }
      ],
      "systemd": {
        "active": false,
        "status": "unknown",
        "enabled": false,
        "lastRun": null,
        "nextRun": null
      },
      "logSizeBytes": 12345
    }
  ]
}
```

### GET /api/services/:name/logs?lines=25

Возвращает последние N строк лога для указанного сервиса.

```json
{
  "success": true,
  "service": "tinkoff-trader",
  "source": "tinkoff-trader.log",
  "lines": 25,
  "log": "=== Запуск Тинькофф Трейдера ===\n..."
}
```

## Как это работает

1. **Чтение файловой системы:** сервер сканирует `workspace/` на наличие `.service` и `.timer` файлов
2. **Парсинг systemd-подобных файлов:** извлекает ExecStart, Description, OnCalendar из конфигов
3. **Поиск логов:** проверяет наличие `<имя>.log`, `<имя>-trades.log`, `<имя>.json` в рабочей директории
4. **Статус systemd:** (опционально) проверяет systemctl при запуске вне контейнера

## Запуск тестов

```bash
cd /home/openclaw/.openclaw/workspace/agent-dashboard
node tests/services.test.js
```

## Изменённые файлы

- `server-simple.js` — добавлены 2 новых API endpoint
- `public/index.html` — добавлена HTML панель, CSS стили, JavaScript логика
- `tests/services.test.js` — новый файл с тестами
