#!/bin/bash

# Perfect Production Startup Script for AI Dashboard
# This script ensures the application runs reliably in production

set -e  # Exit on any error

echo "🚀 Starting AI Dashboard in Production Mode..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

# Check if PM2 is installed, install if not
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 process manager..."
    npm install -g pm2
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci --only=production
fi

# Create logs directory
mkdir -p logs

# Set production environment variables
export NODE_ENV=production
export PORT=${PORT:-3000}

# Check if MongoDB is running (optional)
if command -v mongod &> /dev/null; then
    if ! pgrep -x "mongod" > /dev/null; then
        echo "⚠️  MongoDB is not running. Make sure MongoDB is started."
        echo "   You can start it with: brew services start mongodb/brew/mongodb-community (macOS)"
        echo "   Or use docker: docker run -d -p 27017:27017 --name mongodb mongo:6.0"
    fi
fi

# Check if Redis is running (optional)
if command -v redis-server &> /dev/null; then
    if ! pgrep -x "redis-server" > /dev/null; then
        echo "⚠️  Redis is not running. Make sure Redis is started."
        echo "   You can start it with: brew services start redis (macOS)"
        echo "   Or use docker: docker run -d -p 6379:6379 --name redis redis:7-alpine"
    fi
fi

# Stop any existing PM2 process
echo "🛑 Stopping any existing AI Dashboard processes..."
pm2 delete ai-dashboard 2>/dev/null || true

# Start the application with PM2
echo "🎯 Starting AI Dashboard with PM2..."
pm2 start app.js --name ai-dashboard --env production --log logs/production.log --time

# Wait a moment for startup
sleep 3

# Check if the application started successfully
if pm2 describe ai-dashboard > /dev/null 2>&1; then
    echo "✅ AI Dashboard started successfully!"
    echo ""
    echo "📊 Application Status:"
    pm2 status
    echo ""
    echo "📝 Logs: pm2 logs ai-dashboard"
    echo "🛑 Stop: pm2 stop ai-dashboard"
    echo "🔄 Restart: pm2 restart ai-dashboard"
    echo ""
    echo "🌐 Application should be running at: http://localhost:$PORT"
    echo ""
    echo "📈 Monitoring:"
    echo "   - PM2: pm2 monit"
    echo "   - Logs: pm2 logs ai-dashboard --lines 100"
    echo "   - Metrics: http://localhost:$PORT/metrics (Prometheus)"
else
    echo "❌ Failed to start AI Dashboard. Check logs for details."
    pm2 logs ai-dashboard --lines 50
    exit 1
fi

# Optional: Setup PM2 startup script (run once)
# pm2 startup
# pm2 save

echo ""
echo "🎉 Production deployment complete!"
echo "💡 Remember to set your API keys in environment variables:"
echo "   - OPENAI_API_KEY"
echo "   - HF_API_KEY"
echo "   - AZURE_OPENAI_API_KEY"
echo "   - AZURE_OPENAI_ENDPOINT"
echo "   - GOOGLE_CLOUD_PROJECT_ID"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - MONGODB_URI"
echo "   - REDIS_URL"
echo "   - JWT_SECRET"
