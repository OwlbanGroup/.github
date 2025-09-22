/**
 * Financial Services Module
 * Handles integration with external financial APIs
 */

const axios = require('axios');
const { financialConfig, providerStatus, rateLimiters } = require('./financial-config');
const { StockQuote, FinancialMetrics, BankingTransaction, MarketNews } = require('./financial-models');

// Rate limiting utility
const checkRateLimit = (provider) => {
  const limiter = rateLimiters[provider];
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Clean old requests
  limiter.requests = limiter.requests.filter(time => time > oneMinuteAgo);

  if (limiter.requests.length >= limiter.limit) {
    return false; // Rate limit exceeded
  }

  limiter.requests.push(now);
  return true;
};

// Alpha Vantage Service
class AlphaVantageService {
  constructor() {
    this.apiKey = financialConfig.alphaVantage.apiKey;
    this.baseUrl = financialConfig.alphaVantage.baseUrl;
  }

  async makeRequest(functionName, symbol, params = {}) {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not configured');
    }

    if (!checkRateLimit('alphaVantage')) {
      throw new Error('Alpha Vantage rate limit exceeded');
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: functionName,
          symbol,
          apikey: this.apiKey,
          ...params
        },
        timeout: financialConfig.errorHandling.timeout
      });

      if (response.data['Error Message']) {
        throw new Error(response.data['Error Message']);
      }

      providerStatus.alphaVantage.lastChecked = new Date();
      providerStatus.alphaVantage.available = true;
      providerStatus.alphaVantage.errorCount = 0;

      return response.data;
    } catch (error) {
      providerStatus.alphaVantage.errorCount++;
      if (providerStatus.alphaVantage.errorCount >= financialConfig.errorHandling.circuitBreakerThreshold) {
        providerStatus.alphaVantage.available = false;
      }
      throw error;
    }
  }

  async getStockQuote(symbol) {
    const data = await this.makeRequest(financialConfig.alphaVantage.endpoints.stockQuote, symbol);

    if (!data['Global Quote']) {
      throw new Error('Invalid response format from Alpha Vantage');
    }

    const quote = data['Global Quote'];
    return {
      symbol: symbol.toUpperCase(),
      price: {
        current: parseFloat(quote['05. price']),
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        previousClose: parseFloat(quote['08. previous close']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', ''))
      },
      volume: parseInt(quote['06. volume']),
      lastUpdated: new Date(quote['07. latest trading day']),
      source: 'alphaVantage'
    };
  }

  async getCompanyOverview(symbol) {
    const data = await this.makeRequest(financialConfig.alphaVantage.endpoints.companyOverview, symbol);

    return {
      symbol: symbol.toUpperCase(),
      companyName: data.Name,
      description: data.Description,
      sector: data.Sector,
      industry: data.Industry,
      marketCap: parseFloat(data.MarketCapitalization),
      peRatio: parseFloat(data.PERatio),
      dividendYield: parseFloat(data.DividendYield),
      fiftyTwoWeekHigh: parseFloat(data['52WeekHigh']),
      fiftyTwoWeekLow: parseFloat(data['52WeekLow']),
      exchange: data.Exchange,
      currency: data.Currency,
      source: 'alphaVantage'
    };
  }

  async getFinancialMetrics(symbol) {
    const [balanceSheet, incomeStatement, cashFlow] = await Promise.all([
      this.makeRequest('BALANCE_SHEET', symbol),
      this.makeRequest('INCOME_STATEMENT', symbol),
      this.makeRequest('CASH_FLOW', symbol)
    ]);

    // Process latest annual report
    const latestYear = Object.keys(balanceSheet.annualReports || {})[0];
    const latestIncome = Object.keys(incomeStatement.annualReports || {})[0];
    const latestCashFlow = Object.keys(cashFlow.annualReports || {})[0];

    if (!latestYear) {
      throw new Error('No financial data available');
    }

    const bs = balanceSheet.annualReports[latestYear];
    const ic = incomeStatement.annualReports[latestIncome];
    const cf = cashFlow.annualReports[latestCashFlow];

    return {
      symbol: symbol.toUpperCase(),
      date: new Date(latestYear + '-12-31'),
      metrics: {
        revenue: parseFloat(ic.totalRevenue),
        grossProfit: parseFloat(ic.grossProfit),
        netIncome: parseFloat(ic.netIncome),
        totalAssets: parseFloat(bs.totalAssets),
        totalLiabilities: parseFloat(bs.totalLiabilities),
        shareholdersEquity: parseFloat(bs.totalShareholderEquity),
        operatingCashFlow: parseFloat(cf.operatingCashflow),
        capitalExpenditures: parseFloat(cf.capitalExpenditures),
        freeCashFlow: parseFloat(cf.operatingCashflow) - parseFloat(cf.capitalExpenditures),
        ebitda: parseFloat(ic.ebitda),
        eps: parseFloat(ic.eps),
        bookValue: parseFloat(bs.tangibleBookValuePerShare),
        returnOnEquity: (parseFloat(ic.netIncome) / parseFloat(bs.totalShareholderEquity)) * 100,
        returnOnAssets: (parseFloat(ic.netIncome) / parseFloat(bs.totalAssets)) * 100,
        debtToEquity: parseFloat(bs.totalLiabilities) / parseFloat(bs.totalShareholderEquity),
        currentRatio: parseFloat(bs.totalCurrentAssets) / parseFloat(bs.totalCurrentLiabilities),
        quickRatio: (parseFloat(bs.totalCurrentAssets) - parseFloat(bs.inventory)) / parseFloat(bs.totalCurrentLiabilities)
      },
      period: 'annual',
      fiscalYear: parseInt(latestYear),
      source: 'alphaVantage'
    };
  }
}

// Yahoo Finance Service
class YahooFinanceService {
  constructor() {
    this.baseUrl = financialConfig.yahooFinance.baseUrl;
  }

  async makeRequest(endpoint, params = {}) {
    if (!checkRateLimit('yahooFinance')) {
      throw new Error('Yahoo Finance rate limit exceeded');
    }

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params,
        timeout: financialConfig.errorHandling.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      providerStatus.yahooFinance.lastChecked = new Date();
      providerStatus.yahooFinance.available = true;
      providerStatus.yahooFinance.errorCount = 0;

      return response.data;
    } catch (error) {
      providerStatus.yahooFinance.errorCount++;
      if (providerStatus.yahooFinance.errorCount >= financialConfig.errorHandling.circuitBreakerThreshold) {
        providerStatus.yahooFinance.available = false;
      }
      throw error;
    }
  }

  async getStockQuote(symbol) {
    const data = await this.makeRequest(`/chart/${symbol}`);

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('Invalid response format from Yahoo Finance');
    }

    const result = data.chart.result[0];
    const meta = result.meta;
    const quote = result.meta;

    return {
      symbol: symbol.toUpperCase(),
      companyName: meta.longName || meta.shortName,
      price: {
        current: meta.regularMarketPrice,
        open: meta.regularMarketOpen,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        previousClose: meta.previousClose,
        change: meta.regularMarketPrice - meta.previousClose,
        changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100
      },
      volume: meta.regularMarketVolume,
      marketCap: meta.marketCap,
      peRatio: meta.trailingPE,
      dividendYield: meta.dividendYield,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      exchange: meta.exchangeName,
      currency: meta.currency,
      lastUpdated: new Date(meta.regularMarketTime * 1000),
      source: 'yahooFinance'
    };
  }

  async getHistoricalData(symbol, period = '1y') {
    const data = await this.makeRequest(`/chart/${symbol}`, {
      range: period,
      interval: '1d'
    });

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('Invalid response format from Yahoo Finance');
    }

    const result = data.chart.result[0];
    return result.timestamp.map((timestamp, index) => ({
      date: new Date(timestamp * 1000),
      open: result.indicators.quote[0].open[index],
      high: result.indicators.quote[0].high[index],
      low: result.indicators.quote[0].low[index],
      close: result.indicators.quote[0].close[index],
      volume: result.indicators.quote[0].volume[index]
    }));
  }
}

// Plaid Service (for banking data)
class PlaidService {
  constructor() {
    this.clientId = financialConfig.plaid.clientId;
    this.secret = financialConfig.plaid.secret;
    this.environment = financialConfig.plaid.environment;
    this.baseUrl = financialConfig.plaid.baseUrl[this.environment];
  }

  async makeRequest(endpoint, data) {
    if (!this.clientId || !this.secret) {
      throw new Error('Plaid credentials not configured');
    }

    if (!checkRateLimit('plaid')) {
      throw new Error('Plaid rate limit exceeded');
    }

    try {
      const response = await axios.post(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          'Content-Type': 'application/json'
        },
        auth: {
          username: this.clientId,
          password: this.secret
        },
        timeout: financialConfig.errorHandling.timeout
      });

      providerStatus.plaid.lastChecked = new Date();
      providerStatus.plaid.available = true;
      providerStatus.plaid.errorCount = 0;

      return response.data;
    } catch (error) {
      providerStatus.plaid.errorCount++;
      if (providerStatus.plaid.errorCount >= financialConfig.errorHandling.circuitBreakerThreshold) {
        providerStatus.plaid.available = false;
      }
      throw error;
    }
  }

  async createLinkToken(userId) {
    const data = {
      user: { client_user_id: userId },
      client_name: 'AI Dashboard',
      products: ['transactions', 'accounts'],
      country_codes: ['US'],
      language: 'en'
    };

    return await this.makeRequest('/link/token/create', data);
  }

  async exchangePublicToken(publicToken) {
    const data = {
      public_token: publicToken
    };

    return await this.makeRequest('/item/public_token/exchange', data);
  }

  async getAccounts(accessToken) {
    const data = {
      access_token: accessToken
    };

    return await this.makeRequest('/accounts/get', data);
  }

  async getTransactions(accessToken, startDate, endDate) {
    const data = {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate
    };

    return await this.makeRequest('/transactions/get', data);
  }
}

// Financial Data Manager
class FinancialDataManager {
  constructor() {
    this.alphaVantage = new AlphaVantageService();
    this.yahooFinance = new YahooFinanceService();
    this.plaid = new PlaidService();
  }

  async getStockQuote(symbol, source = 'auto') {
    // Try to get from database first
    const cached = await StockQuote.findOne({
      symbol: symbol.toUpperCase()
    }).sort({ lastUpdated: -1 });

    if (cached && (new Date() - cached.lastUpdated) < 5 * 60 * 1000) { // 5 minutes cache
      return cached;
    }

    // Get fresh data
    let data;
    try {
      if (source === 'alphaVantage' || source === 'auto') {
        data = await this.alphaVantage.getStockQuote(symbol);
      } else if (source === 'yahooFinance') {
        data = await this.yahooFinance.getStockQuote(symbol);
      } else {
        throw new Error('Invalid source specified');
      }

      // Save to database
      await StockQuote.findOneAndUpdate(
        { symbol: data.symbol },
        { ...data, lastUpdated: new Date() },
        { upsert: true, new: true }
      );

      return data;
    } catch (error) {
      console.error(`Error fetching stock quote for ${symbol}:`, error.message);
      if (cached) {
        return cached; // Return cached data if fresh data fails
      }
      throw error;
    }
  }

  async getFinancialMetrics(symbol) {
    const cached = await FinancialMetrics.findOne({
      symbol: symbol.toUpperCase()
    }).sort({ date: -1 });

    if (cached && (new Date() - cached.lastUpdated) < 60 * 60 * 1000) { // 1 hour cache
      return cached;
    }

    try {
      const data = await this.alphaVantage.getFinancialMetrics(symbol);

      await FinancialMetrics.findOneAndUpdate(
        { symbol: data.symbol, date: data.date },
        { ...data, lastUpdated: new Date() },
        { upsert: true, new: true }
      );

      return data;
    } catch (error) {
      console.error(`Error fetching financial metrics for ${symbol}:`, error.message);
      if (cached) {
        return cached;
      }
      throw error;
    }
  }

  async getBankingTransactions(accessToken, startDate, endDate) {
    try {
      const data = await this.plaid.getTransactions(accessToken, startDate, endDate);

      // Save transactions to database
      for (const transaction of data.transactions) {
        await BankingTransaction.findOneAndUpdate(
          { transactionId: transaction.transaction_id },
          {
            accountId: transaction.account_id,
            transactionId: transaction.transaction_id,
            amount: transaction.amount,
            currency: transaction.iso_currency_code || 'USD',
            date: new Date(transaction.date),
            description: transaction.name,
            category: this.categorizeTransaction(transaction),
            merchantName: transaction.merchant_name,
            pending: transaction.pending,
            institution: data.item.institution_id,
            metadata: transaction
          },
          { upsert: true, new: true }
        );
      }

      return data.transactions;
    } catch (error) {
      console.error('Error fetching banking transactions:', error.message);
      throw error;
    }
  }

  categorizeTransaction(transaction) {
    const name = transaction.name.toLowerCase();
    const amount = Math.abs(transaction.amount);

    if (name.includes('dividend') || name.includes('interest')) {
      return 'dividend';
    } else if (name.includes('fee') || name.includes('charge')) {
      return 'fee';
    } else if (name.includes('tax')) {
      return 'tax';
    } else if (amount > 10000) {
      return 'investment';
    } else if (transaction.amount < 0) {
      return 'expense';
    } else {
      return 'income';
    }
  }

  getProviderStatus() {
    return providerStatus;
  }

  getRateLimitStatus() {
    return rateLimiters;
  }
}

module.exports = {
  AlphaVantageService,
  YahooFinanceService,
  PlaidService,
  FinancialDataManager
};
