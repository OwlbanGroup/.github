/**
 * Global Error Handling Middleware
 * Provides centralized error handling and logging
 */

const { logError } = require('../logger');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, true);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, true);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Authorization failed') {
    super(message, 403, true);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, true);
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, true);
    this.name = 'RateLimitError';
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message) {
    super(`${service}: ${message}`, 502, true);
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

// Error logging utility
const logErrorDetails = (error, req = null) => {
  const errorInfo = {
    name: error.name,
    message: error.message,
    statusCode: error.statusCode,
    stack: error.stack,
    isOperational: error.isOperational,
    timestamp: new Date().toISOString()
  };

  if (req) {
    errorInfo.method = req.method;
    errorInfo.url = req.originalUrl;
    errorInfo.ip = req.ip;
    errorInfo.userAgent = req.get('User-Agent');
    errorInfo.body = req.body;
    errorInfo.query = req.query;
    errorInfo.params = req.params;
  }

  // Log different error types appropriately
  if (error.isOperational) {
    console.error('Operational Error:', errorInfo);
  } else {
    console.error('Programming Error:', errorInfo);
  }

  // Log to our logging system
  logError(error, req, 'Global Error Handler');
};

// Global error handler middleware
const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let isOperational = error.isOperational !== false;

  // Handle different error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error: ' + message;
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    if (error.code === 11000) {
      statusCode = 409;
      message = 'Duplicate key error';
    } else {
      statusCode = 500;
      message = 'Database error';
    }
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    message = 'File upload error';
  } else if (error.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
  } else if (error.code === 'ENOTFOUND') {
    statusCode = 503;
    message = 'Service not found';
  }

  // Log error details
  logErrorDetails(error, req);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  const errorResponse = {
    success: false,
    error: {
      message: isDevelopment ? message : 'Something went wrong',
      statusCode,
      timestamp: new Date().toISOString()
    }
  };

  // Add stack trace in development
  if (isDevelopment) {
    errorResponse.error.stack = error.stack;
    errorResponse.error.details = error;
  }

  // Add retry information for certain errors
  if (statusCode === 503 || statusCode === 502) {
    errorResponse.error.retry = true;
    errorResponse.error.retryAfter = 30; // seconds
  }

  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  res.status(404);
  next(error);
};

// Request timeout handler
const timeoutHandler = (req, res, next) => {
  const timeout = setTimeout(() => {
    const error = new AppError('Request timeout', 408, true);
    next(error);
  }, 30000); // 30 seconds

  res.on('finish', () => {
    clearTimeout(timeout);
  });

  next();
};

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // Close database connections
  if (global.mongooseConnection) {
    global.mongooseConnection.close();
  }

  // Close Redis connections
  if (global.redisClient) {
    global.redisClient.disconnect();
  }

  // Close server
  process.exit(0);
};

// Setup graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logError(error, null, 'Uncaught Exception');
  process.exit(1);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logError(reason, null, 'Unhandled Rejection');
  process.exit(1);
});

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalServiceError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  timeoutHandler,
  logErrorDetails
};
