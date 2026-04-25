const express = require('express');
const AnalyticsModule = require('./analytics-module');

const app = express();
const analytics = new AnalyticsModule();

// Test endpoint
app.get('/test-analytics', async (req, res) => {
    try {
        // Mock agents data
        const mockAgents = [
            {
                id: 'test-1',
                name: 'Test Agent',
                status: 'working',
                realMetrics: { totalTokens: 1000 }
            }
        ];
        
        const data = await analytics.collectData(mockAgents);
        res.json({
            success: true,
            data: {
                current: data.current,
                alerts: data.alerts,
                system: data.system
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.get('/test-summary', (req, res) => {
    try {
        const summary = analytics.getAnalyticsSummary();
        res.json({
            success: true,
            summary: summary
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
    console.log('Test endpoints:');
    console.log(`  GET http://localhost:${PORT}/test-analytics`);
    console.log(`  GET http://localhost:${PORT}/test-summary`);
});