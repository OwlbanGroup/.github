module.exports = {
  apps: [{
    name: 'ai-dashboard',
    script: 'app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 4000,
    autorestart: true,
    max_restarts: 5,
    min_uptime: '10s'
  }]
};
