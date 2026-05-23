import React, { useState } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  PieChart, Pie, Cell, Legend, BarChart, Bar, CartesianGrid, Treemap
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, Shuffle, Calendar, LayoutGrid } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

const getHeatmapColor = (pct, heatmapPeriod = 'allTime') => {
  if (heatmapPeriod === 'daily') {
    if (pct > 3.0) return 'rgba(16, 185, 129, 0.85)';   // Bright Green
    if (pct > 1.0) return 'rgba(5, 150, 105, 0.85)';    // Medium Green
    if (pct > 0.0) return 'rgba(4, 120, 87, 0.85)';     // Dark Green
    if (pct === 0.0) return 'rgba(75, 85, 99, 0.6)';    // Grey
    if (pct > -1.0) return 'rgba(159, 18, 57, 0.85)';   // Dark Red
    if (pct > -3.0) return 'rgba(225, 29, 72, 0.85)';   // Medium Red
    return 'rgba(244, 63, 94, 0.85)';                  // Bright Red
  } else {
    if (pct > 10) return 'rgba(16, 185, 129, 0.85)';   // Bright Green
    if (pct > 3) return 'rgba(5, 150, 105, 0.85)';    // Medium Green
    if (pct > 0) return 'rgba(4, 120, 87, 0.85)';     // Dark Green
    if (pct === 0) return 'rgba(75, 85, 99, 0.6)';     // Neutral Grey
    if (pct > -3) return 'rgba(159, 18, 57, 0.85)';    // Dark Red
    if (pct > -10) return 'rgba(225, 29, 72, 0.85)';   // Medium Red
    return 'rgba(244, 63, 94, 0.85)';                  // Bright Red
  }
};

const CustomizedContent = (props) => {
  const { x, y, width, height, name, size, value, gainLossPercent, dailyChangePercent, currency, heatmapPeriod } = props;
  const displayVal = size || value || 0;
  const currentMetric = heatmapPeriod === 'daily' ? (dailyChangePercent || 0) : (gainLossPercent || 0);
  const color = getHeatmapColor(currentMetric, heatmapPeriod);
  
  const showText = width > 50 && height > 35;
  const showFullText = width > 75 && height > 55;
  
  const isProfit = currentMetric >= 0;
  
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#030712',
          strokeWidth: 1.5,
        }}
        className="transition-all duration-300 hover:opacity-80 cursor-pointer"
      />
      {showText && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showFullText ? 10 : 4)}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={11}
          style={{ fontFamily: 'sans-serif' }}
          className="font-bold select-none"
        >
          {name}
          {showFullText ? (
            <>
              <tspan
                x={x + width / 2}
                dy="1.2em"
                fill="rgba(255, 255, 255, 0.8)"
                fontSize={9}
                fontWeight="normal"
              >
                {currency} {displayVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </tspan>
              <tspan
                x={x + width / 2}
                dy="1.2em"
                fill="#ffffff"
                fontSize={9.5}
                fontWeight="bold"
              >
                {isProfit ? '+' : ''}{(currentMetric || 0).toFixed(2)}%
              </tspan>
            </>
          ) : (
            <tspan
              x={x + width / 2}
              dy="1.2em"
              fill="#ffffff"
              fontSize={9}
              fontWeight="bold"
            >
              {isProfit ? '+' : ''}{(currentMetric || 0).toFixed(1)}%
            </tspan>
          )}
        </text>
      )}
    </g>
  );
};

export default function PerformanceChart({ 
  historicalData, 
  historyLoading, 
  historyError, 
  currentAllocation, 
  currency 
}) {
  const [chartView, setChartView] = useState('growth'); // 'growth', 'allocation', 'drift', 'heatmap'
  const [heatmapPeriod, setHeatmapPeriod] = useState('daily'); // default to daily return coloring
  const [timeframe, setTimeframe] = useState('1Y'); // '1M', '3M', '6M', '1Y', 'YTD', 'ALL'

  // Filter historical data locally based on the selected timeframe
  const filteredData = React.useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];
    
    const now = new Date();
    let cutoffDate = new Date();
    
    switch (timeframe) {
      case '1M':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case '3M':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6M':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1Y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'YTD':
        cutoffDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'ALL':
      default:
        // No cutoff, return all historical data
        return historicalData;
    }
    
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    return historicalData.filter(d => d.date >= cutoffStr);
  }, [historicalData, timeframe]);

  // Calculate actual date range in days of the filtered data to format X-axis intelligently
  const dateRangeDays = React.useMemo(() => {
    if (!filteredData || filteredData.length < 2) return 0;
    const first = new Date(filteredData[0].date);
    const last = new Date(filteredData[filteredData.length - 1].date);
    if (isNaN(first.getTime()) || isNaN(last.getTime())) return 0;
    return (last - first) / (1000 * 60 * 60 * 24);
  }, [filteredData]);

  // Clean formatting helpers for dynamic dates and currency values
  const formatXAxisDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      
      // If the actual range of dates shown is 90 days or less, show day-level resolution to avoid repeating labels
      if (dateRangeDays > 0 && dateRangeDays <= 90) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
      return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const formatYAxisValue = (value) => {
    if (value >= 1000) {
      return `${currency} ${(value / 1000).toFixed(0)}k`;
    }
    return `${currency} ${value}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-950/95 border border-gray-800 p-3.5 rounded-xl shadow-2xl backdrop-blur-md">
          <p className="text-xs font-bold text-gray-400 mb-1.5 flex items-center space-x-1">
            <Calendar className="h-3 w-3" />
            <span>{label}</span>
          </p>
          <div className="space-y-1">
            {payload.map((item, index) => (
              <p key={index} className="text-xs font-semibold" style={{ color: item.color }}>
                {item.name}: {currency} {item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-950/95 border border-gray-800 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs">
          <p className="font-bold text-white mb-1">{data.name}</p>
          <p className="font-semibold text-blue-400">Value: {currency} {data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          <p className="font-semibold text-emerald-400">Weight: {data.weight.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  const CustomTreemapTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isProfit = data.gainLossPercent >= 0;
      const isDailyProfit = (data.dailyChangePercent || 0) >= 0;
      return (
        <div className="bg-gray-950/95 border border-gray-800 p-3.5 rounded-xl shadow-2xl backdrop-blur-md text-xs">
          <p className="font-bold text-white mb-1">{data.symbol || data.name}</p>
          <p className="font-semibold text-gray-400 mb-1.5">{data.fullName || data.name}</p>
          <div className="space-y-1 font-semibold text-gray-300">
            <p className="text-blue-400">Market Value: {data.currency} {data.size.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="border-b border-gray-800/80 pb-1.5 mb-1.5">Weight: {data.weight.toFixed(3)}%</p>
            <p className="text-gray-400 font-bold text-[10px] uppercase tracking-wider mb-1">Performance</p>
            <div className="space-y-0.5">
              <p className="flex justify-between space-x-4">
                <span className="text-gray-400">Daily Return:</span>
                <span className={isDailyProfit ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {isDailyProfit ? '+' : ''}{(data.dailyChangePercent || 0).toFixed(3)}%
                </span>
              </p>
              <p className="flex justify-between space-x-4">
                <span className="text-gray-400">All-Time Return:</span>
                <span className={isProfit ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {isProfit ? '+' : ''}{(data.gainLossPercent || 0).toFixed(3)}%
                </span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Prepare allocation data for pie chart
  const pieData = Object.values(currentAllocation).map((asset) => ({
    name: asset.symbol,
    value: asset.marketValue,
    weight: asset.weightPercent
  })).sort((a, b) => b.value - a.value);

  // Prepare drift data for bar chart
  const driftData = Object.values(currentAllocation).map((asset) => ({
    name: asset.symbol,
    'Current Weight': parseFloat(asset.weightPercent.toFixed(1)),
    'Target Weight': asset.targetWeight || 0,
    drift: parseFloat((asset.weightPercent - (asset.targetWeight || 0)).toFixed(1))
  })).sort((a, b) => b['Current Weight'] - a['Current Weight']);

  // Prepare heatmap data
  const heatmapData = Object.values(currentAllocation).map((asset) => ({
    name: asset.symbol.replace('.AX', ''),
    symbol: asset.symbol,
    fullName: asset.name,
    size: asset.marketValue,
    gainLossPercent: asset.gainLossPercent,
    dailyChangePercent: asset.dailyChangePercent,
    weight: asset.weightPercent,
    currency: currency
  })).sort((a, b) => b.size - a.size);

  return (
    <div className="glass-card rounded-3xl p-6 border border-gray-800/60 shadow-xl">
      {/* Chart Headers & Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            {chartView === 'growth' && (
              <>
                <TrendingUp className="h-5 w-5 text-blue-400" />
                <span>Performance & Growth Comparison</span>
              </>
            )}
            {chartView === 'allocation' && (
              <>
                <PieIcon className="h-5 w-5 text-violet-400" />
                <span>Portfolio Asset Allocation</span>
              </>
            )}
            {chartView === 'drift' && (
              <>
                <Shuffle className="h-5 w-5 text-emerald-400" />
                <span>Asset Allocation Drift & Target Alignment</span>
              </>
            )}
            {chartView === 'heatmap' && (
              <>
                <LayoutGrid className="h-5 w-5 text-cyan-400" />
                <span>Portfolio Value & Performance Heat Map</span>
              </>
            )}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {chartView === 'growth' && 'Visualise total portfolio return vs index benchmarks.'}
            {chartView === 'allocation' && 'Understand your current diversification splits.'}
            {chartView === 'drift' && 'Identify current weights vs target goals.'}
            {chartView === 'heatmap' && 'Compare asset weights (box size) and returns (color intensity).'}
          </p>
        </div>

        {/* Toggles Container */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-stretch md:self-auto">
          {chartView === 'growth' && (
            <div className="flex bg-gray-900/60 rounded-xl border border-gray-800/80 p-0.5 justify-between">
              {['1M', '3M', '6M', '1Y', 'YTD', 'ALL'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-300 ${
                    timeframe === tf ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}

          {chartView === 'heatmap' && (
            <div className="flex bg-gray-900/60 rounded-xl border border-gray-800/80 p-0.5 justify-between">
              <button
                onClick={() => setHeatmapPeriod('daily')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${
                  heatmapPeriod === 'daily' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setHeatmapPeriod('allTime')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${
                  heatmapPeriod === 'allTime' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All-Time
              </button>
            </div>
          )}

          {/* View Toggles */}
          <div className="flex bg-gray-900/60 rounded-xl border border-gray-800/80 p-0.5 justify-between">
            <button
              onClick={() => setChartView('growth')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${
                chartView === 'growth' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Growth</span>
            </button>
            <button
              onClick={() => setChartView('allocation')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${
                chartView === 'allocation' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <PieIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Allocation</span>
            </button>
            <button
              onClick={() => setChartView('drift')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${
                chartView === 'drift' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Shuffle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Target Drift</span>
            </button>
            <button
              onClick={() => setChartView('heatmap')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 flex items-center space-x-1.5 ${
                chartView === 'heatmap' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Heat Map</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="h-96 w-full flex items-center justify-center">
        {chartView === 'growth' && (
          historyLoading ? (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-xs text-gray-400 font-semibold">Reconstructing historical performance...</p>
            </div>
          ) : historyError ? (
            <div className="flex flex-col items-center justify-center space-y-2 text-center px-4">
              <span className="text-rose-500 font-semibold text-2xl">⚠️</span>
              <p className="text-sm font-bold text-white">Failed to Load Performance History</p>
              <p className="text-xs text-gray-500 max-w-sm">{historyError}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-4">
              <TrendingUp className="h-10 w-10 text-gray-600 mb-2 animate-pulse" />
              <p className="text-sm font-bold text-white">No Growth Data Available</p>
              <p className="text-xs text-gray-500 mt-1">Add transactions in the Transactions tab to see performance tracking.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="#9ca3af" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={formatXAxisDate}
                />
                <YAxis 
                  stroke="#9ca3af" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={formatYAxisValue} 
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  name="NovaPortfolio" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
                <Area 
                  type="monotone" 
                  name="S&P 500 / ASX 200 (Blended)" 
                  dataKey="benchmarkValue" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1} 
                  fill="url(#colorBenchmark)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )
        )}

        {chartView === 'allocation' && (
          pieData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-around w-full h-full">
              <div className="w-full sm:w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none hover:opacity-90 transition-opacity" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 flex flex-col justify-center space-y-3.5 max-h-full overflow-y-auto px-4">
                {pieData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                      <span className="text-sm font-semibold text-gray-200">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-gray-300 block">{currency} {item.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="text-[10px] text-gray-500 font-bold block">{item.weight.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No holdings to show allocation.</p>
          )
        )}

        {chartView === 'drift' && (
          driftData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driftData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#030712', borderColor: '#1f2937', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#9ca3af' }}
                />
                <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Bar name="Current Weight" dataKey="Current Weight" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar name="Target Weight" dataKey="Target Weight" fill="#4b5563" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500">No holdings to show target alignment.</p>
          )
        )}

        {chartView === 'heatmap' && (
          heatmapData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={heatmapData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#030712"
                content={<CustomizedContent heatmapPeriod={heatmapPeriod} />}
              >
                <Tooltip content={<CustomTreemapTooltip />} />
              </Treemap>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-500">No holdings to show heat map.</p>
          )
        )}
      </div>

      {/* Drift warnings footer */}
      {chartView === 'drift' && driftData.length > 0 && (
        <div className="mt-4 bg-gray-950/40 border border-gray-800/80 rounded-xl p-3.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400">
            Recommended action based on weight deviation:
          </span>
          {(() => {
            const maxDrift = driftData.reduce((max, d) => Math.abs(d.drift) > Math.abs(max.drift) ? d : max, { drift: 0 });
            if (maxDrift.drift > 2.5) {
              return <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Trim {maxDrift.name} (Overweight by {maxDrift.drift}%)</span>;
            } else if (maxDrift.drift < -2.5) {
              return <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">Top up {maxDrift.name} (Underweight by {Math.abs(maxDrift.drift)}%)</span>;
            }
            return <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">Portfolio well balanced!</span>;
          })()}
        </div>
      )}
    </div>
  );
}

