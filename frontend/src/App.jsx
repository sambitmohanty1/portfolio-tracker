import React, { useState, useMemo, useEffect } from 'react';
import Navbar from './components/Navbar';
import MetricCard from './components/MetricCard';
import PerformanceChart from './components/PerformanceChart';
import HoldingTable from './components/HoldingTable';
import TransactionHistory from './components/TransactionHistory';
import Watchlist from './components/Watchlist';
import * as api from './utils/api';

import { 
  MOCK_ASSETS, 
  MOCK_TRANSACTIONS, 
  MOCK_HISTORICAL_PERFORMANCE, 
  MOCK_WATCHLIST,
  DEFAULT_EXCHANGE_RATES 
} from './utils/mockData';

import { 
  calculateXIRR, 
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateAlpha 
} from './utils/calculations';

import { 
  DollarSign, Percent, TrendingUp, ShieldAlert, Award, Calendar, CloudOff, CloudLightning 
} from 'lucide-react';

// Robust helper to normalize any parseable date format into standard YYYY-MM-DD
const normalizeDate = (rawDate) => {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const clean = String(rawDate).trim();

  // 1. If it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // 2. Handle DD/MM/YYYY or MM/DD/YYYY or D/M/YYYY
  const slashMatch = clean.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})$/);
  if (slashMatch) {
    let part1 = slashMatch[1].padStart(2, '0');
    let part2 = slashMatch[2].padStart(2, '0');
    let year = slashMatch[3];
    if (year.length === 2) {
      year = "20" + year; // assume 20xx
    }

    const val1 = parseInt(part1, 10);
    const val2 = parseInt(part2, 10);

    // If part1 is > 12, it has to be DD/MM/YYYY
    if (val1 > 12) {
      return `${year}-${part2}-${part1}`;
    }
    // If part2 is > 12, it has to be MM/DD/YYYY
    if (val2 > 12) {
      return `${year}-${part1}-${part2}`;
    }
    // Otherwise, assume local AU format DD/MM/YYYY by default
    return `${year}-${part2}-${part1}`;
  }

  // 3. Fallback to standard parse
  try {
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {}

  return clean;
};

// Formatting helpers for decimal ratios and percentages
const formatDecimal = (value, decimals = 3) => {
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '-∞';
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  if (Math.abs(value) > 1e12) return 'N/A';
  return value.toFixed(decimals);
};

const formatPercent = (value, decimals = 3, includeSign = false) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  if (!isFinite(value)) return 'N/A';
  if (Math.abs(value) > 1e12) return 'N/A';
  const sign = includeSign && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
};

// Curated sector mappings for fallback purposes
const CURATED_SECTORS = {
  'VAS.AX': 'ETF/Index',
  'VGS.AX': 'ETF/Index',
  'A200.AX': 'ETF/Index',
  'IVV.AX': 'ETF/Index',
  'NDQ.AX': 'ETF/Index',
  'ANZ.AX': 'Financial Services',
  'CBA.AX': 'Financial Services',
  'NAB.AX': 'Financial Services',
  'WBC.AX': 'Financial Services',
  'BHP.AX': 'Basic Materials',
  'RIO.AX': 'Basic Materials',
  'FMG.AX': 'Basic Materials',
  'TLS.AX': 'Communication Services',
  'CSL.AX': 'Healthcare',
  'WES.AX': 'Consumer Cyclical',
  'WOW.AX': 'Consumer Defensive',
  'COL.AX': 'Consumer Defensive',
  'AAPL': 'Technology',
  'MSFT': 'Technology',
  'GOOGL': 'Technology',
  'AMZN': 'Consumer Cyclical',
  'NVDA': 'Technology',
  'TSLA': 'Consumer Cyclical',
  'META': 'Communication Services',
};

const determineTheme = (sector, industry) => {
  const s = (sector || 'Other').toLowerCase();
  const ind = (industry || 'Other').toLowerCase();
  
  if (s.includes('tech') || s.includes('communication') || s.includes('software') || ind.includes('biotech') || ind.includes('internet')) {
    return 'Growth & Innovation';
  }
  if (s.includes('financial') || s.includes('bank') || s.includes('real estate') || s.includes('energy') || s.includes('insurance')) {
    return 'Value & Income';
  }
  if (s.includes('healthcare') || s.includes('defensive') || s.includes('utility') || s.includes('utilities') || s.includes('food')) {
    return 'Defensive & Core';
  }
  if (s.includes('industrial') || s.includes('materials') || s.includes('cyclical') || s.includes('mining') || s.includes('steel')) {
    return 'Cyclical & Resources';
  }
  if (s.includes('etf') || s.includes('index') || s.includes('fund') || ind.includes('diversified')) {
    return 'Passive Diversified';
  }
  return 'Other';
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [displayCurrency, setDisplayCurrency] = useState('AUD');
  const [audUsdRate, setAudUsdRate] = useState(0.645); // Live rate, default fallback
  const [quotesLoaded, setQuotesLoaded] = useState(false); // True once first live API response arrives
  
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [portfolios, setPortfolios] = useState([]);
  const [activePortfolioId, setActivePortfolioId] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [assets, setAssets] = useState({});

  // Historical performance history states
  const [historyPrices, setHistoryPrices] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  const uniqueSymbols = useMemo(() => {
    return [...new Set(transactions.map(t => t.symbol))];
  }, [transactions]);

  const oldestTxPeriod = useMemo(() => {
    if (transactions.length === 0) return '1mo';
    const dates = transactions.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return '1mo';
    
    const oldestTime = Math.min(...dates);
    const nowTime = Date.now();
    const diffDays = (nowTime - oldestTime) / (1000 * 60 * 60 * 24);
    
    if (diffDays <= 30) return '1mo';
    if (diffDays <= 90) return '3mo';
    if (diffDays <= 180) return '6mo';
    if (diffDays <= 365) return '1y';
    if (diffDays <= 365 * 3) return '3y';
    if (diffDays <= 365 * 5) return '5y';
    return 'max';
  }, [transactions]);

  useEffect(() => {
    if (uniqueSymbols.length === 0) {
      setHistoryPrices(null);
      return;
    }
    
    let isMounted = true;
    async function loadHistory() {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const { fetchMarketHistory } = await import('./utils/api');
        const historyData = await fetchMarketHistory(uniqueSymbols, oldestTxPeriod);
        if (isMounted) {
          setHistoryPrices(historyData);
        }
      } catch (err) {
        console.error("Failed to load historical data:", err);
        if (isMounted) {
          setHistoryError(err.message || "Failed to load history");
        }
      } finally {
        if (isMounted) {
          setHistoryLoading(false);
        }
      }
    }
    
    loadHistory();
    
    return () => {
      isMounted = false;
    };
  }, [uniqueSymbols, oldestTxPeriod]);

  // 1. RxDB Initialization and Portfolio Subscription
  useEffect(() => {
    let subPortfolios;
    
    async function initDb() {
      try {
        const { getDatabase } = await import('./utils/db');
        const db = await getDatabase();
        
        subPortfolios = db.portfolios.find().$.subscribe(ports => {
          const portsData = ports.map(p => p.toJSON());
          setPortfolios(portsData);
          if (portsData.length > 0 && !activePortfolioId) {
            setActivePortfolioId(portsData[0].id);
          }
        });
        
        setConnectionStatus('online'); // Using local RxDB successfully
      } catch (e) {
        console.error("RxDB init error", e);
        setConnectionStatus('offline');
      }
    }
    initDb();
    
    return () => {
      if (subPortfolios) subPortfolios.unsubscribe();
    };
  }, []);

  // 2. Subscribe to Transactions and Fetch Live Market Quotes
  useEffect(() => {
    if (!activePortfolioId) return;
    let subTransactions;
    
    async function loadData() {
      const { getDatabase } = await import('./utils/db');
      const db = await getDatabase();
      
      subTransactions = db.transactions.find({
        selector: { portfolio_id: activePortfolioId }
      }).$.subscribe(async (txDocs) => {
        const txData = txDocs.map(t => {
          const raw = t.toJSON();
          return {
            ...raw,
            date: normalizeDate(raw.date)
          };
        });
        setTransactions(txData);

        
        // Fetch Live Market Data for these transactions via stateless proxy
        const uniqueSymbols = [...new Set(txData.map(t => t.symbol))];
        if (uniqueSymbols.length > 0) {
           try {
             const { fetchMarketQuotes, fetchFxRate } = await import('./utils/api');
             const [quotes, fxRate] = await Promise.all([
               fetchMarketQuotes(uniqueSymbols),
               fetchFxRate()
             ]);
             setAudUsdRate(fxRate);
             setQuotesLoaded(true);

             // Get current portfolio target allocations
             const activePort = await db.portfolios.findOne(activePortfolioId).exec();
             const targetAlloc = activePort ? activePort.target_allocation : {};

             setAssets(prev => {
                const newAssets = { ...prev };
                uniqueSymbols.forEach(sym => {
                   if (quotes[sym]) {
                       newAssets[sym] = {
                          ...quotes[sym],
                          targetWeight: targetAlloc[sym] || 0
                       };
                   }
                });
                return newAssets;
             });
           } catch(e) {
             console.warn("Market proxy offline, relying on cached assets", e);
             setConnectionStatus('offline');
           }
        }
      });
    }
    
    loadData();
    
    // Watchlist fallback
    const localWatch = localStorage.getItem('nova_watchlist');
    setWatchlist(localWatch ? JSON.parse(localWatch) : MOCK_WATCHLIST);
    
    return () => {
      if (subTransactions) subTransactions.unsubscribe();
    };
  }, [activePortfolioId]);

  useEffect(() => {
    localStorage.setItem('nova_watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Helper: convert between AUD and USD using live rate
  // audUsdRate = how many USD per 1 AUD (e.g. 0.645)
  const convert = (amount, from, to) => {
    if (from === to) return amount;
    if (from === 'AUD' && to === 'USD') return amount * audUsdRate;
    if (from === 'USD' && to === 'AUD') return amount / audUsdRate;
    return amount;
  };

  // Perform main portfolio calculations
  const portfolio = useMemo(() => {
    const holdings = {};
    let totalDividendsReceivedInDisplay = 0;
    
    // Sort transactions chronologically for calculation safety
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Build a non-mutating local asset lookup that falls back to tx data when API hasn't loaded
    // IMPORTANT: never mutate the `assets` state object inside useMemo
    const workingAssets = { ...assets };

    // 1. Process transactions to determine active holdings
    sortedTx.forEach((tx) => {
      const sym = tx.symbol;

      // Seed a fallback entry only in the local copy, not in state
      if (!workingAssets[sym]) {
        workingAssets[sym] = {
          symbol: sym,
          name: sym.replace('.AX', ''),
          type: sym.endsWith('.AX') ? 'ASX Stock' : 'US Stock',
          // Use tx.price as current price ONLY as a placeholder until API responds
          currentPrice: tx.price,
          prevClose: tx.price,
          currency: tx.currency,
          targetWeight: 0,
          sector: CURATED_SECTORS[sym] || 'Other',
          industry: sym.includes('VAS') || sym.includes('VGS') ? 'Diversified' : 'Other'
        };
      }

      const assetMeta = workingAssets[sym];

      if (tx.type === 'DIVIDEND') {
        const dividendAmountInDisplay = convert(tx.shares * tx.price, tx.currency, displayCurrency);
        totalDividendsReceivedInDisplay += dividendAmountInDisplay;
        return;
      }

      if (!holdings[sym]) {
        const rawSector = assetMeta.sector || CURATED_SECTORS[sym] || 'Other';
        const rawIndustry = assetMeta.industry || (sym.includes('VAS') || sym.includes('VGS') ? 'Diversified' : 'Other');
        const calculatedTheme = determineTheme(rawSector, rawIndustry);

        holdings[sym] = {
          symbol: sym,
          name: assetMeta.name,
          // costCurrency: the currency the cost was actually paid in (from tx, e.g. AUD for CommSec).
          // priceCurrency: the live quote currency from the API (USD for US stocks, AUD for ASX).
          // These must be kept separate so P&L is computed correctly.
          costCurrency: tx.currency,
          priceCurrency: assetMeta.currency || tx.currency,
          shares: 0,
          totalCostBasisLocal: 0,
          currentPrice: assetMeta.currentPrice,
          prevClose: assetMeta.prevClose,
          targetWeight: assetMeta.targetWeight || 0,
          market: sym.endsWith('.AX') ? 'ASX' : 'US',
          sector: rawSector,
          industry: rawIndustry,
          theme: calculatedTheme
        };
      }

      const holding = holdings[sym];

      if (tx.type === 'BUY') {
        holding.shares += tx.shares;
        holding.totalCostBasisLocal += (tx.shares * tx.price) + tx.fee;
      } else if (tx.type === 'SELL') {
        const avgCostBeforeSell = holding.shares > 0 ? (holding.totalCostBasisLocal / holding.shares) : 0;
        holding.shares -= tx.shares;
        holding.totalCostBasisLocal = holding.shares * avgCostBeforeSell;
      }

      if (holding.shares <= 0) {
        delete holdings[sym];
      }
    });

    // 2. Aggregate holdings value and P&L
    let totalCostBasisDisplay = 0;
    let totalMarketValueDisplay = 0;
    let totalPrevCloseValueDisplay = 0;

    Object.keys(holdings).forEach((sym) => {
      const h = holdings[sym];
      h.avgPrice = h.shares > 0 ? (h.totalCostBasisLocal / h.shares) : 0;

      // Cost basis: convert from costCurrency (what was actually paid) to displayCurrency.
      // For CommSec imports: costCurrency=AUD → no conversion needed when displayCurrency=AUD.
      h.totalCostBasis = convert(h.totalCostBasisLocal, h.costCurrency, displayCurrency);

      // Market value: convert from priceCurrency (live quote currency) to displayCurrency.
      // US stocks: priceCurrency=USD → divide by audUsdRate.
      // ASX stocks: priceCurrency=AUD → no conversion.
      h.marketValueLocal = h.shares * h.currentPrice;
      h.marketValue = convert(h.marketValueLocal, h.priceCurrency, displayCurrency);
      h.marketValuePrevClose = convert(h.shares * h.prevClose, h.priceCurrency, displayCurrency);

      // P&L: market value minus cost, both in display currency — now correct.
      h.gainLoss = h.marketValue - h.totalCostBasis;
      h.gainLossPercent = h.totalCostBasis > 0 ? (h.gainLoss / h.totalCostBasis) * 100 : 0;

      // Daily Change
      h.dailyChange = h.marketValue - h.marketValuePrevClose;
      h.dailyChangePercent = h.marketValuePrevClose > 0 ? (h.dailyChange / h.marketValuePrevClose) * 100 : 0;

      totalCostBasisDisplay += h.totalCostBasis;
      totalMarketValueDisplay += h.marketValue;
      totalPrevCloseValueDisplay += h.marketValuePrevClose;
    });

    // Per-holding breakdown and metrics calculated successfully


    // 3. Calculate weights and allocation
    Object.values(holdings).forEach((h) => {
      h.weightPercent = totalMarketValueDisplay > 0 ? (h.marketValue / totalMarketValueDisplay) * 100 : 0;
    });

    // 4. Calculate general metrics
    const totalProfitLossDisplay = totalMarketValueDisplay + totalDividendsReceivedInDisplay - totalCostBasisDisplay;
    const totalProfitLossPercent = totalCostBasisDisplay > 0 ? (totalProfitLossDisplay / totalCostBasisDisplay) * 100 : 0;

    const dailyChangeDisplay = totalMarketValueDisplay - totalPrevCloseValueDisplay;
    const dailyChangePercent = totalPrevCloseValueDisplay > 0 ? (dailyChangeDisplay / totalPrevCloseValueDisplay) * 100 : 0;

    // Dividend Yield: trailing 12-month dividends / current market value (annualised)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const trailing12mDividends = sortedTx
      .filter(tx => tx.type === 'DIVIDEND' && new Date(tx.date) >= twelveMonthsAgo)
      .reduce((sum, tx) => sum + convert(tx.shares * tx.price, tx.currency, displayCurrency), 0);
    const dividendYield = totalMarketValueDisplay > 0 ? (trailing12mDividends / totalMarketValueDisplay) * 100 : 0;

    // 5. XIRR — only include non-zero cash flows to avoid Newton-Raphson noise
    const cashFlows = [];
    sortedTx.forEach((tx) => {
      const flowAmountLocal = tx.shares * tx.price;
      let flowAmountDisplay = null;

      if (tx.type === 'BUY') {
        flowAmountDisplay = -convert(flowAmountLocal + (tx.fee || 0), tx.currency, displayCurrency);
      } else if (tx.type === 'SELL') {
        flowAmountDisplay = convert(flowAmountLocal - (tx.fee || 0), tx.currency, displayCurrency);
      } else if (tx.type === 'DIVIDEND') {
        flowAmountDisplay = convert(flowAmountLocal, tx.currency, displayCurrency);
      }

      // Skip zero / null flows — they add nothing and destabilise the solver
      if (flowAmountDisplay !== null && flowAmountDisplay !== 0) {
        cashFlows.push({ date: new Date(tx.date), amount: flowAmountDisplay });
      }
    });

    // Terminal value: today's portfolio worth is the final positive cash flow
    if (totalMarketValueDisplay > 0) {
      cashFlows.push({ date: new Date(), amount: totalMarketValueDisplay });
    }

    const xirr = calculateXIRR(cashFlows);

    // 6. Sharpe & Sortino — derived from actual XIRR performance
    // Without a daily/monthly price history, we approximate using the realised annualised
    // return (XIRR) and standard equity volatility assumptions.
    // Sharpe uses TOTAL volatility (18%); Sortino uses DOWNSIDE-ONLY vol (~12%, since
    // equity returns are right-skewed — upside vol is greater than downside vol).
    const riskFreeRate = 0.042; // ~4.2% AU cash rate (RBA approx)
    const assumedAnnualVolatility    = 0.18;  // total vol — used for Sharpe
    const assumedDownsideVolatility  = 0.12;  // downside vol (~67% of total) — used for Sortino
    const sharpeRatio  = assumedAnnualVolatility   > 0 ? (xirr - riskFreeRate) / assumedAnnualVolatility   : 0;
    const sortinoRatio = assumedDownsideVolatility > 0 ? (xirr - riskFreeRate) / assumedDownsideVolatility : 0;

    // 7. Alpha — CAPM vs a blended benchmark weighted by AUD/USD portfolio split
    // ASX 200 historical CAGR ~8.5%, S&P 500 ~10.5%
    // Weight benchmark by proportion of cost basis held in AUD (ASX) vs USD (US) stocks
    const totalCostAUD = Object.values(holdings).reduce(
      (sum, h) => sum + (h.costCurrency === 'AUD' ? h.totalCostBasisLocal : 0), 0
    );
    const audFraction = totalCostBasisDisplay > 0 ? totalCostAUD / totalCostBasisDisplay : 0.6;
    const blendedBenchmark = audFraction * 0.085 + (1 - audFraction) * 0.105;
    const alpha = calculateAlpha(xirr, blendedBenchmark);

    return {
      holdings,
      totalCostBasis: totalCostBasisDisplay,
      totalMarketValue: totalMarketValueDisplay,
      totalProfitLoss: totalProfitLossDisplay,
      totalProfitLossPercent,
      dailyChange: dailyChangeDisplay,
      dailyChangePercent,
      dividendYield,
      xirr,
      sharpeRatio,
      sortinoRatio,
      alpha,
      totalDividends: totalDividendsReceivedInDisplay
    };
  }, [transactions, displayCurrency, assets, audUsdRate, quotesLoaded]);

  const historicalPerformance = useMemo(() => {
    if (!historyPrices || transactions.length === 0) return [];

    const dateMapSource = historyPrices['AUDUSD=X'] || historyPrices['^GSPC'] || {};
    const sortedDates = Object.keys(dateMapSource).sort((a, b) => new Date(a) - new Date(b));
    if (sortedDates.length === 0) return [];

    const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstTxDate = sortedTx[0]?.date;
    
    const getPriceOnOrBefore = (symbol, targetDate) => {
      const priceHistory = historyPrices[symbol];
      if (!priceHistory) return null;
      if (priceHistory[targetDate] !== undefined) return priceHistory[targetDate];

      const dates = Object.keys(priceHistory).sort();
      let bestDate = null;
      for (let i = 0; i < dates.length; i++) {
        if (dates[i] <= targetDate) {
          bestDate = dates[i];
        } else {
          break;
        }
      }
      return bestDate ? priceHistory[bestDate] : null;
    };

    const baseDate = sortedDates.find(d => d >= firstTxDate) || sortedDates[0];
    const baseSP500 = getPriceOnOrBefore('^GSPC', baseDate) || 5000;
    const baseASX200 = getPriceOnOrBefore('^AXJO', baseDate) || 8000;

    const result = [];
    
    sortedDates.forEach((date) => {
      const holdings = {};

      sortedTx.forEach((tx) => {
        if (tx.date > date) return;

        const sym = tx.symbol;
        if (tx.type === 'DIVIDEND') {
          const fxRateTx = getPriceOnOrBefore('AUDUSD=X', tx.date) || audUsdRate;
          const convertTx = (amount, from, to) => {
            if (from === to) return amount;
            if (from === 'AUD' && to === 'USD') return amount * fxRateTx;
            if (from === 'USD' && to === 'AUD') return amount / fxRateTx;
            return amount;
          };
          const divAmount = convertTx(tx.shares * tx.price, tx.currency, displayCurrency);
          return;
        }

        if (!holdings[sym]) {
          holdings[sym] = {
            symbol: sym,
            shares: 0,
            totalCostBasisLocal: 0,
            costCurrency: tx.currency,
          };
        }

        const h = holdings[sym];
        if (tx.type === 'BUY') {
          h.shares += tx.shares;
          h.totalCostBasisLocal += (tx.shares * tx.price) + tx.fee;
        } else if (tx.type === 'SELL') {
          const avgCostBeforeSell = h.shares > 0 ? (h.totalCostBasisLocal / h.shares) : 0;
          h.shares -= tx.shares;
          h.totalCostBasisLocal = h.shares * avgCostBeforeSell;
        }

        if (h.shares <= 0) {
          delete holdings[sym];
        }
      });

      if (Object.keys(holdings).length === 0 && result.length === 0) {
        return;
      }

      let totalMarketValueDisplay = 0;
      let totalInvestedCostDisplay = 0;
      const fxRateOnDate = getPriceOnOrBefore('AUDUSD=X', date) || 0.645;
      
      const convertOnDate = (amount, from, to) => {
        if (from === to) return amount;
        if (from === 'AUD' && to === 'USD') return amount * fxRateOnDate;
        if (from === 'USD' && to === 'AUD') return amount / fxRateOnDate;
        return amount;
      };

      let audCostBasisOnDate = 0;
      Object.keys(holdings).forEach((sym) => {
        const h = holdings[sym];
        if (h.shares <= 0) return;

        const costBasisDisplay = convertOnDate(h.totalCostBasisLocal, h.costCurrency, displayCurrency);
        totalInvestedCostDisplay += costBasisDisplay;
        if (h.costCurrency === 'AUD') {
          audCostBasisOnDate += costBasisDisplay;
        }

        const priceCurrency = sym.endsWith('.AX') ? 'AUD' : 'USD';
        const rawPrice = getPriceOnOrBefore(sym, date);
        
        if (rawPrice !== null) {
          const mktValDisplay = convertOnDate(h.shares * rawPrice, priceCurrency, displayCurrency);
          totalMarketValueDisplay += mktValDisplay;
        } else {
          totalMarketValueDisplay += costBasisDisplay;
        }
      });

      const currentSP500 = getPriceOnOrBefore('^GSPC', date) || baseSP500;
      const currentASX200 = getPriceOnOrBefore('^AXJO', date) || baseASX200;

      const returnSP500 = baseSP500 > 0 ? (currentSP500 / baseSP500) - 1 : 0;
      const returnASX200 = baseASX200 > 0 ? (currentASX200 / baseASX200) - 1 : 0;

      const audFraction = totalInvestedCostDisplay > 0 ? audCostBasisOnDate / totalInvestedCostDisplay : 0.6;
      const returnBlended = (audFraction * returnASX200) + ((1 - audFraction) * returnSP500);

      const benchmarkValueDisplay = totalInvestedCostDisplay * (1 + returnBlended);

      result.push({
        date,
        value: parseFloat(totalMarketValueDisplay.toFixed(2)),
        benchmarkValue: parseFloat(benchmarkValueDisplay.toFixed(2)),
      });
    });

    return result;
  }, [transactions, displayCurrency, historyPrices, audUsdRate]);

  // Operations
  const handleAddTransaction = async (newTx) => {
    try {
      const { getDatabase } = await import('./utils/db');
      const db = await getDatabase();
      await db.transactions.insert({
        ...newTx,
        id: `tx-${Date.now()}`,
        portfolio_id: activePortfolioId
      });
    } catch (e) {
      alert(`Failed to add transaction: ${e.message}`);
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      const { getDatabase } = await import('./utils/db');
      const db = await getDatabase();
      const tx = await db.transactions.findOne(id).exec();
      if (tx) await tx.remove();
    } catch (e) {
      alert(`Failed to delete: ${e.message}`);
    }
  };

  const handleImportTransactions = async (importedList, file = null) => {
    try {
      const { getDatabase } = await import('./utils/db');
      const db = await getDatabase();
      const insertData = importedList.map(tx => ({
        ...tx,
        portfolio_id: activePortfolioId
      }));
      await db.transactions.bulkInsert(insertData);
      alert(`Successfully imported ${insertData.length} transactions into local secure vault.`);
    } catch (e) {
      alert(`Failed to import: ${e.message}`);
    }
  };

  const handleUpdateTargetWeight = async (symbol, targetWeight) => {
    // 1. Update UI state immediately
    setAssets((prev) => {
      const updated = { ...prev };
      if (updated[symbol]) {
        updated[symbol] = { ...updated[symbol], targetWeight };
      }
      return updated;
    });

    // 2. Persist to RxDB
    try {
      const { getDatabase } = await import('./utils/db');
      const db = await getDatabase();
      const port = await db.portfolios.findOne(activePortfolioId).exec();
      if (port) {
         const newAlloc = { ...port.target_allocation, [symbol]: targetWeight };
         await port.patch({ target_allocation: newAlloc });
      }
    } catch (e) {
      console.error("Failed to update target weight in RxDB", e);
    }
  };

  const handleAddWatchItem = (item) => {
    setWatchlist((prev) => [...prev, item]);
  };

  const handleDeleteWatchItem = (symbol) => {
    setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
  };

  const handleQuickBuy = (symbol) => {
    setActiveTab('transactions');
    // Set form fields automatically by triggering an alert or storing symbol
    // To make it simple, we focus on transactions and let them add it
  };

  return (
    <div className="min-h-screen text-gray-200 flex flex-col font-sans">
      {/* Background radial glow */}
      <div className="fixed inset-0 bg-[#030712] z-[-10]">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        displayCurrency={displayCurrency} 
        setDisplayCurrency={setDisplayCurrency} 
        connectionStatus={connectionStatus}
      />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Metric Cards Grid */}
        {activeTab === 'dashboard' && (
          <>
            {/* Loading skeleton – shown until first live market quote arrives */}
            {!quotesLoaded && transactions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="glass-card rounded-3xl p-6 border border-gray-800/60 animate-pulse space-y-3">
                    <div className="h-3 w-1/2 bg-gray-700 rounded-full" />
                    <div className="h-8 w-3/4 bg-gray-700 rounded-full" />
                    <div className="h-3 w-1/3 bg-gray-800 rounded-full" />
                  </div>
                ))}
              </div>
            )}
            {/* Live metric cards, charts, table – only rendered once quotes are loaded */}
            {quotesLoaded && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <MetricCard 
                    title="Total Portfolio Value"
                    value={`${displayCurrency} ${portfolio.totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subtext={`Total Cost: ${displayCurrency} ${portfolio.totalCostBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    trend={portfolio.dailyChange >= 0 ? 'positive' : 'negative'}
                    trendValue={formatPercent(portfolio.dailyChangePercent, 3, true)}
                    icon={DollarSign}
                    infoText="Current valuation of all your equity holdings converted to your selected view currency."
                    accentColor="blue"
                  />
                  <MetricCard 
                    title="Total Return (All-Time)"
                    value={`${displayCurrency} ${portfolio.totalProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subtext={`Dividends: +${displayCurrency} ${portfolio.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    trend={portfolio.totalProfitLoss >= 0 ? 'positive' : 'negative'}
                    trendValue={formatPercent(portfolio.totalProfitLossPercent, 3, true)}
                    icon={TrendingUp}
                    infoText="All-time capital appreciation plus cash dividends received, net of transaction fees."
                    accentColor="violet"
                  />
                  <MetricCard 
                    title="Annualized Return (XIRR)"
                    value={formatPercent(portfolio.xirr * 100, 3)}
                    subtext="Money-weighted CAGR"
                    trend={portfolio.xirr >= 0 ? 'positive' : 'negative'}
                    trendValue="Annualized"
                    icon={Percent}
                    infoText="Internal Rate of Return (XIRR): money-weighted annualised return accounting for the exact timing and size of every buy, sell and dividend. Includes today's unrealised market value as the terminal cash flow."
                    accentColor="emerald"
                  />
                  <MetricCard 
                    title="Sharpe Ratio (Approx)"
                    value={formatDecimal(portfolio.sharpeRatio, 3)}
                    subtext={portfolio.sharpeRatio > 1.5 ? 'Excellent risk-adj return' : portfolio.sharpeRatio > 0.5 ? 'Acceptable risk-adj return' : 'Below benchmark'}
                    trend={portfolio.sharpeRatio >= 1.0 ? 'positive' : 'neutral'}
                    trendValue="Sharpe"
                    icon={ShieldAlert}
                    infoText="Approximated Sharpe Ratio = (XIRR − RBA cash rate 4.2%) ÷ 18% assumed equity volatility. A true Sharpe requires a daily price history, which is unavailable without a market data subscription."
                    accentColor="amber"
                  />
                  <MetricCard
                    title="Sortino Ratio (Approx)"
                    value={formatDecimal(portfolio.sortinoRatio, 3)}
                    subtext={portfolio.sortinoRatio > 2.0 ? 'Excellent downside protection' : portfolio.sortinoRatio > 1.0 ? 'Good downside protection' : 'Monitor drawdown risk'}
                    trend={portfolio.sortinoRatio >= 1.0 ? 'positive' : 'neutral'}
                    trendValue="Sortino"
                    icon={ShieldAlert}
                    infoText="Approximated Sortino Ratio = (XIRR − 4.2%) ÷ 12% assumed downside volatility. Unlike Sharpe, Sortino only penalises downside swings — so strong upside gains don't lower your score. Higher is better."
                    accentColor="teal"
                  />
                  <MetricCard 
                    title="Portfolio Alpha"
                    value={formatPercent(portfolio.alpha * 100, 3, true)}
                    subtext="vs Blended ASX200 / S&P500"
                    trend={portfolio.alpha >= 0 ? 'positive' : 'negative'}
                    trendValue="Skill"
                    icon={Award}
                    infoText="CAPM Alpha: your XIRR minus the expected return from a passive blend of ASX 200 (8.5% CAGR) and S&P 500 (10.5% CAGR), weighted by your actual AUD vs USD cost basis split."
                    accentColor="violet"
                  />
                  <MetricCard 
                    title="Dividend Yield (TTM)"
                    value={formatPercent(portfolio.dividendYield, 3)}
                    subtext={`All-time dividends: ${displayCurrency} ${portfolio.totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    trend="neutral"
                    trendValue="Cashflow"
                    icon={Calendar}
                    infoText="Trailing 12-month dividend income divided by current portfolio market value. All-time total is shown as subtext for reference."
                    accentColor="blue"
                  />
                </div>

                {/* Performance charts */}
                <PerformanceChart 
                  historicalData={historicalPerformance} 
                  historyLoading={historyLoading}
                  historyError={historyError}
                  currentAllocation={portfolio.holdings} 
                  currency={displayCurrency} 
                />

                {/* Holding table */}
                <HoldingTable 
                  holdings={portfolio.holdings} 
                  currency={displayCurrency} 
                  onUpdateTargetWeight={handleUpdateTargetWeight} 
                />
              </>
            )}
          </>
        )}

        {activeTab === 'transactions' && (
          <TransactionHistory 
            transactions={transactions} 
            onAddTransaction={handleAddTransaction} 
            onDeleteTransaction={handleDeleteTransaction}
            onImportTransactions={handleImportTransactions}
          />
        )}

        {activeTab === 'watchlist' && (
          <Watchlist 
            watchlist={watchlist} 
            onAddWatchItem={handleAddWatchItem} 
            onDeleteWatchItem={handleDeleteWatchItem}
            onQuickBuy={handleQuickBuy}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-900 bg-gray-950/40 py-6 mt-12 text-center text-xs text-gray-500 font-semibold">
        <p>&copy; {new Date().getFullYear()} NovaPortfolio. Built with React & Tailwind CSS v4. All rights reserved.</p>
      </footer>
    </div>
  );
}
