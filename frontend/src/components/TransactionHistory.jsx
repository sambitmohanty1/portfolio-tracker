import React, { useState, useRef } from 'react';
import { Upload, Plus, Trash2, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

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

export default function TransactionHistory({ 
  transactions, 
  onAddTransaction, 
  onDeleteTransaction, 
  onImportTransactions,
  prefilledSymbol,
  clearPrefilledSymbol
}) {
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState('BUY');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('9.95');
  const [currency, setCurrency] = useState('AUD');
  
  const [csvStatus, setCsvStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const symbolInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        const mockEvent = { target: { files: [file] } };
        handleCsvUpload(mockEvent);
      } else {
        setCsvStatus({
          type: 'error',
          message: 'Unsupported file type. Please drop a standard CSV file.'
        });
      }
    }
  };

  React.useEffect(() => {
    if (prefilledSymbol) {
      setSymbol(prefilledSymbol);
      // Pre-fill default currency based on exchange suffix
      setCurrency(prefilledSymbol.endsWith('.AX') ? 'AUD' : 'USD');
      
      // Clear parent state so it doesn't re-trigger when returning to tab
      clearPrefilledSymbol();

      // Focus on the input field
      setTimeout(() => {
        if (symbolInputRef.current) {
          symbolInputRef.current.focus();
        }
      }, 50);
    }
  }, [prefilledSymbol, clearPrefilledSymbol]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!symbol || !shares || !price) return;

    onAddTransaction({
      symbol: symbol.toUpperCase().trim(),
      type,
      date,
      shares: parseFloat(shares),
      price: parseFloat(price),
      fee: parseFloat(fee) || 0,
      currency
    });

    // Reset fields
    setSymbol('');
    setShares('');
    setPrice('');
  };

  // Flexible CSV Parser
  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');
        if (lines.length < 2) {
          throw new Error("CSV file must contain a header row and at least one data row.");
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
        
        // Find column indices based on ordered regex mapping (exact match preferred)
        const findCol = (regexes) => {
            for (let rx of regexes) {
                let idx = headers.findIndex(h => rx.test(h));
                if (idx !== -1) return idx;
            }
            return -1;
        };

        let symbolIdx = findCol([/^(ticker|symbol|code)$/i, /ticker|symbol|asset|code|stock/i]);
        let typeIdx = findCol([/^(type|action)$/i, /type|transaction|action|buy|sell/i]);
        let dateIdx = findCol([/^(date|time)$/i, /date|time|when/i]);
        let sharesIdx = findCol([/^(qty|quantity|units held|units)$/i, /share|qty|quantity|volume|unit|amount/i]);
        let priceIdx = findCol([/^(price|avg price|net avg pr)$/i, /price|cost|avg/i]);
        const feeIdx = findCol([/^(fee|brokerage)$/i, /fee|brokerage|commission/i]);
        const currencyIdx = findCol([/^(currency|ccy)$/i, /currency|ccy/i]);
        const fxRateIdx = findCol([/^(fx rate|fx|exchange rate|rate)$/i, /fx.?rate|exchange.?rate/i]);

        // Data Inference Fallback: If headers are completely custom, look at the first row's data types
        if (symbolIdx === -1 || sharesIdx === -1 || priceIdx === -1) {
          const firstRow = lines[1].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/["']/g, ''));
          const numberCols = [];
          
          firstRow.forEach((val, idx) => {
             // Look for Symbol (short strings, e.g. AAPL, VAS.AX)
             if (symbolIdx === -1 && /^[A-Z0-9\.\-]{1,10}$/i.test(val) && isNaN(Number(val))) {
                symbolIdx = idx;
             }
             // Look for Date (parseable dates)
             if (dateIdx === -1 && !isNaN(Date.parse(val)) && val.length >= 8 && isNaN(Number(val))) {
                dateIdx = idx;
             }
             // Look for Transaction Type
             if (typeIdx === -1 && /buy|sell|dividend/i.test(val)) {
                typeIdx = idx;
             }
             // Track number columns
             if (!isNaN(parseFloat(val)) && isFinite(val) && val !== '') {
                numberCols.push(idx);
             }
          });

          // Assign first two number columns to Shares and Price if not found
          if (numberCols.length >= 2) {
             if (sharesIdx === -1) sharesIdx = numberCols[0];
             if (priceIdx === -1) priceIdx = numberCols[1];
          } else if (numberCols.length === 1) {
             if (sharesIdx === -1) sharesIdx = numberCols[0];
             if (priceIdx === -1) priceIdx = numberCols[0]; // Edge case fallback
          }
        }

        if (symbolIdx === -1 || sharesIdx === -1 || priceIdx === -1) {
          throw new Error(`Could not determine column mappings automatically. Detected Symbol: ${symbolIdx !== -1 ? 'Yes' : 'No'}, Shares: ${sharesIdx !== -1 ? 'Yes' : 'No'}, Price: ${priceIdx !== -1 ? 'Yes' : 'No'}. Please ensure columns are labelled clearly.`);
        }

        const parsedTransactions = [];
        for (let i = 1; i < lines.length; i++) {
          // Handle comma inside quoted fields if any
          const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/["']/g, ''));
          
          if (cols.length <= Math.max(symbolIdx, sharesIdx, priceIdx)) continue; // Skip incomplete lines

          let rawTicker = cols[symbolIdx].toUpperCase().trim();
          const rowFxRate = fxRateIdx !== -1 ? parseFloat(cols[fxRateIdx]) : null;

          // Step 1: Detect exchange from explicit broker suffix (:US, :AU, :AX)
          let explicitExchange = null;
          if (rawTicker.endsWith(':US')) {
            rawTicker = rawTicker.replace(':US', '');
            explicitExchange = 'US';
          } else if (rawTicker.endsWith(':AU') || rawTicker.endsWith(':AX')) {
            rawTicker = rawTicker.split(':')[0];
            explicitExchange = 'ASX';
          } else if (rawTicker.includes(':')) {
            rawTicker = rawTicker.split(':')[0]; // Strip any other unknown suffix
          }

          // Step 2: If no explicit suffix, use FX Rate to determine exchange.
          // FX Rate = 1 (or missing) → traded in AUD on ASX.
          // FX Rate in 0.4–0.99 range → USD-denominated US stock.
          let ticker;
          let isAsx = false;
          if (explicitExchange === 'ASX' || rawTicker.endsWith('.AX')) {
            ticker = rawTicker.endsWith('.AX') ? rawTicker : rawTicker + '.AX';
            isAsx = true;
          } else if (explicitExchange === 'US') {
            ticker = rawTicker;
            isAsx = false;
          } else if (rowFxRate !== null && !isNaN(rowFxRate)) {
            // FX rate present: rate ~1 means AUD/AUD (ASX), rate < 1 means AUD/USD (US stock)
            const isAsxByFx = rowFxRate >= 0.99;
            ticker = isAsxByFx ? rawTicker + '.AX' : rawTicker;
            isAsx = isAsxByFx;
          } else {
            // No FX rate column at all: default to ASX (most AU broker exports are local stocks)
            ticker = rawTicker + '.AX';
            isAsx = true;
          }

          const txType = typeIdx !== -1 ? cols[typeIdx].toUpperCase() : 'BUY';
          const txDate = normalizeDate(dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx] : new Date().toISOString().split('T')[0]);
          const txShares = parseFloat(cols[sharesIdx]);
          let txPrice = parseFloat(cols[priceIdx]);
          const txFee = feeIdx !== -1 ? parseFloat(cols[feeIdx]) || 0 : 0;

          // Determine transaction currency.
          // Key insight: CommSec (and most AU brokers) record the cost column ('Net Avg Pr Cost')
          // in AUD regardless of what exchange the stock is on. The FX Rate column is for
          // converting the current USD price → AUD, NOT for the cost basis.
          // If an FX Rate column exists in this CSV, the cost IS already in AUD.
          const brokerRecordsCostInAUD = fxRateIdx !== -1;
          let txCurrency;
          if (brokerRecordsCostInAUD) {
            txCurrency = 'AUD'; // All broker costs are in AUD
          } else if (currencyIdx !== -1 && cols[currencyIdx]) {
            txCurrency = cols[currencyIdx].toUpperCase();
          } else {
            txCurrency = isAsx ? 'AUD' : 'USD';
          }

          // DO NOT multiply price by FX rate. The cost column is already in AUD.
          // The FX rate was only used above for exchange detection (ASX vs US).

          if (ticker && !isNaN(txShares) && !isNaN(txPrice)) {
            parsedTransactions.push({
              id: `imported-${Date.now()}-${i}`,
              symbol: ticker,
              type: txType.includes('SELL') ? 'SELL' : txType.includes('DIV') ? 'DIVIDEND' : 'BUY',
              date: txDate,
              shares: txShares,
              price: txPrice,
              fee: txFee,
              currency: txCurrency
            });
          }
        }

        if (parsedTransactions.length === 0) {
          throw new Error("No valid transactions could be parsed from the CSV.");
        }

        onImportTransactions(parsedTransactions, file);
        setCsvStatus({
          type: 'success',
          message: `Successfully imported ${parsedTransactions.length} transactions from Google Sheets export.`
        });
      } catch (err) {
        setCsvStatus({
          type: 'error',
          message: err.message
        });
      }
    };
    
    reader.onerror = () => {
      setCsvStatus({ type: 'error', message: 'Failed to read file.' });
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Left: Input Form & CSV Upload */}
      <div className="space-y-6">
        
        {/* Manual Log Card */}
        <div className="glass-card rounded-3xl p-6 border border-gray-800/60 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
            <Plus className="h-5 w-5 text-blue-400" />
            <span>Log Transaction</span>
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Ticker / Symbol</label>
                <input
                  type="text"
                  required
                  ref={symbolInputRef}
                  placeholder="e.g. VAS.AX or AAPL"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Transaction Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="DIVIDEND">DIVIDEND</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                >
                  <option value="AUD">AUD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Shares</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.0"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Price</label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Fee</label>
                <input
                  type="number"
                  step="any"
                  placeholder="Brokerage"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg shadow-blue-600/10 active:scale-[0.98]"
            >
              Add to Ledger
            </button>
          </form>
        </div>

        {/* CSV Import Card */}
        <div className="glass-card rounded-3xl p-6 border border-gray-800/60 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
            <Upload className="h-5 w-5 text-violet-400" />
            <span>Google Sheets Import</span>
          </h2>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            Upload a CSV exported from your Google Finance tracking sheet. We will automatically map the tickers and transaction logs.
          </p>

          <div 
            onClick={() => fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 ${
              isDragging
                ? 'border-violet-500 bg-violet-600/10 shadow-lg shadow-violet-500/10 scale-[1.01]'
                : 'border-gray-800 hover:border-violet-500/50 bg-gray-950/20 hover:bg-violet-500/[0.02]'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleCsvUpload}
              accept=".csv" 
              className="hidden" 
            />
            <FileSpreadsheet className={`h-8 w-8 mx-auto mb-2.5 transition-colors ${
              isDragging ? 'text-violet-400 animate-bounce' : 'text-gray-500 group-hover:text-violet-400'
            }`} />
            <span className="block text-xs font-bold text-gray-300">
              {isDragging ? 'Drop CSV here!' : 'Choose or Drag CSV'}
            </span>
            <span className="block text-[10px] text-gray-500 mt-1 font-semibold">Supports loose column names</span>
          </div>

          {/* Status Message */}
          {csvStatus && (
            <div className={`mt-4 p-3.5 rounded-xl border flex items-start space-x-2.5 ${
              csvStatus.type === 'success' 
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
            }`}>
              {csvStatus.type === 'success' ? (
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-xs font-semibold leading-normal">{csvStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Transactions list */}
      <div className="lg:col-span-2">
        <div className="glass-card rounded-3xl border border-gray-800/60 overflow-hidden shadow-xl h-full flex flex-col">
          <div className="px-6 py-5 border-b border-gray-800/50">
            <h2 className="text-lg font-bold text-white">Transaction Ledger</h2>
            <p className="text-xs text-gray-400 mt-0.5">Historical list of buys, sells, and dividends.</p>
          </div>

          <div className="overflow-y-auto max-h-[500px] flex-grow">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-gray-950/95 backdrop-blur-md border-b border-gray-800 text-[10px] uppercase font-bold text-gray-400 tracking-wider z-10">
                <tr>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Ticker</th>
                  <th className="py-4 px-6">Action</th>
                  <th className="py-4 px-6 text-right">Shares</th>
                  <th className="py-4 px-6 text-right">Price</th>
                  <th className="py-4 px-6 text-right">Net Cashflow</th>
                  <th className="py-4 px-6 text-center">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40 text-sm font-medium text-gray-200">
                {transactions.length > 0 ? (
                  [...transactions]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map((tx) => {
                      // Calculate cash flow. BUYS are outflows (-), SELLS/DIVIDENDS are inflows (+)
                      const totalCost = tx.shares * tx.price;
                      let netCash = 0;
                      let badgeStyle = '';

                      if (tx.type === 'BUY') {
                        netCash = -(totalCost + tx.fee);
                        badgeStyle = 'bg-blue-500/10 text-blue-400';
                      } else if (tx.type === 'SELL') {
                        netCash = totalCost - tx.fee;
                        badgeStyle = 'bg-rose-500/10 text-rose-400';
                      } else if (tx.type === 'DIVIDEND') {
                        netCash = totalCost; // Dividend cash is pure inflow
                        badgeStyle = 'bg-emerald-500/10 text-emerald-400';
                      }

                      const flowSign = netCash >= 0 ? '+' : '';

                      return (
                        <tr key={tx.id} className="hover:bg-gray-800/10 transition-colors duration-150">
                          <td className="py-3.5 px-6 text-gray-400 text-xs font-semibold">{tx.date}</td>
                          <td className="py-3.5 px-6 font-bold text-white">{tx.symbol}</td>
                          <td className="py-3.5 px-6">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeStyle}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 text-right text-gray-300 font-semibold">
                            {tx.type === 'DIVIDEND' ? '-' : tx.shares.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-6 text-right text-gray-300">
                            {tx.currency} {tx.price.toFixed(2)}
                          </td>
                          <td className={`py-3.5 px-6 text-right font-bold ${netCash >= 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
                            {flowSign}{tx.currency} {Math.abs(netCash).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <button
                              onClick={() => onDeleteTransaction(tx.id)}
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
                    <td colSpan="7" className="py-12 px-6 text-center text-gray-500 font-medium">
                      No transactions recorded.
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
