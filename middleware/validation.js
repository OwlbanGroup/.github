/**
 * Request Validation Middleware
 * Provides comprehensive input validation and sanitization
 */

const validator = require('validator');

// Validation rules for different endpoints
const validationRules = {
  register: {
    username: { required: true, type: 'string', minLength: 3, maxLength: 50 },
    password: { required: true, type: 'string', minLength: 6, maxLength: 100 }
  },
  login: {
    username: { required: true, type: 'string', minLength: 3, maxLength: 50 },
    password: { required: true, type: 'string', minLength: 6, maxLength: 100 }
  },
  aiTextGeneration: {
    prompt: { required: true, type: 'string', minLength: 1, maxLength: 10000 }
  },
  aiImageGeneration: {
    prompt: { required: true, type: 'string', minLength: 1, maxLength: 1000 }
  },
  aiCodeCompletion: {
    code: { required: true, type: 'string', minLength: 1, maxLength: 5000 }
  },
  aiSentimentAnalysis: {
    text: { required: true, type: 'string', minLength: 1, maxLength: 5000 }
  },
  openaiChat: {
    messages: { required: true, type: 'array', minLength: 1 }
  },
  openaiImage: {
    prompt: { required: true, type: 'string', minLength: 1, maxLength: 1000 }
  },
  nvidiaInference: {
    model: { required: true, type: 'string' },
    input: { required: true, type: 'string' }
  },
  nvidiaDeploy: {
    modelId: { required: true, type: 'string' },
    instanceType: { required: true, type: 'string' },
    name: { required: true, type: 'string' }
  }
};

// Sanitization functions
const sanitizeInput = (input, type) => {
  if (typeof input !== 'string') return input;

  switch (type) {
    case 'string':
      return validator.escape(input.trim());
    case 'email':
      return validator.normalizeEmail(input.trim());
    case 'url':
      return validator.normalizeURL(input.trim());
    default:
      return validator.escape(input.trim());
  }
};

// Validation function
const validateInput = (data, rules) => {
  const errors = [];

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];

    // Check required fields
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip validation if field is not required and empty
    if (!rule.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Type validation
    if (rule.type && typeof value !== rule.type) {
      errors.push(`${field} must be of type ${rule.type}`);
      continue;
    }

    // String validations
    if (rule.type === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters long`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field} must not exceed ${rule.maxLength} characters`);
      }
    }

    // Array validations
    if (rule.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${field} must be an array`);
      } else {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${field} must contain at least ${rule.minLength} items`);
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${field} must not contain more than ${rule.maxLength} items`);
        }
      }
    }

    // Email validation
    if (rule.type === 'email' && !validator.isEmail(value)) {
      errors.push(`${field} must be a valid email address`);
    }

    // URL validation
    if (rule.type === 'url' && !validator.isURL(value)) {
      errors.push(`${field} must be a valid URL`);
    }
  }

  return errors;
};

// Main validation middleware
const validateRequest = (rulesName) => {
  return (req, res, next) => {
    const rules = validationRules[rulesName];
    if (!rules) {
      return res.status(500).json({ error: 'Validation rules not found' });
    }

    // Validate body data
    const bodyErrors = validateInput(req.body, rules);

    // Validate query parameters
    const queryErrors = validateInput(req.query, rules);

    // Validate route parameters
    const paramsErrors = validateInput(req.params, rules);

    const allErrors = [...bodyErrors, ...queryErrors, ...paramsErrors];

    if (allErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: allErrors
      });
    }

    // Sanitize input data
    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    req.params = sanitizeObject(req.params);

    next();
  };
};

// Sanitize entire object
const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value, 'string');
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Rate limiting validation
const validateRateLimit = (req, res, next) => {
  // Basic rate limiting headers
  res.set({
    'X-RateLimit-Limit': process.env.RATE_LIMIT_MAX || 100,
    'X-RateLimit-Remaining': Math.max(0, (process.env.RATE_LIMIT_MAX || 100) - 1),
    'X-RateLimit-Reset': new Date(Date.now() + (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000).toISOString()
  });

  next();
};

// SQL injection protection
const preventSQLInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /('|(\\x27)|(\\x2D\\x2D)|(\;)|(\\x3B))/g,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/gi
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    } else if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        if (checkValue(val)) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    return res.status(400).json({
      error: 'Potentially malicious input detected'
    });
  }

  next();
};

// XSS protection
const preventXSS = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of xssPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    } else if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        if (checkValue(val)) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    return res.status(400).json({
      error: 'Potentially malicious XSS content detected'
    });
  }

  next();
};

module.exports = {
  validateRequest,
  validateRateLimit,
  preventSQLInjection,
  preventXSS,
  sanitizeInput,
  validateInput
};
