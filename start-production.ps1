# Perfect Production Startup Script for AI Dashboard (Windows PowerShell)
# This script ensures the application runs reliably in production

param(
    [switch]$Install,
    [switch]$Stop,
    [switch]$Restart
)

Write-Host "🚀 AI Dashboard Production Manager" -ForegroundColor Green

# Function to check if command exists
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Stop existing processes
if ($Stop -or $Restart) {
    Write-Host "🛑 Stopping AI Dashboard processes..." -ForegroundColor Yellow
    try {
        pm2 delete ai-dashboard 2>$null
        Write-Host "✅ Processes stopped" -ForegroundColor Green
    } catch {
        Write-Host "ℹ️  No running processes found" -ForegroundColor Blue
    }

    if ($Stop) {
        exit 0
    }
}

# Install dependencies
if ($Install) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
    npm install
}

# Check Node.js
if (-not (Test-Command node)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

$nodeVersion = node -v
$majorVersion = [int]($nodeVersion -replace '^v(\d+).*', '$1')
if ($majorVersion -lt 18) {
    Write-Host "❌ Node.js version 18+ required. Current version: $nodeVersion" -ForegroundColor Red
    exit 1
}

# Check/Install PM2
if (-not (Test-Command pm2)) {
    Write-Host "📦 Installing PM2 process manager..." -ForegroundColor Blue
    npm install -g pm2
}

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
    npm ci --only=production
}

# Create logs directory
if (-not (Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# Set environment variables
$env:NODE_ENV = "production"
$env:PORT = $env:PORT ?? "3000"

# Check MongoDB (optional)
if (Test-Command mongod) {
    $mongoRunning = Get-Process mongod -ErrorAction SilentlyContinue
    if (-not $mongoRunning) {
        Write-Host "⚠️  MongoDB is not running. Make sure MongoDB is started." -ForegroundColor Yellow
        Write-Host "   You can start it with: net start MongoDB" -ForegroundColor Gray
        Write-Host "   Or use docker: docker run -d -p 27017:27017 --name mongodb mongo:6.0" -ForegroundColor Gray
    }
}

# Check Redis (optional)
if (Test-Command redis-server) {
    $redisRunning = Get-Process redis-server -ErrorAction SilentlyContinue
    if (-not $redisRunning) {
        Write-Host "⚠️  Redis is not running. Make sure Redis is started." -ForegroundColor Yellow
        Write-Host "   Or use docker: docker run -d -p 6379:6379 --name redis redis:7-alpine" -ForegroundColor Gray
    }
}

# Start the application
Write-Host "🎯 Starting AI Dashboard with PM2..." -ForegroundColor Blue
pm2 start app.js --name ai-dashboard --env production --log logs/production.log --time

# Wait for startup
Start-Sleep -Seconds 3

# Check if started successfully
try {
    $pm2Status = pm2 describe ai-dashboard 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ AI Dashboard started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Application Status:" -ForegroundColor Cyan
        pm2 status
        Write-Host ""
        Write-Host "📝 Useful Commands:" -ForegroundColor Yellow
        Write-Host "   Logs: pm2 logs ai-dashboard" -ForegroundColor White
        Write-Host "   Stop: pm2 stop ai-dashboard" -ForegroundColor White
        Write-Host "   Restart: pm2 restart ai-dashboard" -ForegroundColor White
        Write-Host "   Monitor: pm2 monit" -ForegroundColor White
        Write-Host ""
        Write-Host "🌐 Application running at: http://localhost:$env:PORT" -ForegroundColor Green
        Write-Host ""
        Write-Host "📈 Monitoring:" -ForegroundColor Cyan
        Write-Host "   - PM2 Monitor: pm2 monit" -ForegroundColor White
        Write-Host "   - Logs: pm2 logs ai-dashboard --lines 100" -ForegroundColor White
        Write-Host "   - Metrics: http://localhost:$env:PORT/metrics (Prometheus)" -ForegroundColor White
    } else {
        throw "PM2 process not found"
    }
} catch {
    Write-Host "❌ Failed to start AI Dashboard. Check logs for details." -ForegroundColor Red
    pm2 logs ai-dashboard --lines 50
    exit 1
}

Write-Host ""
Write-Host "🎉 Production deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Remember to set your API keys in environment variables:" -ForegroundColor Yellow
Write-Host "   - OPENAI_API_KEY" -ForegroundColor White
Write-Host "   - HF_API_KEY" -ForegroundColor White
Write-Host "   - AZURE_OPENAI_API_KEY" -ForegroundColor White
Write-Host "   - AZURE_OPENAI_ENDPOINT" -ForegroundColor White
Write-Host "   - GOOGLE_CLOUD_PROJECT_ID" -ForegroundColor White
Write-Host "   - AWS_ACCESS_KEY_ID" -ForegroundColor White
Write-Host "   - AWS_SECRET_ACCESS_KEY" -ForegroundColor White
Write-Host "   - MONGODB_URI" -ForegroundColor White
Write-Host "   - REDIS_URL" -ForegroundColor White
Write-Host "   - JWT_SECRET" -ForegroundColor White
Write-Host ""
Write-Host "🔧 For PM2 auto-startup on boot:" -ForegroundColor Cyan
Write-Host "   pm2 startup" -ForegroundColor White
Write-Host "   pm2 save" -ForegroundColor White
