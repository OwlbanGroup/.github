# AI Dashboard Production Startup Script (PowerShell)
# This script ensures proper startup of the AI Dashboard in production

param(
    [switch]$SkipHealthCheck,
    [switch]$Verbose
)

# Function to print colored output
function Write-Status {
    param([string]$Message, [string]$Type = "INFO")
    $Color = switch ($Type) {
        "SUCCESS" { "Green" }
        "WARNING" { "Yellow" }
        "ERROR" { "Red" }
        default { "Blue" }
    }
    Write-Host "[$Type] $Message" -ForegroundColor $Color
}

# Function to test if a command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to check environment variables
function Test-EnvironmentVariables {
    Write-Status "Checking environment variables..." "INFO"

    $requiredVars = @(
        "NODE_ENV",
        "JWT_SECRET",
        "MONGODB_URI",
        "REDIS_URL"
    )

    $missingVars = @()

    foreach ($var in $requiredVars) {
        if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($var))) {
            $missingVars += $var
        }
    }

    if ($missingVars.Count -gt 0) {
        Write-Status "Missing required environment variables: $($missingVars -join ', ')" "ERROR"
        Write-Status "Please check your .env file or environment configuration" "ERROR"
        exit 1
    }

    Write-Status "Environment variables check passed" "SUCCESS"
}

# Function to check system requirements
function Test-SystemRequirements {
    Write-Status "Checking system requirements..." "INFO"

    # Check if Node.js is installed
    if (-not (Test-Command "node")) {
        Write-Status "Node.js is not installed or not in PATH" "ERROR"
        exit 1
    }

    # Check Node.js version
    $nodeVersion = & node -v
    $versionNumber = [version]($nodeVersion.TrimStart('v'))
    if ($versionNumber.Major -lt 16) {
        Write-Status "Node.js version 16 or higher is required. Current version: $nodeVersion" "ERROR"
        exit 1
    }

    # Check if npm is installed
    if (-not (Test-Command "npm")) {
        Write-Status "npm is not installed or not in PATH" "ERROR"
        exit 1
    }

    # Check available memory
    $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
    $availableMemoryGB = [math]::Round($osInfo.FreePhysicalMemory / 1MB, 2)
    if ($availableMemoryGB -lt 0.5) {
        Write-Status "Available memory is less than 512MB: ${availableMemoryGB}GB" "WARNING"
    }

    # Check available disk space
    $diskInfo = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $availableDiskGB = [math]::Round($diskInfo.FreeSpace / 1GB, 2)
    if ($availableDiskGB -lt 1) {
        Write-Status "Available disk space is less than 1GB: ${availableDiskGB}GB" "WARNING"
    }

    Write-Status "System requirements check passed" "SUCCESS"
}

# Function to setup directories
function Set-Directories {
    Write-Status "Setting up directories..." "INFO"

    $directories = @(
        "logs",
        "uploads",
        "data",
        "certs"
    )

    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Status "Created directory: $dir" "INFO"
        }
    }

    Write-Status "Directory setup completed" "SUCCESS"
}

# Function to check database connectivity
function Test-DatabaseConnectivity {
    Write-Status "Checking database connectivity..." "INFO"

    # Check MongoDB connectivity
    try {
        & mongosh --eval "db.runCommand({ping: 1})" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Status "MongoDB connectivity check passed" "SUCCESS"
        } else {
            Write-Status "MongoDB connectivity check failed - application will retry connection" "WARNING"
        }
    }
    catch {
        Write-Status "MongoDB not available - application will retry connection" "WARNING"
    }

    # Check Redis connectivity
    try {
        $redisResult = & redis-cli ping 2>$null
        if ($redisResult -eq "PONG") {
            Write-Status "Redis connectivity check passed" "SUCCESS"
        } else {
            Write-Status "Redis connectivity check failed - application will retry connection" "WARNING"
        }
    }
    catch {
        Write-Status "Redis not available - application will retry connection" "WARNING"
    }
}

# Function to check external API connectivity
function Test-APIConnectivity {
    Write-Status "Checking external API connectivity..." "INFO"

    # Check OpenAI API (if key is provided)
    $openaiKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY")
    if (-not [string]::IsNullOrEmpty($openaiKey)) {
        try {
            Invoke-WebRequest -Uri "https://api.openai.com/v1/models" -Headers @{
                "Authorization" = "Bearer $openaiKey"
            } -TimeoutSec 10 -ErrorAction Stop | Out-Null
            Write-Status "OpenAI API connectivity check passed" "SUCCESS"
        }
        catch {
            Write-Status "OpenAI API connectivity check failed" "WARNING"
        }
    }

    # Check Hugging Face API (if key is provided)
    $hfKey = [Environment]::GetEnvironmentVariable("HF_API_KEY")
    if (-not [string]::IsNullOrEmpty($hfKey)) {
        try {
            Invoke-WebRequest -Uri "https://api-inference.huggingface.co/models" -Headers @{
                "Authorization" = "Bearer $hfKey"
            } -TimeoutSec 10 -ErrorAction Stop | Out-Null
            Write-Status "Hugging Face API connectivity check passed" "SUCCESS"
        }
        catch {
            Write-Status "Hugging Face API connectivity check failed" "WARNING"
        }
    }
}

# Function to start the application
function Start-Application {
    Write-Status "Starting AI Dashboard application..." "INFO"

    # Set production environment
    $env:NODE_ENV = "production"

    # Check if PM2 is available
    if (Test-Command "pm2") {
        Write-Status "Starting application with PM2..." "INFO"

        # Create PM2 ecosystem file if it doesn't exist
        if (-not (Test-Path "ecosystem.config.js")) {
            Write-Status "ecosystem.config.js not found, creating default configuration..." "WARNING"

            $ecosystemConfig = @"
module.exports = {
  apps: [{
    name: 'ai-dashboard',
    script: 'app.js',
    instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    restart_delay: 4000,
    max_restarts: 5,
    min_uptime: '10s'
  }]
};
"@

            $ecosystemConfig | Out-File -FilePath "ecosystem.config.js" -Encoding UTF8
        }

        & pm2 start ecosystem.config.js
        Write-Status "Application started with PM2" "SUCCESS"

        # Save PM2 configuration
        & pm2 save

    } else {
        Write-Status "Starting application with Node.js directly..." "INFO"

        # Start the application in background
        $process = Start-Process -FilePath "node" -ArgumentList "app.js" -RedirectStandardOutput "logs/app.log" -RedirectStandardError "logs/error.log" -PassThru -NoNewWindow

        Write-Status "Application started with PID: $($process.Id)" "SUCCESS"

        # Wait a moment and check if process is still running
        Start-Sleep -Seconds 3
        if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
            Write-Status "Application failed to start" "ERROR"
            exit 1
        }
    }
}

# Function to setup monitoring
function Set-Monitoring {
    Write-Status "Setting up monitoring..." "INFO"

    # Create a Windows scheduled task for health checks
    $taskName = "AI Dashboard Health Check"
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

    if (-not $existingTask) {
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File `"$PSScriptRoot\healthcheck.ps1`""
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User $env:USERNAME | Out-Null
        Write-Status "Health check scheduled task created" "SUCCESS"
    }
    else {
        Write-Status "Health check scheduled task already exists" "INFO"
    }
}

# Function to display startup information
function Show-StartupInfo {
    Write-Status "AI Dashboard started successfully!" "SUCCESS"
    Write-Host ""
    Write-Host "📊 Application Information:" -ForegroundColor Cyan
    Write-Host "   - Environment: $env:NODE_ENV"
    Write-Host "   - Port: $([Environment]::GetEnvironmentVariable('PORT'))"
    Write-Host "   - Health Check: http://localhost:$([Environment]::GetEnvironmentVariable('PORT'))/health"
    Write-Host "   - Metrics: http://localhost:$([Environment]::GetEnvironmentVariable('PORT'))/metrics"
    Write-Host ""
    Write-Host "📝 Log Files:" -ForegroundColor Cyan
    Write-Host "   - Application logs: ./logs/app.log"
    Write-Host "   - Error logs: ./logs/error.log"
    Write-Host ""
    Write-Host "🔧 Useful Commands:" -ForegroundColor Cyan
    Write-Host "   - View logs: Get-Content logs/app.log -Tail 20 -Wait"
    Write-Host "   - Restart app: pm2 restart ai-dashboard (if using PM2)"
    Write-Host "   - Stop app: pm2 stop ai-dashboard (if using PM2)"
    Write-Host "   - Check status: pm2 status (if using PM2)"
    Write-Host ""
    Write-Host "⚠️  Important Notes:" -ForegroundColor Yellow
    Write-Host "   - Ensure all API keys are properly configured"
    Write-Host "   - Monitor disk space and log file sizes"
    Write-Host "   - Set up proper firewall rules"
    Write-Host "   - Configure SSL/TLS for production HTTPS"
    Write-Host ""
}

# Main execution
function Main {
    Write-Status "Starting AI Dashboard production deployment..." "INFO"

    # Change to script directory
    Set-Location $PSScriptRoot

    # Check if .env file exists
    if (-not (Test-Path ".env")) {
        Write-Status ".env file not found!" "ERROR"
        Write-Status "Please copy .env.example to .env and configure your environment variables" "ERROR"
        exit 1
    }

    # Load environment variables from .env file
    if (Test-Path ".env") {
        Get-Content ".env" | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
                $key = $Matches[1]
                $value = $Matches[2]
                [Environment]::SetEnvironmentVariable($key, $value)
            }
        }
    }

    # Run pre-startup checks
    Test-SystemRequirements
    Test-EnvironmentVariables
    Set-Directories

    if (-not $SkipHealthCheck) {
        Test-DatabaseConnectivity
        Test-APIConnectivity
    }

    # Start the application
    Start-Application

    # Setup monitoring
    Set-Monitoring

    # Display startup information
    Show-StartupInfo

    Write-Status "Production deployment completed successfully!" "SUCCESS"
}

# Handle script interruption
try {
    Main
}
catch {
    Write-Status "Script failed: $($_.Exception.Message)" "ERROR"
    exit 1
}
