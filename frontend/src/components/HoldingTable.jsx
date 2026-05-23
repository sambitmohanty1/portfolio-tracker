import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Edit2, Check, X, ShieldAlert, Folder, ChevronDown, ChevronRight } from 'lucide-react';

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

export default function HoldingTable({ holdings, currency, onUpdateTargetWeight }) {
  const [editingSymbol, setEditingSymbol] = useState(null);
  const [editValue, setEditValue] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState('marketValue'); // default sort by market value descending
  const [sortDirection, setSortDirection] = useState('desc');

  // Grouping state
  const [groupBy, setGroupBy] = useState('none'); // 'none', 'market', 'sector', 'theme'
  const [expandedGroups, setExpandedGroups] = useState({});

  // Return period toggle: 'allTime' or 'daily'
  const [returnPeriod, setReturnPeriod] = useState('allTime');

  const startEdit = (symbol, currentTarget) => {
    setEditingSymbol(symbol);
    setEditValue(currentTarget.toString());
  };

  const saveEdit = (symbol) => {
    const numericVal = parseFloat(editValue);
    if (!isNaN(numericVal) && numericVal >= 0 && numericVal <= 100) {
      onUpdateTargetWeight(symbol, numericVal);
    }
    setEditingSymbol(null);
  };

  const cancelEdit = () => {
    setEditingSymbol(null);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: prev[key] === false ? true : false
    }));
  };

  const isGroupExpanded = (key) => {
    return expandedGroups[key] !== false; // Default to true (expanded)
  };

  // 1. Process holdings array and apply sorting
  const sortedHoldings = [...Object.values(holdings)].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'gainLossPercent') {
      valA = returnPeriod === 'daily' ? (a.dailyChangePercent || 0) : (a.gainLossPercent || 0);
      valB = returnPeriod === 'daily' ? (b.dailyChangePercent || 0) : (b.gainLossPercent || 0);
    }

    if (sortField === 'symbol') {
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    valA = valA || 0;
    valB = valB || 0;
    return sortDirection === 'asc' ? valA - valB : valB - valA;
  });

  // 2. Render contents helper
  const renderRows = () => {
    const hasAssets = Object.values(holdings).length > 0;
    if (!hasAssets) {
      return (
        <tr>
          <td colSpan="9" className="py-12 px-6 text-center text-gray-500 font-medium">
            No assets currently held. Add or upload transactions to get started.
          </td>
        </tr>
      );
    }

    if (groupBy === 'none') {
      // Render flat list
      return sortedHoldings.map((holding) => renderHoldingRow(holding, false));
    }

    // Render grouped list
    const groups = {};
    sortedHoldings.forEach((holding) => {
      const groupKey = holding[groupBy] || 'Other';
      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          holdings: [],
          totalCost: 0,
          totalMarketValue: 0,
          totalGainLoss: 0,
          totalDailyChange: 0,
          totalMarketValuePrevClose: 0,
          totalWeight: 0,
        };
      }
      const g = groups[groupKey];
      g.holdings.push(holding);
      g.totalCost += holding.totalCostBasis;
      g.totalMarketValue += holding.marketValue;
      g.totalGainLoss += holding.gainLoss;
      g.totalDailyChange += (holding.dailyChange || 0);
      g.totalMarketValuePrevClose += (holding.marketValuePrevClose || 0);
      g.totalWeight += holding.weightPercent;
    });

    // Calculate group level gainLossPercent and dailyChangePercent
    Object.values(groups).forEach((g) => {
      g.gainLossPercent = g.totalCost > 0 ? (g.totalGainLoss / g.totalCost) * 100 : 0;
      g.dailyChangePercent = g.totalMarketValuePrevClose > 0 ? (g.totalDailyChange / g.totalMarketValuePrevClose) * 100 : 0;
    });

    // Sort groups by total market value descending
    const sortedGroups = Object.values(groups).sort((a, b) => b.totalMarketValue - a.totalMarketValue);

    return sortedGroups.map((g) => {
      const expanded = isGroupExpanded(g.key);
      const isGroupProfit = g.totalGainLoss >= 0;
      const isGroupDailyProfit = g.totalDailyChange >= 0;

      return (
        <React.Fragment key={`group-sec-${g.key}`}>
          {/* Group Header Row */}
          <tr 
            className="bg-gray-900/40 hover:bg-gray-900/60 cursor-pointer border-y border-gray-800/80 transition-colors"
            onClick={() => toggleGroup(g.key)}
          >
            <td className="py-3.5 px-6 font-bold text-gray-200 text-xs uppercase tracking-wider flex items-center space-x-2">
              <span className="text-gray-400">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
              <span>{g.key}</span>
              <span className="text-[10px] text-gray-500 font-bold bg-gray-950/65 px-1.5 py-0.5 rounded border border-gray-900">
                {g.holdings.length} {g.holdings.length === 1 ? 'asset' : 'assets'}
              </span>
            </td>
            <td className="py-3.5 px-6"></td>
            <td className="py-3.5 px-6"></td>
            <td className="py-3.5 px-6"></td>
            <td className="py-3.5 px-6 text-right text-xs font-semibold text-gray-400">
              {currency} {g.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="py-3.5 px-6 text-right text-xs font-bold text-white">
              {currency} {g.totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="py-3.5 px-6 text-right text-xs">
              {returnPeriod === 'daily' ? (
                <>
                  <span className={`font-bold ${isGroupDailyProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isGroupDailyProfit ? '▲ ' : '▼ '}{g.dailyChangePercent.toFixed(3)}%
                  </span>
                  <span className={`block text-[10px] font-bold ${isGroupDailyProfit ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                    {isGroupDailyProfit ? '+' : ''}{currency} {g.totalDailyChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="block text-[10px] text-gray-500 font-semibold mt-0.5">
                    Total: {g.gainLossPercent.toFixed(3)}% ({g.totalGainLoss >= 0 ? '+' : ''}{currency} {g.totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </>
              ) : (
                <>
                  <span className={`font-bold ${isGroupProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isGroupProfit ? '▲ ' : '▼ '}{g.gainLossPercent.toFixed(3)}%
                  </span>
                  <span className={`block text-[10px] font-bold ${isGroupProfit ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                    {isGroupProfit ? '+' : ''}{currency} {g.totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="block text-[10px] text-gray-500 font-semibold mt-0.5">
                    Today: {g.dailyChangePercent.toFixed(3)}% ({isGroupDailyProfit ? '+' : ''}{currency} {g.totalDailyChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </>
              )}
            </td>
            <td className="py-3.5 px-6 text-center">
              <span className="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] px-2 py-0.5 rounded font-bold">
                {g.totalWeight.toFixed(1)}%
              </span>
            </td>
            <td className="py-3.5 px-6 text-center"></td>
          </tr>

          {/* Group Child Asset Rows */}
          {expanded && g.holdings.map((holding) => renderHoldingRow(holding, true))}
        </React.Fragment>
      );
    });
  };

  const renderHoldingRow = (holding, isGrouped) => {
    const isProfit = holding.gainLoss >= 0;
    const isEditing = editingSymbol === holding.symbol;

    return (
      <tr 
        key={holding.symbol} 
        className={`hover:bg-gray-800/25 transition-colors duration-200 border-b border-gray-800/40 ${
          isGrouped ? 'bg-gray-950/15' : ''
        }`}
      >
        {/* Ticker & Name */}
        <td className={`py-4 px-6 ${isGrouped ? 'pl-10' : ''}`}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-center font-bold text-[10px] text-blue-400 shadow-inner">
              {holding.symbol.replace('.AX', '')}
            </div>
            <div>
              <span className="block text-xs font-bold text-white">{holding.symbol}</span>
              <span className="block text-[10px] text-gray-500 max-w-[120px] truncate">{holding.name}</span>
            </div>
          </div>
        </td>
        
        {/* Quantity */}
        <td className="py-4 px-6 text-right font-semibold text-gray-300 text-xs">
          {holding.shares.toLocaleString()}
        </td>
        
        {/* Avg Cost */}
        <td className="py-4 px-6 text-right text-gray-300 text-xs">
          {holding.costCurrency || currency} {holding.avgPrice.toFixed(2)}
        </td>
        
        {/* Current Price */}
        <td className="py-4 px-6 text-right text-gray-300 text-xs">
          {holding.priceCurrency || currency} {holding.currentPrice.toFixed(2)}
        </td>
        
        {/* Total Cost */}
        <td className="py-4 px-6 text-right text-gray-300 text-xs">
          {currency} {holding.totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        
        {/* Market Value */}
        <td className="py-4 px-6 text-right font-bold text-white text-xs">
          {currency} {holding.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        
        {/* Total Return */}
        <td className="py-4 px-6 text-right text-xs">
          {returnPeriod === 'daily' ? (
            <>
              <span className={`flex items-center justify-end font-bold text-xs ${
                holding.dailyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {holding.dailyChange >= 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                <span>{holding.dailyChangePercent.toFixed(3)}%</span>
              </span>
              <span className={`block text-[10px] text-right font-bold ${
                holding.dailyChange >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'
              }`}>
                {holding.dailyChange >= 0 ? '+' : ''}{currency} {holding.dailyChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="block text-[10px] text-gray-500 font-semibold text-right mt-0.5">
                Total: {holding.gainLossPercent.toFixed(3)}% ({holding.gainLoss >= 0 ? '+' : ''}{currency} {holding.gainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </span>
            </>
          ) : (
            <>
              <span className={`flex items-center justify-end font-bold text-xs ${
                isProfit ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {isProfit ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                <span>{holding.gainLossPercent.toFixed(3)}%</span>
              </span>
              <span className={`block text-[10px] text-right font-bold ${
                isProfit ? 'text-emerald-500/70' : 'text-rose-500/70'
              }`}>
                {isProfit ? '+' : ''}{currency} {holding.gainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="block text-[10px] text-gray-500 font-semibold text-right mt-0.5">
                Today: {holding.dailyChangePercent.toFixed(3)}% ({holding.dailyChange >= 0 ? '+' : ''}{currency} {holding.dailyChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
              </span>
            </>
          )}
        </td>
        
        {/* Current Weight */}
        <td className="py-4 px-6 text-center text-xs">
          <span className="inline-block bg-gray-900 border border-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded font-bold">
            {holding.weightPercent.toFixed(1)}%
          </span>
        </td>
        
        {/* Target Weight */}
        <td className="py-4 px-6 text-center text-xs">
          {isEditing ? (
            <div className="flex items-center justify-center space-x-1.5">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-12 bg-gray-900 border border-blue-500 rounded px-1.5 py-0.5 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
              />
              <button onClick={() => saveEdit(holding.symbol)} className="text-emerald-400 hover:text-emerald-300 p-0.5">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={cancelEdit} className="text-rose-400 hover:text-rose-300 p-0.5">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-1.5 group/edit">
              <span className="text-gray-400 font-semibold">{holding.targetWeight}%</span>
              <button
                onClick={() => startEdit(holding.symbol, holding.targetWeight)}
                className="text-gray-500 hover:text-blue-400 p-0.5 opacity-0 group-hover/edit:opacity-100 transition-opacity"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const renderSortArrow = (field) => {
    if (sortField !== field) return null;
    return <span className="ml-1 text-blue-400 font-bold">{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className="glass-card rounded-3xl border border-gray-800/60 overflow-hidden shadow-xl">
      <div className="px-6 py-5 border-b border-gray-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
        <div>
          <h2 className="text-lg font-bold text-white">Current Holdings</h2>
          <p className="text-xs text-gray-400 mt-0.5">Summary of asset costs, current valuations, and gains.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Return Period Selector */}
          <div className="flex items-center space-x-2 bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] uppercase font-bold text-gray-400">Show Return:</span>
            <select
              value={returnPeriod}
              onChange={(e) => setReturnPeriod(e.target.value)}
              className="bg-transparent text-xs font-bold text-gray-200 focus:outline-none border-none cursor-pointer pr-1"
            >
              <option value="allTime" className="bg-gray-950">All-Time</option>
              <option value="daily" className="bg-gray-950">Daily</option>
            </select>
          </div>

          {/* Group By selector */}
          <div className="flex items-center space-x-2 bg-gray-900 border border-gray-800 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] uppercase font-bold text-gray-400">Group By:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="bg-transparent text-xs font-bold text-gray-200 focus:outline-none border-none cursor-pointer pr-1"
            >
              <option value="none" className="bg-gray-950">None (Flat)</option>
              <option value="market" className="bg-gray-950">Market</option>
              <option value="sector" className="bg-gray-950">Sector</option>
              <option value="theme" className="bg-gray-950">Theme</option>
            </select>
          </div>
          
          <div className="text-xs font-semibold text-gray-400 flex items-center bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg">
            <ShieldAlert className="h-3.5 w-3.5 mr-1" />
            Auto-Converted to {currency}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              <th className="py-4 px-6 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('symbol')}>
                <div className="flex items-center">Asset {renderSortArrow('symbol')}</div>
              </th>
              <th className="py-4 px-6 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('shares')}>
                <div className="flex items-center justify-end">Qty {renderSortArrow('shares')}</div>
              </th>
              <th className="py-4 px-6 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('avgPrice')}>
                <div className="flex items-center justify-end">Avg Cost {renderSortArrow('avgPrice')}</div>
              </th>
              <th className="py-4 px-6 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('currentPrice')}>
                <div className="flex items-center justify-end">Current Price {renderSortArrow('currentPrice')}</div>
              </th>
              <th className="py-4 px-6 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('totalCostBasis')}>
                <div className="flex items-center justify-end">Total Cost {renderSortArrow('totalCostBasis')}</div>
              </th>
              <th className="py-4 px-6 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('marketValue')}>
                <div className="flex items-center justify-end">Market Value {renderSortArrow('marketValue')}</div>
              </th>
              <th className="py-4 px-6 text-right cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('gainLossPercent')}>
                <div className="flex items-center justify-end">{returnPeriod === 'daily' ? 'Daily Return' : 'Total Return'} {renderSortArrow('gainLossPercent')}</div>
              </th>
              <th className="py-4 px-6 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('weightPercent')}>
                <div className="flex items-center justify-center">Weight {renderSortArrow('weightPercent')}</div>
              </th>
              <th className="py-4 px-6 text-center">Target Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/30 text-sm font-medium text-gray-200">
            {renderRows()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
