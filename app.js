const express = require('express');
const net = require('net');
const { exec } = require('child_process');
const axios = require('axios');
const OpenAI = require('openai');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const { PredictionServiceClient } = require('@google-cloud/aiplatform');
// Removed AzureOpenAI import, using OpenAI with Azure config
const AWS = require('aws-sdk');
const promClient = require('prom-client');
const Docker = require('dockerode');

// NVIDIA Cloud Integration
const nvidiaCloud = {
  baseUrl: 'https://api.ngc.nvidia.com/v2',
  apiKey: process.env.NVIDIA_API_KEY,
  orgId: process.env.NVIDIA_ORG_ID
};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dashboard', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// User schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

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

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Middleware
app.use(express.json());
app.use(helmet()); // Security headers

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Redis client for caching
const redisClient = createClient();
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

// Google Cloud AI Platform
const predictionServiceClient = new PredictionServiceClient();

// Azure OpenAI (using OpenAI SDK with Azure config)
const azureOpenai = new OpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY || 'YOUR_AZURE_API_KEY',
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT || 'YOUR_AZURE_ENDPOINT'}/openai/deployments/gpt-4`,
    defaultQuery: { 'api-version': '2023-12-01-preview' },
    defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY || 'YOUR_AZURE_API_KEY' },
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// In-memory user store (replace with database in production)
const users = [];

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
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

// Endpoint for profits and revenue data
app.get('/api/profits', (req, res) => {
    // Mock profit data - in production, this would come from your financial systems
    const currentMonth = new Date().getMonth();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Generate realistic profit data
    const revenueData = [];
    const profitData = [];
    let baseRevenue = 5000000; // $5M base
    let baseProfit = 800000;  // $800K base

    for (let i = 0; i < 12; i++) {
        const seasonalMultiplier = 1 + Math.sin((i / 12) * 2 * Math.PI) * 0.3; // Seasonal variation
        const growthTrend = 1 + (i * 0.02); // 2% monthly growth
        const randomVariation = 0.9 + Math.random() * 0.2; // ±10% random variation

        const revenue = Math.round(baseRevenue * seasonalMultiplier * growthTrend * randomVariation);
        const profit = Math.round(revenue * (0.15 + Math.random() * 0.05)); // 15-20% profit margin

        revenueData.push(revenue);
        profitData.push(profit);
    }

    // Calculate current metrics
    const currentRevenue = revenueData[currentMonth];
    const currentProfit = profitData[currentMonth];
    const profitMargin = ((currentProfit / currentRevenue) * 100).toFixed(1);

    // Calculate year-over-year changes (mock)
    const prevYearRevenue = Math.round(currentRevenue * 0.85); // 15% YoY growth
    const prevYearProfit = Math.round(currentProfit * 0.82); // 18% YoY growth
    const revenueChange = (((currentRevenue - prevYearRevenue) / prevYearRevenue) * 100).toFixed(1);
    const profitChange = (((currentProfit - prevYearProfit) / prevYearProfit) * 100).toFixed(1);

    // Calculate ROI (mock calculation)
    const totalInvestment = 10000000; // $10M total investment
    const roi = (((currentProfit * 12) / totalInvestment) * 100).toFixed(1);

    res.json({
        metrics: {
            totalRevenue: currentRevenue,
            netProfit: currentProfit,
            profitMargin: parseFloat(profitMargin),
            roi: parseFloat(roi),
            revenueChange: parseFloat(revenueChange),
            profitChange: parseFloat(profitChange),
            marginChange: 2.1, // Mock margin improvement
            roiChange: 5.3 // Mock ROI improvement
        },
        charts: {
            labels: months,
            revenue: revenueData,
            profit: profitData
        },
        breakdown: {
            byRegion: [
                { region: 'Americas', revenue: Math.round(currentRevenue * 0.45), profit: Math.round(currentProfit * 0.48) },
                { region: 'Europe', revenue: Math.round(currentRevenue * 0.30), profit: Math.round(currentProfit * 0.32) },
                { region: 'Asia Pacific', revenue: Math.round(currentRevenue * 0.20), profit: Math.round(currentProfit * 0.18) },
                { region: 'Other', revenue: Math.round(currentRevenue * 0.05), profit: Math.round(currentProfit * 0.02) }
            ],
            byProduct: [
                { product: 'AI Services', revenue: Math.round(currentRevenue * 0.35), profit: Math.round(currentProfit * 0.40) },
                { product: 'Cloud Computing', revenue: Math.round(currentRevenue * 0.28), profit: Math.round(currentProfit * 0.30) },
                { product: 'Financial Tech', revenue: Math.round(currentRevenue * 0.22), profit: Math.round(currentProfit * 0.20) },
                { product: 'Consulting', revenue: Math.round(currentRevenue * 0.15), profit: Math.round(currentProfit * 0.10) }
            ]
        }
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

// Protected AI Endpoints
// Text Generation
app.post('/api/ai/text-generation', authenticateToken, express.json(), async (req, res) => {
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
app.post('/api/ai/image-generation', authenticateToken, express.json(), async (req, res) => {
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
app.post('/api/ai/code-completion', authenticateToken, express.json(), async (req, res) => {
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
app.post('/api/ai/sentiment-analysis', authenticateToken, express.json(), async (req, res) => {
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

// OpenAI Integration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY'
});

// OpenAI Chat Completion
app.post('/api/ai/openai-chat', authenticateToken, express.json(), async (req, res) => {
    try {
        const { messages } = req.body;
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: messages
        });
        res.json({ response: completion.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: 'OpenAI chat failed' });
    }
});

// OpenAI Image Generation
app.post('/api/ai/openai-image', authenticateToken, express.json(), async (req, res) => {
    try {
        const { prompt } = req.body;
        const image = await openai.images.generate({
            model: 'dall-e-3',
            prompt: prompt,
            size: '1024x1024'
        });
        res.json({ imageUrl: image.data[0].url });
    } catch (error) {
        res.status(500).json({ error: 'OpenAI image generation failed' });
    }
});

// Google Cloud Vertex AI
app.post('/api/ai/google-vertex', authenticateToken, express.json(), async (req, res) => {
    try {
        const { prompt } = req.body;
        const [response] = await predictionServiceClient.predict({
            endpoint: 'projects/YOUR_PROJECT_ID/locations/us-central1/endpoints/YOUR_ENDPOINT_ID',
            instances: [{ content: prompt }]
        });
        res.json({ output: response.predictions[0] });
    } catch (error) {
        res.status(500).json({ error: 'Google Vertex AI failed' });
    }
});

// Azure OpenAI
app.post('/api/ai/azure-openai-chat', authenticateToken, express.json(), async (req, res) => {
    try {
        const { messages } = req.body;
        const completion = await azureOpenai.chat.completions.create({
            model: 'gpt-4',
            messages: messages
        });
        res.json({ response: completion.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: 'Azure OpenAI failed' });
    }
});

// AWS SageMaker
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});
const sagemaker = new AWS.SageMaker();

app.post('/api/ai/aws-sagemaker', authenticateToken, express.json(), async (req, res) => {
    try {
        const { endpointName, inputData } = req.body;
        const params = {
            EndpointName: endpointName,
            ContentType: 'application/json',
            Body: JSON.stringify(inputData)
        };
        const result = await sagemaker.invokeEndpoint(params).promise();
        res.json({ output: JSON.parse(result.Body.toString()) });
    } catch (error) {
        res.status(500).json({ error: 'AWS SageMaker failed' });
    }
});

// NVIDIA NGC Cloud Integration
// List available models
app.get('/api/nvidia/models', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${nvidiaCloud.baseUrl}/models`, {
            headers: {
                'Authorization': `Bearer ${nvidiaCloud.apiKey}`,
                'Content-Type': 'application/json'
            },
            params: {
                org: nvidiaCloud.orgId,
                pageSize: 50
            }
        });
        res.json({ models: response.data.models });
    } catch (error) {
        console.error('NVIDIA models fetch failed:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch NVIDIA models' });
    }
});

// NVIDIA AI Inference
app.post('/api/nvidia/inference', authenticateToken, express.json(), async (req, res) => {
    try {
        const { model, input, parameters = {} } = req.body;

        const response = await axios.post(
            `${nvidiaCloud.baseUrl}/models/${model}/infer`,
            {
                input: input,
                parameters: {
                    max_tokens: parameters.maxTokens || 100,
                    temperature: parameters.temperature || 0.7,
                    ...parameters
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${nvidiaCloud.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            output: response.data.output,
            usage: response.data.usage
        });
    } catch (error) {
        console.error('NVIDIA inference failed:', error.response?.data || error.message);
        res.status(500).json({ error: 'NVIDIA inference failed' });
    }
});

// NVIDIA GPU Cloud Instances
app.get('/api/nvidia/instances', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${nvidiaCloud.baseUrl}/instances`, {
            headers: {
                'Authorization': `Bearer ${nvidiaCloud.apiKey}`,
                'Content-Type': 'application/json'
            },
            params: {
                org: nvidiaCloud.orgId
            }
        });
        res.json({ instances: response.data.instances });
    } catch (error) {
        console.error('NVIDIA instances fetch failed:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch NVIDIA instances' });
    }
});

// NVIDIA Model Deployment
app.post('/api/nvidia/deploy', authenticateToken, express.json(), async (req, res) => {
    try {
        const { modelId, instanceType, name } = req.body;

        const response = await axios.post(
            `${nvidiaCloud.baseUrl}/deployments`,
            {
                model: modelId,
                instance: instanceType,
                name: name,
                org: nvidiaCloud.orgId
            },
            {
                headers: {
                    'Authorization': `Bearer ${nvidiaCloud.apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json({
            deploymentId: response.data.id,
            status: response.data.status,
            endpoint: response.data.endpoint
        });
    } catch (error) {
        console.error('NVIDIA deployment failed:', error.response?.data || error.message);
        res.status(500).json({ error: 'NVIDIA deployment failed' });
    }
});

// NVIDIA Organization Info
app.get('/api/nvidia/org', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${nvidiaCloud.baseUrl}/orgs/${nvidiaCloud.orgId}`, {
            headers: {
                'Authorization': `Bearer ${nvidiaCloud.apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        res.json({ org: response.data });
    } catch (error) {
        console.error('NVIDIA org fetch failed:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch NVIDIA organization info' });
    }
});

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });
const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

app.get('/metrics', (req, res) => {
    res.set('Content-Type', register.contentType);
    register.metrics().then(metrics => res.end(metrics));
});

// Docker integration
const docker = new Docker();

app.post('/api/docker/containers', authenticateToken, express.json(), async (req, res) => {
    try {
        const { image, name } = req.body;
        const container = await docker.createContainer({
            Image: image,
            name: name,
            Tty: true
        });
        await container.start();
        res.json({ containerId: container.id });
    } catch (error) {
        res.status(500).json({ error: 'Docker container creation failed' });
    }
});

// Kubernetes integration (commented out due to version compatibility issues)
// Uncomment and configure when you have a proper Kubernetes cluster setup
/*
const kubeconfig = new k8s.KubeConfig();
kubeconfig.loadFromDefault();
const k8sApi = kubeconfig.makeApiClient(k8s.CoreV1Api);

app.post('/api/kubernetes/deploy', authenticateToken, express.json(), async (req, res) => {
    try {
        const { deployment } = req.body;
        const response = await k8sApi.createNamespacedDeployment('default', deployment);
        res.json({ deployment: response.body });
    } catch (error) {
        res.status(500).json({ error: 'Kubernetes deployment failed' });
    }
});
*/

// RAG (Retrieval-Augmented Generation) Implementation
const knowledgeBase = [
    "JPMorgan Chase is a leading global financial services firm.",
    "NVIDIA provides advanced GPU technology for AI and computing.",
    "AI is transforming industries through machine learning and deep learning.",
    "The dashboard integrates multiple AI platforms for comprehensive analysis."
];

app.post('/api/ai/rag-query', authenticateToken, express.json(), async (req, res) => {
    try {
        const { query } = req.body;

        // Simple semantic search (in production, use vector database like Pinecone)
        const relevantDocs = knowledgeBase.filter(doc =>
            doc.toLowerCase().includes(query.toLowerCase())
        );

        const context = relevantDocs.join(' ');

        // Use OpenAI to generate response with retrieved context
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: `Use this context to answer: ${context}` },
                { role: 'user', content: query }
            ]
        });

        res.json({
            response: completion.choices[0].message.content,
            sources: relevantDocs
        });
    } catch (error) {
        res.status(500).json({ error: 'RAG query failed' });
    }
});

// Fine-tuning endpoint (placeholder for custom model training)
app.post('/api/ai/fine-tune', authenticateToken, express.json(), async (req, res) => {
    try {
        const { trainingData, modelType } = req.body;

        // In production, this would integrate with OpenAI fine-tuning API
        // For now, return mock response
        res.json({
            jobId: `ft-${Date.now()}`,
            status: 'training',
            estimatedCompletion: '2 hours',
            message: `Fine-tuning ${modelType} model with ${trainingData.length} examples`
        });
    } catch (error) {
        res.status(500).json({ error: 'Fine-tuning failed' });
    }
});

// WebSocket for real-time collaboration
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (room) => {
        socket.join(room);
        socket.to(room).emit('user-joined', socket.id);
    });

    socket.on('ai-inference', (data) => {
        socket.to(data.room).emit('ai-inference', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});
