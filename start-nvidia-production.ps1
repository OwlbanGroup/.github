# NVIDIA Enhanced Production Deployment Script (Windows PowerShell)
# Features: GPU monitoring, AI inference optimization, real-time metrics, and health checks

param(
    [switch]$Backup,
    [switch]$Cleanup,
    [switch]$Optimize,
    [switch]$SetupStartup,
    [switch]$Help
)

# Configuration
$APP_NAME = "nvidia-enhanced-control-panel"
$LOG_DIR = "logs\nvidia"
$BACKUP_DIR = "backups\nvidia"
$HEALTH_CHECK_URL = "http://localhost:3000/api/nvidia/health"
$NVIDIA_HEALTH_URL = "http://localhost:3000/api/nvidia/status"
$REQUIRED_NODE_VERSION = 18

# Colors for output
$RED = "Red"
$GREEN = "Green"
$YELLOW = "Yellow"
$BLUE = "Blue"
$PURPLE = "Magenta"
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

function Write-LogNvidia {
    param($Message)
    Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] [NVIDIA] $Message" -ForegroundColor $PURPLE
}

# Function to check NVIDIA GPU availability
function Test-NvidiaGPU {
    Write-LogNvidia "Checking NVIDIA GPU availability..."

    if (-not (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
        Write-LogWarning "nvidia-smi not found. Installing NVIDIA drivers may be required."
        return $false
    }

    try {
        $gpuInfo = & nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>$null
        if ($gpuInfo -and $gpuInfo.Count -gt 0) {
            $gpuName = $gpuInfo[0]
            $gpuMemory = & nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>$null | Select-Object -First 1
            Write-LogSuccess "NVIDIA GPU detected: $gpuName (${gpuMemory}MB)"
            return $true
        } else {
            Write-LogWarning "No NVIDIA GPU detected"
            return $false
        }
    } catch {
        Write-LogWarning "Error checking NVIDIA GPU: $_"
        return $false
    }
}

# Function to check CUDA installation
function Test-CUDA {
    Write-LogNvidia "Checking CUDA installation..."

    $cudaPath = "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA"
    if (Test-Path "$cudaPath\version.txt") {
        $cudaVersion = Get-Content "$cudaPath\version.txt" | Select-String "CUDA Version" | ForEach-Object { $_.Line -replace ".*CUDA Version ([0-9.]+).*", '$1' }
        Write-LogSuccess "CUDA detected: $cudaVersion"
        return $true
    } else {
        Write-LogWarning "CUDA not detected. Some features may not work optimally."
        return $false
    }
}

# Function to check port availability
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

# Function to wait for NVIDIA services to be ready
function Wait-ForNvidiaServices {
    param($MaxAttempts = 30)

    Write-LogNvidia "Waiting for NVIDIA services to be ready..."

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            # Check main health endpoint
            $response = Invoke-WebRequest -Uri $HEALTH_CHECK_URL -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                # Check NVIDIA-specific endpoint
                $nvidiaResponse = Invoke-WebRequest -Uri $NVIDIA_HEALTH_URL -TimeoutSec 5 -ErrorAction Stop
                if ($nvidiaResponse.StatusCode -eq 200) {
                    Write-LogSuccess "NVIDIA services are ready!"
                    return $true
                }
            }
        } catch {
            # Continue waiting
        }

        Write-LogNvidia "Attempt $attempt/$MaxAttempts - NVIDIA services not ready yet..."
        Start-Sleep -Seconds 3
    }

    Write-LogError "NVIDIA services failed to start within $MaxAttempts attempts"
    return $false
}

# Function to create NVIDIA-specific backup
function New-NvidiaBackup {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "$BACKUP_DIR\nvidia_backup_$timestamp.zip"

    Write-LogNvidia "Creating NVIDIA-specific backup: $backupFile"

    if (-not (Test-Path $BACKUP_DIR)) {
        New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    }

    # Create backup excluding unnecessary files
    $exclude = @('node_modules', 'logs', 'backups', '.git', '*.log', 'test-results')
    $items = Get-ChildItem -Path "." -Exclude $exclude | Where-Object {
        $_.Name -like "*nvidia*" -or $_.Name -like "*.json" -or $_.Name -like "*.js" -or $_.Name -like "*.html"
    }

    Compress-Archive -Path $items.FullName -DestinationPath $backupFile -CompressionLevel Optimal -ErrorAction SilentlyContinue

    if (Test-Path $backupFile) {
        Write-LogSuccess "NVIDIA backup created: $backupFile"
    } else {
        Write-LogWarning "Failed to create NVIDIA backup"
    }
}

# Function to validate NVIDIA environment
function Test-NvidiaEnvironment {
    Write-LogNvidia "Validating NVIDIA environment..."

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

    # Check NVIDIA GPU
    Test-NvidiaGPU

    # Check CUDA
    Test-CUDA

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

    Write-LogSuccess "NVIDIA environment validation passed"
}

# Function to setup NVIDIA monitoring
function Initialize-NvidiaMonitoring {
    Write-LogNvidia "Setting up NVIDIA monitoring..."

    # Create PM2 ecosystem file for NVIDIA if it doesn't exist
    if (-not (Test-Path "ecosystem.nvidia.config.js")) {
        $ecosystemConfig = @"
module.exports = {
  apps: [{
    name: '$APP_NAME',
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
"@
        $ecosystemConfig | Out-File -FilePath "ecosystem.nvidia.config.js" -Encoding UTF8
        Write-LogSuccess "Created NVIDIA PM2 ecosystem file"
    }

    # Create NVIDIA-specific log directory
    if (-not (Test-Path $LOG_DIR)) {
        New-Item -ItemType Directory -Path $LOG_DIR | Out-Null
    }
}

# Function to start NVIDIA application
function Start-NvidiaApplication {
    Write-LogNvidia "Starting NVIDIA Enhanced Control Panel..."

    # Create backup before starting
    New-NvidiaBackup

    # Stop any existing NVIDIA instance
    pm2 delete $APP_NAME 2>$null

    # Start with NVIDIA ecosystem file
    pm2 start ecosystem.nvidia.config.js --env production

    # Wait for NVIDIA services to be ready
    if (Wait-ForNvidiaServices -MaxAttempts 30) {
        Write-LogSuccess "NVIDIA application started successfully"

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
        Write-LogError "NVIDIA application failed to start"
        Show-NvidiaLogs
        return $false
    }
}

# Function to show NVIDIA application status
function Show-NvidiaStatus {
    Write-Host ""
    Write-LogNvidia "NVIDIA Application Status:"
    pm2 status $APP_NAME 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-LogWarning "PM2 status not available"
    }

    Write-Host ""
    Write-LogNvidia "NVIDIA GPU Status:"
    if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
        try {
            & nvidia-smi --query-gpu=utilization.gpu,utilization.memory,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits 2>$null | Select-Object -First 5
        } catch {
            Write-LogWarning "Error getting GPU status"
        }
    } else {
        Write-LogWarning "nvidia-smi not available"
    }
}

# Function to show NVIDIA logs
function Show-NvidiaLogs {
    Write-Host ""
    Write-LogNvidia "Recent NVIDIA Application Logs:"
    pm2 logs $APP_NAME --lines 30 --nostream 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-LogWarning "Logs not available"
    }
}

# Function to cleanup old NVIDIA backups
function Clear-OldNvidiaBackups {
    Write-LogNvidia "Cleaning up old NVIDIA backups..."

    $backupFiles = Get-ChildItem "$BACKUP_DIR\nvidia_backup_*.zip" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if ($backupFiles.Count -gt 5) {
        $filesToDelete = $backupFiles | Select-Object -Skip 5
        $filesToDelete | Remove-Item -Force
        Write-LogSuccess "Cleaned up old NVIDIA backups"
    }
}

# Function to optimize NVIDIA performance
function Optimize-NvidiaPerformance {
    Write-LogNvidia "Optimizing NVIDIA performance..."

    if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
        try {
            Write-LogInfo "Setting GPU to maximum performance mode..."
            & nvidia-smi -pm 1 2>$null

            Write-LogInfo "Setting GPU clocks to maximum..."
            & nvidia-smi -ac 5001,1590 2>$null

            Write-LogSuccess "NVIDIA performance optimized"
        } catch {
            Write-LogWarning "Failed to optimize NVIDIA performance: $_"
        }
    } else {
        Write-LogWarning "Cannot optimize NVIDIA performance - nvidia-smi not available"
    }
}

# Main execution
function Main {
    Write-Host "🚀 NVIDIA Enhanced Production Deployment" -ForegroundColor $GREEN
    Write-Host "========================================" -ForegroundColor $GREEN

    # Parse command line arguments
    if ($Help) {
        Write-Host "Usage: .\start-nvidia-production.ps1 [options]" -ForegroundColor $WHITE
        Write-Host "" -ForegroundColor $WHITE
        Write-Host "Options:" -ForegroundColor $CYAN
        Write-Host "  -Backup        Create NVIDIA backup only" -ForegroundColor $WHITE
        Write-Host "  -Cleanup       Cleanup old NVIDIA backups only" -ForegroundColor $WHITE
        Write-Host "  -Optimize      Optimize NVIDIA GPU performance only" -ForegroundColor $WHITE
        Write-Host "  -SetupStartup  Setup PM2 auto-startup on boot" -ForegroundColor $WHITE
        Write-Host "  -Help          Show this help" -ForegroundColor $WHITE
        exit 0
    }

    if ($Backup) {
        New-NvidiaBackup
        exit 0
    }

    if ($Cleanup) {
        Clear-OldNvidiaBackups
        exit 0
    }

    if ($Optimize) {
        Optimize-NvidiaPerformance
        exit 0
    }

    # Validate NVIDIA environment
    Test-NvidiaEnvironment

    # Setup NVIDIA monitoring
    Initialize-NvidiaMonitoring

    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-LogInfo "Installing dependencies..."
        npm ci --only=production
    }

    # Set environment variables
    $env:NODE_ENV = "production"
    if (-not $env:PORT) { $env:PORT = "3000" }
    $env:NVIDIA_ENABLED = "true"

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

    # Start NVIDIA application
    if (Start-NvidiaApplication) {
        # Show status
        Show-NvidiaStatus

        # Cleanup old backups
        Clear-OldNvidiaBackups

        Write-Host ""
        Write-LogSuccess "🎉 NVIDIA Enhanced Control Panel is now running!"
        Write-Host ""
        Write-Host "🌐 Application URLs:" -ForegroundColor $GREEN
        Write-Host "   - Main Dashboard: http://localhost:$($env:PORT)" -ForegroundColor $WHITE
        Write-Host "   - NVIDIA Panel: http://localhost:$($env:PORT)/nvidia-enhanced" -ForegroundColor $WHITE
        Write-Host "   - Health Check: $HEALTH_CHECK_URL" -ForegroundColor $WHITE
        Write-Host "   - NVIDIA Status: $NVIDIA_HEALTH_URL" -ForegroundColor $WHITE
        Write-Host ""
        Write-Host "📊 Monitoring:" -ForegroundColor $CYAN
        Write-Host "   - PM2: pm2 logs $APP_NAME" -ForegroundColor $WHITE
        Write-Host "   - GPU: nvidia-smi -l 1" -ForegroundColor $WHITE
        Write-Host "   - Metrics: http://localhost:$($env:PORT)/metrics" -ForegroundColor $WHITE
        Write-Host ""
        Write-Host "🛠️  Useful commands:" -ForegroundColor $YELLOW
        Write-Host "   pm2 logs $APP_NAME --lines 50    # Show recent logs" -ForegroundColor $WHITE
        Write-Host "   pm2 restart $APP_NAME            # Restart application" -ForegroundColor $WHITE
        Write-Host "   pm2 stop $APP_NAME               # Stop application" -ForegroundColor $WHITE
        Write-Host "   pm2 delete $APP_NAME             # Remove application" -ForegroundColor $WHITE
        Write-Host "   nvidia-smi -l 1                  # Monitor GPU in real-time" -ForegroundColor $WHITE
        Write-Host ""
        Write-Host "🔧 Environment variables:" -ForegroundColor $CYAN
        Write-Host "   NVIDIA_API_KEY, CUDA_HOME, LD_LIBRARY_PATH" -ForegroundColor $WHITE
        Write-Host "   OPENAI_API_KEY, HF_API_KEY (for AI features)" -ForegroundColor $WHITE
    } else {
        Write-LogError "Failed to start NVIDIA Enhanced Control Panel"
        exit 1
    }
}

# Run main function
Main
