# Автозапуск Agent Dashboard

## Настройка автозапуска после перезагрузки

Система настроена для автоматического запуска после перезагрузки компьютера.

### Установленные сервисы:

1. **agent-dashboard.service** - запускает Docker Compose с дашбордом
2. **restore-agents.timer** - восстанавливает агентов после загрузки

### Команды управления:

```bash
# Статус дашборда
sudo systemctl status agent-dashboard.service

# Перезапуск дашборда
sudo systemctl restart agent-dashboard.service

# Просмотр логов
sudo journalctl -u agent-dashboard.service -f

# Статус таймера восстановления
sudo systemctl status restore-agents.timer

# Запуск восстановления агентов вручную
sudo systemctl start restore-agents.service
```

### Проверка работы:

```bash
# Проверить, что дашборд работает
curl http://localhost:3000/api/agents

# Проверить Docker контейнер
docker-compose ps
```

### После перезагрузки:

1. Дашборд автоматически запустится через 10 секунд
2. Агент "Клод" будет восстановлен через 30 секунд
3. Дашборд доступен по http://localhost:3000

### Удаление автозапуска:

```bash
sudo systemctl disable agent-dashboard.service
sudo systemctl disable restore-agents.timer
sudo rm /etc/systemd/system/agent-dashboard.service
sudo rm /etc/systemd/system/restore-agents.*
sudo systemctl daemon-reload
```