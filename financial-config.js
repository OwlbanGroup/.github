/**
 * Financial Data Integration Configuration
 * Manages API keys, settings, and configurations for all financial services
 */

const financialConfig = {
  // Alpha Vantage API Configuration
  alphaVantage: {
    apiKey: process.env.ALPHA_VANTAGE_API_KEY,
    baseUrl: 'https://www.alphavantage.co/query',
    rateLimit: {
      requestsPerMinute: 5, // Free tier limit
      requestsPerDay: 500
    },
    endpoints: {
      stockQuote: 'GLOBAL_QUOTE',
      timeSeriesDaily: 'TIME_SERIES_DAILY',
      timeSeriesIntraday: 'TIME_SERIES_INTRADAY',
      companyOverview: 'OVERVIEW',
      earnings: 'EARNINGS',
      balanceSheet: 'BALANCE_SHEET',
      incomeStatement: 'INCOME_STATEMENT',
      cashFlow: 'CASH_FLOW'
    }
  },

  // Yahoo Finance Configuration
  yahooFinance: {
    baseUrl: 'https://query1.finance.yahoo.com/v8/finance',
    rateLimit: {
      requestsPerMinute: 100, // Higher limit for Yahoo Finance
      requestsPerDay: 10000
    },
    endpoints: {
      quote: '/chart/',
      historical: '/chart/',
      options: '/options/',
      news: '/news/',
      analysis: '/analysis/'
    }
  },

  // Plaid API Configuration (for banking data)
  plaid: {
    clientId: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_SECRET,
    environment: process.env.PLAID_ENV || 'sandbox', // sandbox, development, production
    baseUrl: {
      sandbox: 'https://sandbox.plaid.com',
      development: 'https://development.plaid.com',
      production: 'https://production.plaid.com'
    },
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerDay: 1000
    }
  },

  // Financial Data Cache Configuration
  cache: {
    ttl: {
      stockQuotes: 300, // 5 minutes
      companyData: 3600, // 1 hour
      historicalData: 1800, // 30 minutes
      bankingData: 900 // 15 minutes
    },
    maxSize: 1000 // Maximum cache entries
  },

  // Financial Data Validation Rules
  validation: {
    stockSymbols: /^[A-Z]{1,5}$/, // 1-5 uppercase letters
    dateFormat: /^\d{4}-\d{2}-\d{2}$/,
    currencyCodes: ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'],
    maxHistoricalDays: 365 * 2 // 2 years max for historical data
  },

  // Financial Calculation Constants
  calculations: {
    riskFreeRate: 0.02, // 2% risk-free rate for calculations
    marketRiskPremium: 0.06, // 6% market risk premium
    betaCalculationPeriod: 252, // Trading days in a year
    volatilityCalculationPeriod: 30 // Days for volatility calculation
  },

  // Error Handling Configuration
  errorHandling: {
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    timeout: 30000, // 30 seconds
    circuitBreakerThreshold: 5, // Open circuit after 5 failures
    circuitBreakerResetTime: 60000 // 1 minute
  },

  // Security Configuration
  security: {
    encryptSensitiveData: true,
    logApiCalls: process.env.NODE_ENV === 'development',
    maskApiKeysInLogs: true,
    validateInputData: true
  }
};

// Financial Data Providers Status
const providerStatus = {
  alphaVantage: { available: false, lastChecked: null, errorCount: 0 },
  yahooFinance: { available: false, lastChecked: null, errorCount: 0 },
  plaid: { available: false, lastChecked: null, errorCount: 0 }
};

// Rate Limiting Configuration
const rateLimiters = {
  alphaVantage: {
    requests: [],
    lastReset: Date.now(),
    limit: financialConfig.alphaVantage.rateLimit.requestsPerMinute
  },
  yahooFinance: {
    requests: [],
    lastReset: Date.now(),
    limit: financialConfig.yahooFinance.rateLimit.requestsPerMinute
  },
  plaid: {
    requests: [],
    lastReset: Date.now(),
    limit: financialConfig.plaid.rateLimit.requestsPerMinute
  }
};

module.exports = {
  financialConfig,
  providerStatus,
  rateLimiters
};
