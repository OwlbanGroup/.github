const express = require('express');
const net = require('net');
const { exec } = require('child_process');
const app = express();

function findAvailablePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            // Port in use, try next
            findAvailablePort(startPort + 1).then(resolve).catch(reject);
        });
    });
}

let port;
findAvailablePort(3000).then(availablePort => {
    port = availablePort;
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}).catch(err => {
    console.error('No available ports found:', err);
});

// Serve static files from the dashboard directory
app.use(express.static('dashboard'));

// Endpoint for operations chart data
app.get('/api/operations', (req, res) => {
    res.json({
        labels: ['Americas', 'Europe', 'Asia', 'Africa'],
        data: [85, 92, 78, 88]
    });
});

// Endpoint for banking chart data
app.get('/api/banking', (req, res) => {
    res.json({
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        data: [100, 120, 110, 130, 125, 140]
    });
});

// Endpoint for GPU metrics data
app.get('/api/gpu', (req, res) => {
    exec('nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits', (error, stdout, stderr) => {
        if (error) {
            console.error('Error executing nvidia-smi:', error);
            return res.status(500).json({ error: 'Failed to retrieve GPU metrics' });
        }
        if (stderr) {
            console.error('nvidia-smi stderr:', stderr);
        }

        const lines = stdout.trim().split('\n');
        if (lines.length === 0) {
            return res.status(500).json({ error: 'No GPU data available' });
        }

        // Assume first GPU
        const [utilization, temperature, memoryUsed, memoryTotal] = lines[0].split(',').map(s => parseFloat(s.trim()));

        res.json({
            utilization: utilization || 0,
            temperature: temperature || 0,
            memory: {
                used: (memoryUsed || 0) * 1024 * 1024, // Convert MB to bytes
                total: (memoryTotal || 0) * 1024 * 1024
            }
        });
    });
});
