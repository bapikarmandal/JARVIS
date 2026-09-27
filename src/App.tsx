import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { HomePage } from './components/pages/HomePage';
import { ChatPage } from './components/pages/ChatPage';
import { VoicePage } from './components/pages/VoicePage';
import { MemoryPage } from './components/pages/MemoryPage';
import { PluginsPage } from './components/pages/PluginsPage';
import { AutomationPage } from './components/pages/AutomationPage';
import { SystemPage } from './components/pages/SystemPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { LogsPage } from './components/pages/LogsPage';
import { PageId, Settings, SystemSummary, ActivityLog } from './types';
import { Bell, X } from 'lucide-react';

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageId>('home');
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [settings, setSettings] = useState<Settings>({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    base_url: 'https://generativelanguage.googleapis.com',
    has_custom_key: false,
    has_system_key: false,
  });
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);

  // Initialize and load system stats
  useEffect(() => {
    fetchSystemSummary();
    fetchSettings();
    fetchLogs();

    // Check reminders every 15 seconds
    const interval = setInterval(checkReminders, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchSystemSummary = async () => {
    try {
      const res = await fetch('/api/system/summary');
      const data = await res.json();
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch system summary', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  const checkReminders = async () => {
    try {
      const res = await fetch('/api/reminders');
      const reminders = await res.json();
      const now = new Date().getTime();
      const due = reminders.find(
        (r: any) => !r.completed_at && new Date(r.due_at).getTime() <= now
      );
      if (due && activeAlert !== due.title) {
        setActiveAlert(due.title);
        // Browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('JARVIS Reminder', { body: due.title });
        }
      }
    } catch (err) {
      console.error('Failed to check reminders', err);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#07111f] text-[#e8f1ff]">
      {/* Sidebar shell */}
      <Sidebar
        activePage={activePage}
        onSelectPage={(page) => setActivePage(page)}
        systemStatus={summary?.status || 'ONLINE'}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Reminder Pop-up Banner matching PySide6 show_reminder dialog */}
        {activeAlert && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-950 via-[#182e44] to-[#0e2135] border border-amber-400 text-amber-100 flex items-center justify-between shadow-[0_0_20px_rgba(251,191,36,0.25)] z-40 animate-bounce">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
                <Bell className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400">
                  JARVIS Reminder Alert
                </span>
                <p className="text-sm font-semibold text-white">{activeAlert}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveAlert(null)}
              className="p-1.5 rounded-lg hover:bg-black/30 text-amber-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stacked View Pages */}
        <div className="flex-1 overflow-y-auto p-6">
          {activePage === 'home' && (
            <HomePage onNavigate={(page) => setActivePage(page)} summary={summary} />
          )}

          {activePage === 'chat' && (
            <ChatPage settings={settings} onRefreshLogs={fetchLogs} />
          )}

          {activePage === 'voice' && (
            <VoicePage onRefreshLogs={fetchLogs} />
          )}

          {activePage === 'memory' && (
            <MemoryPage onRefreshLogs={fetchLogs} />
          )}

          {activePage === 'plugins' && (
            <PluginsPage onRefreshLogs={fetchLogs} />
          )}

          {activePage === 'automation' && (
            <AutomationPage onRefreshLogs={fetchLogs} />
          )}

          {activePage === 'system' && (
            <SystemPage onRefreshLogs={fetchLogs} />
          )}

          {activePage === 'settings' && (
            <SettingsPage
              settings={settings}
              onUpdateSettings={(newS) => setSettings(newS)}
              onRefreshLogs={fetchLogs}
            />
          )}

          {activePage === 'logs' && (
            <LogsPage logs={logs} onRefresh={fetchLogs} />
          )}
        </div>
      </main>
    </div>
  );
};
