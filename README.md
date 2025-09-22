# 🧠 AI Dashboard - The Most Advanced AI System

A comprehensive, enterprise-grade AI dashboard integrating multiple AI platforms including OpenAI GPT-4, Google Cloud Vertex AI, Microsoft Azure OpenAI, AWS SageMaker, and Hugging Face models.

## ✨ Features

### 🤖 Multi-Platform AI Integration
- **OpenAI**: GPT-4 chat, DALL-E 3 image generation
- **Google Cloud Vertex AI**: Multimodal AI capabilities
- **Microsoft Azure OpenAI**: Enterprise-grade cloud AI
- **AWS SageMaker**: ML model training and deployment
- **Hugging Face**: Text generation, image generation, code completion, sentiment analysis

### 🛡️ Enterprise Security & Performance
- JWT-based authentication
- Rate limiting and security headers
- Redis caching for performance
- MongoDB for persistent storage
- Real-time WebSocket collaboration

### 📊 Advanced Analytics & Monitoring
- Prometheus metrics collection
- Real-time GPU monitoring (NVIDIA)
- AI-powered analytics with TensorFlow.js
- Docker & Kubernetes deployment ready

### 🎨 Modern UI/UX
- Dark mode toggle
- Internationalization support
- Responsive design
- Real-time updates

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (optional, for user management)
- Redis (optional, for caching)
- NVIDIA GPU (optional, for GPU monitoring)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set environment variables** (create `.env` file)
   ```env
   # Required API Keys
   OPENAI_API_KEY=your_openai_key
   HF_API_KEY=your_huggingface_key

   # Optional (for full functionality)
   AZURE_OPENAI_API_KEY=your_azure_key
   AZURE_OPENAI_ENDPOINT=your_azure_endpoint
   GOOGLE_CLOUD_PROJECT_ID=your_gcp_project
   AWS_ACCESS_KEY_ID=your_aws_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret

   # Database & Cache
   MONGODB_URI=mongodb://localhost:27017/dashboard
   REDIS_URL=redis://localhost:6379

   # Security
   JWT_SECRET=your_jwt_secret
   ```

### Running the Application

#### Development Mode
```bash
# Windows PowerShell
.\start-development.ps1

# Linux/macOS
npm run dev
```

#### Production Mode
```bash
# Windows PowerShell
.\start-production.ps1

# Linux/macOS
./start-production.sh
```

The application will be available at `http://localhost:3000`

## 📁 Project Structure

```
ai-dashboard/
├── app.js                    # Main Express server
├── package.json              # Dependencies and scripts
├── start-production.sh       # Linux/macOS production script
├── start-production.ps1      # Windows production script
├── start-development.ps1     # Windows development script
├── Dockerfile                # Docker containerization
├── docker-compose.yml        # Local development with Docker
├── k8s/                      # Kubernetes deployment
│   └── deployment.yaml
├── .github/workflows/        # CI/CD pipelines
│   └── ci-cd.yml
└── dashboard/                # Frontend assets
    ├── index.html           # Main dashboard
    ├── script.js            # Frontend logic
    ├── nvidia.js            # NVIDIA GPU integration
    ├── collaboration.js     # Real-time collaboration
    └── styles.css           # Styling
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### AI Services (Protected)
- `POST /api/ai/text-generation` - Hugging Face text generation
- `POST /api/ai/image-generation` - Stable Diffusion image generation
- `POST /api/ai/code-completion` - Code completion
- `POST /api/ai/sentiment-analysis` - Sentiment analysis
- `POST /api/ai/openai-chat` - OpenAI GPT-4 chat
- `POST /api/ai/openai-image` - OpenAI DALL-E 3 images
- `POST /api/ai/google-vertex` - Google Cloud Vertex AI
- `POST /api/ai/azure-openai-chat` - Azure OpenAI
- `POST /api/ai/aws-sagemaker` - AWS SageMaker
- `POST /api/ai/rag-query` - RAG-powered queries
- `POST /api/ai/fine-tune` - Model fine-tuning

### System Endpoints
- `GET /api/operations` - Operations KPIs
- `GET /api/banking` - Banking metrics
- `GET /api/gpu` - NVIDIA GPU metrics
- `GET /metrics` - Prometheus metrics

### Infrastructure
- `POST /api/docker/containers` - Docker container management
- `POST /api/kubernetes/deploy` - Kubernetes deployments

## 🐳 Docker Deployment

### Local Development
```bash
docker-compose up -d
```

### Production Deployment
```bash
# Build and run
docker build -t ai-dashboard .
docker run -d -p 3000:3000 --env-file .env ai-dashboard
```

## ☸️ Kubernetes Deployment

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods
kubectl get services
```

## 📊 Monitoring

- **PM2**: Process monitoring and management
- **Prometheus**: Metrics collection at `/metrics`
- **Logs**: Available via `pm2 logs ai-dashboard`

## 🔐 Security Features

- Helmet.js security headers
- Express rate limiting
- JWT token authentication
- Input validation and sanitization
- CORS protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the logs: `pm2 logs ai-dashboard`
- Monitor metrics: `http://localhost:3000/metrics`

---

**Built with ❤️ for the future of AI-powered enterprise applications**
