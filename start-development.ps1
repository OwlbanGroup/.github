# Development Startup Script for AI Dashboard
# This script starts the application in development mode with hot reloading

Write-Host "🚀 Starting AI Dashboard in Development Mode..." -ForegroundColor Green

# Check Node.js
if (-not (Test-Command node)) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
    npm install
}

# Set development environment
$env:NODE_ENV = "development"
$env:PORT = $env:PORT ?? "3000"

# Start the application
Write-Host "🎯 Starting development server..." -ForegroundColor Blue
Write-Host "🌐 Application will be available at: http://localhost:$env:PORT" -ForegroundColor Green
Write-Host "📝 Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start with nodemon if available, otherwise use node
if (Test-Command nodemon) {
    nodemon app.js
} else {
    Write-Host "💡 Install nodemon for automatic restarts: npm install -g nodemon" -ForegroundColor Cyan
    node app.js
}
