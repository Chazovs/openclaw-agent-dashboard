const http = require('http');

// Тестирование API аналитики
function testAnalyticsAPI() {
    console.log('Testing Analytics API...\n');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/analytics',
        method: 'GET'
    };
    
    const req = http.request(options, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Status Message: ${res.statusMessage}`);
        
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const analytics = JSON.parse(data);
                console.log('\n=== Analytics Data ===');
                console.log(`Current agents: ${analytics.current?.agentCount || 0}`);
                console.log(`Working agents: ${analytics.current?.workingAgents || 0}`);
                console.log(`Total tokens: ${analytics.current?.totalTokens || 0}`);
                console.log(`Hourly data points: ${analytics.hourly?.length || 0}`);
                console.log(`Daily data points: ${analytics.daily?.length || 0}`);
                console.log(`Alerts: ${analytics.alerts?.length || 0}`);
                console.log(`System metrics: ${analytics.system ? 'Yes' : 'No'}`);
                
                if (analytics.alerts && analytics.alerts.length > 0) {
                    console.log('\n=== Alerts ===');
                    analytics.alerts.forEach((alert, i) => {
                        console.log(`${i + 1}. ${alert.type.toUpperCase()}: ${alert.message}`);
                    });
                }
                
                console.log('\n✅ Analytics API test passed!');
            } catch (err) {
                console.error('Error parsing response:', err);
                console.log('Raw response:', data);
            }
        });
    });
    
    req.on('error', (err) => {
        console.error('Request error:', err.message);
    });
    
    req.end();
}

// Тестирование API сводки
function testAnalyticsSummary() {
    console.log('\n\nTesting Analytics Summary API...\n');
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/analytics/summary',
        method: 'GET'
    };
    
    const req = http.request(options, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log(`Status Message: ${res.statusMessage}`);
        
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });
        
        res.on('end', () => {
            try {
                const summary = JSON.parse(data);
                console.log('\n=== Analytics Summary ===');
                console.log(`Current agents: ${summary.summary?.currentAgents || 0}`);
                console.log(`Agent trend: ${summary.summary?.agentTrend || 0}`);
                console.log(`Current tokens: ${summary.summary?.currentTokens || 0}`);
                console.log(`Token trend: ${summary.summary?.tokenTrend || 0}`);
                console.log(`System load: ${summary.summary?.systemLoad || 0}`);
                console.log(`Memory usage: ${summary.summary?.memoryUsage || 0}%`);
                console.log(`Hourly data points: ${summary.hourly?.length || 0}`);
                console.log(`Daily data points: ${summary.daily?.length || 0}`);
                
                console.log('\n✅ Analytics Summary API test passed!');
            } catch (err) {
                console.error('Error parsing response:', err);
                console.log('Raw response:', data);
            }
        });
    });
    
    req.on('error', (err) => {
        console.error('Request error:', err.message);
    });
    
    req.end();
}

// Запуск тестов
console.log('Starting Analytics API tests...');
console.log('Make sure the dashboard server is running on port 3000\n');

setTimeout(() => {
    testAnalyticsAPI();
    
    setTimeout(() => {
        testAnalyticsSummary();
        
        setTimeout(() => {
            console.log('\n\n🎉 All tests completed!');
            process.exit(0);
        }, 1000);
    }, 1000);
}, 1000);