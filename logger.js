/**
 * Simple logger utility for the application
 */

const winston = require('winston');

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-dashboard' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with importance level of `info` or less to `combined.log`
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production then log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Log error utility function
const logError = (error, req = null, context = 'Unknown') => {
  const errorInfo = {
    context,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };

  if (req) {
    errorInfo.method = req.method;
    errorInfo.url = req.originalUrl;
    errorInfo.ip = req.ip;
  }

  logger.error('Error occurred', errorInfo);
};

// Log info utility function
const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

// Log warning utility function
const logWarn = (message, meta = {}) => {
  logger.warn(message, meta);
};

// Log debug utility function
const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

module.exports = {
  logger,
  logError,
  logInfo,
  logWarn,
  logDebug
};
