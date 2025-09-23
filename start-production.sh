#!/bin/bash

# AI Dashboard Production Startup Script
# This script ensures proper startup of the AI Dashboard in production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check environment variables
check_env_vars() {
    print_status "Checking environment variables..."

    required_vars=(
        "NODE_ENV"
        "JWT_SECRET"
        "MONGODB_URI"
        "REDIS_URL"
    )

    missing_vars=()

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_error "Missing required environment variables: ${missing_vars[*]}"
        print_error "Please check your .env file or environment configuration"
        exit 1
    fi

    print_success "Environment variables check passed"
}

# Function to check system requirements
check_system_requirements() {
    print_status "Checking system requirements..."

    # Check if Node.js is installed
    if ! command_exists node; then
        print_error "Node.js is not installed or not in PATH"
        exit 1
    fi

    # Check Node.js version
    node_version=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
    if [[ $node_version -lt 16 ]]; then
        print_error "Node.js version 16 or higher is required. Current version: $(node -v)"
        exit 1
    fi

    # Check if npm is installed
    if ! command_exists npm; then
        print_error "npm is not installed or not in PATH"
        exit 1
    fi

    # Check available memory
    available_memory=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    if [[ $available_memory -lt 512 ]]; then
        print_warning "Available memory is less than 512MB: ${available_memory}MB"
    fi

    # Check available disk space
    available_disk=$(df / | awk 'NR==2{print $4}')
    if [[ $available_disk -lt 1048576 ]]; then  # Less than 1GB
        print_warning "Available disk space is less than 1GB: ${available_disk}KB"
    fi

    print_success "System requirements check passed"
}

# Function to setup directories
setup_directories() {
    print_status "Setting up directories..."

    # Create necessary directories
    directories=(
        "logs"
        "uploads"
        "data"
        "certs"
    )

    for dir in "${directories[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done

    # Set proper permissions
    chmod 755 logs uploads data certs

    print_success "Directory setup completed"
}

# Function to check database connectivity
check_database_connectivity() {
    print_status "Checking database connectivity..."

    # Check MongoDB connectivity
    if command_exists mongosh; then
        timeout 10 bash -c "mongosh --eval 'db.runCommand({ping: 1})'" >/dev/null 2>&1
        if [[ $? -eq 0 ]]; then
            print_success "MongoDB connectivity check passed"
        else
            print_warning "MongoDB connectivity check failed - application will retry connection"
        fi
    fi

    # Check Redis connectivity
    if command_exists redis-cli; then
        timeout 10 bash -c "redis-cli ping" | grep -q "PONG"
        if [[ $? -eq 0 ]]; then
            print_success "Redis connectivity check passed"
        else
            print_warning "Redis connectivity check failed - application will retry connection"
        fi
    fi
}

# Function to check external API connectivity
check_api_connectivity() {
    print_status "Checking external API connectivity..."

    # Check OpenAI API (if key is provided)
    if [[ -n "${OPENAI_API_KEY:-}" ]]; then
        timeout 10 bash -c "curl -s -H 'Authorization: Bearer $OPENAI_API_KEY' https://api.openai.com/v1/models" >/dev/null 2>&1
        if [[ $? -eq 0 ]]; then
            print_success "OpenAI API connectivity check passed"
        else
            print_warning "OpenAI API connectivity check failed"
        fi
    fi

    # Check Hugging Face API (if key is provided)
    if [[ -n "${HF_API_KEY:-}" ]]; then
        timeout 10 bash -c "curl -s -H 'Authorization: Bearer $HF_API_KEY' https://api-inference.huggingface.co/models" >/dev/null 2>&1
        if [[ $? -eq 0 ]]; then
            print_success "Hugging Face API connectivity check passed"
        else
            print_warning "Hugging Face API connectivity check failed"
        fi
    fi
}

# Function to start the application
start_application() {
    print_status "Starting AI Dashboard application..."

    # Set production environment
    export NODE_ENV=production

    # Start the application with PM2 if available, otherwise use node directly
    if command_exists pm2; then
        print_status "Starting application with PM2..."

        # Create PM2 ecosystem file if it doesn't exist
        if [[ ! -f ecosystem.config.js ]]; then
            print_warning "ecosystem.config.js not found, creating default configuration..."

            cat > ecosystem.config.js << EOF
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
EOF
        fi

        pm2 start ecosystem.config.js
        print_success "Application started with PM2"

        # Save PM2 configuration
        pm2 save

        # Set up PM2 startup script
        pm2 startup

    else
        print_status "Starting application with Node.js directly..."

        # Start with nohup and redirect logs
        nohup node app.js > logs/app.log 2> logs/error.log &

        # Get the process ID
        APP_PID=$!

        print_success "Application started with PID: $APP_PID"

        # Wait a moment and check if process is still running
        sleep 3
        if ! kill -0 $APP_PID 2>/dev/null; then
            print_error "Application failed to start"
            exit 1
        fi
    fi
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."

    # Create log rotation configuration
    if command_exists logrotate; then
        cat > /etc/logrotate.d/ai-dashboard << EOF
/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
    postrotate
        killall -HUP rsyslogd 2>/dev/null || true
    endscript
}
EOF
        print_success "Log rotation configured"
    fi

    # Set up cron job for health checks
    if command_exists crontab; then
        # Add health check cron job
        (crontab -l 2>/dev/null; echo "*/5 * * * * /app/healthcheck.sh") | crontab -
        print_success "Health check cron job configured"
    fi
}

# Function to display startup information
display_startup_info() {
    print_success "AI Dashboard started successfully!"
    echo ""
    echo "📊 Application Information:"
    echo "   - Environment: $NODE_ENV"
    echo "   - Port: $PORT"
    echo "   - Health Check: http://localhost:$PORT/health"
    echo "   - Metrics: http://localhost:$PORT/metrics"
    echo ""
    echo "📝 Log Files:"
    echo "   - Application logs: ./logs/app.log"
    echo "   - Error logs: ./logs/error.log"
    echo ""
    echo "🔧 Useful Commands:"
    echo "   - View logs: tail -f logs/app.log"
    echo "   - Restart app: pm2 restart ai-dashboard (if using PM2)"
    echo "   - Stop app: pm2 stop ai-dashboard (if using PM2)"
    echo "   - Check status: pm2 status (if using PM2)"
    echo ""
    echo "⚠️  Important Notes:"
    echo "   - Ensure all API keys are properly configured"
    echo "   - Monitor disk space and log file sizes"
    echo "   - Set up proper firewall rules"
    echo "   - Configure SSL/TLS for production HTTPS"
    echo ""
}

# Main execution
main() {
    print_status "Starting AI Dashboard production deployment..."

    # Change to script directory
    cd "$(dirname "$0")"

    # Check if .env file exists
    if [[ ! -f .env ]]; then
        print_error ".env file not found!"
        print_error "Please copy .env.example to .env and configure your environment variables"
        exit 1
    fi

    # Load environment variables
    if [[ -f .env ]]; then
        set -a
        source .env
        set +a
    fi

    # Run pre-startup checks
    check_system_requirements
    check_env_vars
    setup_directories
    check_database_connectivity
    check_api_connectivity

    # Start the application
    start_application

    # Setup monitoring
    setup_monitoring

    # Display startup information
    display_startup_info

    print_success "Production deployment completed successfully!"
}

# Handle script interruption
trap 'print_warning "Script interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"
