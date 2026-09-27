# JARVIS

JARVIS is a modular desktop AI assistant built with Python and PySide6. It keeps local data in SQLite, supports Gemini, OpenAI-compatible endpoints, and Ollama, and treats system actions as permissioned capabilities.

## Current capabilities

- Desktop workspace for chat, voice output, memory, plugins, reminders, system utilities, settings, and logs.
- Provider abstraction with real Gemini, OpenAI-compatible, and Ollama HTTP integrations.
- Persistent conversations, searchable long-term memory, preferences, reminders, and structured activity logs.
- Plugin lifecycle management with isolated failures and built-in Memory and System plugins.
- Safety gate for actions that must be confirmed before execution.

## Requirements

- Python **3.14.7** (64-bit) on Windows. The project’s supported interpreter range is `>=3.14,<3.15`.
- Windows, macOS, or Linux (the UI works across platforms; some system capabilities are platform-specific)

JARVIS targets the regular CPython build, not the experimental free-threaded build. Download the Windows installer from [python.org](https://www.python.org/ftp/python/3.14.7/python-3.14.7-amd64.exe) and enable **Add python.exe to PATH** during installation.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev,voice,vision]"
python -m jarvis
```

On first launch, select a provider and model in **Settings**. API keys are stored with the operating system keyring, not in SQLite. For Ollama, install and run Ollama locally, then use its default `http://localhost:11434` endpoint.

For push-to-talk transcription, install the optional speech package with `python -m pip install -e ".[speech]"` and a CPython 3.14-compatible PortAudio/PyAudio microphone backend. It is intentionally separate from the default install because upstream PyAudio does not currently publish a Windows x64 CPython 3.14 wheel; this keeps standard JARVIS installs free from an unreliable native build step.

## Project layout

```
src/jarvis/
  ai/          Provider adapters and chat orchestration
  core/        Configuration, logging, errors, and safety policy
  memory/      Searchable durable memories
  plugins/     Plugin contracts, loader, and built-ins
  storage/     SQLite persistence and secure secret storage
  system/      Explicitly permissioned desktop capabilities
  automation/  Reminders and scheduled-work foundation
  ui/          PySide6 application shell and views
  voice/       Text-to-speech service
```

## Security model

Destructive actions are not exposed as direct commands. A capability declares its risk level and must pass `SafetyGate` before it can execute. Shutdown, restart, sleep, locking, and file deletion require a separate, explicit confirmation flow before any operating-system call is made. JARVIS does not persist API keys in its database or log request secrets.

## Development

```powershell
python -m compileall -q src
python -m pytest
python -m ruff check .
```

The repository starts with no remote code history; this implementation is an initial production-oriented baseline rather than a rewrite of pre-existing source.
