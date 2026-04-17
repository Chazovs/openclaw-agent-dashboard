FROM node:18-alpine

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm install

# Копирование исходного кода
COPY . .

# Сборка фронтенда
RUN npm run build

# Порт
EXPOSE 3000

# Запуск
CMD ["node", "server-simple.js"]