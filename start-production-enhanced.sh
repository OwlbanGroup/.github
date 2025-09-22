#!/bin/bash

# Enhanced Production Startup Script for Owlban Group AI Dashboard
# Features: Health checks, environment validation, backup, monitoring, and recovery

set -e  # Exit on any error

# Configuration
APP_NAME="owlban-ai-dashboard"
LOG_DIR="logs"
BACKUP_DIR="backups"
HEALTH_CHECK_URL="http://localhost:3000/api/operations"
MAX_STARTUP_TIME=60
REQUIRED_NODE_VERSION=18

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to wait for application to be ready
wait_for_app() {
    local max_attempts=$1
    local attempt=1

    log_info "Waiting for application to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 5 $HEALTH_CHECK_URL > /dev/null 2>&1; then
            log_success "Application is ready!"
            return 0
        fi

        log_info "Attempt $attempt/$max_attempts - Application not ready yet..."
        sleep 2
        ((attempt++))
    done

    log_error "Application failed to start within $max_attempts attempts"
    return 1
}

# Function to create backup
create_backup() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_file="$BACKUP_DIR/backup_$timestamp.tar.gz"

    log_info "Creating backup: $backup_file"

    mkdir -p $BACKUP_DIR

    # Backup important files and data
    tar -czf $backup_file \
        --exclude='node_modules' \
        --exclude='logs' \
        --exclude='backups' \
        --exclude='.git' \
        . 2>/dev/null || true

    log_success "Backup created: $backup_file"
}

# Function to validate environment
validate_environment() {
    log_info "Validating environment..."

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

    # Check if port is available
    if check_port ${PORT:-3000}; then
        log_warning "Port ${PORT:-3000} is already in use. Attempting to free it..."
        # Try to find and kill process using the port
        local pid=$(lsof -ti:${PORT:-3000})
        if [ ! -z "$pid" ]; then
            log_warning "Killing process $pid using port ${PORT:-3000}"
            kill -9 $pid 2>/dev/null || true
            sleep 2
        fi
    fi

    log_success "Environment validation passed"
}

# Function to setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."

    # Create PM2 ecosystem file if it doesn't exist
    if [ ! -f "ecosystem.config.js" ]; then
        cat > ecosystem.config.js << EOF
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
EOF
        log_success "Created PM2 ecosystem file"
    fi
}

# Function to start application
start_application() {
    log_info "Starting $APP_NAME..."

    # Create backup before starting
    create_backup

    # Stop any existing instance
    pm2 delete $APP_NAME 2>/dev/null || true

    # Start with PM2 ecosystem file
    pm2 start ecosystem.config.js --env production

    # Wait for application to be ready
    if wait_for_app 30; then
        log_success "Application started successfully"

        # Setup PM2 startup (optional)
        if [ "$SETUP_PM2_STARTUP" = "true" ]; then
            log_info "Setting up PM2 auto-startup..."
            pm2 startup | grep "sudo" | bash
            pm2 save
        fi

        return 0
    else
        log_error "Application failed to start"
        show_logs
        return 1
    fi
}

# Function to show application status
show_status() {
    echo
    log_info "Application Status:"
    pm2 status $APP_NAME 2>/dev/null || log_warning "PM2 status not available"

    echo
    log_info "Resource Usage:"
    pm2 monit $APP_NAME 2>/dev/null | head -20 || log_warning "PM2 monitoring not available"
}

# Function to show logs
show_logs() {
    echo
    log_info "Recent Application Logs:"
    pm2 logs $APP_NAME --lines 20 --nostream 2>/dev/null || log_warning "Logs not available"
}

# Function to cleanup old backups
cleanup_backups() {
    log_info "Cleaning up old backups..."

    # Keep only last 10 backups
    local backup_count=$(ls -1 $BACKUP_DIR/*.tar.gz 2>/dev/null | wc -l)
    if [ "$backup_count" -gt 10 ]; then
        ls -1t $BACKUP_DIR/*.tar.gz | tail -n +11 | xargs rm -f
        log_success "Cleaned up old backups"
    fi
}

# Main execution
main() {
    echo "🚀 Enhanced Production Startup for $APP_NAME"
    echo "=============================================="

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup)
                create_backup
                exit 0
                ;;
            --cleanup)
                cleanup_backups
                exit 0
                ;;
            --setup-startup)
                SETUP_PM2_STARTUP=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --backup        Create backup only"
                echo "  --cleanup       Cleanup old backups only"
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

    # Validate environment
    validate_environment

    # Setup monitoring
    setup_monitoring

    # Create necessary directories
    mkdir -p $LOG_DIR

    # Start application
    if start_application; then
        # Show status
        show_status

        # Cleanup old backups
        cleanup_backups

        echo
        log_success "🎉 $APP_NAME is now running in production!"
        echo
        echo "🌐 Application URL: http://localhost:${PORT:-3000}"
        echo "📊 Metrics URL: http://localhost:${PORT:-3000}/metrics"
        echo "📝 Logs: pm2 logs $APP_NAME"
        echo "🛑 Stop: pm2 stop $APP_NAME"
        echo "🔄 Restart: pm2 restart $APP_NAME"
        echo "👀 Monitor: pm2 monit"
        echo
        echo "💡 Useful commands:"
        echo "   pm2 status              # Show all processes"
        echo "   pm2 logs $APP_NAME --lines 50  # Show recent logs"
        echo "   pm2 reload $APP_NAME    # Reload without downtime"
        echo "   pm2 delete $APP_NAME    # Stop and remove"
        echo
        echo "🔧 Environment variables to set:"
        echo "   OPENAI_API_KEY, HF_API_KEY, NVIDIA_API_KEY"
        echo "   MONGODB_URI, REDIS_URL, JWT_SECRET"
    else
        log_error "Failed to start $APP_NAME"
        exit 1
    fi
}

# Run main function
main "$@"
