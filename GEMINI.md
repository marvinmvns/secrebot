# Project Documentation (GEMINI.md)

This document provides an overview of the project, its structure, and key components, as understood and documented by the Gemini CLI agent. It incorporates detailed technical insights for a comprehensive understanding.

## Table of Contents

- [Project Overview](#project-overview)
- [Directory Structure](#directory-structure)
- [Setup and Running](#setup-and-running)
- [Development Commands](#development-commands)
- [Architecture Overview](#architecture-overview)
- [Key Technologies](#key-technologies)
- [Development Patterns](#development-patterns)
- [Common Development Tasks](#common-development-tasks)
- [Environment Configuration](#environment-configuration)
- [Debugging](#debugging)
- [Security Considerations](#security-considerations)
- [Flow Builder Details](#flow-builder-details)
- [Piper TTS Details](#piper-tts-details)
- [Telegram Bot Details](#telegram-bot-details)
- [Whisper Integration Details](#whisper-integration-details)
- [Jiu-Jitsu Template Details](#jiu-jitsu-template-details)

## Project Overview

**SecreBot** is a comprehensive intelligent assistant for WhatsApp, designed to run locally and offer a wide range of AI-powered functionalities. It integrates with various services to provide features such as:

-   **AI Chat:** Contextual conversations using local LLMs via Ollama.
-   **Audio Processing:** Transcription with Whisper and Text-to-Speech (TTS) with Piper or ElevenLabs.
-   **Visual Analysis:** Image description and calorie counting.
-   **Scheduling:** Intelligent reminders and calendar integration.
-   **Professional Tools:** LinkedIn profile analysis and YouTube video summarization.
-   **Web Interface:** A full-featured dashboard for management, chat, configurations, and resource monitoring.
-   **Flow Builder:** A no-code visual interface for creating conversational flows.

The project emphasizes local execution of AI models, ease of use, extensibility, and a complete feature set without recurring API costs (for core AI functionalities).

## Directory Structure

The project follows a modular structure, with key directories for source code, public assets, views, scripts, and tests.

```
secrebot/
├── 📂 src/                          # Main source code
│   ├── 📄 app.js                    # Application entry point
│   ├── 📂 core/                     # Core bot logic (WhatsApp, Telegram)
│   ├── 📂 services/                 # Modular services (LLM, transcription, scheduler, etc.)
│   ├── 📂 api/                      # REST API endpoints
│   ├── 📂 config/                   # Configuration files
│   ├── 📂 constants/                # Application constants (commands, messages)
│   ├── 📂 utils/                    # Utility functions (job queue, logger, error handling)
│   └── 📂 views/                    # EJS templates for web interface
├── 📂 public/                       # Web assets (CSS, JS, images)
├── 📂 scripts/                      # Installation and utility scripts
├── 📂 test/                         # Automated tests
├── 📂 piper/                        # Local TTS (auto-created upon installation)
├── 📂 templates/                    # Example flow templates
├── 📄 package.json                  # Project dependencies and scripts
├── 📄 .env.example                  # Example environment variables
├── 📄 Dockerfile                    # Docker container definition
├── 📄 docker-compose.yml            # Docker Compose orchestration
├── 📄 Makefile                      # Automated commands
└── 📄 README.md                     # Project documentation
```

## Setup and Running

SecreBot can be set up using automated installation scripts for Linux and Windows, or manually.

**Prerequisites:**
-   Node.js (>=18.0)
-   MongoDB (6.0+)
-   FFmpeg
-   Ollama (latest version)

**Automated Installation (Linux example):**
```bash
wget https://raw.githubusercontent.com/seu-usuario/secrebot/main/install-secrebot-linux.sh
chmod +x install-secrebot-linux.sh
./install-secrebot-linux.sh
```

**Manual Installation (Quick Start):**
```bash
git clone https://github.com/seu-usuario/secrebot.git
cd secrebot
npm install
npx playwright install # For browser automation (e.g., LinkedIn scraper)
# Configure MongoDB and Ollama separately as per README.md
cp .env.example .env
# Edit .env file with your configurations
npm start
```

**Running the application:**
```bash
npm start
```

## Development Commands

### Starting the Application
```bash
pm2 restart 0           # Start the main application
```

### Testing
```bash
npm test                     # Run all tests using Node's built-in test runner
npm test -- --verbose       # Run tests with detailed output
npm test -- --grep "whisper" # Run specific tests matching pattern
```

### Dependencies
```bash
npm install                  # Install all dependencies
npx playwright install      # Install browser automation dependencies (required)
```

### Build and Development Tools
The project uses a Makefile for common tasks:
```bash
make help                    # Show all available commands
make install-deps           # Install Node.js dependencies
make install-piper          # Install Piper TTS with Portuguese model
make test-piper             # Test Piper TTS installation
make status                 # Show status of all components
make start                  # Start the application
make all                    # Complete installation (deps + piper + env)
```

## Architecture Overview

### Core Application Structure
-   **Entry Point**: `src/app.js` - Simple entry point that uses ApplicationFactory.
-   **ApplicationFactory**: `src/core/applicationFactory.js` - Dependency injection container that initializes all services.
-   **WhatsApp Bot**: `src/core/whatsAppBot.js` - Main bot logic with menu system and command handling.
-   **Telegram Bot**: `src/core/telegramBot.js` - Handles Telegram bot interactions, if configured.
-   **REST API**: `src/api/restApi.js` - Express.js web interface and API endpoints.

### Key Components and Services

Based on the `ApplicationFactory`, the following are the core components and services of the SecreBot application:

-   **Scheduler** (`src/services/scheduler.js`): Manages scheduled tasks and interactions, likely involving a database for persistence. Uses MongoDB for scheduling.
-   **ConfigService** (`src/services/configService.js`): Handles application configuration, loading settings from the database and applying them.
-   **LLMService** (`src/services/llmService.js`): Integrates with Large Language Models (LLMs) via Ollama for AI-powered conversational capabilities.
-   **AudioTranscriber** (`src/services/audioTranscriber.js`): Responsible for transcribing audio inputs, likely using Whisper models.
-   **TtsService** (`src/services/ttsService.js`): Provides Text-to-Speech functionality, converting text responses into audio via ElevenLabs or local Piper.
-   **WhatsAppBot** (`src/core/whatsAppBot.js`): The primary bot interface for WhatsApp, handling messages, commands, and interactions. It integrates with FlowService and FlowExecutionService.
-   **TelegramBotService** (`src/core/telegramBot.js`): (Optional) Provides an interface for Telegram bot interactions, if configured.
-   **RestAPI** (`src/api/restApi.js`): Exposes RESTful endpoints for external communication and web interface functionalities.
-   **FlowService** (`src/services/flowService.js`): Manages the creation, storage, and retrieval of conversational flows (no-code).
-   **FlowExecutionService** (`src/services/flowExecutionService.js`): Executes the defined conversational flows, handling the logic and transitions.
-   **FlowDataService** (`src/services/flowDataService.js`): MongoDB persistence layer for flows.
-   **YouTubeService** (`src/services/youtubeService.js`): Handles YouTube video processing, such as summarization or transcription.
-   **LinkedInScraper** (`src/services/linkedinScraper.js`): Performs LinkedIn profile analysis via Playwright.
-   **CalorieService** (`src/services/calorieService.js`): Provides nutrition analysis using API Ninjas.
-   **GoogleCalendarService** (`src/services/googleCalendarService.js`): Handles ICS import functionality.

### Configuration System
-   **Config Directory**: `src/config/` contains modular configuration.
-   **Commands**: `src/constants/commands.js` defines all bot commands and menu shortcuts.
-   **Messages**: `src/constants/messages.js` contains all user-facing text.

## Key Technologies

### Required Dependencies
-   **Node.js 18+**: ES modules with top-level await.
-   **MongoDB 6.0+**: Database for scheduling and flow persistence.
-   **Ollama**: Local LLM server (must be running on `localhost:11434`).
-   **FFmpeg**: Audio processing for Whisper transcription.

### Optional Dependencies
-   **Piper TTS**: Local text-to-speech (auto-installed via scripts).
-   **ElevenLabs**: Premium TTS service (requires API key).
-   **Playwright**: Browser automation for LinkedIn scraping.

## Development Patterns

### Error Handling
-   Global error handlers in `src/utils/errorHandler.js`.
-   All async operations should use try-catch blocks.
-   Logger utility in `src/utils/logger.js` for consistent logging.

### Database Usage
-   MongoDB connections are managed by individual services.
-   No global database connection - each service manages its own.
-   Collections: `sched` (scheduling), `flows` (flow builder).

### WhatsApp Bot Commands
-   Commands use `!` prefix (e.g., `!menu`, `!deep`, `!transcrever`).
-   Numeric shortcuts for menu navigation (e.g., `1.1`, `2.3.1`).
-   State management via `chatModes` Map for user sessions.
-   Menu system is hierarchical with up to 3 levels.

### Flow Builder System
-   Visual drag-and-drop interface at `/flow-builder`.
-   Node types: start, message, condition, webhook, llm, delay, variable.
-   Flows are executed via WhatsApp commands: `!flow start <alias>`.
-   Alias system allows user-friendly names for flows.

## Common Development Tasks

### Adding New Commands
1.  Add command constant to `src/constants/commands.js`.
2.  Add numeric shortcut to menu system if needed.
3.  Implement handler in `src/core/whatsAppBot.js`.
4.  Add corresponding message templates to `src/constants/messages.js`.

### Adding New Services
1.  Create service file in `src/services/`.
2.  Register in `src/core/applicationFactory.js`.
3.  Inject dependencies via constructor.
4.  Add configuration options to `src/config/config.js`.

### Testing
-   Test files are in `/test` directory.
-   Uses Node's built-in test runner (no Mocha/Jest).
-   Integration tests require MongoDB and Ollama running.
-   Whisper tests require FFmpeg.

## Environment Configuration

-   Copy `.env.example` to `.env` for development.
-   Key variables: `MONGO_URI`, `OLLAMA_HOST`, `LLM_MODEL`.
-   TTS configuration: `PIPER_ENABLED` or `ELEVENLABS_API_KEY`.
-   Optional: `CALORIE_API_KEY`, `LINKEDIN_USER`, Google Calendar OAuth.

## Debugging

-   Logs are written to console and optionally to files.
-   Use `logger.debug()`, `logger.info()`, `logger.error()` consistently.
-   WhatsApp session data stored in `.wwebjs_auth/` (can be deleted to reset).

## Security Considerations

This is a defensive security tool for WhatsApp automation. When working with this codebase:
-   Avoid adding features that could be used maliciously.
-   Be cautious with file uploads and user input validation.
-   The LinkedIn scraper uses browser automation - ensure it remains ethical.
-   MongoDB queries should be parameterized to prevent injection.
-   API keys and credentials should never be committed to the repository.

## Flow Builder Details

The Flow Builder is a no-code/low-code visual interface for creating automated conversational flows for WhatsApp. It allows users to design, edit, and test interaction flows using an intuitive drag-and-drop interface.

### Architecture
-   **Frontend Interface**: `src/views/flow-builder.ejs` provides the visual construction area with a node palette, editing canvas, properties panel, and toolbar.
-   **Frontend JavaScript**: `src/public/js/flow-builder.js` handles the UI logic, including drag-and-drop, connection management, flow serialization, and validation.
-   **Execution Service**: `src/services/flowExecutionService.js` acts as the flow execution engine, processing nodes in real-time, managing user states, and integrating with WhatsApp Web.js.
-   **REST API**: `src/api/restApi.js` exposes endpoints for flow persistence and testing (`/flow-builder`, `/api/flow/save`, `/api/flow/list`, `/api/flow/:id`, `/api/flow/test`, `/api/flow/delete`).
-   **Alias System**: Allows friendly names for flows, automatically generated from flow names, supporting `!flow start <alias>` commands.

### Node Types
-   `start`: Entry point (keyword, any, button triggers).
-   `message`: Sends text messages (supports `{{variables}}`).
-   `condition`: Branches based on conditions (contains, equals, starts, ends, regex).
-   `input`: Waits for user input, stores in a variable.
-   `delay`: Pauses execution for a specified time.
-   `llm`: Generates AI responses via `llmService`.
-   `webhook`: Calls external APIs (HTTP method, headers, body).
-   `end`: Terminates the flow.

### Variable System
-   **Standard Variables**: `userInput`, `userId`, `webhookResponse`.
-   **Syntax**: `{{variable}}` for use in messages.
-   **Scope**: Variables persist throughout flow execution and are cleared upon completion.

### Persistence
Flows are saved in MongoDB via `configService` with a structured JSON format including nodes, connections, and metadata.

## Piper TTS Details

Piper TTS provides local and free Text-to-Speech capabilities. The project offers simplified installation scripts and detailed configuration.

### Installation
-   **Recommended**: `make install-piper` or `./scripts/install-piper-simple.sh` for quick installation using pre-compiled binaries without external dependencies like `espeak-ng`.
-   **Manual Configuration**: Set `PIPER_ENABLED`, `PIPER_EXECUTABLE` (to `./piper/piper-wrapper.sh`), and `PIPER_MODEL` in `.env`.

### Architecture and Benefits
-   **Externalized Configuration**: `piper-models.json` centralizes model configurations and URLs.
-   **Improved Scripts**: `install-piper.sh` and `install-piper.py` support JSON parsing, dynamic downloads, and architecture-specific models.
-   **Benefits**: Improved maintainability, flexibility (easy addition of models/languages), security (sensitive data not committed), performance (ignored cache), compatibility (multiple architectures), and usability.

### Troubleshooting
Common issues include `libpiper_phonemize.so.1` errors (use wrapper script), `espeak-ng-data` errors (install `espeak-ng-data` or use simple installer), and audio generation failures (check model/executable permissions).

## Telegram Bot Details

SecreBot can be integrated with Telegram, offering similar AI-powered functionalities.

### Configuration
1.  Create a bot via `@BotFather` to obtain a `TELEGRAM_BOT_TOKEN`.
2.  Add `TELEGRAM_BOT_TOKEN` and feature toggles (e.g., `TELEGRAM_FEATURE_AI_CHAT=true`) to `.env`.
3.  Initialize the bot with `npm start`.

### Usage
-   **Commands**: `/start`, `/help`.
-   **Menu Structure**: Hierarchical menu for AI & Chat, Agenda, Media, Analysis, and Configurations.
-   **Content Types**: Supports text messages, audio (automatic transcription), images (analysis, calorie counting), and documents (summary).

### Feature Toggles
-   **User-specific**: Stored in MongoDB, allowing personalized feature sets.
-   **Global**: Configured via `.env` variables.
-   **Priority**: User config > Environment config > Default config.

### Security
-   **Token Protection**: Never share the bot token; use environment variables.
-   **User Validation**: Restrict access with `TELEGRAM_ALLOWED_USERS`.
-   **Rate Limiting**: Basic controls implemented to prevent spam.

## Whisper Integration Details

Whisper is used for audio transcription, supporting both local and API modes with load balancing.

### Identified Issues and Recommendations
-   **Large Model Usage**: Using `large-v3-turbo` for all cases leads to slow transcriptions. **Recommendation**: Implement dynamic model selection based on audio duration (`tiny` for <30s, `base` for <2min, `small` for <10min, `large-v3-turbo` for >10min).
-   **Inadequate Timeout**: 120s timeout might be insufficient for large models. **Recommendation**: Adjust timeout dynamically based on audio duration and model size.
-   **Manual Integration**: Code uses manual `spawn` instead of `nodejs-whisper` API. **Status**: Functional but can be optimized.
-   **Load Balancing**: The system was not effectively balancing audio processing requests when in API mode. **Correction**: The `getLoadScore` function in `src/services/whisperApiClient.js` now includes `activeRequests` to better reflect immediate load, and `WhisperAPIPool` updates this status before selecting the best client.

### Tested Integrations
-   `AudioTranscriber` Service (`src/services/audioTranscriber.js`)
-   `YouTube` Service (`src/services/youtubeService.js`)
-   `Telegram Bot` (`src/core/telegramBot.js`)
-   `WhatsApp Bot` (`src/core/whatsAppBot.js`)
-   `REST API` (`src/api/restApi.js`)

## Jiu-Jitsu Template Details

This template provides a complete and interactive flow for automated customer service for Jiu-Jitsu academies via WhatsApp.

### Overview
-   **Features**: Academy presentation, modality info, pricing, trial class scheduling, location/hours, benefits, instructor contact, testimonials, and AI-powered responses.
-   **Activation Keywords**: "academia", "jiu-jitsu", "jiujitsu", "arte marcial", "luta".

### Installation
-   Import `template_academia_jiu_jitsu.json` via the web interface (`http://localhost:3000/flow-builder`) or REST API (`POST /api/flow/import`).
-   **Personalization**: Edit location, prices, schedules, contacts, and instructor details within the template.
-   **Integrations**: Configure webhooks for scheduling and AI (e.g., OpenAI API token and prompt).

### Customization
-   **Advanced Nodes**: Add promotion, event, graduation, or competition nodes.
-   **Custom Variables**: Use `{{nomeAcademia}}`, `{{professores}}`, etc.
-   **Visual Customization**: Utilize emojis and maintain a friendly, motivating tone in messages.

### Troubleshooting
Common issues include flows not starting (check keywords, loaded status), webhook failures (check URL, token), AI not responding (check API token, credits), and variables not substituting (check syntax, definition).