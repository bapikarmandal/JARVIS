import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// In-Memory Durable Database modeled after jarvis.storage.database.Database
interface SettingItem {
  value: string;
  updated_at: string;
}

interface MessageItem {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface ConversationItem {
  id: number;
  title: string;
  created_at: string;
}

interface MemoryItem {
  id: number;
  category: string;
  content: string;
  importance: number;
  created_at: string;
  updated_at: string;
}

interface ReminderItem {
  id: number;
  title: string;
  due_at: string;
  completed_at: string | null;
  created_at: string;
}

interface ActivityLogItem {
  id: number;
  category: string;
  level: string;
  message: string;
  created_at: string;
}

interface SafetyToken {
  token: string;
  action: string;
  detail: string;
  createdAt: number;
}

class JarvisStorage {
  private settings: Map<string, SettingItem> = new Map();
  private conversations: ConversationItem[] = [];
  private messages: MessageItem[] = [];
  private memories: MemoryItem[] = [];
  private reminders: ReminderItem[] = [];
  private logs: ActivityLogItem[] = [];
  private safetyTokens: Map<string, SafetyToken> = new Map();
  private nextConvId = 1;
  private nextMsgId = 1;
  private nextMemId = 1;
  private nextRemId = 1;
  private nextLogId = 1;

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    this.settings.set('provider', { value: 'gemini', updated_at: new Date().toISOString() });
    this.settings.set('model', { value: 'gemini-2.5-flash', updated_at: new Date().toISOString() });
    this.settings.set('base_url', { value: 'https://generativelanguage.googleapis.com', updated_at: new Date().toISOString() });
    this.settings.set('api_key', { value: '', updated_at: new Date().toISOString() });

    // Seed default initial memories
    this.addMemory('preference', 'Commander prefers concise, high-efficiency tactical briefings.', 3);
    this.addMemory('identity', 'JARVIS is configured as an autonomous Personal OS with SafetyGate.', 2);
    this.addMemory('protocol', 'Destructive actions require explicit confirmation tokens.', 2);

    // Seed initial conversation
    const convId = this.createConversation('System Initialization');
    this.addMessage(convId, 'assistant', 'JARVIS online. All core systems operational. SafetyGate active. How may I assist you, Commander?');

    // Initial logs
    this.log('system', 'info', 'JARVIS Core initialized with SafetyGate protocols.');
    this.log('ai', 'info', 'Configured default AI model provider.');
    this.log('memory', 'info', 'Loaded baseline memory vault facts.');
  }

  getSetting(key: string, defaultValue = ''): string {
    return this.settings.get(key)?.value ?? defaultValue;
  }

  setSetting(key: string, value: string): void {
    this.settings.set(key, { value, updated_at: new Date().toISOString() });
  }

  createConversation(title = 'New conversation'): number {
    const id = this.nextConvId++;
    this.conversations.unshift({
      id,
      title: title.slice(0, 80),
      created_at: new Date().toISOString(),
    });
    return id;
  }

  listConversations(): ConversationItem[] {
    return this.conversations;
  }

  setConversationTitle(id: number, title: string): void {
    const conv = this.conversations.find((c) => c.id === id);
    if (conv) conv.title = title.slice(0, 80);
  }

  addMessage(conversation_id: number, role: 'user' | 'assistant' | 'system', content: string): MessageItem {
    const id = this.nextMsgId++;
    const msg: MessageItem = {
      id,
      conversation_id,
      role,
      content,
      created_at: new Date().toISOString(),
    };
    this.messages.push(msg);
    return msg;
  }

  getMessages(conversation_id: number, limit = 50): MessageItem[] {
    return this.messages
      .filter((m) => m.conversation_id === conversation_id)
      .slice(-limit);
  }

  clearConversation(conversation_id: number): void {
    this.messages = this.messages.filter((m) => m.conversation_id !== conversation_id);
    this.log('chat', 'info', `Cleared messages for conversation #${conversation_id}`);
  }

  deleteConversation(conversation_id: number): void {
    this.conversations = this.conversations.filter((c) => c.id !== conversation_id);
    this.messages = this.messages.filter((m) => m.conversation_id !== conversation_id);
    this.log('chat', 'info', `Deleted conversation #${conversation_id}`);
  }

  addMemory(category: string, content: string, importance = 1): MemoryItem {
    const id = this.nextMemId++;
    const now = new Date().toISOString();
    const mem: MemoryItem = {
      id,
      category: category || 'general',
      content: content.trim(),
      importance: Number(importance) || 1,
      created_at: now,
      updated_at: now,
    };
    this.memories.unshift(mem);
    return mem;
  }

  searchMemories(query: string): MemoryItem[] {
    if (!query.trim()) {
      return [...this.memories].sort((a, b) => b.importance - a.importance);
    }
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    return this.memories
      .map((mem) => {
        const text = (mem.content + ' ' + mem.category).toLowerCase();
        const score = words.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0);
        return { mem, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.mem.importance - a.mem.importance)
      .map((item) => item.mem);
  }

  deleteMemory(id: number): boolean {
    const initialLen = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    return this.memories.length < initialLen;
  }

  addReminder(title: string, minutes: number): ReminderItem {
    const id = this.nextRemId++;
    const now = new Date();
    const due = new Date(now.getTime() + minutes * 60 * 1000);
    const item: ReminderItem = {
      id,
      title: title.trim(),
      due_at: due.toISOString(),
      completed_at: null,
      created_at: now.toISOString(),
    };
    this.reminders.unshift(item);
    return item;
  }

  listReminders(): ReminderItem[] {
    return this.reminders;
  }

  completeReminder(id: number): boolean {
    const item = this.reminders.find((r) => r.id === id);
    if (item) {
      item.completed_at = new Date().toISOString();
      return true;
    }
    return false;
  }

  log(category: string, level: string, message: string): void {
    const id = this.nextLogId++;
    this.logs.unshift({
      id,
      category,
      level,
      message,
      created_at: new Date().toISOString(),
    });
    if (this.logs.length > 500) {
      this.logs.pop();
    }
  }

  getLogs(limit = 150): ActivityLogItem[] {
    return this.logs.slice(0, limit);
  }

  clearLogs(): void {
    this.logs = [];
    this.log('system', 'info', 'Audit logs cleared.');
  }

  createSafetyToken(action: string, detail: string): string {
    const token = 'tok_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    this.safetyTokens.set(token, {
      token,
      action,
      detail,
      createdAt: Date.now(),
    });
    return token;
  }

  validateAndConsumeToken(action: string, token: string): boolean {
    const record = this.safetyTokens.get(token);
    if (!record) return false;
    this.safetyTokens.delete(token);
    // Token valid within 5 minutes
    if (Date.now() - record.createdAt > 5 * 60 * 1000) return false;
    return record.action === action;
  }
}

const storage = new JarvisStorage();

// Installed Plugins
interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  enabled: boolean;
}

const plugins: PluginInfo[] = [
  {
    id: 'memory',
    name: 'Memory Vault',
    version: '1.0.0',
    description: 'Stores and retrieves user-approved facts across sessions.',
    permissions: ['memory.read', 'memory.write'],
    enabled: true,
  },
  {
    id: 'system',
    name: 'System Utilities & SafetyGate',
    version: '1.0.0',
    description: 'Executes guarded power workflows, URL routing, and screen captures.',
    permissions: ['system.open_url', 'system.power', 'system.screenshot'],
    enabled: true,
  },
  {
    id: 'automation',
    name: 'Automation & Reminders',
    version: '1.0.0',
    description: 'Schedules durable local notifications and timer triggers.',
    permissions: ['notifications.schedule'],
    enabled: true,
  },
  {
    id: 'voice',
    name: 'Voice Engine & Audio Synthesizer',
    version: '1.0.0',
    description: 'High-fidelity speech synthesis and push-to-talk speech recognition.',
    permissions: ['audio.synthesize', 'audio.transcribe'],
    enabled: true,
  },
];

// API Routes
app.get('/api/system/summary', (req, res) => {
  res.json({
    platform: 'JARVIS Modular Cloud OS (Linux/x86_64)',
    python: '3.14.7 Compatible',
    architecture: 'x86_64',
    status: 'ONLINE',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/settings', (req, res) => {
  res.json({
    provider: storage.getSetting('provider', 'gemini'),
    model: storage.getSetting('model', 'gemini-2.5-flash'),
    base_url: storage.getSetting('base_url', 'https://generativelanguage.googleapis.com'),
    has_custom_key: Boolean(storage.getSetting('api_key')),
    has_system_key: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.post('/api/settings', (req, res) => {
  const { provider, model, base_url, api_key } = req.body;
  if (!model?.trim()) {
    return res.status(400).json({ error: 'A model name is required.' });
  }
  storage.setSetting('provider', provider || 'gemini');
  storage.setSetting('model', model.trim());
  if (base_url !== undefined) storage.setSetting('base_url', base_url.trim());
  if (api_key !== undefined && api_key.trim()) {
    storage.setSetting('api_key', api_key.trim());
  }
  storage.log('settings', 'info', `Updated ${provider || 'default'} model settings to ${model}.`);
  res.json({ success: true, message: 'Settings saved. Keys maintained securely.' });
});

app.get('/api/conversations', (req, res) => {
  res.json(storage.listConversations());
});

app.post('/api/conversations', (req, res) => {
  const title = req.body.title || 'New conversation';
  const id = storage.createConversation(title);
  storage.log('chat', 'info', `Created conversation #${id}: "${title}".`);
  res.json({ id, title });
});

app.get('/api/conversations/:id/messages', (req, res) => {
  const id = parseInt(req.params.id, 10);
  res.json(storage.getMessages(id));
});

app.delete('/api/conversations/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  storage.deleteConversation(id);
  res.json({ success: true });
});

app.post('/api/conversations/:id/clear', (req, res) => {
  const id = parseInt(req.params.id, 10);
  storage.clearConversation(id);
  res.json({ success: true });
});

// Chat Orchestration Endpoint
app.post('/api/chat', async (req, res) => {
  const { conversationId, text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Prompt text is required.' });
  }

  const convId = Number(conversationId) || storage.createConversation('New conversation');
  const userText = text.trim();

  // Save user message
  storage.addMessage(convId, 'user', userText);

  // If first user message, update title
  const existingMsgs = storage.getMessages(convId);
  if (existingMsgs.filter((m) => m.role === 'user').length <= 1) {
    storage.setConversationTitle(convId, userText.slice(0, 40));
  }

  // Inject relevant memories
  const recalledMemories = storage.searchMemories(userText).slice(0, 5);
  const memoryContext = recalledMemories.map((m) => `- [${m.category}] ${m.content}`).join('\n');

  const systemPrompt = `You are JARVIS, a highly capable, concise, tactical, and safety-conscious personal AI operating system.
Your demeanor is sharp, professional, and respectful (referring to the user occasionally as Commander or Sir/Ma'am when fitting).
Keep responses helpful, structured, and direct without unnecessary filler.
Never claim to have executed a physical or destructive system action unless SafetyGate authorization has completed.
${memoryContext ? `\nRelevant verified user memories from the Vault:\n${memoryContext}` : ''}`;

  const provider = storage.getSetting('provider', 'gemini');
  const model = storage.getSetting('model', 'gemini-2.5-flash');
  const customKey = storage.getSetting('api_key');
  const effectiveKey = customKey || process.env.GEMINI_API_KEY || '';

  let assistantReply = '';

  try {
    if (provider === 'gemini') {
      if (!effectiveKey) {
        // Fallback intelligent simulation when no API key is yet configured
        assistantReply = `[Safety Mode Simulation] Greeting Commander. Your query has been processed: "${userText}".\n\nTo enable full live neural inference, enter your Gemini API key in **Settings**, or verify that the server environment key is configured. All local functions (Memory, Automation, System Tools, SafetyGate) remain 100% active.`;
      } else {
        const ai = new GoogleGenAI({ apiKey: effectiveKey });
        // Prepare conversation history
        const history = existingMsgs.slice(-10).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const response = await ai.models.generateContent({
          model: model || 'gemini-2.5-flash',
          contents: [
            ...history,
            {
              role: 'user',
              parts: [{ text: userText }],
            },
          ],
          config: {
            systemInstruction: systemPrompt,
          },
        });

        assistantReply = response.text || 'JARVIS received no text output from the neural provider.';
      }
    } else {
      // Ollama or OpenAI-compatible endpoint
      const baseUrl = storage.getSetting('base_url', 'http://127.0.0.1:11434');
      if (provider === 'ollama') {
        const fetchRes = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model || 'llama3.2',
            stream: false,
            messages: [
              { role: 'system', content: systemPrompt },
              ...existingMsgs.slice(-8).map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: userText },
            ],
          }),
        });
        if (!fetchRes.ok) {
          throw new Error(`Ollama returned status ${fetchRes.status}: ${await fetchRes.text()}`);
        }
        const data = await fetchRes.json();
        assistantReply = data?.message?.content || 'No response content from Ollama.';
      } else {
        // OpenAI compatible
        const fetchRes = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...existingMsgs.slice(-8).map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: userText },
            ],
          }),
        });
        if (!fetchRes.ok) {
          throw new Error(`OpenAI compatible endpoint error: ${fetchRes.status}`);
        }
        const data = await fetchRes.json();
        assistantReply = data?.choices?.[0]?.message?.content || 'No response content.';
      }
    }
  } catch (err: any) {
    console.error('Chat generation error:', err);
    storage.log('ai', 'error', `Generation failed: ${err.message}`);
    assistantReply = `**JARVIS Diagnostic Alert:** Unable to complete neural request through ${provider}/${model}.\n\n*Error details:* ${err.message}\n\nPlease verify your configuration in Settings.`;
  }

  // Save assistant message
  storage.addMessage(convId, 'assistant', assistantReply);
  storage.log('ai', 'info', `Completed response via ${provider}/${model}.`);

  res.json({
    conversationId: convId,
    reply: assistantReply,
  });
});

// Memory Vault API
app.get('/api/memories', (req, res) => {
  const q = req.query.q as string;
  res.json(storage.searchMemories(q || ''));
});

app.post('/api/memories', (req, res) => {
  const { content, category, importance } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Memory content cannot be empty.' });
  }
  const item = storage.addMemory(category || 'fact', content.trim(), importance || 1);
  storage.log('memory', 'info', `Stored memory #${item.id} [${item.category}]: "${item.content.slice(0, 30)}..."`);
  res.json(item);
});

app.delete('/api/memories/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const success = storage.deleteMemory(id);
  if (success) {
    storage.log('memory', 'info', `Purged memory #${id} from vault.`);
  }
  res.json({ success });
});

// Reminders & Automation API
app.get('/api/reminders', (req, res) => {
  res.json(storage.listReminders());
});

app.post('/api/reminders', (req, res) => {
  const { title, minutes } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Reminder title is required.' });
  }
  const min = Math.max(1, parseInt(minutes, 10) || 15);
  const item = storage.addReminder(title.trim(), min);
  storage.log('automation', 'info', `Scheduled local reminder "${item.title}" for +${min} minutes.`);
  res.json(item);
});

app.post('/api/reminders/:id/complete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const success = storage.completeReminder(id);
  if (success) {
    storage.log('automation', 'info', `Completed reminder #${id}.`);
  }
  res.json({ success });
});

// Plugins API
app.get('/api/plugins', (req, res) => {
  res.json(plugins);
});

app.post('/api/plugins/:id/toggle', (req, res) => {
  const plugin = plugins.find((p) => p.id === req.params.id);
  if (!plugin) return res.status(404).json({ error: 'Plugin not found' });
  plugin.enabled = !plugin.enabled;
  storage.log('plugins', 'info', `Toggled plugin "${plugin.name}" to ${plugin.enabled ? 'Enabled' : 'Disabled'}.`);
  res.json(plugin);
});

// SafetyGate & System Tools API
app.post('/api/system/request_power', (req, res) => {
  const { action } = req.body;
  if (!['lock', 'sleep', 'restart', 'shutdown'].includes(action)) {
    return res.status(400).json({ error: `Unsupported power action: ${action}` });
  }
  const detail = `${action.toUpperCase()} workstation session`;
  const token = storage.createSafetyToken(action, detail);
  storage.log('security', 'warning', `SafetyGate issued confirmation token for power action: ${action}`);
  res.json({
    action,
    detail,
    token,
    riskLevel: 'DANGEROUS',
    requiresConfirmation: true,
  });
});

app.post('/api/system/execute_power', (req, res) => {
  const { action, token } = req.body;
  const isValid = storage.validateAndConsumeToken(action, token);
  if (!isValid) {
    storage.log('security', 'error', `SafetyGate DENIED unauthorized or expired execution of power action: ${action}`);
    return res.status(403).json({
      error: 'Security gate rejected execution: Invalid, already consumed, or expired confirmation token.',
    });
  }

  storage.log('security', 'warning', `SafetyGate CONFIRMED and EXECUTED power action: ${action.toUpperCase()}`);
  res.json({
    success: true,
    action,
    message: `Workstation ${action} command acknowledged and dispatched safely.`,
  });
});

app.post('/api/system/open_url', (req, res) => {
  const { url } = req.body;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are authorized.' });
    }
    storage.log('system', 'info', `Dispatched browser URL dispatch: ${url}`);
    res.json({ success: true, url });
  } catch {
    res.status(400).json({ error: 'Invalid URL format provided.' });
  }
});

// Activity Logs API
app.get('/api/logs', (req, res) => {
  res.json(storage.getLogs());
});

app.delete('/api/logs', (req, res) => {
  storage.clearLogs();
  res.json({ success: true });
});

// Vite Integration (Dev Middleware or Production Static Serve)
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`JARVIS Personal OS server online at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
