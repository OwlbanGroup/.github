# Enhanced Production Startup Script for Owlban Group AI Dashboard (Windows)
# Features: Health checks, environment validation, backup, monitoring, and recovery

param(
    [switch]$Backup,
    [switch]$Cleanup,
    [switch]$SetupStartup,
    [switch]$Help
)

# Configuration
$APP_NAME = "owlban-ai-dashboard"
$LOG_DIR = "logs"
$BACKUP_DIR = "backups"
$HEALTH_CHECK_URL = "http://localhost:3000/api/operations"
$MAX_STARTUP_TIME = 60
$REQUIRED_NODE_VERSION = 18

# Colors for output
$RED = "Red"
$GREEN = "Green"
$YELLOW = "Yellow"
$BLUE = "Blue"
$CYAN = "Cyan"
$WHITE = "White"

# Logging functions
function Write-LogInfo {
    param($Message)
    Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] [INFO] $Message" -ForegroundColor $BLUE
}

function Write-LogSuccess {
    param($Message)
    Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] [SUCCESS] $Message" -ForegroundColor $GREEN
}

function Write-LogWarning {
    param($Message)
    Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] [WARNING] $Message" -ForegroundColor $YELLOW
}

function Write-LogError {
    param($Message)
    Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] [ERROR] $Message" -ForegroundColor $RED
}

# Function to check if port is in use
function Test-PortInUse {
    param($Port)
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect("localhost", $Port)
        $tcpClient.Close()
        return $true
    } catch {
        return $false
    }
}

# Function to wait for application to be ready
function Wait-ForApp {
    param($MaxAttempts = 30)

    Write-LogInfo "Waiting for application to be ready..."

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $HEALTH_CHECK_URL -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-LogSuccess "Application is ready!"
                return $true
            }
        } catch {
            # Continue waiting
        }

        Write-LogInfo "Attempt $attempt/$MaxAttempts - Application not ready yet..."
        Start-Sleep -Seconds 2
    }

    Write-LogError "Application failed to start within $MaxAttempts attempts"
    return $false
}

# Function to create backup
function New-Backup {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "$BACKUP_DIR\backup_$timestamp.zip"

    Write-LogInfo "Creating backup: $backupFile"

    if (-not (Test-Path $BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    }

    # Create backup excluding unnecessary files
    $exclude = @('node_modules', 'logs', 'backups', '.git', '*.log', 'test-results')
    $items = Get-ChildItem -Path "." -Exclude $exclude

    Compress-Archive -Path $items.FullName -DestinationPath $backupFile -CompressionLevel Optimal

    Write-LogSuccess "Backup created: $backupFile"
}

# Function to validate environment
function Test-Environment {
    Write-LogInfo "Validating environment..."

    # Check Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-LogError "Node.js is not installed"
        exit 1
    }

    $nodeVersion = node -v
    $majorVersion = [int]($nodeVersion -replace '^v(\d+).*', '$1')
    if ($majorVersion -lt $REQUIRED_NODE_VERSION) {
        Write-LogError "Node.js version $REQUIRED_NODE_VERSION+ required. Current: $nodeVersion"
        exit 1
    }

    # Check PM2
    if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
        Write-LogInfo "Installing PM2..."
        npm install -g pm2
    }

    # Check if port is available
    $port = if ($env:PORT) { $env:PORT } else { 3000 }
    if (Test-PortInUse -Port $port) {
        Write-LogWarning "Port $port is already in use. Attempting to free it..."

        # Try to find and kill process using the port
        $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                if ($conn.OwningProcess) {
                    Write-LogWarning "Stopping process $($conn.OwningProcess) using port $port"
                    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
            Start-Sleep -Seconds 2
        }
    }

    Write-LogSuccess "Environment validation passed"
}

# Function to setup monitoring
function Initialize-Monitoring {
    Write-LogInfo "Setting up monitoring..."

    # Create PM2 ecosystem file if it doesn't exist
    if (-not (Test-Path "ecosystem.config.js")) {
        $ecosystemConfig = @"
module.exports = {
  apps: [{
    name: '$APP_NAME',
    script: 'app.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
"@
        $ecosystemConfig | Out-File -FilePath "ecosystem.config.js" -Encoding UTF8
        Write-LogSuccess "Created PM2 ecosystem file"
    }
}

# Function to start application
function Start-Application {
    Write-LogInfo "Starting $APP_NAME..."

    # Create backup before starting
    New-Backup

    # Stop any existing instance
    pm2 delete $APP_NAME 2>$null

    # Start with PM2 ecosystem file
    pm2 start ecosystem.config.js --env production

    # Wait for application to be ready
    if (Wait-ForApp -MaxAttempts 30) {
        Write-LogSuccess "Application started successfully"

        # Setup PM2 startup (optional)
        if ($SetupStartup) {
            Write-LogInfo "Setting up PM2 auto-startup..."
            try {
                pm2 startup
                pm2 save
                Write-LogSuccess "PM2 auto-startup configured"
            } catch {
                Write-LogWarning "Failed to setup PM2 auto-startup"
            }
        }

        return $true
    } else {
        Write-LogError "Application failed to start"
        Show-Logs
        return $false
    }
}

# Function to show application status
function Show-Status {
    Write-Host ""
    Write-LogInfo "Application Status:"
    pm2 status $APP_NAME 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-LogWarning "PM2 status not available"
    }

    Write-Host ""
    Write-LogInfo "Resource Usage:"
    pm2 monit $APP_NAME 2>$null | Select-Object -First 20
    if ($LASTEXITCODE -ne 0) {
        Write-LogWarning "PM2 monitoring not available"
    }
}

# Function to show logs
function Show-Logs {
    Write-Host ""
    Write-LogInfo "Recent Application Logs:"
    pm2 logs $APP_NAME --lines 20 --nostream 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-LogWarning "Logs not available"
    }
}

# Function to cleanup old backups
function Clear-OldBackups {
    Write-LogInfo "Cleaning up old backups..."

    $backupFiles = Get-ChildItem "$BACKUP_DIR\*.zip" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if ($backupFiles.Count -gt 10) {
        $filesToDelete = $backupFiles | Select-Object -Skip 10
        $filesToDelete | Remove-Item -Force
        Write-LogSuccess "Cleaned up old backups"
    }
}

# Main execution
function Main {
    Write-Host "🚀 Enhanced Production Startup for $APP_NAME" -ForegroundColor $GREEN
    Write-Host "==============================================" -ForegroundColor $GREEN

    # Parse command line arguments
    if ($Help) {
        Write-Host "Usage: .\start-production-enhanced.ps1 [options]" -ForegroundColor $WHITE
        Write-Host "" -ForegroundColor $WHITE
        Write-Host "Options:" -ForegroundColor $CYAN
        Write-Host "  -Backup        Create backup only" -ForegroundColor $WHITE
        Write-Host "  -Cleanup       Cleanup old backups only" -ForegroundColor $WHITE
        Write-Host "  -SetupStartup  Setup PM2 auto-startup on boot" -ForegroundColor $WHITE
        Write-Host "  -Help          Show this help" -ForegroundColor $WHITE
        exit 0
    }

    if ($Backup) {
        New-Backup
        exit 0
    }

    if ($Cleanup) {
        Clear-OldBackups
        exit 0
    }

    # Validate environment
    Test-Environment

    # Setup monitoring
    Initialize-Monitoring

    # Create necessary directories
    if (-not (Test-Path $LOG_DIR)) {
        New-Item -ItemType Directory -Path $LOG_DIR | Out-Null
    }

    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-LogInfo "Installing dependencies..."
        npm ci --only=production
    }

    # Set environment variables
    $env:NODE_ENV = "production"
    if (-not $env:PORT) { $env:PORT = "3000" }

    # Check MongoDB (optional)
    if (Get-Command mongod -ErrorAction SilentlyContinue) {
        $mongoRunning = Get-Process mongod -ErrorAction SilentlyContinue
        if (-not $mongoRunning) {
            Write-LogWarning "MongoDB is not running. Make sure MongoDB is started."
            Write-Host "   You can start it with: net start MongoDB" -ForegroundColor Gray
            Write-Host "   Or use docker: docker run -d -p 27017:27017 --name mongodb mongo:6.0" -ForegroundColor Gray
        }
    }

    # Check Redis (optional)
    if (Get-Command redis-server -ErrorAction SilentlyContinue) {
        $redisRunning = Get-Process redis-server -ErrorAction SilentlyContinue
        if (-not $redisRunning) {
            Write-LogWarning "Redis is not running. Make sure Redis is started."
            Write-Host "   Or use docker: docker run -d -p 6379:6379 --name redis redis:7-alpine" -ForegroundColor Gray
        }
    }

    # Start application
    if (Start-Application) {
        # Show status
        Show-Status

        # Cleanup old backups
        Clear-OldBackups

        Write-Host ""
        Write-LogSuccess "🎉 $APP_NAME is now running in production!"
        Write-Host ""
        Write-Host "🌐 Application URL: http://localhost:$($env:PORT)" -ForegroundColor $GREEN
        Write-Host "📊 Metrics URL: http://localhost:$($env:PORT)/metrics" -ForegroundColor $GREEN
        Write-Host ""
        Write-Host "📝 Useful Commands:" -ForegroundColor $YELLOW
        Write-Host "   Logs: pm2 logs $APP_NAME" -ForegroundColor $WHITE
        Write-Host "   Stop: pm2 stop $APP_NAME" -ForegroundColor $WHITE
        Write-Host "   Restart: pm2 restart $APP_NAME" -ForegroundColor $WHITE
        Write-Host "   Monitor: pm2 monit" -ForegroundColor $WHITE
        Write-Host ""
        Write-Host "🔧 Environment variables to set:" -ForegroundColor $CYAN
        Write-Host "   OPENAI_API_KEY, HF_API_KEY, NVIDIA_API_KEY" -ForegroundColor $WHITE
        Write-Host "   MONGODB_URI, REDIS_URL, JWT_SECRET" -ForegroundColor $WHITE
        Write-Host ""
        Write-Host "💡 PM2 Commands:" -ForegroundColor $CYAN
        Write-Host "   pm2 status              # Show all processes" -ForegroundColor $WHITE
        Write-Host "   pm2 logs $APP_NAME --lines 50  # Show recent logs" -ForegroundColor $WHITE
        Write-Host "   pm2 reload $APP_NAME    # Reload without downtime" -ForegroundColor $WHITE
        Write-Host "   pm2 delete $APP_NAME    # Stop and remove" -ForegroundColor $WHITE
    } else {
        Write-LogError "Failed to start $APP_NAME"
        exit 1
    }
}

# Run main function
Main
