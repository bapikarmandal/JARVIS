import React from 'react';
import {
  Home,
  MessageSquare,
  Mic,
  Brain,
  Cpu,
  Clock,
  ShieldAlert,
  Settings as SettingsIcon,
  Terminal,
  Activity,
} from 'lucide-react';
import { PageId } from '../types';

interface SidebarProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  systemStatus: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  systemStatus,
}) => {
  const navItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
    { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'voice', label: 'Voice', icon: <Mic className="w-4 h-4" /> },
    { id: 'memory', label: 'Memory', icon: <Brain className="w-4 h-4" /> },
    { id: 'plugins', label: 'Plugins', icon: <Cpu className="w-4 h-4" /> },
    { id: 'automation', label: 'Automation', icon: <Clock className="w-4 h-4" /> },
    { id: 'system', label: 'System', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-4 h-4" /> },
    { id: 'logs', label: 'Logs', icon: <Terminal className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-56 bg-[#0b1a2c] border-r border-[#1d4060] flex flex-col justify-between p-4 shrink-0 select-none">
      <div>
        {/* Brand header */}
        <div className="pt-2 pb-5 border-b border-[#1d4060]/50">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#72e8ff] shadow-[0_0_8px_#72e8ff] animate-pulse" />
            <h1 className="text-2xl font-bold tracking-[0.2em] text-[#72e8ff] font-brand">
              JARVIS
            </h1>
          </div>
          <p className="text-[10px] tracking-[0.25em] font-semibold text-[#6f9cb8] mt-1 uppercase">
            Personal OS
          </p>
        </div>

        {/* Nav Items */}
        <nav className="mt-4 space-y-1">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                  isActive
                    ? 'bg-[#123956] text-[#86ebff] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border-l-2 border-[#72e8ff]'
                    : 'text-[#a9c7dc] hover:bg-[#123956]/60 hover:text-[#e8f1ff]'
                }`}
              >
                <span className={isActive ? 'text-[#72e8ff]' : 'text-[#6f9cb8]'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Banner */}
      <div className="pt-4 border-t border-[#1d4060]/60 text-xs">
        <div className="flex items-center gap-2 mb-1.5 text-[#72e8ff]/80">
          <Activity className="w-3.5 h-3.5" />
          <span className="font-semibold tracking-wider text-[10px] uppercase">
            {systemStatus || 'READY · ONLINE'}
          </span>
        </div>
        <p className="text-[9px] tracking-widest text-[#6f9cb8] font-semibold uppercase">
          Safe Mode · Local Data
        </p>
      </div>
    </aside>
  );
};
