const express = require('express');
const net = require('net');
const { exec } = require('child_process');
const axios = require('axios');
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

// AI Endpoints using Hugging Face Inference API
const HF_API_KEY = process.env.HF_API_KEY || 'YOUR_HUGGINGFACE_API_KEY'; // Set in environment

// Text Generation
app.post('/api/ai/text-generation', express.json(), async (req, res) => {
    try {
        const { prompt } = req.body;
        const response = await axios.post('https://api-inference.huggingface.co/models/gpt2', {
            inputs: prompt,
            parameters: { max_length: 100 }
        }, {
            headers: { 'Authorization': `Bearer ${HF_API_KEY}` }
        });
        res.json({ output: response.data[0].generated_text });
    } catch (error) {
        res.status(500).json({ error: 'Text generation failed' });
    }
});

// Image Generation (using Stable Diffusion)
app.post('/api/ai/image-generation', express.json(), async (req, res) => {
    try {
        const { prompt } = req.body;
        const response = await axios.post('https://api-inference.huggingface.co/models/CompVis/stable-diffusion-v1-4', {
            inputs: prompt
        }, {
            headers: { 'Authorization': `Bearer ${HF_API_KEY}` },
            responseType: 'arraybuffer'
        });
        res.set('Content-Type', 'image/png');
        res.send(Buffer.from(response.data));
    } catch (error) {
        res.status(500).json({ error: 'Image generation failed' });
    }
});

// Code Completion
app.post('/api/ai/code-completion', express.json(), async (req, res) => {
    try {
        const { code } = req.body;
        const response = await axios.post('https://api-inference.huggingface.co/models/microsoft/CodeGPT-small-py', {
            inputs: code,
            parameters: { max_length: 50 }
        }, {
            headers: { 'Authorization': `Bearer ${HF_API_KEY}` }
        });
        res.json({ output: response.data[0].generated_text });
    } catch (error) {
        res.status(500).json({ error: 'Code completion failed' });
    }
});

// Sentiment Analysis
app.post('/api/ai/sentiment-analysis', express.json(), async (req, res) => {
    try {
        const { text } = req.body;
        const response = await axios.post('https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment', {
            inputs: text
        }, {
            headers: { 'Authorization': `Bearer ${HF_API_KEY}` }
        });
        res.json({ sentiment: response.data[0] });
    } catch (error) {
        res.status(500).json({ error: 'Sentiment analysis failed' });
    }
});
