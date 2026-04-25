const express = require('express');
const SimpleAnalytics = require('./simple-analytics');

const app = express();
const analytics = new SimpleAnalytics();

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Test endpoint
app.get('/api/analytics', async (req, res) => {
    try {
        console.log('GET /api/analytics');
        
        // Mock agents data
        const mockAgents = [
            {
                id: 'main-agent',
                name: 'Main Agent',
                status: 'working',
                realMetrics: { totalTokens: 50000 }
            },
            {
                id: 'telegram-agent',
                name: 'Telegram Bot',
                status: 'idle',
                realMetrics: { totalTokens: 25000 }
            },
            {
                id: 'cron-agent',
                name: 'Cron Agent',
                status: 'working',
                realMetrics: { totalTokens: 10000 }
            }
        ];
        
        const data = await analytics.collectData(mockAgents);
        res.json(data);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/analytics/summary', (req, res) => {
    try {
        console.log('GET /api/analytics/summary');
        const summary = analytics.getAnalyticsSummary();
        res.json(summary);
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`✅ Test analytics server running on http://localhost:${PORT}`);
    console.log('📊 Endpoints:');
    console.log(`  GET http://localhost:${PORT}/api/analytics`);
    console.log(`  GET http://localhost:${PORT}/api/analytics/summary`);
    console.log(`  GET http://localhost:${PORT}/health`);
});