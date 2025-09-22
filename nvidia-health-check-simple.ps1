#!/usr/bin/env pwsh

# Simple NVIDIA Health Check Script (Windows PowerShell)
# Monitors NVIDIA GPU status and application health

param(
    [switch]$Help
)

# Configuration
$HEALTH_CHECK_URL = "http://localhost:3000/api/nvidia/health"
$NVIDIA_STATUS_URL = "http://localhost:3000/api/nvidia/status"
$LOG_FILE = "logs\nvidia\health-check.log"

# Colors
$GREEN = "Green"
$RED = "Red"
$YELLOW = "Yellow"
$BLUE = "Blue"

# Logging function
function Write-Log {
    param($Message, $Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage -ForegroundColor $Color
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

# Function to check if command exists
function Test-CommandExists {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to check application health
function Test-ApplicationHealth {
    try {
        $response = Invoke-WebRequest -Uri $HEALTH_CHECK_URL -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Log "Application health check passed" $GREEN
            return $true
        } else {
            Write-Log "Application health check failed with status: $($response.StatusCode)" $RED
            return $false
        }
    } catch {
        Write-Log "Application health check failed: $($_.Exception.Message)" $RED
        return $false
    }
}

# Function to check NVIDIA endpoints
function Test-NvidiaEndpoints {
    try {
        $response = Invoke-WebRequest -Uri $NVIDIA_STATUS_URL -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Log "NVIDIA endpoints responding" $GREEN
            return $true
        } else {
            Write-Log "NVIDIA endpoints returned status: $($response.StatusCode)" $RED
            return $false
        }
    } catch {
        Write-Log "NVIDIA endpoints not responding: $($_.Exception.Message)" $RED
        return $false
    }
}

# Function to check NVIDIA GPU
function Test-NvidiaGPU {
    if (Test-CommandExists -Command "nvidia-smi") {
        try {
            $gpuInfo = & nvidia-smi --query-gpu=name --format=csv,noheader,nounits 2>$null
            if ($gpuInfo -and $gpuInfo.Count -gt 0) {
                $gpuName = $gpuInfo[0]
                Write-Log "NVIDIA GPU detected: $gpuName" $GREEN
                return $true
            } else {
                Write-Log "No NVIDIA GPU detected" $YELLOW
                return $false
            }
        } catch {
            Write-Log "Error checking NVIDIA GPU: $($_.Exception.Message)" $RED
            return $false
        }
    } else {
        Write-Log "nvidia-smi not available" $YELLOW
        return $false
    }
}

# Function to check PM2 process
function Test-PM2Process {
    if (Test-CommandExists -Command "pm2") {
        try {
            $pm2List = pm2 jlist 2>$null | ConvertFrom-Json
            $process = $pm2List | Where-Object { $_.name -eq "nvidia-enhanced-control-panel" }

            if ($process -and $process.pm2_env.status -eq "online") {
                Write-Log "PM2 process is online" $GREEN
                return $true
            } else {
                Write-Log "PM2 process not online" $YELLOW
                return $false
            }
        } catch {
            Write-Log "PM2 process check failed" $YELLOW
            return $false
        }
    } else {
        Write-Log "PM2 not installed" $YELLOW
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

    Write-Host "NVIDIA Health Check" -ForegroundColor $GREEN
    Write-Host "==================" -ForegroundColor $GREEN
    Write-Host ""

    $errors = 0

    # Application health
    if (-not (Test-ApplicationHealth)) { $errors++ }

    # NVIDIA endpoints
    if (-not (Test-NvidiaEndpoints)) { $errors++ }

    # PM2 process
    if (-not (Test-PM2Process)) { $errors++ }

    # NVIDIA GPU
    if (-not (Test-NvidiaGPU)) { $errors++ }

    Write-Host ""
    if ($errors -eq 0) {
        Write-Log "All health checks passed!" $GREEN
        exit 0
    } else {
        Write-Log "$errors health check(s) failed" $RED
        exit 1
    }
}

# Show help
if ($Help) {
    Write-Host "NVIDIA Health Check Script" -ForegroundColor $GREEN
    Write-Host ""
    Write-Host "Usage: .\nvidia-health-check-simple.ps1" -ForegroundColor $BLUE
    Write-Host ""
    Write-Host "This script performs basic health checks for NVIDIA services:"
    Write-Host "  - Application health endpoint" -ForegroundColor $BLUE
    Write-Host "  - NVIDIA-specific endpoints" -ForegroundColor $BLUE
    Write-Host "  - PM2 process status" -ForegroundColor $BLUE
    Write-Host "  - NVIDIA GPU availability" -ForegroundColor $BLUE
    exit 0
}

# Run main function
Main
