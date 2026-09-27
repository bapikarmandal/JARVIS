export type PageId =
  | 'home'
  | 'chat'
  | 'voice'
  | 'memory'
  | 'plugins'
  | 'automation'
  | 'system'
  | 'settings'
  | 'logs';

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface Memory {
  id: number;
  category: string;
  content: string;
  importance: number;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: number;
  title: string;
  due_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  enabled: boolean;
}

export interface ActivityLog {
  id: number;
  category: string;
  level: string;
  message: string;
  created_at: string;
}

export interface Settings {
  provider: 'gemini' | 'ollama' | 'openai_compatible';
  model: string;
  base_url: string;
  has_custom_key: boolean;
  has_system_key: boolean;
}

export interface SystemSummary {
  platform: string;
  python: string;
  architecture: string;
  status: string;
  uptime: number;
  timestamp: string;
}
