/**
 * Comprehensive Logging System for AI Dashboard
 * Provides structured logging with different levels and formats
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for different log levels
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  new winston.transports.File({
    filename: 'logs/all.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
});

// Create HTTP request logger middleware
const httpLogger = (req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms - ${req.ip}`;

    if (res.statusCode >= 400) {
      logger.error(message);
    } else {
      logger.http(message);
    }
  });

  next();
};

// Request logging utility
const logRequest = (req, message = '') => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    message: message
  };
  logger.info(`Request: ${JSON.stringify(logData)}`);
};

// Error logging utility
const logError = (error, req = null, context = '') => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    context: context,
    timestamp: new Date().toISOString()
  };

  if (req) {
    errorData.method = req.method;
    errorData.url = req.originalUrl;
    errorData.ip = req.ip;
  }

  logger.error(`Error: ${JSON.stringify(errorData)}`);
};

// Performance logging utility
const logPerformance = (operation, duration, metadata = {}) => {
  const perfData = {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...metadata
  };
  logger.info(`Performance: ${JSON.stringify(perfData)}`);
};

// Database operation logging
const logDatabaseOperation = (operation, collection, duration, success = true) => {
  const dbData = {
    operation,
    collection,
    duration: `${duration}ms`,
    success,
    timestamp: new Date().toISOString()
  };
  logger.info(`Database: ${JSON.stringify(dbData)}`);
};

// AI service logging
const logAIServiceCall = (service, operation, duration, success = true, tokens = null) => {
  const aiData = {
    service,
    operation,
    duration: `${duration}ms`,
    success,
    tokens,
    timestamp: new Date().toISOString()
  };
  logger.info(`AI Service: ${JSON.stringify(aiData)}`);
};

// Security event logging
const logSecurityEvent = (event, severity, details = {}) => {
  const securityData = {
    event,
    severity,
    details,
    timestamp: new Date().toISOString(),
    ip: details.ip || 'unknown'
  };
  logger.warn(`Security: ${JSON.stringify(securityData)}`);
};

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = {
  logger,
  httpLogger,
  logRequest,
  logError,
  logPerformance,
  logDatabaseOperation,
  logAIServiceCall,
  logSecurityEvent
};
