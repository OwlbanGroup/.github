#!/bin/bash

# NVIDIA Health Check Script
# Monitors NVIDIA GPU status, application health, and system resources

set -e

# Configuration
HEALTH_CHECK_URL="http://localhost:3000/api/nvidia/health"
NVIDIA_STATUS_URL="http://localhost:3000/api/nvidia/status"
APP_NAME="nvidia-enhanced-control-panel"
LOG_FILE="logs/nvidia/health-check.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Logging functions
log_info() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $1" | tee -a $LOG_FILE
}

log_success() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [SUCCESS] $1" | tee -a $LOG_FILE
}

log_warning() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [WARNING] $1" | tee -a $LOG_FILE
}

log_error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] $1" | tee -a $LOG_FILE
}

log_nvidia() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [NVIDIA] $1" | tee -a $LOG_FILE
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check application health
check_application_health() {
    log_info "Checking application health..."

    if curl -s --max-time 10 $HEALTH_CHECK_URL > /dev/null 2>&1; then
        local response=$(curl -s --max-time 10 $HEALTH_CHECK_URL)
        if echo "$response" | grep -q '"status":"healthy"'; then
            log_success "Application health check passed"
            return 0
        else
            log_warning "Application health check returned unexpected response: $response"
            return 1
        fi
    else
        log_error "Application health check failed - cannot reach $HEALTH_CHECK_URL"
        return 1
    fi
}

# Function to check NVIDIA-specific endpoints
check_nvidia_endpoints() {
    log_nvidia "Checking NVIDIA-specific endpoints..."

    if curl -s --max-time 10 $NVIDIA_STATUS_URL > /dev/null 2>&1; then
        local response=$(curl -s --max-time 10 $NVIDIA_STATUS_URL)
        if echo "$response" | grep -q '"gpu_detected"'; then
            log_success "NVIDIA status endpoint is responding"
            return 0
        else
            log_warning "NVIDIA status endpoint returned unexpected response"
            return 1
        fi
    else
        log_error "NVIDIA status endpoint is not responding"
        return 1
    fi
}

# Function to check PM2 process
check_pm2_process() {
    log_info "Checking PM2 process status..."

    if command_exists pm2; then
        if pm2 describe $APP_NAME > /dev/null 2>&1; then
            local status=$(pm2 jlist | grep -o '"pm2_env":{"status":"[^"]*"' | cut -d'"' -f4)
            if [ "$status" = "online" ]; then
                log_success "PM2 process is online"
                return 0
            else
                log_warning "PM2 process status: $status"
                return 1
            fi
        else
            log_error "PM2 process $APP_NAME not found"
            return 1
        fi
    else
        log_warning "PM2 not installed"
        return 1
    fi
}

# Function to check NVIDIA GPU status
check_nvidia_gpu() {
    log_nvidia "Checking NVIDIA GPU status..."

    if command_exists nvidia-smi; then
        # Check if GPU is accessible
        if nvidia-smi --query-gpu=name --format=csv,noheader,nounits > /dev/null 2>&1; then
            # Get GPU utilization
            local gpu_util=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits | head -1 | tr -d ' %')
            local gpu_temp=$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits | head -1)
            local gpu_memory=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1 | tr -d ' MiB')

            log_success "GPU Status - Utilization: ${gpu_util}%, Temperature: ${gpu_temp}°C, Memory: ${gpu_memory}MiB"

            # Check for high temperature
            if [ "$gpu_temp" -gt 85 ]; then
                log_warning "High GPU temperature detected: ${gpu_temp}°C"
                return 1
            fi

            # Check for high memory usage
            if [ "$gpu_memory" -gt 7000 ]; then
                log_warning "High GPU memory usage: ${gpu_memory}MiB"
            fi

            return 0
        else
            log_error "Cannot access NVIDIA GPU"
            return 1
        fi
    else
        log_warning "nvidia-smi not available"
        return 1
    fi
}

# Function to check system resources
check_system_resources() {
    log_info "Checking system resources..."

    # Check disk space
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
    if [ "$disk_usage" -gt 90 ]; then
        log_warning "High disk usage: ${disk_usage}%"
        return 1
    else
        log_success "Disk usage: ${disk_usage}%"
    fi

    # Check memory usage
    local mem_usage=$(free | grep Mem: | awk '{printf "%.0f", $3/$2 * 100.0}')
    if [ "$mem_usage" -gt 90 ]; then
        log_warning "High memory usage: ${mem_usage}%"
        return 1
    else
        log_success "Memory usage: ${mem_usage}%"
    fi

    return 0
}

# Function to check network connectivity
check_network_connectivity() {
    log_info "Checking network connectivity..."

    # Test internet connectivity
    if ping -c 1 -W 5 8.8.8.8 > /dev/null 2>&1; then
        log_success "Internet connectivity OK"
        return 0
    else
        log_warning "No internet connectivity"
        return 1
    fi
}

# Function to perform comprehensive health check
comprehensive_health_check() {
    local errors=0

    echo "🔍 NVIDIA Health Check Report"
    echo "================================"

    # Application health
    if ! check_application_health; then
        ((errors++))
    fi

    # NVIDIA endpoints
    if ! check_nvidia_endpoints; then
        ((errors++))
    fi

    # PM2 process
    if ! check_pm2_process; then
        ((errors++))
    fi

    # NVIDIA GPU
    if ! check_nvidia_gpu; then
        ((errors++))
    fi

    # System resources
    if ! check_system_resources; then
        ((errors++))
    fi

    # Network connectivity
    if ! check_network_connectivity; then
        ((errors++))
    fi

    echo
    if [ $errors -eq 0 ]; then
        log_success "All health checks passed! ✅"
        return 0
    else
        log_error "$errors health check(s) failed! ❌"
        return 1
    fi
}

# Function to generate health report
generate_health_report() {
    local report_file="logs/nvidia/health-report-$(date +%Y%m%d-%H%M%S).json"

    log_info "Generating health report: $report_file"

    cat > "$report_file" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "application": {
        "name": "$APP_NAME",
        "health_check_url": "$HEALTH_CHECK_URL",
        "nvidia_status_url": "$NVIDIA_STATUS_URL"
    },
    "system": {
        "hostname": "$(hostname)",
        "uptime": "$(uptime -p)",
        "load_average": "$(uptime | awk -F'load average:' '{print $2}')"
    },
    "nvidia": {
        "gpu_available": $(command_exists nvidia-smi && echo "true" || echo "false"),
        "cuda_available": $([ -f "/usr/local/cuda/version.txt" ] && echo "true" || echo "false")
    },
    "checks": {
        "application_health": $(check_application_health >/dev/null 2>&1 && echo "true" || echo "false"),
        "nvidia_endpoints": $(check_nvidia_endpoints >/dev/null 2>&1 && echo "true" || echo "false"),
        "pm2_process": $(check_pm2_process >/dev/null 2>&1 && echo "true" || echo "false"),
        "gpu_status": $(check_nvidia_gpu >/dev/null 2>&1 && echo "true" || echo "false"),
        "system_resources": $(check_system_resources >/dev/null 2>&1 && echo "true" || echo "false"),
        "network_connectivity": $(check_network_connectivity >/dev/null 2>&1 && echo "true" || echo "false")
    }
}
EOF

    log_success "Health report generated: $report_file"
}

# Function to auto-recover from common issues
auto_recover() {
    log_info "Attempting auto-recovery..."

    local recovered=0

    # Check if PM2 process is down
    if ! pm2 describe $APP_NAME > /dev/null 2>&1; then
        log_warning "PM2 process is down, attempting to restart..."
        if pm2 start ecosystem.nvidia.config.js --env production; then
            log_success "PM2 process restarted"
            ((recovered++))
        else
            log_error "Failed to restart PM2 process"
        fi
    fi

    # Check if GPU is in error state
    if command_exists nvidia-smi; then
        if nvidia-smi --query-gpu=count --format=csv,noheader,nounits | grep -q "No devices"; then
            log_warning "No NVIDIA devices found, attempting GPU reset..."
            nvidia-smi --gpu-reset 2>/dev/null || true
            ((recovered++))
        fi
    fi

    if [ $recovered -gt 0 ]; then
        log_success "Auto-recovery completed ($recovered fixes applied)"
        return 0
    else
        log_info "No issues found requiring auto-recovery"
        return 1
    fi
}

# Main execution
main() {
    # Create log directory
    mkdir -p "$(dirname $LOG_FILE)"

    echo "🚀 NVIDIA Health Check"
    echo "======================"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --report)
                generate_health_report
                exit 0
                ;;
            --recover)
                auto_recover
                exit $?
                ;;
            --continuous)
                CONTINUOUS=true
                INTERVAL=${2:-300}  # Default 5 minutes
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --report      Generate detailed health report"
                echo "  --recover     Attempt auto-recovery from issues"
                echo "  --continuous  Run continuous monitoring (requires interval in seconds)"
                echo "  --help        Show this help"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
        shift
    done

    if [ "$CONTINUOUS" = true ]; then
        log_info "Starting continuous monitoring (interval: ${INTERVAL}s)..."
        log_info "Press Ctrl+C to stop"

        while true; do
            comprehensive_health_check
            sleep $INTERVAL
        done
    else
        # Single health check
        if comprehensive_health_check; then
            exit 0
        else
            exit 1
        fi
    fi
}

# Run main function
main "$@"
