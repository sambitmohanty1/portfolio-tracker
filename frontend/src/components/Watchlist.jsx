import React, { useState } from 'react';
import { Plus, Trash2, ArrowUpRight, ArrowDownRight, Eye, Sparkles } from 'lucide-react';
import { fetchMarketQuotes } from '../utils/api';

const COMPANY_ALIASES = {
  'APPLE': 'AAPL',
  'WALMART': 'WMT',
  'WAL-MART': 'WMT',
  'GOOGLE': 'GOOGL',
  'ALPHABET': 'GOOGL',
  'MICROSOFT': 'MSFT',
  'AMAZON': 'AMZN',
  'TESLA': 'TSLA',
  'NETFLIX': 'NFLX',
  'FACEBOOK': 'META',
  'META': 'META',
  'NVIDIA': 'NVDA',
  'COMMONWEALTH BANK': 'CBA.AX',
  'CBA': 'CBA.AX',
  'BHP': 'BHP.AX',
  'ANZ': 'ANZ.AX',
  'NAB': 'NAB.AX',
  'WESTPAC': 'WBC.AX',
  'CSL': 'CSL.AX',
  'WOOLWORTHS': 'WOW.AX',
  'WOW': 'WOW.AX',
  'COLES': 'COL.AX',
  'COL': 'COL.AX',
  'WESFARMERS': 'WES.AX',
  'WES': 'WES.AX',
  'VANGUARD INDEX': 'VAS.AX',
  'VAS': 'VAS.AX',
  'VGS': 'VGS.AX',
};

export default function Watchlist({ watchlist, onAddWatchItem, onDeleteWatchItem, onQuickBuy }) {
  const [symbol, setSymbol] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!symbol) return;
    
    setError('');
    const rawInput = symbol.trim().toUpperCase();
    
    // Resolve alias if present
    let cleanSymbol = COMPANY_ALIASES[rawInput] || rawInput;
    
    // Check if already in watchlist
    if (watchlist.some(item => item.symbol === cleanSymbol)) {
      setError('Ticker already in watchlist.');
      return;
    }

    setLoading(true);
    try {
      const quotes = await fetchMarketQuotes([cleanSymbol]);
      const quote = quotes[cleanSymbol];
      
      if (quote) {
        const change = quote.currentPrice - quote.prevClose;
        const changePercent = quote.prevClose > 0 ? (change / quote.prevClose) * 100 : 0;
        
        onAddWatchItem({
          symbol: cleanSymbol,
          name: quote.name || cleanSymbol,
          type: quote.type || (cleanSymbol.endsWith('.AX') ? 'ASX Stock' : 'US Stock'),
          price: quote.currentPrice,
          change,
          changePercent,
          currency: quote.currency || (cleanSymbol.endsWith('.AX') ? 'AUD' : 'USD')
        });
        
        setSymbol('');
      } else {
        setError(`Ticker symbol "${cleanSymbol}" not found. Try adding a suffix for ASX (e.g., CBA.AX).`);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch real-time quote for symbol.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left Column: Form */}
      <div>
        <div className="glass-card rounded-3xl p-6 border border-gray-800/60 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
            <Eye className="h-5 w-5 text-blue-400" />
            <span>Watch Ticker</span>
          </h2>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            Monitor stocks and ETFs before allocating capital. Add tickers from US and ASX markets.
          </p>

          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Ticker / Symbol</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  required
                  disabled={loading}
                  placeholder="e.g. apple, WMT, CBA.AX"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="flex-grow bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition-all duration-300 shadow-md hover:shadow-blue-500/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[40px]"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
              </div>
              {error && <span className="block text-[11px] font-semibold text-rose-400 mt-1">{error}</span>}
            </div>
          </form>

          {/* Quick Tips */}
          <div className="mt-6 bg-gray-950/40 border border-gray-800/80 rounded-2xl p-4">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center mb-1.5">
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Premium Tip
            </span>
            <p className="text-[11px] font-medium leading-relaxed text-gray-400">
              Suffix ASX stocks with <code className="bg-gray-800 text-blue-300 px-1 py-0.5 rounded text-[10px] font-mono">.AX</code> to map price conversions in AUD (e.g., VAS.AX). US stocks default to USD.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column: List Table */}
      <div className="lg:col-span-2">
        <div className="glass-card rounded-3xl border border-gray-800/60 overflow-hidden shadow-xl">
          <div className="px-6 py-5 border-b border-gray-800/50">
            <h2 className="text-lg font-bold text-white">Watchlist</h2>
            <p className="text-xs text-gray-400 mt-0.5">Real-time status updates on assets you are tracking.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  <th className="py-4 px-6">Asset</th>
                  <th className="py-4 px-6">Type</th>
                  <th className="py-4 px-6 text-right">Price</th>
                  <th className="py-4 px-6 text-right">Change</th>
                  <th className="py-4 px-6 text-center">Trade</th>
                  <th className="py-4 px-6 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 text-sm font-medium text-gray-200">
                {watchlist.length > 0 ? (
                  watchlist.map((item) => {
                    const isPositive = item.change >= 0;
                    return (
                      <tr key={item.symbol} className="hover:bg-gray-800/20 transition-colors duration-200">
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center font-bold text-xs text-violet-400">
                              {item.symbol.replace('.AX', '')}
                            </div>
                            <div>
                              <span className="block text-sm font-bold text-white">{item.symbol}</span>
                              <span className="block text-xs text-gray-400 max-w-[180px] truncate">{item.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded">
                            {item.type}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-white">
                          {item.currency} {item.price.toFixed(2)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={`inline-flex items-center font-bold text-xs ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {isPositive ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                            {item.changePercent.toFixed(2)}%
                          </span>
                          <span className="block text-[10px] text-gray-500 font-bold">
                            {isPositive ? '+' : ''}{item.change.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => onQuickBuy(item.symbol)}
                            className="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 hover:scale-[1.02]"
                          >
                            Buy
                          </button>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => onDeleteWatchItem(item.symbol)}
                            className="text-gray-500 hover:text-rose-400 p-1 hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 px-6 text-center text-gray-500 font-medium">
                      Watchlist is empty. Add a symbol above to track it.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
