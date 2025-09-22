#!/usr/bin/env pwsh

# NVIDIA Health Check Script (Windows PowerShell)
# Monitors NVIDIA GPU status, application health, and system resources

param(
    [switch]$Report,
    [switch]$Recover,
    [switch]$Continuous,
    [int]$Interval = 300,  # Default 5 minutes
    [switch]$Help
)

# Configuration
$HEALTH_CHECK_URL = "http://localhost:3000/api/nvidia/health"
$NVIDIA_STATUS_URL = "http://localhost:3000/api/nvidia/status"
$APP_NAME = "nvidia-enhanced-control-panel"
$LOG_FILE = "logs\nvidia\health-check.log"

# Colors
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
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [INFO] $Message"
    Write-Host $logMessage -ForegroundColor $BLUE
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

function Write-LogSuccess {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [SUCCESS] $Message"
    Write-Host $logMessage -ForegroundColor $GREEN
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

function Write-LogWarning {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [WARNING] $Message"
    Write-Host $logMessage -ForegroundColor $YELLOW
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

function Write-LogError {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [ERROR] $Message"
    Write-Host $logMessage -ForegroundColor $RED
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

function Write-LogNvidia {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [NVIDIA] $Message"
    Write-Host $logMessage -ForegroundColor $PURPLE
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

# Function to check if command exists
function Test-CommandExists {
    param($Command)
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'stop'
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $oldPreference
    }
}

# Function to check application health
function Test-ApplicationHealth {
    Write-LogInfo "Checking application health..."

    try {
        $response = Invoke-WebRequest -Uri $HEALTH_CHECK_URL -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $content = $response.Content | ConvertFrom-Json
            if ($content.status -eq "healthy") {
                Write-LogSuccess "Application health check passed"
                return $true
            } else {
                Write-LogWarning "Application health check returned unexpected status: $($content.status)"
                return $false
            }
        } else {
            Write-LogError "Application health check failed with status code: $($response.StatusCode)"
            return $false
        }
    } catch {
        Write-LogError "Application health check failed - cannot reach $HEALTH_CHECK_URL : $_"
        return $false
    }
}

# Function to check NVIDIA-specific endpoints
function Test-NvidiaEndpoints {
    Write-LogNvidia "Checking NVIDIA-specific endpoints..."

    try {
        $response = Invoke-WebRequest -Uri $NVIDIA_STATUS_URL -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $content = $response.Content | ConvertFrom-Json
            if ($content.gpu_detected -ne $null) {
                Write-LogSuccess "NVIDIA status endpoint is responding"
                return $true
            } else {
                Write-LogWarning "NVIDIA status endpoint returned unexpected response"
                return $false
            }
        } else {
            Write-LogError "NVIDIA status endpoint returned status code: $($response.StatusCode)"
            return $false
        }
    } catch {
        Write-LogError "NVIDIA status endpoint is not responding: $_"
        return $false
    }
}

# Function to check PM2 process
function Test-PM2Process {
    Write-LogInfo "Checking PM2 process status..."

    if (Test-CommandExists -Command "pm2") {
        try {
            $pm2List = pm2 jlist 2>$null | ConvertFrom-Json
            $process = $pm2List | Where-Object { $_.name -eq $APP_NAME }

            if ($process -and $process.pm2_env.status -eq "online") {
                Write-LogSuccess "PM2 process is online"
                return $true
            } else {
                Write-LogWarning "PM2 process status: $($process.pm2_env.status)"
                return $false
            }
        } catch {
            Write-LogError "PM2 process $APP_NAME not found"
            return $false
        }
    } else {
        Write-LogWarning "PM2 not installed"
        return $false
    }
}

# Function to check NVIDIA GPU status
function Test-NvidiaGPU {
    Write-LogNvidia "Checking NVIDIA GPU status..."

    if (Test-CommandExists -Command "nvidia-smi") {
        try {
            $gpuInfo = & nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>$null
            if ($gpuInfo -and $gpuInfo.Count -gt 0) {
                # Get GPU metrics
                $gpuUtil = & nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>$null | Select-Object -First 1 | ForEach-Object { $_.Trim(' %') }
                $gpuTemp = & nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits 2>$null | Select-Object -First 1
                $gpuMemory = & nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>$null | Select-Object -First 1 | ForEach-Object { $_.Trim(' MiB') }

                Write-LogSuccess "GPU Status - Utilization: ${gpuUtil}%, Temperature: ${gpuTemp}°C, Memory: ${gpuMemory}MiB"

                # Check for high temperature
                if ([int]$gpuTemp -gt 85) {
                    Write-LogWarning "High GPU temperature detected: ${gpuTemp}°C"
                    return $false
                }

                # Check for high memory usage
                if ([int]$gpuMemory -gt 7000) {
                    Write-LogWarning "High GPU memory usage: ${gpuMemory}MiB"
                }

                return $true
            } else {
                Write-LogError "Cannot access NVIDIA GPU"
                return $false
            }
        } catch {
            Write-LogError "Error checking NVIDIA GPU: $_"
            return $false
        }
    } else {
        Write-LogWarning "nvidia-smi not available"
        return $false
    }
}

# Function to check system resources
function Test-SystemResources {
    Write-LogInfo "Checking system resources..."

    # Check disk space
    $disk = Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceID -eq "C:" }
    $diskUsage = [math]::Round((($disk.Size - $disk.FreeSpace) / $disk.Size) * 100, 2)

    if ($diskUsage -gt 90) {
        Write-LogWarning "High disk usage: ${diskUsage}%"
        return $false
    } else {
        Write-LogSuccess "Disk usage: ${diskUsage}%"
    }

    # Check memory usage
    $memory = Get-WmiObject -Class Win32_OperatingSystem
    $memUsage = [math]::Round((($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / $memory.TotalVisibleMemorySize) * 100, 2)

    if ($memUsage -gt 90) {
        Write-LogWarning "High memory usage: ${memUsage}%"
        return $false
    } else {
        Write-LogSuccess "Memory usage: ${memUsage}%"
    }

    return $true
}

# Function to check network connectivity
function Test-NetworkConnectivity {
    Write-LogInfo "Checking network connectivity..."

    try {
        $response = Invoke-WebRequest -Uri "http://www.google.com" -TimeoutSec 5 -ErrorAction Stop
        Write-LogSuccess "Internet connectivity OK"
        return $true
    } catch {
        Write-LogWarning "No internet connectivity: $_"
        return $false
    }
}

# Function to perform comprehensive health check
function Invoke-ComprehensiveHealthCheck {
    $errors = 0

    Write-Host "🔍 NVIDIA Health Check Report" -ForegroundColor $GREEN
    Write-Host "================================" -ForegroundColor $GREEN

    # Application health
    if (-not (Test-ApplicationHealth)) {
        $errors++
    }

    # NVIDIA endpoints
    if (-not (Test-NvidiaEndpoints)) {
        $errors++
    }

    # PM2 process
    if (-not (Test-PM2Process)) {
        $errors++
    }

    # NVIDIA GPU
    if (-not (Test-NvidiaGPU)) {
        $errors++
    }

    # System resources
    if (-not (Test-SystemResources)) {
        $errors++
    }

    # Network connectivity
    if (-not (Test-NetworkConnectivity)) {
        $errors++
    }

    Write-Host ""
    if ($errors -eq 0) {
        Write-LogSuccess "All health checks passed! ✅"
        return $true
    } else {
        Write-LogError "$errors health check(s) failed! ❌"
        return $false
    }
}

# Function to generate health report
function New-HealthReport {
    $reportFile = "logs\nvidia\health-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

    Write-LogInfo "Generating health report: $reportFile"

    # Create log directory if it doesn't exist
    $logDir = Split-Path $reportFile -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir | Out-Null
    }

    $report = @{
        timestamp = Get-Date -Format "o"
        application = @{
            name = $APP_NAME
            health_check_url = $HEALTH_CHECK_URL
            nvidia_status_url = $NVIDIA_STATUS_URL
        }
        system = @{
            hostname = $env:COMPUTERNAME
            uptime = (Get-Date) - (Get-CimInstance -ClassName Win32_OperatingSystem).LastBootUpTime
            load_average = "N/A (Windows)"
        }
        nvidia = @{
            gpu_available = (Test-CommandExists -Command "nvidia-smi")
            cuda_available = (Test-Path "C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\version.txt")
        }
        checks = @{
            application_health = (Test-ApplicationHealth)
            nvidia_endpoints = (Test-NvidiaEndpoints)
            pm2_process = (Test-PM2Process)
            gpu_status = (Test-NvidiaGPU)
            system_resources = (Test-SystemResources)
            network_connectivity = (Test-NetworkConnectivity)
        }
    }

    $report | ConvertTo-Json -Depth 3 | Out-File -FilePath $reportFile -Encoding UTF8
    Write-LogSuccess "Health report generated: $reportFile"
}

# Function to auto-recover from common issues
function Invoke-AutoRecovery {
    Write-LogInfo "Attempting auto-recovery..."

    $recovered = 0

    # Check if PM2 process is down
    if (Test-CommandExists -Command "pm2") {
        try {
            $pm2List = pm2 jlist 2>$null | ConvertFrom-Json
            $process = $pm2List | Where-Object { $_.name -eq $APP_NAME }

            if (-not $process -or $process.pm2_env.status -ne "online") {
                Write-LogWarning "PM2 process is down, attempting to restart..."
                pm2 start ecosystem.nvidia.config.js --env production
                if ($LASTEXITCODE -eq 0) {
                    Write-LogSuccess "PM2 process restarted"
                    $recovered++
                } else {
                    Write-LogError "Failed to restart PM2 process"
                }
            }
        } catch {
            Write-LogWarning "Error checking PM2 process: $_"
        }
    }

    # Check if GPU is in error state
    if (Test-CommandExists -Command "nvidia-smi") {
        try {
            $gpuInfo = & nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>$null
            if (-not $gpuInfo -or $gpuInfo.Count -eq 0) {
                Write-LogWarning "No NVIDIA devices found, attempting GPU reset..."
                & nvidia-smi --gpu-reset 2>$null
                $recovered++
            }
        } catch {
            Write-LogWarning "Error checking GPU status: $_"
        }
    }

    if ($recovered -gt 0) {
        Write-LogSuccess "Auto-recovery completed (`$recovered fixes applied)"
        return $true
    } else {
        Write-LogInfo "No issues found requiring auto-recovery"
        return $false
    }
}

# Main execution
function Main {
    # Create log directory
    $logDir = Split-Path $LOG_FILE -Parent
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir | Out-Null
    }

    Write-Host "🚀 NVIDIA Health Check" -ForegroundColor $GREEN
    Write-Host "======================" -ForegroundColor $GREEN

    # Parse command line arguments
    if ($Help) {
        Write-Host "Usage: .\nvidia-health-check.ps1 [options]" -ForegroundColor $WHITE
        Write-Host "" -ForegroundColor $WHITE
        Write-Host "Options:" -ForegroundColor $CYAN
        Write-Host "  -Report       Generate detailed health report" -ForegroundColor $WHITE
        Write-Host "  -Recover      Attempt auto-recovery from issues" -ForegroundColor $WHITE
        Write-Host "  -Continuous   Run continuous monitoring (requires interval in seconds)" -ForegroundColor $WHITE
        Write-Host "  -Interval     Interval for continuous monitoring (default: 300 seconds)" -ForegroundColor $WHITE
        Write-Host "  -Help         Show this help" -ForegroundColor $WHITE
        exit 0
    }

    if ($Report) {
        New-HealthReport
        exit 0
    }

    if ($Recover) {
        Invoke-AutoRecovery
        exit $?
    }

    if ($Continuous) {
        Write-LogInfo "Starting continuous monitoring (interval: ${Interval}s)..."
        Write-LogInfo "Press Ctrl+C to stop"

        try {
            while ($true) {
                Invoke-ComprehensiveHealthCheck
                Start-Sleep -Seconds $Interval
            }
        } catch {
            Write-LogInfo "Continuous monitoring stopped"
        }
    } else {
        # Single health check
        if (Invoke-ComprehensiveHealthCheck) {
            exit 0
        } else {
            exit 1
        }
    }
}

# Run main function
Main
