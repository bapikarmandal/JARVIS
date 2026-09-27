import React, { useState, useEffect } from 'react';
import { PageHeader } from '../PageHeader';
import { Settings } from '../../types';
import { Settings as SettingsIcon, ShieldCheck, Key, Save, CheckCircle2 } from 'lucide-react';

interface SettingsPageProps {
  settings: Settings;
  onUpdateSettings: (newSettings: Settings) => void;
  onRefreshLogs: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onRefreshLogs,
}) => {
  const [provider, setProvider] = useState<'gemini' | 'ollama' | 'openai_compatible'>(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [baseUrl, setBaseUrl] = useState(settings.base_url);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setProvider(settings.provider);
    setModel(settings.model);
    setBaseUrl(settings.base_url);
  }, [settings]);

  const handleProviderChange = (newProvider: 'gemini' | 'ollama' | 'openai_compatible') => {
    setProvider(newProvider);
    if (newProvider === 'gemini') {
      setModel('gemini-2.5-flash');
      setBaseUrl('https://generativelanguage.googleapis.com');
    } else if (newProvider === 'ollama') {
      setModel('llama3.2');
      setBaseUrl('http://127.0.0.1:11434');
    } else {
      setModel('gpt-4o-mini');
      setBaseUrl('https://api.openai.com/v1');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model.trim()) {
      alert('A model name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          base_url: baseUrl.trim(),
          api_key: apiKey.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onUpdateSettings({
          provider,
          model: model.trim(),
          base_url: baseUrl.trim(),
          has_custom_key: Boolean(apiKey.trim()) || settings.has_custom_key,
          has_system_key: settings.has_system_key,
        });
        setApiKey('');
        setFeedback('Settings saved. API keys remain outside the JARVIS database.');
        onRefreshLogs();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Settings" eyebrow="Model and Privacy Controls">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e2135] border border-[#1d4868] text-xs text-[#72e8ff]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Encrypted Vault Mode</span>
        </div>
      </PageHeader>

      {feedback && (
        <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <form onSubmit={handleSave} className="jarvis-card p-6 space-y-5">
        {/* Provider */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider text-[#6f9cb8] uppercase">
            AI Provider
          </label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as any)}
            className="w-full jarvis-input text-xs h-10"
          >
            <option value="gemini">Google Gemini (Gemini SDK & Flash Models)</option>
            <option value="ollama">Ollama (Local Inference Endpoint)</option>
            <option value="openai_compatible">OpenAI Compatible (Custom Endpoint)</option>
          </select>
        </div>

        {/* Model */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider text-[#6f9cb8] uppercase">
            Model
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full jarvis-input text-xs h-10 font-mono-tech"
            placeholder="e.g. gemini-2.5-flash, llama3.2, etc."
          />
        </div>

        {/* Base URL */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-wider text-[#6f9cb8] uppercase">
            Base URL (Ollama or OpenAI-compatible only)
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full jarvis-input text-xs h-10 font-mono-tech"
            placeholder="http://127.0.0.1:11434"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold tracking-wider text-[#6f9cb8] uppercase flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#72e8ff]" />
              <span>API Key (Stored in secure server credential manager)</span>
            </label>
            <span className="text-[10px] text-[#6f9cb8]">
              {settings.has_custom_key || settings.has_system_key
                ? 'Key configured'
                : 'No key detected'}
            </span>
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full jarvis-input text-xs h-10 font-mono-tech"
            placeholder="Leave empty to keep the currently stored key"
          />
          <p className="text-[11px] text-[#6f9cb8] pt-0.5">
            JARVIS does not persist secrets to disk database tables. Keys remain in ephemeral memory or environment variables.
          </p>
        </div>

        <div className="flex justify-end pt-3 border-t border-[#1d4868]/60">
          <button
            type="submit"
            disabled={isSaving}
            className="jarvis-btn text-xs flex items-center gap-2 px-5 py-2.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-[#72e8ff]" />
            <span>{isSaving ? 'Securing...' : 'Save secure settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
