# Voice Bot Metrics Dashboard

A simple, beautiful dashboard showing your voice bot's 3 core performance metrics.

## Core Metrics

1. **STT (Speech-to-Text) Latency** - `stt_duration_ms`
2. **LLM (Language Model) Latency** - `llm_duration_ms`  
3. **TTS (Text-to-Speech) Latency** - `tts_duration_ms`

## Quick Start

### 1. Start the Voice Bot

```bash
npm start
```

The metrics server starts automatically and provides:
- **Dashboard**: `http://localhost:9464/dashboard` (Beautiful HTML interface)
- **Raw Metrics**: `http://localhost:9464/metrics` (Prometheus format)
- **Health Check**: `http://localhost:9464/health`

### 2. View Your Dashboard

Open `http://localhost:9464/dashboard` in your browser to see:

- **Real-time metrics** with auto-refresh every 5 seconds
- **Color-coded performance indicators**:
  - 🟢 Green: Good performance (STT <1s, LLM/TTS <3s)
  - 🟡 Orange: Warning thresholds
  - 🔴 Red: Performance issues
- **Individual metric cards** showing averages and totals
- **Clean, modern design** that works on all devices

## Dashboard Features

### Visual Performance Indicators
- **STT Card**: Shows speech-to-text processing times
- **LLM Card**: Displays language model response generation
- **TTS Card**: Text-to-speech synthesis performance

### Real-time Data
- Auto-refreshes every 5 seconds
- Shows total requests processed
- Displays average response times
- Color-coded status indicators

### No External Dependencies
- Pure HTML/CSS dashboard
- No Docker required
- No additional software needed
- Works in any modern browser

## Accessing Metrics

### Beautiful Dashboard
```
http://localhost:9464/dashboard
```
Perfect for monitoring and debugging your voice bot performance.

### Raw Prometheus Metrics
```
http://localhost:9464/metrics
```
For integration with monitoring tools or custom analysis.

### Health Check
```
http://localhost:9464/health
```
Simple endpoint to verify the metrics server is running.

## Performance Thresholds

### STT (Speech-to-Text)
- 🟢 **Good**: < 1000ms
- 🟡 **Warning**: 1000-2000ms  
- 🔴 **Critical**: > 2000ms

### LLM (Language Model)
- 🟢 **Good**: < 3000ms
- 🟡 **Warning**: 3000-5000ms
- 🔴 **Critical**: > 5000ms

### TTS (Text-to-Speech)
- 🟢 **Good**: < 3000ms
- 🟡 **Warning**: 3000-5000ms
- 🔴 **Critical**: > 5000ms

## Testing Your Setup

1. **Start the voice bot**: `npm start`
2. **Open the dashboard**: `http://localhost:9464/dashboard`
3. **Talk to your bot** to generate metrics
4. **Watch the dashboard update** in real-time

The dashboard will show "0" values until you start using the voice bot! 