# 🚀 NVIDIA Enhanced Control Panel - Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the NVIDIA Enhanced Control Panel in production environments. The system includes advanced GPU monitoring, AI inference optimization, real-time metrics, and automated health checks.

## 📋 Prerequisites

### System Requirements
- **Node.js**: Version 18 or higher
- **NVIDIA GPU**: With proper drivers installed
- **CUDA**: Version 11.0 or higher (optional but recommended)
- **PM2**: Process manager for production
- **Memory**: Minimum 8GB RAM
- **Storage**: 20GB free space

### Software Dependencies
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install NVIDIA drivers (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y nvidia-driver-XXX

# Install CUDA (optional)
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/cuda-repo-ubuntu2004_11.8.0-1_amd64.deb
sudo dpkg -i cuda-repo-ubuntu2004_11.8.0-1_amd64.deb
sudo apt-get update
sudo apt-get install -y cuda
```

## 🚀 Quick Start

### 1. Basic Production Deployment

**Linux/macOS:**
```bash
# Make script executable
chmod +x start-nvidia-production.sh

# Start NVIDIA Control Panel
./start-nvidia-production.sh
```

**Windows PowerShell:**
```powershell
# Start NVIDIA Control Panel
.\start-nvidia-production.ps1
```

### 2. Enhanced Production Deployment

**Linux/macOS:**
```bash
# Enhanced deployment with monitoring
./start-nvidia-production.sh --setup-startup

# Or use the enhanced script
./start-production-enhanced.sh
```

**Windows PowerShell:**
```powershell
# Enhanced deployment with monitoring
.\start-nvidia-production.ps1 -SetupStartup

# Or use the enhanced script
.\start-production-enhanced.ps1
```

## 📊 Available Scripts

### Production Deployment Scripts

| Script | Platform | Description |
|--------|----------|-------------|
| `start-nvidia-production.sh` | Linux/macOS | NVIDIA-specific production deployment |
| `start-nvidia-production.ps1` | Windows | NVIDIA-specific production deployment |
| `start-production-enhanced.sh` | Linux/macOS | Enhanced production deployment |
| `start-production-enhanced.ps1` | Windows | Enhanced production deployment |

### Health Check & Monitoring

| Script | Platform | Description |
|--------|----------|-------------|
| `nvidia-health-check.sh` | Linux/macOS | Comprehensive health monitoring |

## 🔧 Configuration

### Environment Variables

Set the following environment variables before deployment:

```bash
# Required
export NODE_ENV=production
export PORT=3000
export NVIDIA_ENABLED=true

# Optional - AI Services
export OPENAI_API_KEY="your-openai-key"
export HF_API_KEY="your-huggingface-key"
export NVIDIA_API_KEY="your-nvidia-key"

# Optional - Database
export MONGODB_URI="mongodb://localhost:27017/nvidia-dashboard"
export REDIS_URL="redis://localhost:6379"

# Optional - Security
export JWT_SECRET="your-jwt-secret"
```

### PM2 Ecosystem Configuration

The scripts automatically create `ecosystem.nvidia.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'nvidia-enhanced-control-panel',
    script: 'app.js',
    instances: 1,
    autorestart: true,
    watch: ['dashboard/nvidia-enhanced.js', 'dashboard/nvidia-enhanced.html'],
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000,
      NVIDIA_ENABLED: 'true'
    },
    error_file: './logs/nvidia/err.log',
    out_file: './logs/nvidia/out.log',
    log_file: './logs/nvidia/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

## 📊 Monitoring & Health Checks

### Health Check Endpoints

- **Main Health**: `http://localhost:3000/api/nvidia/health`
- **NVIDIA Status**: `http://localhost:3000/api/nvidia/status`
- **Metrics**: `http://localhost:3000/metrics`

### Running Health Checks

**Linux/macOS:**
```bash
# Single health check
./nvidia-health-check.sh

# Generate detailed report
./nvidia-health-check.sh --report

# Continuous monitoring (5-minute intervals)
./nvidia-health-check.sh --continuous 300

# Auto-recovery from issues
./nvidia-health-check.sh --recover
```

### PM2 Monitoring Commands

```bash
# View application status
pm2 status

# View logs
pm2 logs nvidia-enhanced-control-panel

# Monitor in real-time
pm2 monit

# View resource usage
pm2 list

# Restart application
pm2 restart nvidia-enhanced-control-panel

# Stop application
pm2 stop nvidia-enhanced-control-panel

# Delete application
pm2 delete nvidia-enhanced-control-panel
```

### GPU Monitoring

```bash
# Real-time GPU monitoring
nvidia-smi -l 1

# Detailed GPU information
nvidia-smi --query-gpu=name,driver_version,memory.total,memory.free,memory.used,utilization.gpu,utilization.memory,temperature.gpu --format=csv

# GPU processes
nvidia-smi --query-compute-apps=name,used_memory --format=csv
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

#### 2. PM2 Process Not Starting
```bash
# Check PM2 logs
pm2 logs nvidia-enhanced-control-panel --lines 50

# Restart PM2 daemon
pm2 kill
pm2 start ecosystem.nvidia.config.js
```

#### 3. GPU Not Detected
```bash
# Check GPU status
nvidia-smi

# Check driver status
nvidia-smi --query-gpu=driver_version --format=csv

# Reinstall drivers if needed
sudo apt-get remove --purge nvidia-*
sudo apt-get install nvidia-driver-XXX
```

#### 4. High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart application
pm2 restart nvidia-enhanced-control-panel

# Check for memory leaks
pm2 logs nvidia-enhanced-control-panel --lines 100
```

#### 5. Application Health Check Failing
```bash
# Check application logs
pm2 logs nvidia-enhanced-control-panel

# Test health endpoint manually
curl http://localhost:3000/api/nvidia/health

# Restart application
pm2 restart nvidia-enhanced-control-panel
```

### Performance Optimization

#### GPU Performance Tuning
```bash
# Set GPU to maximum performance mode
nvidia-smi -pm 1

# Set GPU clocks to maximum
nvidia-smi -ac 5001,1590

# Enable persistence mode
nvidia-smi -pm 1
```

#### Application Optimization
```bash
# Use the optimization script
./start-nvidia-production.sh --optimize

# Or manually optimize
pm2 restart nvidia-enhanced-control-panel --update-env
```

## 📈 Scaling & High Availability

### Load Balancing
```bash
# Multiple instances (adjust based on GPU memory)
pm2 start ecosystem.nvidia.config.js --env production -i 2
```

### Reverse Proxy Configuration (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint for load balancer
    location /api/nvidia/health {
        proxy_pass http://localhost:3000/api/nvidia/health;
        access_log off;
    }
}
```

### Docker Deployment
```dockerfile
FROM nvidia/cuda:11.8-devel-ubuntu20.04

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs/nvidia

# Expose port
EXPOSE 3000

# Start application
CMD ["pm2-runtime", "ecosystem.nvidia.config.js"]
```

## 🔒 Security Considerations

### Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 3000
sudo ufw allow 22
sudo ufw enable
```

### Environment Variables Security
```bash
# Never commit API keys to version control
echo "OPENAI_API_KEY=your-key" >> .env.production
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.production

# Set proper permissions
chmod 600 .env.production
```

### SSL/TLS Configuration
```bash
# Install certbot
sudo apt-get install certbot

# Generate SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📋 Maintenance

### Regular Tasks

#### Daily Health Checks
```bash
# Automated health check
./nvidia-health-check.sh --report

# GPU status check
nvidia-smi --query-gpu=utilization.gpu,utilization.memory,temperature.gpu --format=csv
```

#### Weekly Maintenance
```bash
# Clean old logs
find logs/ -name "*.log" -mtime +7 -delete

# Clean old backups
./start-nvidia-production.sh --cleanup

# Update system packages
sudo apt-get update && sudo apt-get upgrade -y
```

#### Monthly Tasks
```bash
# Security updates
sudo apt-get update && sudo apt-get upgrade -y
sudo npm audit fix

# Performance review
pm2 logs nvidia-enhanced-control-panel --lines 1000 | grep ERROR
```

### Backup Strategy

#### Automated Backups
```bash
# Create backup
./start-nvidia-production.sh --backup

# Schedule daily backups
crontab -e
# Add: 0 2 * * * /path/to/start-nvidia-production.sh --backup
```

#### Manual Backup
```bash
# Create full backup
tar -czf nvidia-backup-$(date +%Y%m%d).tar.gz \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='.git' \
    dashboard/nvidia-enhanced.html \
    dashboard/nvidia-enhanced.js \
    *.json
```

## 📞 Support & Monitoring

### Application URLs
- **Main Dashboard**: `http://localhost:3000`
- **NVIDIA Panel**: `http://localhost:3000/nvidia-enhanced`
- **Health Check**: `http://localhost:3000/api/nvidia/health`
- **Metrics**: `http://localhost:3000/metrics`

### Useful Commands Reference

```bash
# Application Management
pm2 start ecosystem.nvidia.config.js
pm2 restart nvidia-enhanced-control-panel
pm2 stop nvidia-enhanced-control-panel
pm2 delete nvidia-enhanced-control-panel

# Monitoring
pm2 logs nvidia-enhanced-control-panel
pm2 monit
nvidia-smi -l 1

# Health Checks
./nvidia-health-check.sh
curl http://localhost:3000/api/nvidia/health

# Backup & Recovery
./start-nvidia-production.sh --backup
./nvidia-health-check.sh --recover
```

### Log Files Location
- **Application Logs**: `logs/nvidia/`
- **PM2 Logs**: `~/.pm2/logs/`
- **System Logs**: `/var/log/syslog`

## 🎯 Advanced Features

### AI Inference Monitoring
- Real-time inference performance tracking
- Model accuracy monitoring
- GPU utilization optimization
- Automatic model switching

### GPU Process Management
- Process isolation
- Memory management
- Priority scheduling
- Resource allocation

### Cloud Integration
- Multi-GPU support
- Distributed training
- Model deployment
- Performance analytics

---

## 📞 Need Help?

1. **Check Logs**: `pm2 logs nvidia-enhanced-control-panel`
2. **Run Health Check**: `./nvidia-health-check.sh`
3. **Review Configuration**: Check environment variables
4. **Contact Support**: Provide logs and health report

**Production Ready**: ✅ All systems operational
