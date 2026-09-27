import React, { useState, useEffect, useRef } from 'react';
import { PageHeader } from '../PageHeader';
import { Conversation, Message, Settings } from '../../types';
import { Plus, Trash2, Send, Mic, Sparkles, AlertCircle } from 'lucide-react';

interface ChatPageProps {
  settings: Settings;
  onRefreshLogs: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ settings, onRefreshLogs }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when current conversation changes
  useEffect(() => {
    if (currentConvId) {
      loadMessages(currentConvId);
    }
  }, [currentConvId]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setConversations(data);
      if (data.length > 0 && !currentConvId) {
        setCurrentConvId(data[0].id);
      } else if (data.length === 0) {
        // Create initial
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const loadMessages = async (convId: number) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  const handleNewChat = async () => {
    if (isLoading) return;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New conversation' }),
      });
      const data = await res.json();
      setConversations((prev) => [data, ...prev]);
      setCurrentConvId(data.id);
      setMessages([
        {
          id: Date.now(),
          conversation_id: data.id,
          role: 'assistant',
          content: 'New conversation ready. What can I help with, Commander?',
          created_at: new Date().toISOString(),
        },
      ]);
      onRefreshLogs();
    } catch (err) {
      console.error('Failed to create new chat', err);
    }
  };

  const handleClearHistory = async () => {
    if (!currentConvId || isLoading) return;
    if (window.confirm('Remove all messages from this conversation? This cannot be undone.')) {
      try {
        await fetch(`/api/conversations/${currentConvId}/clear`, { method: 'POST' });
        setMessages([
          {
            id: Date.now(),
            conversation_id: currentConvId,
            role: 'assistant',
            content: 'Conversation history cleared. How can I assist you?',
            created_at: new Date().toISOString(),
          },
        ]);
        onRefreshLogs();
      } catch (err) {
        console.error('Failed to clear conversation', err);
      }
    }
  };

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText('');
    setIsLoading(true);

    const activeId = currentConvId || 1;

    // Optimistic user message
    const tempUserMsg: Message = {
      id: Date.now(),
      conversation_id: activeId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeId,
          text: text,
        }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            conversation_id: activeId,
            role: 'assistant',
            content: data.reply,
            created_at: new Date().toISOString(),
          },
        ]);
        loadConversations();
        onRefreshLogs();
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          conversation_id: activeId,
          role: 'assistant',
          content: `**Unable to complete that request.**\n\n${err?.message || 'Connection failure'}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Quick speech recognition toggle
  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser environment. Use modern Chrome or Edge.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-w-5xl mx-auto">
      {/* Header matching PySide6 ChatPage layout */}
      <PageHeader title="Command Center" eyebrow="Conversation">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wider text-[#6f9cb8] uppercase bg-[#081827] px-2.5 py-1.5 rounded-lg border border-[#27506c]">
            {settings.provider} · {settings.model}
          </span>

          <select
            value={currentConvId || ''}
            onChange={(e) => setCurrentConvId(Number(e.target.value))}
            className="jarvis-input text-xs min-w-[190px] h-9"
          >
            {conversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <button onClick={handleNewChat} className="jarvis-btn text-xs flex items-center gap-1.5 h-9">
            <Plus className="w-3.5 h-3.5 text-[#72e8ff]" />
            <span>New chat</span>
          </button>

          <button onClick={handleClearHistory} className="jarvis-btn text-xs flex items-center gap-1.5 h-9 text-[#f87171] hover:border-[#f87171]">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </PageHeader>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-[#6f9cb8]">
            <div>
              <Sparkles className="w-10 h-10 mx-auto mb-2 text-[#72e8ff]/50 animate-pulse" />
              <p className="font-brand font-semibold text-lg text-[#f4f9ff]">JARVIS Online</p>
              <p className="text-xs text-[#a9c7dc] mt-1">
                Configure your model in Settings, or transmit a command below.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[780px] p-4 rounded-xl border transition-all ${
                    isUser
                      ? 'bg-[#12324b] border-[#29739c]/70 text-[#f4f9ff]'
                      : 'bg-[#0e2135] border-[#1d4868] text-[#e8f1ff]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6f9cb8]">
                      {isUser ? 'YOU' : 'JARVIS'}
                    </span>
                    <span className="text-[9px] text-[#6f9cb8]/70">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans select-text">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[780px] p-4 rounded-xl bg-[#0e2135] border border-[#1d4868] text-[#e8f1ff]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#72e8ff]">
                  JARVIS
                </span>
                <span className="w-2 h-2 rounded-full bg-[#72e8ff] animate-ping" />
              </div>
              <p className="text-xs text-[#6f9cb8] mt-2 font-mono-tech flex items-center gap-2">
                <span>Synthesizing neural reply through {settings.provider}...</span>
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Card matching PySide6 main_window.py */}
      <div className="jarvis-card p-4 shrink-0">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask JARVIS anything…  (Ctrl+Enter to send)"
          className="w-full h-20 bg-transparent resize-none border-none outline-none text-sm text-[#e8f1ff] placeholder-[#6f9cb8]/70"
        />

        <div className="flex items-center justify-between pt-3 border-t border-[#1d4868]/50 mt-2">
          <div className="flex items-center gap-2 text-xs text-[#6f9cb8]">
            <AlertCircle className="w-3.5 h-3.5 text-[#72e8ff]" />
            <span className="hidden sm:inline">
              JARVIS keeps model calls deliberate and system actions permissioned.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleSpeechRecognition}
              title="Push to dictate"
              type="button"
              className={`p-2 rounded-lg border transition-all ${
                isListening
                  ? 'bg-rose-900/60 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-[#123756] border-[#29739c] text-[#72e8ff] hover:bg-[#18517a]'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>

            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputText.trim()}
              className="jarvis-btn flex items-center gap-1.5 text-xs px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5 text-[#72e8ff]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
