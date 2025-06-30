# Audio Test Files

This directory contains WAV files for testing the voice bot with pre-recorded audio instead of live microphone input.

## Test Files

- `capital-india.wav` - Question about India's capital
- `photosynthesis-question.wav` - Science question about photosynthesis  
- `programming-advice.wav` - Question about programming languages for beginners

## Usage

Process any WAV file through the voice bot:

```bash
npm run wav <path-to-wav-file>

# Examples:
npm run wav ./audio/programming-advice.wav
npm run wav ./audio/capital-india.wav
npm run wav ./audio/photosynthesis-question.wav
```

## Creating Your Own Test Files

You can create custom test WAV files using macOS `say` command:

```bash
# Create a 48kHz WAV file (recommended format)
say -o audio/my-question.wav -r 200 --data-format=LEF32@48000 "What is artificial intelligence?"

# Or record using QuickTime Player:
# 1. File → New Audio Recording
# 2. Record your question
# 3. File → Export As → Audio Only → WAV
```

## Supported Audio Formats

- **Format**: WAV (RIFF)
- **Sample Rate**: Any (auto-detected, 48kHz recommended)
- **Channels**: Mono or stereo (mono recommended)
- **Bit Depth**: 16-bit recommended
- **Duration**: Any length

## How WAV Processing Works

1. **File Analysis**: Reads WAV header to detect audio properties
2. **Real-time Simulation**: Streams audio chunks with realistic timing
3. **Speech Recognition**: Processes through Deepgram STT with interim results
4. **AI Conversation**: Generates natural speech-friendly response via OpenAI
5. **Audio Synthesis**: Converts response to speech using OpenAI TTS
6. **Playback**: Plays AI response through system speakers

## Tips for Best Results

- **Clear Speech**: Speak clearly and at normal pace
- **Minimal Background Noise**: Record in quiet environment
- **Specific Questions**: Ask clear, specific questions for better responses
- **Natural Language**: Speak naturally as you would in conversation 