/**
 * Portfolio Tracker Mock Data
 */

export const MOCK_ASSETS = {
  // US Stocks & ETFs
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', type: 'US Stock', currentPrice: 175.50, prevClose: 173.20, currency: 'USD', targetWeight: 15 },
  'MSFT': { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'US Stock', currentPrice: 420.10, prevClose: 422.30, currency: 'USD', targetWeight: 15 },
  'IVV': { symbol: 'IVV', name: 'iShares Core S&P 500 ETF', type: 'ETF', currentPrice: 512.40, prevClose: 509.80, currency: 'USD', targetWeight: 20 },
  
  // ASX Stocks & ETFs
  'VAS.AX': { symbol: 'VAS.AX', name: 'Vanguard Australian Shares Index ETF', type: 'ETF', currentPrice: 98.20, prevClose: 97.45, currency: 'AUD', targetWeight: 25 },
  'CBA.AX': { symbol: 'CBA.AX', name: 'Commonwealth Bank of Australia', type: 'ASX Stock', currentPrice: 118.50, prevClose: 119.10, currency: 'AUD', targetWeight: 15 },
  'BHP.AX': { symbol: 'BHP.AX', name: 'BHP Group Limited', type: 'ASX Stock', currentPrice: 43.10, prevClose: 42.80, currency: 'AUD', targetWeight: 10 },
};

// Default exchange rates (AUD/USD = 0.65)
export const DEFAULT_EXCHANGE_RATES = {
  'USD': 0.65, // 1 AUD = 0.65 USD, or 1 USD = 1.54 AUD
  'AUD': 1.00
};

export const MOCK_TRANSACTIONS = [
  // 2024 Buys
  { id: '1', date: '2024-01-15', symbol: 'VAS.AX', type: 'BUY', shares: 100, price: 88.50, fee: 9.95, currency: 'AUD' },
  { id: '2', date: '2024-02-10', symbol: 'AAPL', type: 'BUY', shares: 20, price: 165.00, fee: 5.00, currency: 'USD' },
  { id: '3', date: '2024-03-20', symbol: 'IVV', type: 'BUY', shares: 15, price: 440.00, fee: 5.00, currency: 'USD' },
  { id: '4', date: '2024-06-15', symbol: 'CBA.AX', type: 'BUY', shares: 40, price: 102.30, fee: 9.95, currency: 'AUD' },
  
  // Dividends
  { id: 'd1', date: '2024-04-15', symbol: 'VAS.AX', type: 'DIVIDEND', shares: 100, price: 1.10, fee: 0, currency: 'AUD' }, // $110 dividend
  { id: 'd2', date: '2024-10-15', symbol: 'VAS.AX', type: 'DIVIDEND', shares: 100, price: 0.95, fee: 0, currency: 'AUD' }, // $95 dividend
  
  // 2025 Transactions
  { id: '5', date: '2025-01-10', symbol: 'VAS.AX', type: 'BUY', shares: 50, price: 92.10, fee: 9.95, currency: 'AUD' },
  { id: '6', date: '2025-02-15', symbol: 'MSFT', type: 'BUY', shares: 10, price: 380.00, fee: 5.00, currency: 'USD' },
  { id: '7', date: '2025-05-12', symbol: 'BHP.AX', type: 'BUY', shares: 150, price: 41.50, fee: 9.95, currency: 'AUD' },
  { id: '8', date: '2025-08-22', symbol: 'AAPL', type: 'BUY', shares: 15, price: 172.00, fee: 5.00, currency: 'USD' },
  
  // Dividends
  { id: 'd3', date: '2025-04-15', symbol: 'VAS.AX', type: 'DIVIDEND', shares: 150, price: 1.25, fee: 0, currency: 'AUD' },
  { id: 'd4', date: '2025-09-30', symbol: 'CBA.AX', type: 'DIVIDEND', shares: 40, price: 2.15, fee: 0, currency: 'AUD' },
  { id: 'd5', date: '2025-10-15', symbol: 'VAS.AX', type: 'DIVIDEND', shares: 150, price: 1.05, fee: 0, currency: 'AUD' },

  // 2026 Transactions
  { id: '9', date: '2026-02-05', symbol: 'IVV', type: 'BUY', shares: 10, price: 495.00, fee: 5.00, currency: 'USD' },
  { id: '10', date: '2026-03-12', symbol: 'BHP.AX', type: 'SELL', shares: 50, price: 45.20, fee: 9.95, currency: 'AUD' }, // Sell BHP
];

// Historical portfolio values for charting (last 12 months)
export const MOCK_HISTORICAL_PERFORMANCE = [
  { date: 'May 2025', valueAUD: 42500, benchmarkValueAUD: 42500 },
  { date: 'Jun 2025', valueAUD: 43200, benchmarkValueAUD: 43100 },
  { date: 'Jul 2025', valueAUD: 44100, benchmarkValueAUD: 43800 },
  { date: 'Aug 2025', valueAUD: 44900, benchmarkValueAUD: 44200 },
  { date: 'Sep 2025', valueAUD: 43800, benchmarkValueAUD: 43500 },
  { date: 'Oct 2025', valueAUD: 45200, benchmarkValueAUD: 44300 },
  { date: 'Nov 2025', valueAUD: 46800, benchmarkValueAUD: 45700 },
  { date: 'Dec 2025', valueAUD: 48500, benchmarkValueAUD: 47200 },
  { date: 'Jan 2026', valueAUD: 49200, benchmarkValueAUD: 47900 },
  { date: 'Feb 2026', valueAUD: 51200, benchmarkValueAUD: 49300 },
  { date: 'Mar 2026', valueAUD: 52100, benchmarkValueAUD: 50100 },
  { date: 'Apr 2026', valueAUD: 53800, benchmarkValueAUD: 51500 },
  { date: 'May 2026', valueAUD: 55420, benchmarkValueAUD: 52800 },
];

export const MOCK_WATCHLIST = [
  { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'US Stock', price: 152.30, change: 1.45, changePercent: 0.96, currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'US Stock', price: 174.60, change: -4.20, changePercent: -2.35, currency: 'USD' },
  { symbol: 'NDQ.AX', name: 'Betashares Nasdaq 100 ETF', type: 'ETF', price: 42.15, change: 0.35, changePercent: 0.84, currency: 'AUD' },
  { symbol: 'WES.AX', name: 'Wesfarmers Limited', type: 'ASX Stock', price: 65.80, change: -0.12, changePercent: -0.18, currency: 'AUD' },
];
