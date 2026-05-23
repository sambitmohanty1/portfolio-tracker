import React from 'react';
import { LayoutDashboard, History, Eye, ArrowUpRight, TrendingUp, Download, Upload } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, displayCurrency, setDisplayCurrency, connectionStatus = 'online' }) {
  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', name: 'Transactions', icon: History },
    { id: 'watchlist', name: 'Watchlist', icon: Eye },
  ];

  return (
    <nav className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between transition-all duration-300">
      {/* Logo / Brand */}
      <div className="flex items-center space-x-3 group cursor-pointer">
        <div className="bg-gradient-to-tr from-blue-500 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
          <TrendingUp className="h-6 w-6 text-white" />
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight text-gradient">
            NovaPortfolio
          </span>
          <span className="block text-[10px] text-gray-400 font-semibold tracking-wider uppercase -mt-1">
            Global Wealth Tracker
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center bg-gray-900/60 p-1.5 rounded-xl border border-gray-800/80">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Settings / Profile */}
      <div className="flex items-center space-x-4">
        {/* Connection status label */}
        {connectionStatus === 'offline' && (
          <span className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
            <span>Offline</span>
          </span>
        )}
        {connectionStatus === 'connecting' && (
          <span className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
            <span>Syncing</span>
          </span>
        )}

        {/* Currency Switcher */}
        <div className="flex items-center bg-gray-900/60 rounded-xl border border-gray-800/80 p-0.5">
          {['AUD', 'USD'].map((curr) => (
            <button
              key={curr}
              onClick={() => setDisplayCurrency(curr)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-300 ${
                displayCurrency === curr
                  ? 'bg-gray-800 text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {curr}
            </button>
          ))}
        </div>

        {/* Local Vault Backup */}
        <div className="flex items-center space-x-3 pl-3 border-l border-gray-800/80">
          <div className="text-right hidden md:block">
            <span className="block text-xs font-semibold text-gray-200">Local Vault</span>
            <span className={`block text-[10px] font-bold ${connectionStatus === 'offline' ? 'text-rose-400' : 'text-emerald-400'}`}>
              Encrypted
            </span>
          </div>
          
          <div className="flex space-x-2">
            <button 
              onClick={async () => {
                const pwd = prompt("Enter a password to encrypt your backup:");
                if (pwd) {
                   const { exportEncryptedBackup } = await import('../utils/backup');
                   await exportEncryptedBackup(pwd);
                }
              }}
              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1.5 rounded-lg transition-colors text-gray-300 flex items-center space-x-1"
              title="Export Encrypted Backup"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
            <label className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2.5 py-1.5 rounded-lg transition-colors text-gray-300 flex items-center space-x-1 cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>Import</span>
              <input type="file" className="hidden" onChange={async (e) => {
                 const file = e.target.files[0];
                 if (file) {
                    const pwd = prompt("Enter the password to decrypt your backup:");
                    if (pwd) {
                       const { importEncryptedBackup } = await import('../utils/backup');
                       try {
                         await importEncryptedBackup(file, pwd);
                         alert("Vault successfully restored!");
                         window.location.reload();
                       } catch (err) {
                         alert(err.message);
                       }
                    }
                 }
              }} />
            </label>
          </div>
        </div>
      </div>
    </nav>
  );
}
