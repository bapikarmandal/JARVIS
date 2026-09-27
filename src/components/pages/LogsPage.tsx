import React, { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { ActivityLog } from '../../types';
import { Terminal, RefreshCw, Trash2, Filter } from 'lucide-react';

interface LogsPageProps {
  logs: ActivityLog[];
  onRefresh: () => void;
}

export const LogsPage: React.FC<LogsPageProps> = ({ logs, onRefresh }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isClearing, setIsClearing] = useState(false);

  const categories = ['all', 'system', 'ai', 'security', 'memory', 'automation', 'chat', 'plugins', 'settings'];

  const filteredLogs = filterCategory === 'all'
    ? logs
    : logs.filter((l) => l.category.toLowerCase() === filterCategory.toLowerCase());

  const handleClearLogs = async () => {
    if (window.confirm('Clear all local activity audit logs?')) {
      setIsClearing(true);
      try {
        await fetch('/api/logs', { method: 'DELETE' });
        onRefresh();
      } catch (err) {
        console.error('Failed to clear logs', err);
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto flex flex-col h-[calc(100vh-3.5rem)]">
      <PageHeader title="Activity Log" eyebrow="Local Audit Trail">
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="jarvis-btn text-xs flex items-center gap-1.5 h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#72e8ff]" />
            <span>Refresh logs</span>
          </button>

          <button
            onClick={handleClearLogs}
            disabled={isClearing || logs.length === 0}
            className="jarvis-btn text-xs flex items-center gap-1.5 h-9 text-[#f87171] hover:border-[#f87171] disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear logs</span>
          </button>
        </div>
      </PageHeader>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
        <Filter className="w-3.5 h-3.5 text-[#6f9cb8] mr-1 shrink-0" />
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider transition-all shrink-0 ${
              filterCategory === cat
                ? 'bg-[#123956] text-[#72e8ff] border border-[#29739c]'
                : 'text-[#6f9cb8] hover:text-[#e8f1ff] hover:bg-[#0e2135]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Terminal Monospace Logs Container */}
      <div className="flex-1 jarvis-card p-4 overflow-y-auto font-mono-tech text-xs bg-[#050c16] border border-[#1d4868] shadow-inner select-text">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#6f9cb8]">
            <div className="text-center">
              <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No activity logs recorded for this filter category.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredLogs.map((log) => {
              const isError = log.level.toLowerCase() === 'error';
              const isWarning = log.level.toLowerCase() === 'warning';

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 hover:bg-[#0e2135]/50 px-2 py-1 rounded transition-colors"
                >
                  <span className="text-[#6f9cb8]/80 shrink-0">
                    {new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                  </span>

                  <span
                    className={`shrink-0 font-bold px-1.5 py-0.2 rounded text-[10px] uppercase ${
                      isError
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : isWarning
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-[#123756] text-[#72e8ff] border border-[#29739c]'
                    }`}
                  >
                    [{log.level.toUpperCase()}]
                  </span>

                  <span className="text-[#86ebff] font-semibold shrink-0">
                    {log.category}:
                  </span>

                  <span className={`flex-1 break-all ${isError ? 'text-rose-200' : 'text-[#d6e7f7]'}`}>
                    {log.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
