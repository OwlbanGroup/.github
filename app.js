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
const { FinancialDataManager } = require('./financial-services');
const {
  validateApiVersion,
  ensureCompatibility,
  formatResponse,
  getVersionInfo
} = require('./middleware/apiVersioning');

// Import logger and error handler
const { logger, logError, logInfo } = require('./logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// OpenTelemetry Distributed Tracing Setup
let tracer, span;
try {
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
  const { ZipkinExporter } = require('@opentelemetry/exporter-zipkin');

  // Configure exporters based on environment
  const exporters = [];
  if (process.env.JAEGER_ENDPOINT) {
    exporters.push(new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT,
    }));
  }
  if (process.env.ZIPKIN_ENDPOINT) {
    exporters.push(new ZipkinExporter({
      url: process.env.ZIPKIN_ENDPOINT,
    }));
  }

  if (exporters.length > 0) {
    const sdk = new NodeSDK({
      serviceName: 'ai-dashboard',
      serviceVersion: '1.0.0',
      instrumentations: [getNodeAutoInstrumentations()],
      traceExporter: exporters,
    });

    sdk.start();
    console.log('✅ OpenTelemetry distributed tracing initialized');

    const { trace } = require('@opentelemetry/api');
    tracer = trace.getTracer('ai-dashboard');
  }
} catch (error) {
    console.warn('⚠️ OpenTelemetry not available:', error.message);
}

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

// Middleware
app.use(express.json());
app.use(helmet()); // Security headers

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// API Versioning Middleware - only apply to API routes
app.use('/api', validateApiVersion);
app.use('/api', ensureCompatibility);
app.use('/api', formatResponse);

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

// Initialize Financial Data Manager
const financialManager = new FinancialDataManager();

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

// Public endpoints for testing (no authentication required)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

app.get('/api/public/status', (req, res) => {
    res.json({
        status: 'API is running',
        timestamp: new Date().toISOString(),
        services: {
            financial: 'available',
            ai: 'available',
            nvidia: 'available',
            docker: 'available'
        }
    });
});

// Public financial data endpoint (limited data for testing)
app.get('/api/public/financial/status', (req, res) => {
    try {
        const status = financialManager.getProviderStatus();
        const rateLimitStatus = financialManager.getRateLimitStatus();

        res.json({
            providers: status,
            rateLimits: rateLimitStatus,
            summary: {
                availableProviders: Object.values(status).filter(p => p.available).length,
                totalProviders: Object.keys(status).length,
                totalErrors: Object.values(status).reduce((sum, p) => sum + p.errorCount, 0)
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logError(error, req, 'Public financial status endpoint');
        res.status(500).json({ error: 'Failed to fetch provider status', details: error.message });
    }
});

// Public GPU metrics endpoint
app.get('/api/public/gpu', (req, res) => {
    exec('nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits', (error, stdout, stderr) => {
        if (error) {
            logError(error, req, 'Public GPU metrics endpoint');
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
            },
            timestamp: new Date().toISOString()
        });
    });
});

// Financial Data Endpoints

// Endpoint for stock quotes
app.get('/api/financial/stock/:symbol', authenticateToken, async (req, res) => {
    try {
        const { symbol } = req.params;
        const { source = 'auto' } = req.query;

        const stockData = await financialManager.getStockQuote(symbol, source);
        res.json(stockData);
    } catch (error) {
        console.error('Error fetching stock data:', error.message);
        res.status(500).json({ error: 'Failed to fetch stock data', details: error.message });
    }
});

// Endpoint for financial metrics
app.get('/api/financial/metrics/:symbol', authenticateToken, async (req, res) => {
    try {
        const { symbol } = req.params;
        const metrics = await financialManager.getFinancialMetrics(symbol);
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching financial metrics:', error.message);
        res.status(500).json({ error: 'Failed to fetch financial metrics', details: error.message });
    }
});

// Endpoint for banking transactions (Plaid integration)
app.get('/api/financial/banking/transactions', authenticateToken, async (req, res) => {
    try {
        const { accessToken, startDate, endDate } = req.query;

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token required' });
        }

        const transactions = await financialManager.getBankingTransactions(
            accessToken,
            startDate || '2024-01-01',
            endDate || new Date().toISOString().split('T')[0]
        );

        res.json({ transactions });
    } catch (error) {
        console.error('Error fetching banking transactions:', error.message);
        res.status(500).json({ error: 'Failed to fetch banking transactions', details: error.message });
    }
});

// Endpoint for Plaid Link token creation
app.post('/api/financial/banking/link-token', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID required' });
        }

        const linkToken = await financialManager.plaid.createLinkToken(userId);
        res.json({ linkToken: linkToken.link_token });
    } catch (error) {
        console.error('Error creating link token:', error.message);
        res.status(500).json({ error: 'Failed to create link token', details: error.message });
    }
});

// Endpoint for Plaid public token exchange
app.post('/api/financial/banking/exchange-token', authenticateToken, async (req, res) => {
    try {
        const { publicToken } = req.body;

        if (!publicToken) {
            return res.status(400).json({ error: 'Public token required' });
        }

        const exchangeResponse = await financialManager.plaid.exchangePublicToken(publicToken);
        res.json({
            accessToken: exchangeResponse.access_token,
            itemId: exchangeResponse.item_id
        });
    } catch (error) {
        console.error('Error exchanging public token:', error.message);
        res.status(500).json({ error: 'Failed to exchange public token', details: error.message });
    }
});

// Endpoint for operations chart data (using real financial data)
app.get('/api/operations', authenticateToken, async (req, res) => {
    try {
        // Get stock data for major indices/companies
        const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN'];
        const operationsData = [];

        for (const symbol of symbols) {
            try {
                const stockData = await financialManager.getStockQuote(symbol);
                operationsData.push({
                    symbol: stockData.symbol,
                    companyName: stockData.companyName || symbol,
                    currentPrice: stockData.price.current,
                    change: stockData.price.change,
                    changePercent: stockData.price.changePercent,
                    volume: stockData.volume,
                    marketCap: stockData.marketCap
                });
            } catch (error) {
                console.error(`Error fetching data for ${symbol}:`, error.message);
                // Continue with other symbols even if one fails
            }
        }

        res.json({
            operations: operationsData,
            summary: {
                totalSymbols: operationsData.length,
                gainers: operationsData.filter(op => op.change > 0).length,
                losers: operationsData.filter(op => op.change < 0).length,
                totalVolume: operationsData.reduce((sum, op) => sum + (op.volume || 0), 0),
                totalMarketCap: operationsData.reduce((sum, op) => sum + (op.marketCap || 0), 0)
            }
        });
    } catch (error) {
        console.error('Error fetching operations data:', error.message);
        res.status(500).json({ error: 'Failed to fetch operations data', details: error.message });
    }
});

// Endpoint for banking chart data (using real banking metrics)
app.get('/api/banking', authenticateToken, async (req, res) => {
    try {
        // Get financial metrics for banking sector companies
        const bankingSymbols = ['JPM', 'BAC', 'WFC', 'C'];
        const bankingData = [];

        for (const symbol of bankingSymbols) {
            try {
                const metrics = await financialManager.getFinancialMetrics(symbol);
                bankingData.push({
                    symbol: metrics.symbol,
                    companyName: symbol,
                    revenue: metrics.metrics.revenue,
                    netIncome: metrics.metrics.netIncome,
                    totalAssets: metrics.metrics.totalAssets,
                    returnOnEquity: metrics.metrics.returnOnEquity,
                    returnOnAssets: metrics.metrics.returnOnAssets
                });
            } catch (error) {
                console.error(`Error fetching banking data for ${symbol}:`, error.message);
            }
        }

        // Calculate sector averages
        const validData = bankingData.filter(item => item.revenue && item.netIncome);
        const averages = {
            avgRevenue: validData.reduce((sum, item) => sum + item.revenue, 0) / validData.length,
            avgNetIncome: validData.reduce((sum, item) => sum + item.netIncome, 0) / validData.length,
            avgROE: validData.reduce((sum, item) => sum + item.returnOnEquity, 0) / validData.length,
            avgROA: validData.reduce((sum, item) => sum + item.returnOnAssets, 0) / validData.length
        };

        res.json({
            bankingSector: bankingData,
            sectorAverages: averages,
            summary: {
                totalBanks: bankingData.length,
                totalAssets: bankingData.reduce((sum, bank) => sum + (bank.totalAssets || 0), 0),
                totalRevenue: bankingData.reduce((sum, bank) => sum + (bank.revenue || 0), 0),
                totalNetIncome: bankingData.reduce((sum, bank) => sum + (bank.netIncome || 0), 0)
            }
        });
    } catch (error) {
        console.error('Error fetching banking data:', error.message);
        res.status(500).json({ error: 'Failed to fetch banking data', details: error.message });
    }
});

// Endpoint for profits and revenue data (using real financial data)
app.get('/api/profits', authenticateToken, async (req, res) => {
    try {
        // Get financial metrics for major tech companies
        const techSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
        const profitData = [];

        for (const symbol of techSymbols) {
            try {
                const metrics = await financialManager.getFinancialMetrics(symbol);
                profitData.push({
                    symbol: metrics.symbol,
                    companyName: symbol,
                    revenue: metrics.metrics.revenue,
                    grossProfit: metrics.metrics.grossProfit,
                    netIncome: metrics.metrics.netIncome,
                    ebitda: metrics.metrics.ebitda,
                    eps: metrics.metrics.eps,
                    profitMargin: (metrics.metrics.netIncome / metrics.metrics.revenue) * 100,
                    returnOnEquity: metrics.metrics.returnOnEquity,
                    returnOnAssets: metrics.metrics.returnOnAssets,
                    freeCashFlow: metrics.metrics.freeCashFlow
                });
            } catch (error) {
                console.error(`Error fetching profit data for ${symbol}:`, error.message);
            }
        }

        // Calculate sector totals and averages
        const validData = profitData.filter(item => item.revenue && item.netIncome);
        const totals = {
            totalRevenue: validData.reduce((sum, item) => sum + item.revenue, 0),
            totalNetIncome: validData.reduce((sum, item) => sum + item.netIncome, 0),
            totalGrossProfit: validData.reduce((sum, item) => sum + item.grossProfit, 0),
            totalEBITDA: validData.reduce((sum, item) => sum + item.ebitda, 0),
            totalFreeCashFlow: validData.reduce((sum, item) => sum + item.freeCashFlow, 0)
        };

        const averages = {
            avgProfitMargin: validData.reduce((sum, item) => sum + item.profitMargin, 0) / validData.length,
            avgROE: validData.reduce((sum, item) => sum + item.returnOnEquity, 0) / validData.length,
            avgROA: validData.reduce((sum, item) => sum + item.returnOnAssets, 0) / validData.length
        };

        res.json({
            companies: profitData,
            sectorTotals: totals,
            sectorAverages: averages,
            summary: {
                totalCompanies: profitData.length,
                profitableCompanies: validData.filter(item => item.netIncome > 0).length,
                totalRevenue: totals.totalRevenue,
                totalNetIncome: totals.totalNetIncome,
                overallProfitMargin: (totals.totalNetIncome / totals.totalRevenue) * 100
            }
        });
    } catch (error) {
        console.error('Error fetching profits data:', error.message);
        res.status(500).json({ error: 'Failed to fetch profits data', details: error.message });
    }
});

// Endpoint for financial provider status
app.get('/api/financial/status', authenticateToken, (req, res) => {
    try {
        const status = financialManager.getProviderStatus();
        const rateLimitStatus = financialManager.getRateLimitStatus();

        res.json({
            providers: status,
            rateLimits: rateLimitStatus,
            summary: {
                availableProviders: Object.values(status).filter(p => p.available).length,
                totalProviders: Object.keys(status).length,
                totalErrors: Object.values(status).reduce((sum, p) => sum + p.errorCount, 0)
            }
        });
    } catch (error) {
        console.error('Error fetching provider status:', error.message);
        res.status(500).json({ error: 'Failed to fetch provider status', details: error.message });
    }
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

// Metrics endpoint
app.get('/metrics', (req, res) => {
    res.set('Content-Type', register.contentType);
    register.metrics().then(metrics => res.end(metrics)).catch(error => {
        logError(error, req, 'Metrics endpoint');
        res.status(500).json({ error: 'Failed to retrieve metrics' });
    });
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

// WebSocket for real-time collaboration and financial data
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (room) => {
        socket.join(room);
        socket.to(room).emit('user-joined', socket.id);
    });

    socket.on('ai-inference', (data) => {
        socket.to(data.room).emit('ai-inference', data);
    });

    // Financial data real-time subscriptions
    socket.on('subscribe-financial', (data) => {
        const { symbols, updateInterval = 5000 } = data; // 5 second default

        if (!symbols || !Array.isArray(symbols)) {
            socket.emit('error', { message: 'Symbols array required' });
            return;
        }

        console.log(`User ${socket.id} subscribed to financial data for:`, symbols);

        // Send initial data
        symbols.forEach(async (symbol) => {
            try {
                const stockData = await financialManager.getStockQuote(symbol);
                socket.emit('financial-update', {
                    symbol: stockData.symbol,
                    data: stockData,
                    timestamp: new Date()
                });
            } catch (error) {
                socket.emit('financial-error', {
                    symbol,
                    error: error.message
                });
            }
        });

        // Set up real-time updates
        const intervalId = setInterval(async () => {
            symbols.forEach(async (symbol) => {
                try {
                    const stockData = await financialManager.getStockQuote(symbol);
                    socket.emit('financial-update', {
                        symbol: stockData.symbol,
                        data: stockData,
                        timestamp: new Date()
                    });
                } catch (error) {
                    socket.emit('financial-error', {
                        symbol,
                        error: error.message
                    });
                }
            });
        }, updateInterval);

        // Store interval for cleanup
        socket._financialInterval = intervalId;

        socket.on('unsubscribe-financial', () => {
            if (socket._financialInterval) {
                clearInterval(socket._financialInterval);
                delete socket._financialInterval;
            }
            console.log(`User ${socket.id} unsubscribed from financial data`);
        });
    });

    // Portfolio real-time tracking
    socket.on('subscribe-portfolio', (data) => {
        const { portfolioId, updateInterval = 10000 } = data; // 10 second default for portfolio

        if (!portfolioId) {
            socket.emit('error', { message: 'Portfolio ID required' });
            return;
        }

        console.log(`User ${socket.id} subscribed to portfolio:`, portfolioId);

        // Set up portfolio updates
        const intervalId = setInterval(async () => {
            try {
                // Get portfolio data (mock implementation - would come from database)
                const portfolioData = await getPortfolioData(portfolioId);
                socket.emit('portfolio-update', {
                    portfolioId,
                    data: portfolioData,
                    timestamp: new Date()
                });
            } catch (error) {
                socket.emit('portfolio-error', {
                    portfolioId,
                    error: error.message
                });
            }
        }, updateInterval);

        socket._portfolioInterval = intervalId;

        socket.on('unsubscribe-portfolio', () => {
            if (socket._portfolioInterval) {
                clearInterval(socket._portfolioInterval);
                delete socket._portfolioInterval;
            }
            console.log(`User ${socket.id} unsubscribed from portfolio:`, portfolioId);
        });
    });

    // Market news real-time updates
    socket.on('subscribe-news', (data) => {
        const { categories = [], updateInterval = 30000 } = data; // 30 second default for news

        console.log(`User ${socket.id} subscribed to news categories:`, categories);

        // Set up news updates
        const intervalId = setInterval(async () => {
            try {
                // Get latest market news (mock implementation)
                const newsData = await getMarketNews(categories);
                socket.emit('news-update', {
                    data: newsData,
                    timestamp: new Date()
                });
            } catch (error) {
                socket.emit('news-error', {
                    error: error.message
                });
            }
        }, updateInterval);

        socket._newsInterval = intervalId;

        socket.on('unsubscribe-news', () => {
            if (socket._newsInterval) {
                clearInterval(socket._newsInterval);
                delete socket._newsInterval;
            }
            console.log(`User ${socket.id} unsubscribed from news`);
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Clean up all intervals
        if (socket._financialInterval) {
            clearInterval(socket._financialInterval);
        }
        if (socket._portfolioInterval) {
            clearInterval(socket._portfolioInterval);
        }
        if (socket._newsInterval) {
            clearInterval(socket._newsInterval);
        }
    });
});

// Helper function to get portfolio data (mock implementation)
async function getPortfolioData(portfolioId) {
    // In production, this would fetch from database
    // For now, return mock portfolio data
    return {
        portfolioId,
        totalValue: 125000.50,
        totalGainLoss: 2500.75,
        totalGainLossPercent: 2.04,
        holdings: [
            {
                symbol: 'AAPL',
                shares: 100,
                currentPrice: 175.50,
                marketValue: 17550.00,
                gainLoss: 500.00,
                gainLossPercent: 2.93
            },
            {
                symbol: 'MSFT',
                shares: 50,
                currentPrice: 378.25,
                marketValue: 18912.50,
                gainLoss: 812.50,
                gainLossPercent: 4.49
            }
        ],
        lastUpdated: new Date()
    };
}

// Helper function to get market news (mock implementation)
async function getMarketNews(categories) {
    // In production, this would fetch from news API
    // For now, return mock news data
    return [
        {
            id: 'news-1',
            title: 'Federal Reserve Signals Potential Rate Cut',
            summary: 'Fed officials indicate possible interest rate reduction in Q2...',
            source: 'Financial Times',
            publishedAt: new Date(),
            category: 'economics',
            importance: 'high'
        },
        {
            id: 'news-2',
            title: 'Tech Stocks Rally on AI Optimism',
            summary: 'Major tech companies see gains as AI investments show promise...',
            source: 'Reuters',
            publishedAt: new Date(Date.now() - 300000), // 5 minutes ago
            category: 'technology',
            importance: 'medium'
        }
    ];
}



// Apply error handling middleware (must be last)
app.use(errorHandler);

// 404 handler for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Start server
async function startServer() {
    try {
        // Find available port if needed
        const finalPort = await findAvailablePort(port);
        if (finalPort !== port) {
            console.log(`Port ${port} in use, using ${finalPort} instead`);
        }

        server.listen(finalPort, () => {
            console.log(`✅ AI Dashboard Server running at http://localhost:${finalPort}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 WebSocket server enabled for real-time features`);
            console.log(`📈 Financial data integration active`);
            console.log(`🤖 AI services: OpenAI, Hugging Face, Google Cloud, Azure, AWS, NVIDIA`);
            console.log(`📊 Metrics available at http://localhost:${finalPort}/metrics`);
        });

        // Handle server shutdown gracefully
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('SIGINT received, shutting down gracefully');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
