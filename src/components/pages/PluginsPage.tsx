import React, { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { PluginInfo } from '../../types';
import { Cpu, RefreshCw, CheckCircle2, XCircle, Shield } from 'lucide-react';

interface PluginsPageProps {
  onRefreshLogs: () => void;
}

export const PluginsPage: React.FC<PluginsPageProps> = ({ onRefreshLogs }) => {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPlugins();
  }, []);

  const fetchPlugins = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/plugins');
      const data = await res.json();
      setPlugins(data);
    } catch (err) {
      console.error('Failed to fetch plugins', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await fetch(`/api/plugins/${id}/toggle`, { method: 'POST' });
      const updated = await res.json();
      setPlugins((prev) => prev.map((p) => (p.id === id ? updated : p)));
      onRefreshLogs();
    } catch (err) {
      console.error('Failed to toggle plugin', err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader title="Capability Plugins" eyebrow="Extensible Modules">
        <button
          onClick={fetchPlugins}
          disabled={isLoading}
          className="jarvis-btn text-xs flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh status</span>
        </button>
      </PageHeader>

      <div className="grid gap-4">
        {plugins.map((plugin) => (
          <div
            key={plugin.id}
            className={`jarvis-card p-5 border transition-all ${
              plugin.enabled ? 'border-[#1d4868]' : 'border-[#1d4868]/40 opacity-70'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#123756] border border-[#29739c]/50 text-[#72e8ff]">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-[#f4f9ff] font-brand">
                        {plugin.name}
                      </h4>
                      <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded bg-[#081827] border border-[#27506c] text-[#72e8ff]">
                        v{plugin.version}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-[#a9c7dc] leading-relaxed">
                  {plugin.description}
                </p>

                {/* Permissions tags */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <div className="flex items-center gap-1 text-[10px] text-[#6f9cb8]">
                    <Shield className="w-3 h-3 text-[#72e8ff]" />
                    <span>Permissions:</span>
                  </div>
                  {plugin.permissions.length > 0 ? (
                    plugin.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="text-[9px] font-mono-tech px-2 py-0.5 rounded bg-[#081827] border border-[#27506c] text-[#a9c7dc]"
                      >
                        {perm}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-[#6f9cb8]">No sensitive permissions</span>
                  )}
                </div>
              </div>

              {/* Status and Toggle */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 pt-2 sm:pt-0">
                <div className="flex items-center gap-1.5 text-xs">
                  {plugin.enabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Enabled</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-rose-400 font-semibold">Disabled</span>
                    </>
                  )}
                </div>

                <button
                  onClick={() => handleToggle(plugin.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                    plugin.enabled
                      ? 'bg-[#123756] border-[#29739c] text-[#72e8ff] hover:border-rose-400 hover:text-rose-300'
                      : 'bg-emerald-950/40 border-emerald-600/50 text-emerald-400 hover:bg-emerald-900/50'
                  }`}
                >
                  {plugin.enabled ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
