# Voice Integration - Quick Start Guide

## Setup (5 minutes)

### 1. Install Dependencies

```bash
cd backend
pip install requests python-dotenv
```

### 2. Get ElevenLabs API Key

1. Sign up at https://elevenlabs.io
2. Go to your profile → API Keys
3. Copy your API key

### 3. Configure Environment

Create `backend/.env` file:

```env
# Existing keys
TEAM_ID=your_team_id
API_TOKEN=your_api_token
DATABASE_URL=postgresql://beacon_user:beacon_local_dev@localhost:5432/beacon

# Add this for voice integration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### 4. Verify Installation

```bash
cd backend
python -m voice.test_voice_integration
```

Expected output:
```
=== Testing STT Service ===
✅ STT Token generated successfully
✅ STT Config retrieved

=== Testing TTS Service ===
✅ TTS Token generated successfully
✅ Context-aware voice selected
✅ Available voices: 4

=== Testing Voice Agent ===
✅ Session started
✅ Turn 1 processed
✅ Turn 2 processed

🎉 All tests passed!
```

## API Endpoints Now Available

Once integrated, the following endpoints are available:

```
POST   /api/voice/stt/token          - Generate STT WebSocket token
POST   /api/voice/tts/token          - Generate TTS WebSocket token
POST   /api/voice/agent/process      - Process voice conversation
GET    /api/voice/agent/session/:id  - Get session info
DELETE /api/voice/agent/session/:id  - End session
GET    /api/voice/voices             - Get available voices
GET    /api/voice/config             - Get configuration
GET    /api/voice/health             - Health check
```

## Quick Test with cURL

```bash
# Health check
curl http://localhost:8000/api/voice/health

# Generate STT token
curl -X POST http://localhost:8000/api/voice/stt/token \
  -H "Content-Type: application/json" \
  -d '{"language_code": "en"}'

# Generate TTS token
curl -X POST http://localhost:8000/api/voice/tts/token \
  -H "Content-Type: application/json" \
  -d '{"voice_type": "calm_female"}'

# Start voice conversation
curl -X POST http://localhost:8000/api/voice/agent/process \
  -H "Content-Type: application/json" \
  -d '{
    "user_message": "There is a fire in my building",
    "location": {"lat": 37.7749, "lng": -122.4194}
  }'
```

## Frontend Integration

### Get WebSocket URLs

```typescript
// Get STT token
const sttResp = await fetch('/api/voice/stt/token', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({session_id: userId})
});
const {ws_url: sttUrl} = await sttResp.json();

// Connect to STT WebSocket
const sttWs = new WebSocket(sttUrl);

// Get TTS token
const ttsResp = await fetch('/api/voice/tts/token', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    session_id: userId,
    urgency: 'high',
    role: 'caller'
  })
});
const {ws_url: ttsUrl} = await ttsResp.json();

// Connect to TTS WebSocket
const ttsWs = new WebSocket(ttsUrl);
```

## Troubleshooting

### "ELEVENLABS_API_KEY not set"

Make sure `.env` file exists in `backend/` directory and contains:
```
ELEVENLABS_API_KEY=your_actual_key_here
```

### "Failed to generate token: 401 Unauthorized"

Your API key is invalid. Check:
1. Key is copied correctly (no extra spaces)
2. Account is active on ElevenLabs
3. Free tier limits not exceeded

### "Module 'voice' not found"

Run from backend directory:
```bash
cd backend
python -m voice.test_voice_integration
```

### Check Server Logs

```bash
cd backend
python app.py

# Look for:
# ✅ Voice integration routes registered
```

## Architecture Overview

```
Frontend                  Backend              ElevenLabs
─────────────────────────────────────────────────────────

1. Request token     →   Generate token   →   POST /auth/token
                     ←   Return ws_url    ←   Return token

2. Connect WS        →   [Direct]         →   WSS Connect
   wss://...             (no proxy)

3. Stream audio      →   [Direct]         →   Process audio
                     ←   [Direct]         ←   Return transcript

4. Submit transcript →   Voice Agent
                         (LangGraph)
                         Create case
                     ←   Agent response

5. Get TTS token     →   Generate token   →   POST /auth/token
                     ←   Return ws_url    ←   Return token

6. Connect TTS WS    →   [Direct]         →   WSS Connect

7. Stream text       →   [Direct]         →   Generate speech
                     ←   [Direct]         ←   Return audio chunks
```

## Next Steps

1. ✅ Backend voice module created and tested
2. ⬜ Create frontend components (VoiceConversationScreen.tsx)
3. ⬜ Add voice mode toggle to help request modal
4. ⬜ Implement WebSocket clients in frontend
5. ⬜ Test end-to-end voice flow
6. ⬜ Deploy and monitor

## Support

For detailed documentation, see:
- `backend/voice/README.md` - Full API documentation
- `AUDIO_MODE_INTEGRATION_PLAN.md` - Complete integration plan
- `backend/voice/test_voice_integration.py` - Test examples

For issues:
```bash
# Check health
curl http://localhost:8000/api/voice/health

# View logs
python app.py  # Watch console output
```
