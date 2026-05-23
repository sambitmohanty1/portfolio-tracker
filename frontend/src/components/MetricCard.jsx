import React from 'react';
import { ArrowUpRight, ArrowDownRight, HelpCircle } from 'lucide-react';

export default function MetricCard({ title, value, subtext, trend, trendValue, icon: Icon, infoText, accentColor = 'blue' }) {
  const isPositive = trend === 'positive';
  const isNegative = trend === 'negative';
  
  const accentStyles = {
    blue:    'border-l-4 border-blue-500 hover:shadow-blue-500/5',
    violet:  'border-l-4 border-violet-500 hover:shadow-violet-500/5',
    emerald: 'border-l-4 border-emerald-500 hover:shadow-emerald-500/5',
    amber:   'border-l-4 border-amber-500 hover:shadow-amber-500/5',
    teal:    'border-l-4 border-teal-500 hover:shadow-teal-500/5',
  };

  const iconColorStyles = {
    blue:    'bg-blue-500/10 text-blue-400',
    violet:  'bg-violet-500/10 text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber:   'bg-amber-500/10 text-amber-400',
    teal:    'bg-teal-500/10 text-teal-400',
  };

  return (
    <div className={`glass-card rounded-2xl p-5 hover:translate-y-[-2px] transition-all duration-300 relative group ${accentStyles[accentColor] || accentStyles.blue}`}>
      {/* Decorative Background Glow */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute -right-10 -top-10 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
      </div>

      <div className="flex justify-between items-start">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>{title}</span>
            {infoText && (
              <div className="relative group/tooltip">
                <HelpCircle className="h-3.5 w-3.5 text-gray-500 hover:text-gray-300 cursor-help transition-colors" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-950/95 border border-gray-800 rounded-lg text-[10px] font-medium leading-relaxed text-gray-300 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 shadow-2xl z-50">
                  {infoText}
                </div>
              </div>
            )}
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-white">{value}</h3>
        </div>
        
        <div className={`p-2.5 rounded-xl ${iconColorStyles[accentColor]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-800/50 pt-3">
        <span className="text-xs text-gray-400 font-medium">{subtext}</span>
        {trendValue && (
          <span className={`flex items-center space-x-0.5 text-xs font-bold px-2 py-0.5 rounded-md ${
            isPositive ? 'text-emerald-400 bg-emerald-500/10' :
            isNegative ? 'text-rose-400 bg-rose-500/10' :
            'text-gray-400 bg-gray-500/10'
          }`}>
            {isPositive && <ArrowUpRight className="h-3 w-3" />}
            {isNegative && <ArrowDownRight className="h-3 w-3" />}
            <span>{trendValue}</span>
          </span>
        )}
      </div>
    </div>
  );
}
