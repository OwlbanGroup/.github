/**
 * Health Check System for AI Dashboard
 * Provides comprehensive system health monitoring
 */

const mongoose = require('mongoose');
const { createClient } = require('redis');
const axios = require('axios');
const os = require('os');
const fs = require('fs').promises;

class HealthChecker {
  constructor() {
    this.redisClient = null;
    this.startTime = Date.now();
  }

  // Initialize Redis client for health checks
  async initRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      await this.redisClient.connect();
    } catch (error) {
      console.warn('Redis health check unavailable:', error.message);
    }
  }

  // Check database connectivity
  async checkDatabase() {
    try {
      await mongoose.connection.db.admin().ping();
      return {
        status: 'healthy',
        responseTime: Date.now() - this.startTime,
        message: 'MongoDB connection successful'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'MongoDB connection failed'
      };
    }
  }

  // Check Redis connectivity
  async checkRedis() {
    if (!this.redisClient) {
      return {
        status: 'unavailable',
        message: 'Redis client not initialized'
      };
    }

    try {
      const start = Date.now();
      await this.redisClient.ping();
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
        message: 'Redis connection successful'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Redis connection failed'
      };
    }
  }

  // Check external API connectivity
  async checkExternalAPIs() {
    const apis = [
      {
        name: 'OpenAI',
        url: 'https://api.openai.com/v1/models',
        headers: process.env.OPENAI_API_KEY ? {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        } : null
      },
      {
        name: 'Hugging Face',
        url: 'https://api-inference.huggingface.co/models',
        headers: process.env.HF_API_KEY ? {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`
        } : null
      }
    ];

    const results = {};

    for (const api of apis) {
      if (!api.headers) {
        results[api.name] = {
          status: 'not_configured',
          message: 'API key not provided'
        };
        continue;
      }

      try {
        const start = Date.now();
        const response = await axios.get(api.url, {
          headers: api.headers,
          timeout: 5000
        });

        results[api.name] = {
          status: 'healthy',
          responseTime: Date.now() - start,
          message: `API accessible (${response.status})`
        };
      } catch (error) {
        results[api.name] = {
          status: 'unhealthy',
          error: error.code || error.message,
          message: `API not accessible: ${error.message}`
        };
      }
    }

    return results;
  }

  // Check system resources
  async checkSystemResources() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;

    return {
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: os.loadavg()
      },
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        systemUsage: `${memUsagePercent.toFixed(2)}%`
      },
      uptime: {
        process: `${Math.round(process.uptime())}s`,
        system: `${Math.round(os.uptime())}s`
      },
      platform: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        nodeVersion: process.version
      }
    };
  }

  // Check disk space
  async checkDiskSpace() {
    try {
      const stats = await fs.statvfs ? await fs.statvfs('/') : null;
      if (stats) {
        const total = stats.f_blocks * stats.f_frsize;
        const available = stats.f_bavail * stats.f_frsize;
        const used = total - available;
        const usagePercent = (used / total) * 100;

        return {
          status: usagePercent > 90 ? 'warning' : 'healthy',
          total: `${Math.round(total / 1024 / 1024 / 1024)}GB`,
          used: `${Math.round(used / 1024 / 1024 / 1024)}GB`,
          available: `${Math.round(available / 1024 / 1024 / 1024)}GB`,
          usagePercent: `${usagePercent.toFixed(2)}%`
        };
      } else {
        return {
          status: 'unknown',
          message: 'Disk space information not available'
        };
      }
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        message: 'Failed to check disk space'
      };
    }
  }

  // Check application dependencies
  async checkDependencies() {
    const dependencies = [
      'express',
      'mongoose',
      'redis',
      'axios',
      'openai',
      'socket.io'
    ];

    const results = {};

    for (const dep of dependencies) {
      try {
        require.resolve(dep);
        results[dep] = {
          status: 'available',
          version: require(`${dep}/package.json`).version
        };
      } catch (error) {
        results[dep] = {
          status: 'missing',
          error: error.message
        };
      }
    }

    return results;
  }

  // Perform comprehensive health check
  async performHealthCheck(detailed = false) {
    const healthCheck = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      status: 'healthy',
      checks: {}
    };

    // Database check
    healthCheck.checks.database = await this.checkDatabase();

    // Redis check
    healthCheck.checks.redis = await this.checkRedis();

    // System resources
    healthCheck.checks.system = await this.checkSystemResources();

    // Disk space
    healthCheck.checks.disk = await this.checkDiskSpace();

    // Dependencies
    if (detailed) {
      healthCheck.checks.dependencies = await this.checkDependencies();
      healthCheck.checks.externalAPIs = await this.checkExternalAPIs();
    }

    // Determine overall status
    const allChecks = Object.values(healthCheck.checks);
    const hasUnhealthy = allChecks.some(check =>
      check.status === 'unhealthy' || check.status === 'error'
    );
    const hasWarnings = allChecks.some(check =>
      check.status === 'warning'
    );

    if (hasUnhealthy) {
      healthCheck.status = 'unhealthy';
    } else if (hasWarnings) {
      healthCheck.status = 'warning';
    }

    return healthCheck;
  }

  // Get health check as JSON response
  async getHealthJSON(detailed = false) {
    const health = await this.performHealthCheck(detailed);

    return {
      status: health.status,
      timestamp: health.timestamp,
      uptime: health.uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: health.checks
    };
  }

  // Get health check as HTML response
  async getHealthHTML(detailed = false) {
    const health = await this.performHealthCheck(detailed);

    const statusColor = {
      healthy: 'green',
      warning: 'orange',
      unhealthy: 'red'
    };

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>AI Dashboard Health Check</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .status { padding: 10px; border-radius: 5px; color: white; }
          .healthy { background-color: green; }
          .warning { background-color: orange; }
          .unhealthy { background-color: red; }
          .check { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
          .check-title { font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>AI Dashboard Health Check</h1>
        <div class="status ${health.status}">
          Status: ${health.status.toUpperCase()}
        </div>
        <p><strong>Timestamp:</strong> ${health.timestamp}</p>
        <p><strong>Uptime:</strong> ${Math.round(health.uptime / 1000)} seconds</p>
        <p><strong>Version:</strong> ${process.env.npm_package_version || '1.0.0'}</p>
        <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
    `;

    for (const [checkName, check] of Object.entries(health.checks)) {
      html += `
        <div class="check">
          <div class="check-title">${checkName.toUpperCase()}</div>
          <div>Status: ${check.status}</div>
          <div>Message: ${check.message || 'OK'}</div>
          ${check.responseTime ? `<div>Response Time: ${check.responseTime}ms</div>` : ''}
          ${check.error ? `<div>Error: ${check.error}</div>` : ''}
        </div>
      `;
    }

    html += `
      </body>
      </html>
    `;

    return html;
  }

  // Cleanup method
  async cleanup() {
    if (this.redisClient) {
      await this.redisClient.disconnect();
    }
  }
}

module.exports = HealthChecker;
