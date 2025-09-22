# AI Dashboard API Documentation

Comprehensive API documentation for the AI Dashboard application.

## 📋 Table of Contents

- [Authentication](#authentication)
- [AI Services](#ai-services)
- [Financial Data](#financial-data)
- [NVIDIA Cloud Services](#nvidia-cloud-services)
- [System Endpoints](#system-endpoints)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

## 🔐 Authentication

All protected endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "username": "username"
  }
}
```

### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "username": "username"
  }
}
```

## 🤖 AI Services

### Text Generation (Hugging Face)
```http
POST /api/ai/text-generation
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Write a story about AI",
  "model": "gpt2",
  "max_length": 100,
  "temperature": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "result": [
    {
      "generated_text": "Generated text here..."
    }
  ]
}
```

### Image Generation (Stable Diffusion)
```http
POST /api/ai/image-generation
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "A futuristic city",
  "width": 512,
  "height": 512,
  "num_inference_steps": 50
}
```

**Response:**
```json
{
  "success": true,
  "images": ["base64_encoded_image_data"]
}
```

### Code Completion
```http
POST /api/ai/code-completion
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "def hello_world():",
  "language": "python",
  "max_new_tokens": 50
}
```

**Response:**
```json
{
  "success": true,
  "completion": "    print('Hello, World!')"
}
```

### Sentiment Analysis
```http
POST /api/ai/sentiment-analysis
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "I love this product!"
}
```

**Response:**
```json
{
  "success": true,
  "sentiment": {
    "label": "POSITIVE",
    "score": 0.9998
  }
}
```

### OpenAI Chat (GPT-4)
```http
POST /api/ai/openai-chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "model": "gpt-4",
  "temperature": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "role": "assistant",
    "content": "Hello! I'm doing well, thank you for asking."
  }
}
```

### OpenAI Image Generation (DALL-E 3)
```http
POST /api/ai/openai-image
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "A cat wearing a hat",
  "size": "1024x1024",
  "quality": "standard",
  "style": "vivid"
}
```

**Response:**
```json
{
  "success": true,
  "images": [
    {
      "url": "https://image.url",
      "revised_prompt": "A cat wearing a stylish hat"
    }
  ]
}
```

### Google Cloud Vertex AI
```http
POST /api/ai/google-vertex
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Explain quantum computing",
  "model": "text-bison",
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response:**
```json
{
  "success": true,
  "response": "Quantum computing is..."
}
```

### Azure OpenAI
```http
POST /api/ai/azure-openai-chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Write a haiku about coding"
    }
  ],
  "temperature": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "response": "Code flows like water..."
}
```

### AWS SageMaker
```http
POST /api/ai/aws-sagemaker
Authorization: Bearer <token>
Content-Type: application/json

{
  "input": "Classify this text",
  "endpoint_name": "your-endpoint"
}
```

**Response:**
```json
{
  "success": true,
  "prediction": "Classification result"
}
```

### RAG Query
```http
POST /api/ai/rag-query
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "What are the latest AI trends?",
  "context": "Technology news",
  "top_k": 5
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Based on the latest trends...",
  "sources": ["source1", "source2"]
}
```

### Fine-tuning
```http
POST /api/ai/fine-tune
Authorization: Bearer <token>
Content-Type: application/json

{
  "model": "gpt2",
  "dataset": "path/to/dataset",
  "parameters": {
    "epochs": 3,
    "learning_rate": 5e-5
  }
}
```

**Response:**
```json
{
  "success": true,
  "job_id": "ft-job-123",
  "status": "queued"
}
```

## 📊 Financial Data

### Stock Quote
```http
GET /api/financial/stock-quote?symbol=AAPL&source=alphaVantage
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "symbol": "AAPL",
  "price": {
    "current": 150.25,
    "open": 148.50,
    "high": 151.00,
    "low": 148.00,
    "change": 1.75,
    "changePercent": 1.18
  },
  "volume": 50000000,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### Financial Metrics
```http
GET /api/financial/metrics?symbol=AAPL
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "symbol": "AAPL",
  "date": "2023-12-31",
  "metrics": {
    "revenue": 383285000000,
    "netIncome": 97000000000,
    "totalAssets": 352755000000,
    "returnOnEquity": 147.45,
    "debtToEquity": 1.98
  }
}
```

### Banking Transactions
```http
GET /api/financial/banking?access_token=plaid_token&start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "transactionId": "tx_123",
      "amount": -50.00,
      "description": "Grocery Store",
      "category": "expense",
      "date": "2024-01-15"
    }
  ]
}
```

### Portfolio
```http
GET /api/financial/portfolio?user_id=user123
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "portfolio": {
    "name": "My Portfolio",
    "totalValue": 100000,
    "holdings": [
      {
        "symbol": "AAPL",
        "shares": 100,
        "currentPrice": 150.25,
        "marketValue": 15025
      }
    ]
  }
}
```

## ☁️ NVIDIA Cloud Services

### List Models
```http
GET /api/nvidia/models
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "models": [
    {
      "id": "model_123",
      "name": "Llama 2 7B",
      "type": "text-generation",
      "status": "available"
    }
  ]
}
```

### Run Inference
```http
POST /api/nvidia/inference
Authorization: Bearer <token>
Content-Type: application/json

{
  "model": "model_123",
  "input": "Hello world",
  "parameters": {
    "max_tokens": 100,
    "temperature": 0.7
  }
}
```

**Response:**
```json
{
  "success": true,
  "output": "Generated text...",
  "usage": {
    "tokens": 150,
    "cost": 0.001
  }
}
```

### List Instances
```http
GET /api/nvidia/instances
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "instances": [
    {
      "id": "instance_123",
      "name": "gpu-instance-1",
      "status": "running",
      "gpu_type": "A100",
      "utilization": 85
    }
  ]
}
```

### Deploy Model
```http
POST /api/nvidia/deploy
Authorization: Bearer <token>
Content-Type: application/json

{
  "modelId": "model_123",
  "instanceType": "gpu_1gpu",
  "name": "my-deployment",
  "replicas": 1
}
```

**Response:**
```json
{
  "success": true,
  "deployment": {
    "id": "deploy_123",
    "status": "creating",
    "endpoint": "https://api.nvidia.com/v1/deployments/deploy_123"
  }
}
```

## 🖥️ System Endpoints

### Operations Dashboard
```http
GET /api/operations
```

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["Americas", "Europe", "Asia", "Africa"],
    "datasets": [
      {
        "label": "Revenue",
        "data": [120000, 80000, 60000, 40000]
      }
    ]
  }
}
```

### Banking Metrics
```http
GET /api/banking
```

**Response:**
```json
{
  "success": true,
  "data": {
    "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    "datasets": [
      {
        "label": "Transactions",
        "data": [1200, 1900, 3000, 5000, 3800, 4200]
      }
    ]
  }
}
```

### Profits Analytics
```http
GET /api/profits
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalRevenue": 1000000,
    "netProfit": 250000,
    "profitMargin": 25,
    "roi": 15
  },
  "charts": {
    "revenue": [100000, 120000, 90000, 150000],
    "profit": [25000, 30000, 20000, 40000]
  }
}
```

### GPU Metrics
```http
GET /api/gpu
```

**Response:**
```json
{
  "success": true,
  "utilization": 75,
  "memory": {
    "used": 8.5,
    "total": 12,
    "free": 3.5
  },
  "temperature": 65,
  "power": 250
}
```

### Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2
    }
  }
}
```

### Metrics (Prometheus)
```http
GET /metrics
```

Returns Prometheus-compatible metrics.

## 🐳 Docker Management

### List Containers
```http
GET /api/docker/containers
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "containers": [
    {
      "id": "container_123",
      "name": "ai-dashboard",
      "status": "running",
      "image": "ai-dashboard:latest"
    }
  ]
}
```

### Manage Container
```http
POST /api/docker/containers
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "start|stop|restart|remove",
  "containerId": "container_123"
}
```

## ☸️ Kubernetes Management

### Deploy Application
```http
POST /api/kubernetes/deploy
Authorization: Bearer <token>
Content-Type: application/json

{
  "namespace": "default",
  "replicas": 3,
  "image": "ai-dashboard:latest"
}
```

**Response:**
```json
{
  "success": true,
  "deployment": {
    "name": "ai-dashboard",
    "status": "deploying",
    "replicas": 3
  }
}
```

## ❌ Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Common HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error
- `502`: Bad Gateway
- `503`: Service Unavailable

## 🚦 Rate Limiting

Rate limiting is applied to prevent abuse:

- **Default limit**: 100 requests per 15-minute window
- **Headers**:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Time when limit resets

When rate limit is exceeded:
```json
{
  "success": false,
  "error": {
    "message": "Too many requests",
    "statusCode": 429,
    "retryAfter": 900
  }
}
```

## 📝 Response Format

All API responses follow this consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

For more information or support, please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) file or create an issue in the repository.
