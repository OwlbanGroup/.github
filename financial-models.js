/**
 * Financial Data Models and Schemas
 * Defines MongoDB schemas for financial data storage and management
 */

const mongoose = require('mongoose');

// Stock Quote Schema
const stockQuoteSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  companyName: String,
  price: {
    current: Number,
    open: Number,
    high: Number,
    low: Number,
    previousClose: Number,
    change: Number,
    changePercent: Number
  },
  volume: Number,
  marketCap: Number,
  peRatio: Number,
  dividendYield: Number,
  fiftyTwoWeekHigh: Number,
  fiftyTwoWeekLow: Number,
  exchange: String,
  currency: {
    type: String,
    default: 'USD'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    enum: ['alphaVantage', 'yahooFinance', 'manual'],
    default: 'alphaVantage'
  }
});

// Financial Metrics Schema
const financialMetricsSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  date: {
    type: Date,
    required: true
  },
  metrics: {
    revenue: Number,
    grossProfit: Number,
    netIncome: Number,
    totalAssets: Number,
    totalLiabilities: Number,
    shareholdersEquity: Number,
    operatingCashFlow: Number,
    capitalExpenditures: Number,
    freeCashFlow: Number,
    ebitda: Number,
    eps: Number,
    bookValue: Number,
    returnOnEquity: Number,
    returnOnAssets: Number,
    debtToEquity: Number,
    currentRatio: Number,
    quickRatio: Number
  },
  period: {
    type: String,
    enum: ['annual', 'quarterly'],
    default: 'annual'
  },
  fiscalYear: Number,
  fiscalQuarter: Number,
  source: {
    type: String,
    enum: ['alphaVantage', 'yahooFinance', 'sec', 'manual'],
    default: 'alphaVantage'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Banking Transaction Schema
const bankingTransactionSchema = new mongoose.Schema({
  accountId: {
    type: String,
    required: true
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  date: {
    type: Date,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: [
      'income', 'expense', 'transfer', 'investment', 'fee',
      'dividend', 'interest', 'tax', 'other'
    ]
  },
  merchantName: String,
  pending: {
    type: Boolean,
    default: false
  },
  institution: String,
  accountType: String,
  tags: [String],
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Financial Portfolio Schema
const portfolioSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  holdings: [{
    symbol: String,
    shares: Number,
    averageCost: Number,
    currentPrice: Number,
    marketValue: Number,
    unrealizedGainLoss: Number,
    weight: Number // Percentage of portfolio
  }],
  totalValue: Number,
  totalCost: Number,
  totalGainLoss: Number,
  totalGainLossPercent: Number,
  cashPosition: Number,
  currency: {
    type: String,
    default: 'USD'
  },
  benchmark: {
    symbol: String,
    name: String
  },
  riskMetrics: {
    beta: Number,
    alpha: Number,
    sharpeRatio: Number,
    volatility: Number,
    maxDrawdown: Number
  },
  performance: {
    daily: Number,
    weekly: Number,
    monthly: Number,
    yearly: Number,
    inception: Number
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Financial Goal Schema
const financialGoalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['savings', 'investment', 'debt_payoff', 'emergency_fund', 'retirement', 'other'],
    required: true
  },
  targetAmount: {
    type: Number,
    required: true
  },
  currentAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  targetDate: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'cancelled'],
    default: 'active'
  },
  progress: {
    percentage: Number,
    remainingAmount: Number,
    monthsRemaining: Number,
    projectedCompletionDate: Date
  },
  contributions: [{
    amount: Number,
    date: Date,
    description: String
  }],
  milestones: [{
    amount: Number,
    date: Date,
    description: String,
    achieved: {
      type: Boolean,
      default: false
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Financial Alert Schema
const financialAlertSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['price', 'volume', 'news', 'earnings', 'dividend', 'rating_change', 'portfolio'],
    required: true
  },
  symbol: String, // For stock-specific alerts
  condition: {
    operator: {
      type: String,
      enum: ['greater_than', 'less_than', 'equal_to', 'crosses_above', 'crosses_below']
    },
    value: Number,
    field: String // e.g., 'price', 'volume', 'change_percent'
  },
  message: String,
  isActive: {
    type: Boolean,
    default: true
  },
  triggeredAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastChecked: Date
});

// Market News Schema
const marketNewsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  summary: String,
  content: String,
  url: String,
  source: String,
  publishedAt: {
    type: Date,
    required: true
  },
  symbols: [String], // Related stock symbols
  categories: [String], // e.g., ['technology', 'earnings', 'merger']
  sentiment: {
    score: Number, // -1 to 1
    label: {
      type: String,
      enum: ['positive', 'negative', 'neutral']
    }
  },
  importance: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
stockQuoteSchema.index({ symbol: 1, lastUpdated: -1 });
stockQuoteSchema.index({ 'price.current': 1 });
stockQuoteSchema.index({ marketCap: -1 });

financialMetricsSchema.index({ symbol: 1, date: -1 });
financialMetricsSchema.index({ date: -1 });

bankingTransactionSchema.index({ accountId: 1, date: -1 });
bankingTransactionSchema.index({ category: 1 });
bankingTransactionSchema.index({ amount: 1 });

portfolioSchema.index({ userId: 1, isActive: 1 });
portfolioSchema.index({ lastUpdated: -1 });

financialGoalSchema.index({ userId: 1, status: 1 });
financialGoalSchema.index({ targetDate: 1 });

financialAlertSchema.index({ userId: 1, isActive: 1 });
financialAlertSchema.index({ symbol: 1, isActive: 1 });

marketNewsSchema.index({ publishedAt: -1 });
marketNewsSchema.index({ symbols: 1 });
marketNewsSchema.index({ 'sentiment.score': -1 });

// Create models
const StockQuote = mongoose.model('StockQuote', stockQuoteSchema);
const FinancialMetrics = mongoose.model('FinancialMetrics', financialMetricsSchema);
const BankingTransaction = mongoose.model('BankingTransaction', bankingTransactionSchema);
const Portfolio = mongoose.model('Portfolio', portfolioSchema);
const FinancialGoal = mongoose.model('FinancialGoal', financialGoalSchema);
const FinancialAlert = mongoose.model('FinancialAlert', financialAlertSchema);
const MarketNews = mongoose.model('MarketNews', marketNewsSchema);

module.exports = {
  StockQuote,
  FinancialMetrics,
  BankingTransaction,
  Portfolio,
  FinancialGoal,
  FinancialAlert,
  MarketNews
};
