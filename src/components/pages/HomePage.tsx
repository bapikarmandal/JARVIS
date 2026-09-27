import React from 'react';
import { PageHeader } from '../PageHeader';
import { PageId, SystemSummary } from '../../types';
import { MessageSquare, Brain, Clock, ShieldCheck, Mic, ArrowRight, Activity, Terminal } from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: PageId) => void;
  summary: SystemSummary | null;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, summary }) => {
  const cards = [
    {
      id: 'chat' as PageId,
      title: 'Command Center',
      tag: 'Neural Chat',
      desc: 'Communicate with Gemini or connected neural endpoints with contextual memory injection.',
      icon: <MessageSquare className="w-5 h-5 text-[#72e8ff]" />,
    },
    {
      id: 'voice' as PageId,
      title: 'Voice Interface',
      tag: 'Speech Synthesizer',
      desc: 'Hands-free voice transcription, push-to-talk audio input, and voice response synthesis.',
      icon: <Mic className="w-5 h-5 text-[#72e8ff]" />,
    },
    {
      id: 'memory' as PageId,
      title: 'Memory Vault',
      tag: 'Long-term Memory',
      desc: 'Save and index persistent facts, preferences, and directives that survive resets.',
      icon: <Brain className="w-5 h-5 text-[#72e8ff]" />,
    },
    {
      id: 'automation' as PageId,
      title: 'Automation',
      tag: 'Local Reminders',
      desc: 'Set durable local alarms and reminders that remain persistent in background storage.',
      icon: <Clock className="w-5 h-5 text-[#72e8ff]" />,
    },
    {
      id: 'system' as PageId,
      title: 'System Tools',
      tag: 'SafetyGate Utilities',
      desc: 'Permissioned desktop capabilities, web dispatch, and guarded workstation actions.',
      icon: <ShieldCheck className="w-5 h-5 text-[#72e8ff]" />,
    },
    {
      id: 'logs' as PageId,
      title: 'Activity Log',
      tag: 'Audit Trail',
      desc: 'Inspect real-time telemetry, model completions, safety audits, and errors.',
      icon: <Terminal className="w-5 h-5 text-[#72e8ff]" />,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Good evening, Commander." eyebrow="JARVIS Desktop Assistant">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#123956]/50 border border-[#29739c]/60 text-xs text-[#72e8ff]">
          <Activity className="w-3.5 h-3.5 animate-pulse text-[#72e8ff]" />
          <span>Core AI Subsystems Active</span>
        </div>
      </PageHeader>

      {/* Main Status Surface */}
      <div className="jarvis-card p-6 relative overflow-hidden bg-gradient-to-r from-[#0e2135] via-[#0b1c2f] to-[#081726]">
        <div className="absolute right-0 top-0 bottom-0 w-80 pointer-events-none opacity-20 flex items-center justify-center">
          <div className="w-56 h-56 rounded-full border border-[#72e8ff] animate-[spin_40s_linear_infinite] flex items-center justify-center">
            <div className="w-40 h-40 rounded-full border border-dashed border-[#72e8ff] animate-[spin_20s_linear_infinite_reverse]" />
          </div>
        </div>

        <div className="relative z-10">
          <span className="text-[10px] font-bold tracking-[0.2em] text-[#6f9cb8] uppercase">
            System Status
          </span>
          <h3 className="text-xl font-bold text-[#f4f9ff] font-brand mt-1 flex items-center gap-3">
            <span>Ready</span>
            <span className="text-[#6f9cb8] text-sm font-normal">·</span>
            <span className="text-sm font-normal text-[#a9c7dc]">
              {summary?.platform || 'JARVIS Cloud OS · Linux x86_64'}
            </span>
            <span className="text-[#6f9cb8] text-sm font-normal">·</span>
            <span className="text-sm font-normal text-[#72e8ff]">
              Python {summary?.python || '3.14.7 Compatible'}
            </span>
          </h3>

          <p className="text-sm text-[#a9c7dc] mt-2 max-w-2xl leading-relaxed">
            JARVIS is operating under strict <span className="text-[#72e8ff] font-medium">SafetyGate</span> protocols. Model completions remain isolated, personal memories are stored locally, and dangerous system actions require cryptographic confirmation tokens before execution.
          </p>

          <div className="mt-5 flex flex-wrap gap-4 pt-4 border-t border-[#1d4868]/60 text-xs text-[#6f9cb8]">
            <div>
              <span className="block font-semibold text-[#f4f9ff]">Architecture</span>
              <span>{summary?.architecture || 'x86_64'}</span>
            </div>
            <div className="h-8 w-px bg-[#1d4868]/60" />
            <div>
              <span className="block font-semibold text-[#f4f9ff]">Security Level</span>
              <span className="text-emerald-400 font-medium">Safe Mode Enforced</span>
            </div>
            <div className="h-8 w-px bg-[#1d4868]/60" />
            <div>
              <span className="block font-semibold text-[#f4f9ff]">Uptime</span>
              <span>{summary?.uptime ? `${Math.floor(summary.uptime / 60)}m ${summary.uptime % 60}s` : 'Active'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Modular Subsystems */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold tracking-[0.15em] text-[#6f9cb8] uppercase">
            Workspace Modules
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className="jarvis-card p-5 text-left transition-all hover:border-[#66d4f0]/60 hover:shadow-[0_4px_24px_rgba(114,232,255,0.12)] group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-lg bg-[#123756]/60 border border-[#29739c]/40 group-hover:border-[#72e8ff]/60 transition-colors">
                    {card.icon}
                  </div>
                  <span className="text-[10px] font-semibold tracking-wider text-[#6f9cb8] uppercase">
                    {card.tag}
                  </span>
                </div>
                <h5 className="text-base font-bold text-[#f4f9ff] group-hover:text-[#72e8ff] transition-colors">
                  {card.title}
                </h5>
                <p className="text-xs text-[#a9c7dc] mt-1.5 leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1d4868]/40 flex items-center justify-between text-xs text-[#72e8ff] font-semibold">
                <span>Access module</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
