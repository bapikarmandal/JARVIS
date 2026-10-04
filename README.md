<div align="center">
  <h1>JARVIS</h1>
  <p><strong>A safety-conscious personal AI workspace for chat, memory, voice, and local automation.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/Google_Gemini-API-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Google Gemini API" />
  </p>
</div>

JARVIS is a full-stack web application that combines a sci-fi-inspired command dashboard with practical AI-assistant features. Connect Gemini, Ollama, or an OpenAI-compatible endpoint; keep conversations and selected memories in the current session; use browser voice controls; and explore guarded system-action flows.

> **Current storage model:** application data is held in memory. Conversations, memories, reminders, settings, and logs are reset when the server restarts.

## Features

- **AI command center** — Chat with Gemini, Ollama, or an OpenAI-compatible provider, with recent context and relevant memory injected into prompts.
- **Memory vault** — Add, search, prioritize, and remove facts or preferences during the active session.
- **Voice interface** — Browser-based text-to-speech and explicit push-to-talk transcription through the Web Speech APIs.
- **Reminders and automation** — Create and complete session-based reminders.
- **Plugin dashboard** — View and toggle the built-in Memory, System, Automation, and Voice modules.
- **Activity logs** — Inspect application, model, memory, and safety events.
- **SafetyGate** — Power actions require a short-lived, single-use confirmation token before the server acknowledges the action.

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Lucide icons |
| Backend | Node.js, Express, TypeScript |
| AI providers | Google Gemini SDK, Ollama HTTP API, OpenAI-compatible Chat Completions API |
| Browser capabilities | Web Speech API, Screen Capture API |

## Quick Start

### Prerequisites

- Node.js 20 or later
- npm
- A Gemini API key, a running Ollama instance, or credentials for an OpenAI-compatible endpoint (optional for exploring the interface)

### Install and run

```powershell
git clone https://github.com/bapikarmandal/JARVIS.git
cd JARVIS
Copy-Item .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without an AI key, the chat interface remains available and returns a clearly labelled safety-mode simulation. Add a provider key in **Settings** or configure the server environment to enable live model responses.

## Configuration

Create a local `.env` from the included `.env.example` file:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

`.env` is ignored by Git—never commit API keys. The Settings page also accepts a key for the active runtime session. That value is stored only in the server process’s in-memory settings and is lost after restart.

### Provider options

| Provider | Suggested setup |
| --- | --- |
| Gemini | Select `gemini`, choose a Gemini model, and set `GEMINI_API_KEY` or enter a session key in Settings. |
| Ollama | Select `ollama`, run Ollama locally, and use a base URL such as `http://127.0.0.1:11434`. |
| OpenAI-compatible | Select `openai_compatible`, supply the provider base URL and model, then enter a session key. |

## Available Scripts

```bash
npm run dev      # Start Express with Vite development middleware
npm run build    # Type-check and create a production frontend build
npm run start    # Start the Express server
npm run lint     # Run the TypeScript type checker without emitting files
```

To serve the built application, run `npm run build`, set `NODE_ENV=production`, then run `npm start`.

## Project Structure

```text
src/
├── components/
│   ├── pages/       # Dashboard modules: chat, voice, memory, system, logs, etc.
│   ├── PageHeader.tsx
│   └── Sidebar.tsx
├── App.tsx          # Application shell and page routing
├── main.tsx         # React entry point
└── types.ts         # Shared client types
server.ts            # Express API, in-memory store, AI orchestration, and Vite integration
```

## Safety Notes

JARVIS validates web URLs and uses an explicit two-step confirmation flow for `lock`, `sleep`, `restart`, and `shutdown`. Tokens are action-specific, expire after five minutes, and are consumed after use.

At present, confirmed power actions are **acknowledged and logged only**; `server.ts` does not invoke operating-system power commands. This makes the current implementation safe to run as a web application while leaving room for a future, explicitly permissioned native integration.

Browser microphone and screen access are also opt-in: the app requests them only when you use push-to-talk or screenshot capture.

## Roadmap

- Persist data with a database rather than the current in-memory store
- Add authenticated user accounts and encrypted secret storage
- Stream AI responses in the chat interface
- Support real, permissioned desktop actions through a native companion
- Add tests for API routes and UI workflows

---

Built by [Bapikar Mandal](https://github.com/bapikarmandal).
