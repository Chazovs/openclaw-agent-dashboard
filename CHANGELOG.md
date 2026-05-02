# Changelog

## v1.6.0 — Commission & Fee Analyzer (2026-05-02)

**Новая панель: Комиссии и сборы** 💸

- Добавлен модуль `commission-analyzer.js` для анализа торговых комиссий всех 4 ботов
- API эндпоинты: `GET /api/commissions`, `POST /api/commissions/refresh`
- Парсинг логов: bybit-trades.log, bybit-aggressive-trades.log, memecoins-trades.log, tinkoff-live-trades.log
- Извлечение объёмов сделок через regex (покупаем на $X, Buy X SYM)
- Расчёт комиссий по ставкам: 0.1% spot, 0.055% futures, 0.05% Tinkoff
- Агрегация по дням/неделям/месяцам с трендами и прогнозами
- 60-секундный кэш для снижения нагрузки

**Фронтенд:**
- Новая встраиваемая панель между Trading Performance и Alert Center
- Сводка: всего комиссий, сделок, средняя комиссия, PnL, fee-to-PnL ratio
- Прогноз на месяц
- Разбивка по ботам с горизонтальными барами
- Дневной тренд (бар-чарт, последние 30 дней)
- Недельная разбивка
- Индикатор направления тренда
- Рекомендации при превышении порогов
- Автообновление каждые 15 сек
- Индикатор качества данных (точные vs оценочные комиссии)

**Тесты:** 27 автоматических тестов (модуль, API, regex, кэш, целостность)

**Исправления:**
- Восстановлены недостающие модули: trading-overview.js, alert-manager.js
- Разрешены merge-конфликты с main-веткой

## v1.5.0 — Real-time Activity Timeline

**Новая панель: Временная шкала активности** 📋

- Unified event feed из сессий, оповещений, сервисов и системы
- /api/timeline endpoint с агрегацией по типам

## v1.4.0 — Unified Alert & Notification Center

**Новая панель: Центр оповещений** 🔔

- Alert Manager с уровнями критичности (1-4)
- API: create, acknowledge, scan, clear
- Фильтрация по severity, acknowledgement, источнику
- Интервал автообновления 10 сек

## v1.3.0 — Trading Performance Panel

**Новая панель: Сводка по торговле** 📈

- Объединённый trading-overview с данными PnL, позиций, рынка
- API: /api/trading/overview
- Расчёт PnL из крипто-аудита

## v1.2.0 — Trading Monitor Panel

**Новая панель: Мониторинг торговли** 🤖

- Парсинг логов 4 ботов в реальном времени
- API: /api/trading/monitor
- Статус сервисов systemd

## v1.1.0 — Sessions Explorer Panel

**Новая панель: Sessions Explorer** 🔌

- Чтение сессий OpenClaw из sessions.json
- API: /api/sessions

## v1.0.0 — Initial Dashboard

**Базовые панели:**
- System Health (CPU/RAM/Disk/Network)
- Token Costs & Trends
- Analytics (models, costs, users)
