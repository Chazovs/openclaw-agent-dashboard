# Agent Dashboard for OpenClaw

Simple pixel-art dashboard for monitoring OpenClaw AI agents in real-time.

## Features

- 🕹️ Pixel-art interface with retro styling
- 🔄 Real-time updates via WebSocket
- 📊 Agent status monitoring (working/idle/error/offline)
- 📈 System statistics
- 🐳 Docker container support
- 🔌 Automatic agent discovery

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone or navigate to the dashboard directory
cd /home/openclaw/.openclaw/workspace/agent-dashboard

# Start the dashboard
docker-compose up -d

# Access at http://localhost:3000
```

### Manual Docker Build

```bash
docker build -t agent-dashboard .
docker run -p 3000:3000 -v /home/openclaw/.openclaw:/root/.openclaw:ro agent-dashboard
```

### Development

```bash
npm install
npm run dev
```

## How It Works

1. **Agent Discovery**: Scans `~/.openclaw/workspace-*/` directories
2. **Identity Reading**: Reads `IDENTITY.md` files for agent names and emojis
3. **Real-time Updates**: Uses WebSocket for live updates
4. **File Monitoring**: Watches for changes in workspace directories

## API Endpoints

- `GET /api/agents` - JSON list of all agents
- `GET /` - Dashboard interface
- `WebSocket /` - Real-time agent updates

## Environment Variables

- `OPENCLAW_HOME` - Path to OpenClaw directory (default: `/root/.openclaw`)
- `PORT` - Server port (default: `3000`)

## Docker Volumes

- `/root/.openclaw` - Read-only mount of OpenClaw directory
- `/app/data` - Persistent data storage

## Screenshot

```
╔══════════════════════════════════════════════════════════════════╗
║  🕹️ AGENT DASHBOARD                                             ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  [🤖 Клод]      [🧠 Аналитик]    [💰 Трейдер]                  ║
║  🟩 WORKING     🟨 IDLE         🟦 ACTIVE                      ║
║                                                                  ║
║  Agents: 3 online  Last update: 18:45:32                        ║
╚══════════════════════════════════════════════════════════════════╝
```

## License

MIT