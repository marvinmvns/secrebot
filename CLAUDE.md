# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Application
```bash
npm start                    # Start the main application
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
- **Entry Point**: `src/app.js` - Simple entry point that uses ApplicationFactory
- **ApplicationFactory**: `src/core/applicationFactory.js` - Dependency injection container that initializes all services
- **WhatsApp Bot**: `src/core/whatsAppBot.js` - Main bot logic with menu system and command handling
- **REST API**: `src/api/restApi.js` - Express.js web interface and API endpoints

### Key Services
- **LLM Service** (`src/services/llmService.js`): Ollama integration for local AI models
- **Audio Transcriber** (`src/services/audioTranscriber.js`): Whisper integration for audio transcription
- **TTS Service** (`src/services/ttsService.js`): Text-to-speech via ElevenLabs or local Piper
- **Scheduler** (`src/services/scheduler.js`): MongoDB-based scheduling system for reminders
- **Flow Services**: 
  - `flowService.js`: Flow management and CRUD operations
  - `flowExecutionService.js`: Runtime execution of flows
  - `flowDataService.js`: MongoDB persistence layer for flows

### External Integrations
- **YouTube Service**: Video transcription and summarization
- **LinkedIn Scraper**: Profile analysis via Playwright
- **Calorie Service**: Nutrition analysis using API Ninjas
- **Google Calendar**: ICS import functionality

### Configuration System
- **Config Directory**: `src/config/` contains modular configuration
- **Commands**: `src/constants/commands.js` defines all bot commands and menu shortcuts
- **Messages**: `src/constants/messages.js` contains all user-facing text

## Key Technologies

### Required Dependencies
- **Node.js 18+**: ES modules with top-level await
- **MongoDB 6.0+**: Database for scheduling and flow persistence
- **Ollama**: Local LLM server (must be running on localhost:11434)
- **FFmpeg**: Audio processing for Whisper transcription

### Optional Dependencies
- **Piper TTS**: Local text-to-speech (auto-installed via scripts)
- **ElevenLabs**: Premium TTS service (requires API key)
- **Playwright**: Browser automation for LinkedIn scraping

## Development Patterns

### Error Handling
- Global error handlers in `src/utils/errorHandler.js`
- All async operations should use try-catch blocks
- Logger utility in `src/utils/logger.js` for consistent logging

### Database Usage
- MongoDB connections are managed by individual services
- No global database connection - each service manages its own
- Collections: `sched` (scheduling), `flows` (flow builder)

### WhatsApp Bot Commands
- Commands use `!` prefix (e.g., `!menu`, `!deep`, `!transcrever`)
- Numeric shortcuts for menu navigation (e.g., `1.1`, `2.3.1`)
- State management via `chatModes` Map for user sessions
- Menu system is hierarchical with up to 3 levels

### Flow Builder System
- Visual drag-and-drop interface at `/flow-builder`
- Node types: start, message, condition, webhook, llm, delay, variable
- Flows are executed via WhatsApp commands: `!flow start <alias>`
- Alias system allows user-friendly names for flows

## Common Development Tasks

### Adding New Commands
1. Add command constant to `src/constants/commands.js`
2. Add numeric shortcut to menu system if needed
3. Implement handler in `src/core/whatsAppBot.js`
4. Add corresponding message templates to `src/constants/messages.js`

### Adding New Services
1. Create service file in `src/services/`
2. Register in `src/core/applicationFactory.js`
3. Inject dependencies via constructor
4. Add configuration options to `src/config/config.js`

### Testing
- Test files are in `/test` directory
- Use Node's built-in test runner (no Mocha/Jest)
- Integration tests require MongoDB and Ollama running
- Whisper tests require FFmpeg

### Environment Configuration
- Copy `.env.example` to `.env` for development
- Key variables: `MONGO_URI`, `OLLAMA_HOST`, `LLM_MODEL`
- TTS configuration: `PIPER_ENABLED` or `ELEVENLABS_API_KEY`
- Optional: `CALORIE_API_KEY`, `LINKEDIN_USER`, Google Calendar OAuth

### Debugging
- Logs are written to console and optionally to files
- Use `logger.debug()`, `logger.info()`, `logger.error()` consistently
- WhatsApp session data stored in `.wwebjs_auth/` (can be deleted to reset)

## Security Considerations

This is a defensive security tool for WhatsApp automation. When working with this codebase:
- Avoid adding features that could be used maliciously
- Be cautious with file uploads and user input validation
- The LinkedIn scraper uses browser automation - ensure it remains ethical
- MongoDB queries should be parameterized to prevent injection
- API keys and credentials should never be committed to the repository