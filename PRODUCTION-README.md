# AI Dashboard - Production Deployment Guide

## 🚀 Overview

This guide provides comprehensive instructions for deploying the AI Dashboard in a production environment. The application includes multiple AI service integrations, financial data processing, real-time features, and production-ready infrastructure.

## 📋 Prerequisites

### System Requirements
- **Node.js**: Version 16 or higher
- **npm**: Latest stable version
- **Memory**: Minimum 512MB RAM (2GB recommended)
- **Storage**: Minimum 1GB free space
- **Operating System**: Linux, macOS, or Windows

### External Services
- **MongoDB**: Database for user data and application state
- **Redis**: Caching and session storage
- **API Keys**: OpenAI, Hugging Face, Google Cloud, Azure, AWS, NVIDIA

## 🛠️ Quick Start

### 1. Environment Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ai-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the application**:
   ```bash
   # On Linux/macOS
   ./start-production.sh

   # On Windows
   .\start-production.ps1
   ```

### 2. Docker Deployment

1. **Build the Docker image**:
   ```bash
   docker build -f Dockerfile.prod -t ai-dashboard:latest .
   ```

2. **Run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Web UI: http://localhost:3000
   - Health Check: http://localhost:3000/health
   - Metrics: http://localhost:3000/metrics

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `production` |
| `PORT` | Server port | No | `3000` |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key | No | - |
| `HF_API_KEY` | Hugging Face API key | No | - |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | No | - |
| `AWS_ACCESS_KEY_ID` | AWS access key | No | - |
| `NVIDIA_API_KEY` | NVIDIA NGC API key | No | - |

### API Keys Setup

1. **OpenAI**:
   - Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Set `OPENAI_API_KEY` in environment

2. **Hugging Face**:
   - Get token from [Hugging Face Settings](https://huggingface.co/settings/tokens)
   - Set `HF_API_KEY` in environment

3. **NVIDIA NGC**:
   - Get API key from [NVIDIA NGC](https://ngc.nvidia.com/setup/api-key)
   - Set `NVIDIA_API_KEY` and `NVIDIA_ORG_ID` in environment

## 🐳 Docker Deployment

### Using Docker Compose

1. **Start all services**:
   ```bash
   docker-compose up -d
   ```

2. **View logs**:
   ```bash
   docker-compose logs -f ai-dashboard
   ```

3. **Stop services**:
   ```bash
   docker-compose down
   ```

### Using Kubernetes

1. **Deploy to Kubernetes**:
   ```bash
   kubectl apply -f k8s/
   ```

2. **Check deployment status**:
   ```bash
   kubectl get pods -l app=ai-dashboard
   kubectl get services -l app=ai-dashboard
   ```

3. **View logs**:
   ```bash
   kubectl logs -l app=ai-dashboard
   ```

## 📊 Monitoring

### Health Checks

- **Application Health**: http://localhost:3000/health
- **Database Connectivity**: Automatic monitoring
- **External API Status**: Automatic monitoring

### Metrics

- **Prometheus Metrics**: http://localhost:3000/metrics
- **Application Logs**: `./logs/app.log`
- **Error Logs**: `./logs/error.log`

### Useful Commands

```bash
# View application logs
tail -f logs/app.log

# Check system resources
docker stats

# Monitor database connections
docker-compose exec mongodb mongosh --eval "db.serverStatus().connections"

# Check Redis status
docker-compose exec redis redis-cli ping
```

## 🔒 Security

### Best Practices

1. **API Keys**:
   - Never commit API keys to version control
   - Use environment variables or secret management
   - Rotate keys regularly

2. **Network Security**:
   - Use HTTPS in production
   - Configure firewall rules
   - Enable rate limiting

3. **Authentication**:
   - Use strong JWT secrets
   - Implement proper session management
   - Enable CORS appropriately

### Security Features

- ✅ Rate limiting (100 requests per 15 minutes per IP)
- ✅ Helmet.js security headers
- ✅ Input validation and sanitization
- ✅ JWT authentication
- ✅ Password hashing with bcrypt
- ✅ CORS configuration
- ✅ Request logging and monitoring

## 🚀 Scaling

### Horizontal Scaling

1. **Using PM2**:
   ```bash
   pm2 start ecosystem.config.js
   pm2 scale ai-dashboard +2  # Add 2 more instances
   ```

2. **Using Docker**:
   ```bash
   docker-compose up -d --scale ai-dashboard=3
   ```

3. **Using Kubernetes**:
   ```bash
   kubectl scale deployment ai-dashboard --replicas=5
   ```

### Load Balancing

- Use reverse proxy (nginx, HAProxy)
- Configure health checks
- Enable session affinity if needed

## 🔧 Troubleshooting

### Common Issues

1. **Application won't start**:
   ```bash
   # Check logs
   tail -f logs/error.log

   # Verify environment variables
   ./start-production.sh --verbose

   # Check port availability
   netstat -tulpn | grep :3000
   ```

2. **Database connection issues**:
   ```bash
   # Check MongoDB status
   docker-compose exec mongodb mongosh --eval "db.runCommand({ping: 1})"

   # Check Redis status
   docker-compose exec redis redis-cli ping
   ```

3. **API connectivity issues**:
   ```bash
   # Test OpenAI API
   curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

   # Test Hugging Face API
   curl -H "Authorization: Bearer $HF_API_KEY" https://api-inference.huggingface.co/models
   ```

### Debug Mode

Enable debug logging by setting:
```bash
export NODE_ENV=development
export LOG_LEVEL=debug
```

## 📈 Performance Optimization

### Memory Management

1. **Node.js optimization**:
   ```bash
   # Set memory limits
   export NODE_OPTIONS="--max-old-space-size=4096"

   # Enable garbage collection
   export NODE_OPTIONS="--expose-gc $NODE_OPTIONS"
   ```

2. **Database optimization**:
   - Enable connection pooling
   - Use indexes appropriately
   - Implement caching strategies

### Caching

- Redis for session storage and API responses
- In-memory caching for frequently accessed data
- CDN for static assets

## 🔄 Backup and Recovery

### Database Backup

```bash
# MongoDB backup
docker-compose exec mongodb mongodump --out /backup/$(date +%Y%m%d_%H%M%S)

# Redis backup
docker-compose exec redis redis-cli SAVE
```

### Application Backup

```bash
# Create application backup
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='.git' \
    .
```

## 📝 API Documentation

### Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"password"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"password"}'
```

### AI Endpoints

```bash
# OpenAI Chat
curl -X POST http://localhost:3000/api/ai/openai-chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'

# Financial Data
curl -X GET http://localhost:3000/api/financial/stock/AAPL \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🤝 Support

### Getting Help

1. **Check logs**: `./logs/app.log` and `./logs/error.log`
2. **Health check**: Visit http://localhost:3000/health
3. **API documentation**: Check `API.md` file
4. **Community**: GitHub issues and discussions

### Common Questions

**Q: How do I update the application?**
```bash
git pull origin main
npm install
pm2 restart ai-dashboard
```

**Q: How do I add new environment variables?**
- Add to `.env.example`
- Update `.env` file
- Restart the application

**Q: How do I monitor resource usage?**
```bash
# Docker stats
docker stats

# PM2 monitoring
pm2 monit

# System resources
htop
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for AI capabilities
- Hugging Face for model hosting
- MongoDB and Redis for data storage
- Docker and Kubernetes for containerization
- All contributors and supporters

---

**For production deployment issues, please check the troubleshooting section above or create an issue in the repository.**
