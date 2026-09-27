import React, { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Reminder } from '../../types';
import { Clock, Plus, CheckCircle2, BellRing, Calendar } from 'lucide-react';

interface AutomationPageProps {
  onRefreshLogs: () => void;
  onReminderTriggered?: (title: string) => void;
}

export const AutomationPage: React.FC<AutomationPageProps> = ({ onRefreshLogs }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(15);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchReminders();
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/reminders');
      const data = await res.json();
      setReminders(data);
    } catch (err) {
      console.error('Failed to fetch reminders', err);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          minutes,
        }),
      });
      if (res.ok) {
        setTitle('');
        setMinutes(15);
        fetchReminders();
        onRefreshLogs();
      }
    } catch (err) {
      console.error('Failed to create reminder', err);
    }
  };

  const handleComplete = async (id: number) => {
    try {
      const res = await fetch(`/api/reminders/${id}/complete`, { method: 'POST' });
      if (res.ok) {
        fetchReminders();
        onRefreshLogs();
      }
    } catch (err) {
      console.error('Failed to complete reminder', err);
    }
  };

  const activeReminders = reminders.filter((r) => !r.completed_at);
  const completedReminders = reminders.filter((r) => r.completed_at);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader title="Automation" eyebrow="Local Reminders">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e2135] border border-[#1d4868] text-xs text-[#72e8ff]">
          <BellRing className="w-3.5 h-3.5" />
          <span>{activeReminders.length} Active Reminders</span>
        </div>
      </PageHeader>

      {/* Schedule Reminder Card from PySide6 main_window.py */}
      <div className="jarvis-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#f4f9ff]">Schedule Local Reminder</h3>
          <p className="text-xs text-[#a9c7dc] mt-1">
            Reminders are stored locally and checked while JARVIS is running.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reminder title (e.g. Run tactical audit, review deployment…)"
              className="w-full jarvis-input text-xs h-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={525600}
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, parseInt(e.target.value) || 1))}
              className="jarvis-input text-xs h-10 w-24 text-center font-mono-tech"
            />
            <span className="text-xs text-[#a9c7dc] whitespace-nowrap">minutes</span>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            className="jarvis-btn text-xs flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 text-[#72e8ff]" />
            <span>Schedule reminder</span>
          </button>
        </div>
      </div>

      {/* Active Reminders List */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold tracking-[0.15em] text-[#6f9cb8] uppercase px-1">
          Active Reminders ({activeReminders.length})
        </h4>

        {activeReminders.length === 0 ? (
          <div className="jarvis-card p-6 text-center text-[#6f9cb8]">
            <Clock className="w-6 h-6 mx-auto mb-2 text-[#72e8ff]/40" />
            <p className="text-xs text-[#a9c7dc]">No active reminders scheduled.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {activeReminders.map((rem) => {
              const due = new Date(rem.due_at);
              const diffMs = due.getTime() - now.getTime();
              const isOverdue = diffMs <= 0;
              const diffMin = Math.ceil(diffMs / (60 * 1000));

              return (
                <div
                  key={rem.id}
                  className={`jarvis-card p-4 flex items-center justify-between gap-4 border transition-all ${
                    isOverdue
                      ? 'border-rose-500/60 bg-rose-950/20'
                      : 'border-[#1d4868]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#f4f9ff]">
                        {rem.title}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-500/50 animate-pulse">
                          Due Now
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#6f9cb8]">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Due: {due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      <span>·</span>
                      <span className={isOverdue ? 'text-rose-400 font-bold' : 'text-[#72e8ff]'}>
                        {isOverdue ? 'Triggered' : `In ${diffMin} min`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleComplete(rem.id)}
                    className="jarvis-btn text-xs flex items-center gap-1.5 py-1.5 px-3 text-emerald-400 hover:border-emerald-400"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Reminders */}
      {completedReminders.length > 0 && (
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold tracking-[0.15em] text-[#6f9cb8]/70 uppercase px-1">
            Archived Reminders
          </h4>
          <div className="space-y-2 opacity-60">
            {completedReminders.slice(0, 5).map((rem) => (
              <div
                key={rem.id}
                className="jarvis-card p-3 flex items-center justify-between text-xs text-[#a9c7dc]"
              >
                <span className="line-through">{rem.title}</span>
                <span className="text-[10px] text-[#6f9cb8]">
                  Completed {new Date(rem.completed_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
