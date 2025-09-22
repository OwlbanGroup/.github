#!/bin/bash

# NVIDIA Enhanced Production Deployment Script
# Features: GPU monitoring, AI inference optimization, real-time metrics, and health checks

set -e  # Exit on any error

# Configuration
APP_NAME="nvidia-enhanced-control-panel"
LOG_DIR="logs/nvidia"
BACKUP_DIR="backups/nvidia"
HEALTH_CHECK_URL="http://localhost:3000/api/nvidia/health"
NVIDIA_HEALTH_URL="http://localhost:3000/api/nvidia/status"
MAX_STARTUP_TIME=90
REQUIRED_NODE_VERSION=18

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_nvidia() {
    echo -e "${PURPLE}[NVIDIA]${NC} $1"
}

# Function to check NVIDIA GPU availability
check_nvidia_gpu() {
    log_nvidia "Checking NVIDIA GPU availability..."

    if ! command -v nvidia-smi &> /dev/null; then
        log_warning "nvidia-smi not found. Installing NVIDIA drivers may be required."
        return 1
    fi

    # Check if GPU is available
    if nvidia-smi --query-gpu=name --format=csv,noheader,nounits | grep -q "GPU"; then
        local gpu_name=$(nvidia-smi --query-gpu=name --format=csv,noheader,nounits | head -1)
        local gpu_memory=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
        log_success "NVIDIA GPU detected: $gpu_name (${gpu_memory}MB)"
        return 0
    else
        log_warning "No NVIDIA GPU detected"
        return 1
    fi
}

# Function to check CUDA installation
check_cuda() {
    log_nvidia "Checking CUDA installation..."

    if [ -f "/usr/local/cuda/version.txt" ]; then
        local cuda_version=$(cat /usr/local/cuda/version.txt | grep -o "CUDA Version [0-9]\+\.[0-9]\+" | cut -d' ' -f3)
        log_success "CUDA detected: $cuda_version"
        return 0
    else
        log_warning "CUDA not detected. Some features may not work optimally."
        return 1
    fi
}

# Function to check port availability
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to wait for NVIDIA services to be ready
wait_for_nvidia_services() {
    local max_attempts=$1
    local attempt=1

    log_nvidia "Waiting for NVIDIA services to be ready..."

    while [ $attempt -le $max_attempts ]; do
        # Check main health endpoint
        if curl -s --max-time 5 $HEALTH_CHECK_URL > /dev/null 2>&1; then
            # Check NVIDIA-specific endpoint
            if curl -s --max-time 5 $NVIDIA_HEALTH_URL > /dev/null 2>&1; then
                log_success "NVIDIA services are ready!"
                return 0
            fi
        fi

        log_nvidia "Attempt $attempt/$max_attempts - NVIDIA services not ready yet..."
        sleep 3
        ((attempt++))
    done

    log_error "NVIDIA services failed to start within $max_attempts attempts"
    return 1
}

# Function to create NVIDIA-specific backup
create_nvidia_backup() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/nvidia_backup_$timestamp.tar.gz"

    log_nvidia "Creating NVIDIA-specific backup: $backup_file"

    mkdir -p $BACKUP_DIR

    # Backup NVIDIA-specific files and configurations
    tar -czf $backup_file \
        --exclude='node_modules' \
        --exclude='logs' \
        --exclude='backups' \
        --exclude='.git' \
        dashboard/nvidia-enhanced.html \
        dashboard/nvidia-enhanced.js \
        dashboard/nvidia.js \
        *.json 2>/dev/null || true

    log_success "NVIDIA backup created: $backup_file"
}

# Function to validate NVIDIA environment
validate_nvidia_environment() {
    log_nvidia "Validating NVIDIA environment..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    local node_version=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
    if [ "$node_version" -lt $REQUIRED_NODE_VERSION ]; then
        log_error "Node.js version $REQUIRED_NODE_VERSION+ required. Current: $(node -v)"
        exit 1
    fi

    # Check PM2
    if ! command -v pm2 &> /dev/null; then
        log_info "Installing PM2..."
        npm install -g pm2
    fi

    # Check NVIDIA GPU
    check_nvidia_gpu

    # Check CUDA
    check_cuda

    # Check if port is available
    if check_port ${PORT:-3000}; then
        log_warning "Port ${PORT:-3000} is already in use. Attempting to free it..."
        local pid=$(lsof -ti:${PORT:-3000})
        if [ ! -z "$pid" ]; then
            log_warning "Killing process $pid using port ${PORT:-3000}"
            kill -9 $pid 2>/dev/null || true
            sleep 2
        fi
    fi

    log_success "NVIDIA environment validation passed"
}

# Function to setup NVIDIA monitoring
setup_nvidia_monitoring() {
    log_nvidia "Setting up NVIDIA monitoring..."

    # Create PM2 ecosystem file for NVIDIA if it doesn't exist
    if [ ! -f "ecosystem.nvidia.config.js" ]; then
        cat > ecosystem.nvidia.config.js << EOF
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
EOF
        log_success "Created NVIDIA PM2 ecosystem file"
    fi

    # Create NVIDIA-specific log directory
    mkdir -p $LOG_DIR
}

# Function to start NVIDIA application
start_nvidia_application() {
    log_nvidia "Starting NVIDIA Enhanced Control Panel..."

    # Create backup before starting
    create_nvidia_backup

    # Stop any existing NVIDIA instance
    pm2 delete $APP_NAME 2>/dev/null || true

    # Start with NVIDIA ecosystem file
    pm2 start ecosystem.nvidia.config.js --env production

    # Wait for NVIDIA services to be ready
    if wait_for_nvidia_services 30; then
        log_success "NVIDIA application started successfully"

        # Setup PM2 startup (optional)
        if [ "$SETUP_PM2_STARTUP" = "true" ]; then
            log_info "Setting up PM2 auto-startup..."
            pm2 startup | grep "sudo" | bash
            pm2 save
        fi

        return 0
    else
        log_error "NVIDIA application failed to start"
        show_nvidia_logs
        return 1
    fi
}

# Function to show NVIDIA application status
show_nvidia_status() {
    echo
    log_nvidia "NVIDIA Application Status:"
    pm2 status $APP_NAME 2>/dev/null || log_warning "PM2 status not available"

    echo
    log_nvidia "NVIDIA GPU Status:"
    if command -v nvidia-smi &> /dev/null; then
        nvidia-smi --query-gpu=utilization.gpu,utilization.memory,temperature.gpu,memory.used,memory.total --format=csv,noheader,nounits | head -5
    else
        log_warning "nvidia-smi not available"
    fi
}

# Function to show NVIDIA logs
show_nvidia_logs() {
    echo
    log_nvidia "Recent NVIDIA Application Logs:"
    pm2 logs $APP_NAME --lines 30 --nostream 2>/dev/null || log_warning "Logs not available"
}

# Function to cleanup old NVIDIA backups
cleanup_nvidia_backups() {
    log_nvidia "Cleaning up old NVIDIA backups..."

    # Keep only last 5 NVIDIA backups
    local backup_count=$(ls -1 $BACKUP_DIR/nvidia_backup_*.tar.gz 2>/dev/null | wc -l)
    if [ "$backup_count" -gt 5 ]; then
        ls -1t $BACKUP_DIR/nvidia_backup_*.tar.gz | tail -n +6 | xargs rm -f
        log_success "Cleaned up old NVIDIA backups"
    fi
}

# Function to optimize NVIDIA performance
optimize_nvidia_performance() {
    log_nvidia "Optimizing NVIDIA performance..."

    # Set NVIDIA GPU performance mode
    if command -v nvidia-smi &> /dev/null; then
        log_info "Setting GPU to maximum performance mode..."
        nvidia-smi -pm 1 2>/dev/null || true

        # Set GPU clock speeds to maximum
        log_info "Setting GPU clocks to maximum..."
        nvidia-smi -ac 5001,1590 2>/dev/null || true

        log_success "NVIDIA performance optimized"
    else
        log_warning "Cannot optimize NVIDIA performance - nvidia-smi not available"
    fi
}

# Main execution
main() {
    echo "🚀 NVIDIA Enhanced Production Deployment"
    echo "========================================"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup)
                create_nvidia_backup
                exit 0
                ;;
            --cleanup)
                cleanup_nvidia_backups
                exit 0
                ;;
            --optimize)
                optimize_nvidia_performance
                exit 0
                ;;
            --setup-startup)
                SETUP_PM2_STARTUP=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --backup        Create NVIDIA backup only"
                echo "  --cleanup       Cleanup old NVIDIA backups only"
                echo "  --optimize      Optimize NVIDIA GPU performance only"
                echo "  --setup-startup Setup PM2 auto-startup on boot"
                echo "  --help          Show this help"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Validate NVIDIA environment
    validate_nvidia_environment

    # Setup NVIDIA monitoring
    setup_nvidia_monitoring

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm ci --only=production
    fi

    # Set environment variables
    export NODE_ENV=production
    export PORT=${PORT:-3000}
    export NVIDIA_ENABLED=true

    # Start NVIDIA application
    if start_nvidia_application; then
        # Show status
        show_nvidia_status

        # Cleanup old backups
        cleanup_nvidia_backups

        echo
        log_success "🎉 NVIDIA Enhanced Control Panel is now running!"
        echo
        echo "🌐 Application URLs:"
        echo "   - Main Dashboard: http://localhost:$PORT"
        echo "   - NVIDIA Panel: http://localhost:$PORT/nvidia-enhanced"
        echo "   - Health Check: $HEALTH_CHECK_URL"
        echo "   - NVIDIA Status: $NVIDIA_HEALTH_URL"
        echo
        echo "📊 Monitoring:"
        echo "   - PM2: pm2 logs $APP_NAME"
        echo "   - GPU: nvidia-smi -l 1"
        echo "   - Metrics: http://localhost:$PORT/metrics"
        echo
        echo "🛠️  Useful commands:"
        echo "   pm2 logs $APP_NAME --lines 50    # Show recent logs"
        echo "   pm2 restart $APP_NAME            # Restart application"
        echo "   pm2 stop $APP_NAME               # Stop application"
        echo "   pm2 delete $APP_NAME             # Remove application"
        echo "   nvidia-smi -l 1                  # Monitor GPU in real-time"
        echo
        echo "🔧 Environment variables:"
        echo "   NVIDIA_API_KEY, CUDA_HOME, LD_LIBRARY_PATH"
        echo "   OPENAI_API_KEY, HF_API_KEY (for AI features)"
    else
        log_error "Failed to start NVIDIA Enhanced Control Panel"
        exit 1
    fi
}

# Run main function
main "$@"
