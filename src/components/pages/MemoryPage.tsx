import React, { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Memory } from '../../types';
import { Brain, Search, Trash2, Plus, Sparkles, AlertCircle } from 'lucide-react';

interface MemoryPageProps {
  onRefreshLogs: () => void;
}

export const MemoryPage: React.FC<MemoryPageProps> = ({ onRefreshLogs }) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('preference');
  const [importance, setImportance] = useState(2);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async (query = '') => {
    setIsLoading(true);
    try {
      const url = query ? `/api/memories?q=${encodeURIComponent(query)}` : '/api/memories';
      const res = await fetch(url);
      const data = await res.json();
      setMemories(data);
    } catch (err) {
      console.error('Failed to fetch memories', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemember = async () => {
    if (!content.trim()) return;
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          category,
          importance,
        }),
      });
      if (res.ok) {
        setContent('');
        fetchMemories(searchQuery);
        onRefreshLogs();
      }
    } catch (err) {
      console.error('Failed to save memory', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Permanently remove this stored memory from the vault?')) {
      try {
        await fetch(`/api/memories/${id}`, { method: 'DELETE' });
        fetchMemories(searchQuery);
        onRefreshLogs();
      } catch (err) {
        console.error('Failed to delete memory', err);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMemories(searchQuery);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader title="Memory Vault" eyebrow="Long-Term Memory">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e2135] border border-[#1d4868] text-xs text-[#72e8ff]">
          <Brain className="w-3.5 h-3.5" />
          <span>{memories.length} Durable Facts Cached</span>
        </div>
      </PageHeader>

      {/* Add Memory Card */}
      <div className="jarvis-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold tracking-wider text-[#6f9cb8] uppercase">
            Store User Memory
          </label>
          <span className="text-xs text-[#6f9cb8]">Injected into future chat prompts</span>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Store an explicit preference, project detail, or important fact…"
          rows={3}
          className="w-full jarvis-input text-sm leading-relaxed"
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="jarvis-input text-xs"
            >
              <option value="preference">Preference</option>
              <option value="identity">Identity</option>
              <option value="protocol">Protocol</option>
              <option value="fact">General Fact</option>
              <option value="project">Project Data</option>
            </select>

            <div className="flex items-center gap-1.5 text-xs text-[#a9c7dc]">
              <span>Importance:</span>
              <select
                value={importance}
                onChange={(e) => setImportance(Number(e.target.value))}
                className="jarvis-input text-xs w-16"
              >
                <option value={1}>1 (Low)</option>
                <option value={2}>2 (Normal)</option>
                <option value={3}>3 (High)</option>
                <option value={5}>5 (Critical)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleRemember}
            disabled={!content.trim()}
            className="jarvis-btn text-xs flex items-center gap-2 w-full sm:w-auto justify-center disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 text-[#72e8ff]" />
            <span>Remember</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#6f9cb8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search remembered facts"
            className="jarvis-input pl-9 w-full text-xs h-10"
          />
        </div>
        <button type="submit" className="jarvis-btn text-xs px-5 h-10">
          Search
        </button>
      </form>

      {/* Memory Results List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold tracking-wider text-[#6f9cb8] uppercase">
            Indexed Memories
          </span>
          <span className="text-[11px] text-[#6f9cb8]">
            Double-click or click trash icon to forget
          </span>
        </div>

        {memories.length === 0 ? (
          <div className="jarvis-card p-8 text-center text-[#6f9cb8]">
            <Brain className="w-8 h-8 mx-auto mb-2 text-[#72e8ff]/40" />
            <p className="text-sm font-medium text-[#f4f9ff]">No memories found</p>
            <p className="text-xs text-[#a9c7dc] mt-1">
              Add explicit preferences above to anchor JARVIS responses.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map((mem) => (
              <div
                key={mem.id}
                onDoubleClick={() => handleDelete(mem.id)}
                className="jarvis-card p-4 flex items-start justify-between gap-4 group hover:border-[#66d4f0]/60 transition-colors cursor-pointer select-none"
                title="Double click to permanently delete"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#123756] border border-[#29739c] text-[#72e8ff]">
                      [{mem.category}]
                    </span>
                    <span className="text-[10px] text-[#6f9cb8]">
                      Tier {mem.importance} Priority
                    </span>
                    <span className="text-[10px] text-[#6f9cb8]/60">·</span>
                    <span className="text-[10px] text-[#6f9cb8]/60 font-mono-tech">
                      {new Date(mem.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-[#e8f1ff] leading-relaxed select-text">
                    {mem.content}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(mem.id);
                  }}
                  className="p-2 rounded-lg text-[#6f9cb8] hover:text-[#f87171] hover:bg-rose-950/30 transition-colors"
                  title="Forget memory"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
