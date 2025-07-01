# Voice Node Library

A real-time voice bot library that enables seamless voice-to-voice conversations using speech-to-text (STT), large language models (LLM), and text-to-speech (TTS) technologies.

## Architecture Overview

The library follows a modular provider-based architecture that allows easy swapping of different AI services:

```
Audio Input → STT Provider → LLM Provider → TTS Provider → Audio Output
     ↓              ↓             ↓             ↓            ↓
 Microphone → Deepgram → OpenAI GPT → OpenAI TTS → Speaker
```

## Core Components

### 1. VoiceBot Engine (`src/engine.ts`)
The central orchestrator that:
- Manages the audio processing pipeline
- Coordinates between STT, LLM, and TTS providers
- Handles real-time streaming and performance metrics
- Maintains conversation history

### 2. Provider Interfaces (`src/providers.ts`)
Defines contracts for:
- **STTProvider**: Speech-to-text transcription
- **LLMProvider**: Language model chat completion
- **TTSProvider**: Text-to-speech synthesis

### 3. Provider Implementations
- **DeepgramSTT** (`src/providers/deepgram.ts`): Real-time speech recognition
- **OpenAIChat** (`src/providers/openai-llm.ts`): GPT-based conversation
- **OpenAITTS** (`src/providers/openai-tts.ts`): Neural voice synthesis

### 4. Type System (`src/types.ts`)
Core data structures:
- `TranscriptChunk`: STT output with timing information
- `TokenChunk`: LLM streaming tokens
- `AudioChunk`: PCM audio data with metadata

## Getting Started

### Prerequisites
- **Node.js 18+** with npm or pnpm
- **macOS** (for audio playback via `afplay`)
- **SoX** audio processing library

### Installation

1. **Install Node.js dependencies:**
```bash
npm install
# or
pnpm install
```

2. **Install SoX (macOS):**
```bash
# Using Homebrew
brew install sox

# Verify installation
sox --version
```

3. **Install SoX (Other platforms):**
```bash
# Ubuntu/Debian
sudo apt-get install sox

# Windows (using Chocolatey)
choco install sox
```

### Environment Variables
Create a `.env` file:
```env
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key
```

### Usage

```typescript
import { VoiceBot } from "./src/engine";
import { DeepgramSTT } from "./src/providers/deepgram";
import { OpenAIChat } from "./src/providers/openai-llm";
import { OpenAITTS } from "./src/providers/openai-tts";

const bot = new VoiceBot(
  new DeepgramSTT(),
  new OpenAIChat(),
  new OpenAITTS()
);

bot.on("sttChunk", (text) => console.log("Transcribed:", text));
bot.on("llmToken", (token) => process.stdout.write(token));
bot.on("audioChunk", (chunk) => {
});

await bot.run(audioInputStream);
```

#### Running the Voice Bot

**Real-time voice chat (microphone input):**
```bash
npm run chat
# or
npm start
```
This starts real-time voice conversation using your microphone. Speak naturally and the AI will respond with voice.

**Process WAV files:**
```bash
npm run wav <path-to-wav-file>
# Example:
npm run wav ./audio/test.wav
```
This processes pre-recorded WAV files, transcribes them, generates AI responses, and plays back the audio response.

## Audio Pipeline Details

### Input Processing
1. **Audio Capture**: 48kHz, 16-bit, mono PCM from microphone
2. **Real-time Streaming**: Chunks sent to Deepgram for live transcription
3. **Interim Results**: Accumulates partial transcriptions for longer inputs

### Output Processing
1. **Token Streaming**: LLM tokens streamed in real-time to TTS
2. **Text Cleaning**: Markdown and formatting removed for natural speech
3. **Audio Synthesis**: 24kHz PCM output from OpenAI TTS
4. **Playback**: Sequential chunk playback via system audio

## Performance Metrics & Monitoring

The system tracks 3 core latency metrics:
- **STT Latency** (`stt_duration_ms`): Speech-to-text processing time
- **LLM Latency** (`llm_duration_ms`): Complete LLM response generation time  
- **TTS Latency** (`tts_duration_ms`): Text-to-speech processing time

### Built-in Performance Dashboard

Get beautiful real-time metrics with zero setup:

```bash
# Start your voice bot (dashboard included)
npm start

# Open the dashboard
open http://localhost:9464/dashboard
```

Access your metrics:
- **Performance Dashboard**: http://localhost:9464/dashboard (Beautiful HTML interface)
- **Raw Prometheus Metrics**: http://localhost:9464/metrics
- **Health Check**: http://localhost:9464/health

The dashboard automatically shows:
- Real-time metric cards with averages and totals  
- Color-coded performance indicators (🟢🟡🔴)
- Auto-refresh every 5 seconds
- No external dependencies required

See `PROMETHEUS_SETUP.md` for detailed dashboard features.

## Configuration Options

### Deepgram STT
```typescript
new DeepgramSTT("nova-3") // Model selection
```
- Model: `nova-3` (default), `nova-2`, `whisper`
- Features: Smart formatting, punctuation, VAD events
- Endpointing: 2000ms for longer prompts

### OpenAI Chat
```typescript
new OpenAIChat("gpt-4o-mini") // Model selection
```
- Model: `gpt-4o-mini` (default), `gpt-4`, `gpt-3.5-turbo`
- Temperature: 0.7 for balanced creativity
- Max tokens: 1000 per response
- **Speech-Friendly Responses**: Automatically generates conversational text optimized for TTS

#### Intelligent Speech Optimization
The system uses an advanced system prompt that instructs the LLM to generate speech-friendly responses:
- No markdown formatting or visual elements
- Natural conversational flow and transitions
- Spoken numbers and symbols ("percent" not "%")
- Bullet points converted to "First,", "Second,", "Another point is"
- Designed for listening, not reading

### OpenAI TTS
```typescript
new OpenAITTS("tts-1") 
```
- Model: `tts-1` (default), `tts-1-hd` (higher quality)
- Voice: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
- Format: PCM for low latency
- Streaming: Real-time chunk-based synthesis

## Error Handling

The library implements robust error handling:
- Connection failures are automatically retried
- Audio processing errors don't interrupt the pipeline
- Graceful degradation when services are unavailable

## System Requirements

### Audio Dependencies
- **macOS**: Uses `afplay` for audio playback
- **SoX**: Required for audio format conversion
- **Microphone**: Any USB or built-in microphone

### API Dependencies
- **Deepgram**: Real-time STT service
- **OpenAI**: GPT models and TTS service

#### Environment Variables
```bash
# Error: Missing required environment variables
# Solution: Create .env file with your API keys
echo "DEEPGRAM_API_KEY=your_key_here" > .env
echo "OPENAI_API_KEY=your_key_here" >> .env
```

### Audio Format Issues
- **Unsupported formats**: Convert to WAV using `ffmpeg -i input.mp3 output.wav`
- **Sample rate mismatch**: System auto-detects, but 48kHz recommended
- **Stereo to mono**: `sox input.wav -c 1 output.wav`


### Custom Voice Selection
```typescript
const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const tts = new OpenAITTS("tts-1-hd", { voice: "nova" });
```

### Performance Tuning
```typescript
const deepgram = new DeepgramSTT("nova-3", { endpointing: 1000 });
const openai = new OpenAIChat("gpt-4o-mini", { max_tokens: 500 });

const deepgram = new DeepgramSTT("nova-3", { endpointing: 3000 });
const openai = new OpenAIChat("gpt-4", { max_tokens: 1500 });
```

### Audio Format Customization
```typescript
// Microphone settings
const micConfig = {
  rate: "48000", 
  channels: "1", 
  encoding: "signed-integer"
};

// Speaker settings
const speakerConfig = {
  sampleRate: 24000,  
  channels: 1,
  bitDepth: 16
};
```

## Development

### Scripts
- `npm start` / `npm run chat`: Real-time voice chat with microphone
- `npm run wav <file>`: Process WAV audio files
- `npm run dev`: Development mode with auto-reload
- `npm run build`: Compile TypeScript to JavaScript

### Project Structure
```
src/
├── engine.ts           # Core VoiceBot orchestrator
├── index.ts           # Main entry point
├── providers.ts       # Provider interfaces
├── types.ts          # Core type definitions
├── utils.ts          # Utility functions
├── metrics.ts        # Performance monitoring
├── system-audio.ts   # Audio playback utilities
└── providers/
    ├── deepgram.ts   # Deepgram STT implementation
    ├── openai-llm.ts # OpenAI Chat implementation
    └── openai-tts.ts # OpenAI TTS implementation
```

