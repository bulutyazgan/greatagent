# Audio Mode Integration Plan - ElevenLabs Voice Integration

## Overview

Enable **bidirectional voice communication** for users who cannot read or type during emergencies. This feature integrates:
1. **Speech-to-Text**: Voice input for submitting help requests
2. **Text-to-Speech**: Audio output for reading guides and instructions aloud

This uses ElevenLabs WebSocket APIs for real-time voice interaction.

### Motivation

During emergencies, many victims:
- Have limited mobility (injured hands, trapped positions)
- Are in high-stress situations making typing difficult
- May be elderly or have disabilities
- Need hands-free operation to focus on safety

Voice input significantly lowers the barrier to requesting help in critical moments.

---

## Architecture Overview

```
┌─────────────────┐
│  Caller's Phone │
│   (Microphone)  │
└────────┬────────┘
         │ Audio Stream (WebRTC)
         ▼
┌─────────────────────────────────┐
│  Frontend (React)               │
│  - AudioRecorder component      │
│  - WebSocket client             │
│  - Real-time transcript display │
└────────┬────────────────────────┘
         │ Audio chunks (base64)
         ▼
┌──────────────────────────────────┐
│  ElevenLabs WebSocket API        │
│  wss://api.elevenlabs.io/v1/     │
│    speech-to-text/realtime       │
└────────┬─────────────────────────┘
         │ Transcripts (JSON)
         ▼
┌──────────────────────────────────┐
│  Frontend → Backend API          │
│  POST /api/cases                 │
│  {transcribed_text + location}   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  Existing Backend Pipeline       │
│  - InputProcessingAgent          │
│  - ResearchAgent                 │
│  - CallerGuideAgent              │
└──────────────────────────────────┘
```

---

## User Flow

### 1. **Audio Mode Activation**

```
User on "Request Help" screen
  ├─ Sees two options:
  │   ├─ [Keyboard Icon] Type Description
  │   └─ [Microphone Icon] Speak Description (NEW)
  │
  └─ User taps "Speak Description"
      ├─ Browser requests microphone permission
      ├─ Visual indicator: Pulsing red dot "Listening..."
      └─ Waveform animation shows audio input
```

### 2. **Audio Recording & Transcription**

```
User speaks: "I'm trapped in a building on 3rd floor, smoke everywhere, can't move my leg"
  │
  ├─ Audio captured via WebRTC MediaRecorder API
  ├─ Sent to ElevenLabs WebSocket in real-time
  ├─ Partial transcripts appear as user speaks:
  │   "I'm trapped in a building..."
  │   "I'm trapped in a building on 3rd floor..."
  │   "I'm trapped in a building on 3rd floor, smoke everywhere..."
  │
  └─ User sees live transcript updating (builds confidence)
```

### 3. **Commit & Submit**

```
Two commit strategies:

OPTION A: VAD (Voice Activity Detection) - Automatic
  ├─ User stops speaking for 2.5 seconds
  ├─ ElevenLabs auto-commits transcript
  ├─ System shows: "Got it! Processing your request..."
  └─ Submits to backend automatically

OPTION B: Manual Commit (Recommended for emergencies)
  ├─ User taps "Send" button when done speaking
  ├─ Allows reviewing/editing transcript first
  ├─ More control, prevents accidental submissions
  └─ Better for noisy environments
```

### 4. **Fallback to Text**

```
If audio fails or user wants to add details:
  ├─ "Edit Transcript" button appears
  ├─ Switches to text input with pre-filled transcript
  └─ User can correct/add information
```

---

## Implementation Details

### Frontend Changes

#### 1. **New Component: `VoiceRecorder.tsx`**

```typescript
// frontend/src/components/audio/VoiceRecorder.tsx

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';

interface VoiceRecorderProps {
  onTranscriptComplete: (transcript: string) => void;
  onError: (error: string) => void;
}

export function VoiceRecorder({ onTranscriptComplete, onError }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [committedTranscript, setCommittedTranscript] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startRecording = async () => {
    try {
      // 1. Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // 2. Initialize WebSocket connection to ElevenLabs
      const ws = new WebSocket(
        `wss://api.elevenlabs.io/v1/speech-to-text/realtime?` +
        `model_id=scribe-realtime-en-v1&` +
        `commit_strategy=manual&` +
        `audio_format=pcm_16000&` +
        `include_timestamps=false&` +
        `enable_logging=true`
      );

      // Set API key in header (need to configure this)
      ws.addEventListener('open', () => {
        console.log('ElevenLabs WebSocket connected');
        setIsRecording(true);
      });

      // 3. Handle incoming transcription messages
      ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);

        switch (data.message_type) {
          case 'session_started':
            console.log('Session started:', data.session_id);
            break;

          case 'partial_transcript':
            // Show live transcript as user speaks
            setPartialTranscript(data.transcript);
            break;

          case 'committed_transcript':
            // Final transcript when user commits
            setCommittedTranscript(data.transcript);
            setPartialTranscript('');
            break;

          case 'scribe_error':
          case 'scribe_auth_error':
          case 'scribe_quota_exceeded_error':
            onError(data.message || 'Transcription error');
            stopRecording();
            break;
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        onError('Connection to transcription service failed');
        stopRecording();
      });

      wsRef.current = ws;

      // 4. Setup audio processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        // Get audio data
        const inputData = e.inputBuffer.getChannelData(0);

        // Convert Float32Array to PCM16
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Convert to base64
        const base64Audio = btoa(
          String.fromCharCode(...new Uint8Array(pcm16.buffer))
        );

        // Send to ElevenLabs
        wsRef.current.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: base64Audio,
          commit: false, // Manual commit
          sample_rate: 16000
        }));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      mediaRecorderRef.current = { processor, source, stream } as any;

    } catch (error) {
      console.error('Failed to start recording:', error);
      onError('Microphone access denied or unavailable');
    }
  };

  const stopRecording = () => {
    // Cleanup audio resources
    if (mediaRecorderRef.current) {
      const { processor, source, stream } = mediaRecorderRef.current as any;
      processor?.disconnect();
      source?.disconnect();
      stream?.getTracks().forEach((track: MediaStreamTrack) => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsRecording(false);
  };

  const commitTranscript = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Send commit signal
    wsRef.current.send(JSON.stringify({
      message_type: 'input_audio_chunk',
      audio_base_64: '',
      commit: true,
      sample_rate: 16000
    }));
  };

  const handleSubmit = () => {
    if (committedTranscript) {
      onTranscriptComplete(committedTranscript);
      stopRecording();
    } else {
      // Commit first, then wait for committed_transcript event
      commitTranscript();

      // Wait for commit (listener will call onTranscriptComplete)
      setTimeout(() => {
        if (committedTranscript) {
          onTranscriptComplete(committedTranscript);
        }
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className="voice-recorder">
      {/* Recording Status */}
      <div className="flex items-center gap-3 mb-4">
        {isRecording ? (
          <>
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600">Listening...</span>
          </>
        ) : (
          <span className="text-sm text-gray-400">Ready to record</span>
        )}
      </div>

      {/* Live Transcript Display */}
      <div className="transcript-box min-h-32 p-4 bg-gray-50 rounded-lg mb-4">
        <p className="text-gray-800">
          {committedTranscript}
          {partialTranscript && (
            <span className="text-gray-400 italic">{partialTranscript}</span>
          )}
        </p>
        {!committedTranscript && !partialTranscript && (
          <p className="text-gray-400 italic">
            Tap the microphone and describe your emergency...
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white py-3 px-6 rounded-lg hover:bg-red-600 transition"
          >
            <Mic className="w-5 h-5" />
            Start Speaking
          </button>
        ) : (
          <>
            <button
              onClick={stopRecording}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-500 text-white py-3 px-6 rounded-lg hover:bg-gray-600 transition"
            >
              <MicOff className="w-5 h-5" />
              Stop
            </button>
            <button
              onClick={handleSubmit}
              disabled={!partialTranscript && !committedTranscript}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white py-3 px-6 rounded-lg hover:bg-blue-600 transition disabled:bg-gray-300"
            >
              <Send className="w-5 h-5" />
              Submit
            </button>
          </>
        )}
      </div>

      {/* Edit Fallback */}
      {committedTranscript && (
        <button
          onClick={() => {
            onTranscriptComplete(committedTranscript);
            // Parent component should switch to text mode with pre-filled value
          }}
          className="w-full mt-3 text-sm text-blue-600 underline"
        >
          Edit transcript before submitting
        </button>
      )}
    </div>
  );
}
```

#### 2. **Update `RequestHelpDialog.tsx`**

```typescript
// frontend/src/components/layout/RequestHelpDialog.tsx

import { useState } from 'react';
import { VoiceRecorder } from '@/components/audio/VoiceRecorder';
import { Keyboard, Mic } from 'lucide-react';

type InputMode = 'text' | 'voice';

export function RequestHelpDialog({ disaster, onSubmit, onClose }) {
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [description, setDescription] = useState('');

  const handleVoiceTranscript = (transcript: string) => {
    setDescription(transcript);
    // Auto-submit or switch to text mode for review
    setInputMode('text'); // Let user review before submitting
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Emergency Help</DialogTitle>
        </DialogHeader>

        {/* Input Mode Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setInputMode('text')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border ${
              inputMode === 'text'
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Type
          </button>
          <button
            onClick={() => setInputMode('voice')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg border ${
              inputMode === 'voice'
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-gray-700 border-gray-300'
            }`}
          >
            <Mic className="w-4 h-4" />
            Speak
          </button>
        </div>

        {/* Conditional Rendering */}
        {inputMode === 'text' ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your emergency..."
            className="w-full h-32 p-3 border rounded-lg"
          />
        ) : (
          <VoiceRecorder
            onTranscriptComplete={handleVoiceTranscript}
            onError={(error) => {
              toast.error(error);
              setInputMode('text'); // Fallback to text
            }}
          />
        )}

        {/* Submit Button (only in text mode) */}
        {inputMode === 'text' && (
          <button
            onClick={() => onSubmit(description)}
            disabled={!description.trim()}
            className="w-full bg-red-500 text-white py-3 rounded-lg"
          >
            Submit Help Request
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

#### 3. **Environment Configuration**

```typescript
// frontend/.env

VITE_ELEVENLABS_API_KEY=your_api_key_here

# OR use token generation endpoint (more secure for client-side)
VITE_BACKEND_URL=http://localhost:8000
```

---

### Backend Changes

#### 1. **Token Generation Endpoint** (Recommended for security)

Instead of exposing the ElevenLabs API key on the frontend, generate short-lived tokens:

```python
# backend/app.py

from fastapi import APIRouter
import requests
import os

router = APIRouter()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

@router.post("/api/audio/token")
async def generate_audio_token():
    """
    Generate a single-use token for ElevenLabs speech-to-text.
    This is more secure than exposing the API key on the client.

    Reference: https://elevenlabs.io/docs/api-reference/single-use-token
    """
    try:
        response = requests.post(
            "https://api.elevenlabs.io/v1/auth/token",
            headers={
                "xi-api-key": ELEVENLABS_API_KEY
            },
            json={
                "scope": "speech_to_text",
                "expires_in": 3600  # 1 hour
            }
        )
        response.raise_for_status()
        token = response.json()["token"]

        return {
            "token": token,
            "ws_url": f"wss://api.elevenlabs.io/v1/speech-to-text/realtime?token={token}"
        }
    except Exception as e:
        return {"error": str(e)}, 500

# Add to main app
app.include_router(router)
```

#### 2. **Update Case Creation to Accept Audio Metadata**

```python
# backend/app.py - Update existing endpoint

from pydantic import BaseModel

class CreateCaseRequest(BaseModel):
    user_id: str
    latitude: float
    longitude: float
    raw_problem_description: str
    input_method: str = "text"  # NEW: "text" or "voice"
    audio_metadata: dict | None = None  # NEW: Optional audio info

@app.post("/api/cases")
async def create_case(request: CreateCaseRequest):
    """
    Create new help request case.
    Now supports both text and voice input.
    """
    # Log input method for analytics
    if request.input_method == "voice":
        logger.info(f"Voice input case created: {request.audio_metadata}")

    # Rest of existing logic remains the same
    # The AI agent doesn't care if input came from text or voice
    case_id = cases.create_case(
        user_id=request.user_id,
        latitude=request.latitude,
        longitude=request.longitude,
        raw_problem_description=request.raw_problem_description
    )

    return {
        "case_id": case_id,
        "processing_started": True,
        "input_method": request.input_method
    }
```

#### 3. **Analytics & Metrics**

Track audio mode usage:

```python
# backend/services/analytics.py (NEW)

from datetime import datetime
import psycopg2
from .users import get_db_cursor

def log_audio_usage(user_id: str, session_duration_secs: float, transcript_length: int):
    """Track audio mode usage for optimization insights."""
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO audio_usage_logs
            (user_id, session_duration, transcript_length, created_at)
            VALUES (%s, %s, %s, %s)
        """, (user_id, session_duration_secs, transcript_length, datetime.utcnow()))
```

```sql
-- backend/database/migrations/002_add_audio_tracking.sql

CREATE TABLE audio_usage_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    session_duration FLOAT,
    transcript_length INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audio_logs_user ON audio_usage_logs(user_id);
```

---

## ElevenLabs API Configuration

### Authentication Options

#### Option 1: Direct API Key (Simple, less secure)
```typescript
const ws = new WebSocket(
  'wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe-realtime-en-v1',
  {
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY
    }
  }
);
```

**⚠️ Issue**: Can't set custom headers in browser WebSocket constructor.

**Solution**: Use token-based auth instead (Option 2).

#### Option 2: Token-Based (Recommended, secure)
```typescript
// 1. Frontend requests token from backend
const response = await fetch('/api/audio/token');
const { token, ws_url } = await response.json();

// 2. Connect with token in URL
const ws = new WebSocket(ws_url);
```

**Benefits**:
- API key never exposed to client
- Tokens are single-use and expire
- Can track usage per user

### WebSocket Message Flow

#### 1. **Session Initialization**
```json
// Server → Client
{
  "message_type": "session_started",
  "session_id": "abc-123-def-456",
  "config": {
    "model_id": "scribe-realtime-en-v1",
    "commit_strategy": "manual",
    "audio_format": "pcm_16000"
  }
}
```

#### 2. **Streaming Audio Chunks**
```json
// Client → Server (every ~100ms)
{
  "message_type": "input_audio_chunk",
  "audio_base_64": "AAAAAQIDBAUG...",
  "commit": false,
  "sample_rate": 16000
}
```

#### 3. **Receiving Partial Transcripts**
```json
// Server → Client (as user speaks)
{
  "message_type": "partial_transcript",
  "transcript": "I'm trapped in a building on 3rd floor"
}
```

#### 4. **Committing Final Transcript**
```json
// Client → Server (when user done speaking)
{
  "message_type": "input_audio_chunk",
  "audio_base_64": "",
  "commit": true,
  "sample_rate": 16000
}

// Server → Client (final result)
{
  "message_type": "committed_transcript",
  "transcript": "I'm trapped in a building on 3rd floor, smoke everywhere, can't move my leg"
}
```

### Recommended Configuration

```javascript
const wsConfig = {
  model_id: 'scribe-realtime-en-v1',
  commit_strategy: 'manual', // User control
  audio_format: 'pcm_16000', // 16kHz PCM
  include_timestamps: false, // Don't need word-level timing
  language_code: 'en', // English (can expand to other languages)
  enable_logging: true, // For debugging

  // VAD settings (if using 'vad' commit_strategy)
  vad_silence_threshold_secs: 2.5, // Wait 2.5s of silence
  vad_threshold: 0.4, // Voice detection sensitivity
  min_speech_duration_ms: 250,
  min_silence_duration_ms: 2500
};
```

---

## Error Handling

### 1. **Microphone Access Denied**
```typescript
catch (error) {
  if (error.name === 'NotAllowedError') {
    toast.error('Microphone access required. Please check your browser permissions.');
  } else if (error.name === 'NotFoundError') {
    toast.error('No microphone found. Please connect a microphone.');
  } else {
    toast.error('Failed to access microphone.');
  }

  // Fallback to text mode
  setInputMode('text');
}
```

### 2. **WebSocket Connection Failures**
```typescript
ws.addEventListener('error', (error) => {
  console.error('WebSocket error:', error);

  // Log to backend for monitoring
  fetch('/api/audio/error', {
    method: 'POST',
    body: JSON.stringify({ error: error.message })
  });

  toast.error('Connection to transcription service failed. Switching to text input.');
  setInputMode('text');
});
```

### 3. **API Quota Exceeded**
```typescript
case 'scribe_quota_exceeded_error':
  toast.error('Transcription service temporarily unavailable. Please type your message.');
  setInputMode('text');

  // Backend should send alert to admin
  fetch('/api/audio/quota-exceeded', { method: 'POST' });
  break;
```

### 4. **Poor Audio Quality / No Speech Detected**
```typescript
// If no transcript after 10 seconds of recording
setTimeout(() => {
  if (!partialTranscript && !committedTranscript && isRecording) {
    toast.warning(
      'Not detecting speech. Please ensure microphone is working or switch to typing.',
      { action: { label: 'Switch to Text', onClick: () => setInputMode('text') } }
    );
  }
}, 10000);
```

---

## User Experience Enhancements

### 1. **Visual Feedback**

```typescript
// Audio waveform animation
import { useAudioVisualization } from '@/hooks/useAudioVisualization';

function VoiceRecorder() {
  const { levels } = useAudioVisualization(stream);

  return (
    <div className="waveform">
      {levels.map((level, i) => (
        <div
          key={i}
          className="bar"
          style={{ height: `${level * 100}%` }}
        />
      ))}
    </div>
  );
}
```

### 2. **Confidence Indicators**

```typescript
// Show if transcript seems incomplete
{partialTranscript && partialTranscript.length < 20 && (
  <p className="text-yellow-600 text-sm mt-2">
    ⚠️ Description seems short. Please provide more details.
  </p>
)}
```

### 3. **Suggested Prompts**

```typescript
// Before recording starts
<div className="suggestions mb-4">
  <p className="text-sm text-gray-600 mb-2">Try saying:</p>
  <ul className="text-xs text-gray-500 space-y-1">
    <li>"I'm trapped on the 3rd floor, can't reach stairs"</li>
    <li>"Medical emergency, person unconscious, need ambulance"</li>
    <li>"Fire in building, smoke filling apartment"</li>
  </ul>
</div>
```

### 4. **Multi-Language Support**

```typescript
const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
];

// Add language selector
<select onChange={(e) => setLanguage(e.target.value)}>
  {languages.map(lang => (
    <option key={lang.code} value={lang.code}>{lang.name}</option>
  ))}
</select>
```

---

## Part 2: Text-to-Speech Integration (Reading Guides Aloud)

### Overview

After creating a case via voice input, users receive AI-generated guides. For hands-free operation, we can **read these guides aloud** using ElevenLabs Text-to-Speech WebSocket API.

### Use Cases

1. **Caller Guides**: Read survival instructions to trapped victims
2. **Helper Guides**: Read action plans to responders while they navigate
3. **Confirmations**: Voice feedback when cases are submitted
4. **Navigation**: Turn-by-turn voice directions

### Architecture

```
┌──────────────────────────────┐
│  Backend API                 │
│  GET /api/cases/{id}/        │
│      caller-guide            │
└────────┬─────────────────────┘
         │ {"guide_text": "1. Stay calm..."}
         ▼
┌──────────────────────────────┐
│  Frontend - GuidePlayer      │
│  - Text chunking             │
│  - WebSocket TTS client      │
└────────┬─────────────────────┘
         │ Text chunks
         ▼
┌──────────────────────────────┐
│  ElevenLabs TTS WebSocket    │
│  wss://api.elevenlabs.io/v1/ │
│    text-to-speech/{voice}/   │
│    stream-input              │
└────────┬─────────────────────┘
         │ Audio chunks (base64)
         ▼
┌──────────────────────────────┐
│  Web Audio API               │
│  - Decode audio              │
│  - Play through speakers     │
└──────────────────────────────┘
```

---

### Frontend Implementation

#### 1. **New Component: `GuideAudioPlayer.tsx`**

```typescript
// frontend/src/components/audio/GuideAudioPlayer.tsx

import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Pause, Play } from 'lucide-react';

interface GuideAudioPlayerProps {
  guideText: string;
  voiceId?: string;
  autoPlay?: boolean;
}

export function GuideAudioPlayer({
  guideText,
  voiceId = '21m00Tcm4TlvDq8ikWAM', // Default: Rachel (calm, clear)
  autoPlay = false
}: GuideAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const startAudioPlayback = async () => {
    try {
      // 1. Get token from backend (for security)
      const tokenResponse = await fetch('/api/audio/tts-token', {
        method: 'POST',
        body: JSON.stringify({ voice_id: voiceId })
      });
      const { ws_url } = await tokenResponse.json();

      // 2. Initialize WebSocket
      const ws = new WebSocket(ws_url);
      wsRef.current = ws;

      // 3. Initialize Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 44100
      });
      audioContextRef.current = audioContext;

      let currentTime = 0;

      ws.addEventListener('open', () => {
        console.log('TTS WebSocket connected');
        setIsPlaying(true);

        // Initialize connection with voice settings
        ws.send(JSON.stringify({
          text: ' ', // Initial space required
          voice_settings: {
            stability: 0.7, // Higher = more consistent
            similarity_boost: 0.8, // Voice clarity
            speed: 1.0 // Normal speed (0.5-2.0)
          },
          xi_api_key: undefined // Token in URL, not needed here
        }));

        // Stream the guide text in chunks
        streamTextChunks(ws, guideText);
      });

      ws.addEventListener('message', async (event) => {
        const data = JSON.parse(event.data);

        if (data.audio) {
          // Decode base64 audio chunk
          const audioData = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));

          // Decode to AudioBuffer
          const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);

          // Play audio chunk
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.start(currentTime);

          currentTime += audioBuffer.duration;

          // Track progress
          const totalDuration = estimateTextDuration(guideText);
          setProgress((currentTime / totalDuration) * 100);

          sourceNodeRef.current = source;
        }

        if (data.isFinal) {
          console.log('TTS complete');
          setIsPlaying(false);
          setProgress(100);
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('TTS WebSocket error:', error);
        setIsPlaying(false);
      });

      ws.addEventListener('close', () => {
        console.log('TTS WebSocket closed');
        setIsPlaying(false);
      });

    } catch (error) {
      console.error('Failed to start audio playback:', error);
      setIsPlaying(false);
    }
  };

  const streamTextChunks = (ws: WebSocket, text: string) => {
    // Break text into sentences for better prosody
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    sentences.forEach((sentence, index) => {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            text: sentence,
            try_trigger_generation: true // Start generating immediately
          }));
        }
      }, index * 100); // Stagger by 100ms
    });

    // Send flush signal after all text
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          text: '' // Empty string signals end
        }));
      }
    }, sentences.length * 100 + 200);
  };

  const stopAudioPlayback = () => {
    // Stop current audio
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setIsPlaying(false);
    setProgress(0);
  };

  const pauseAudioPlayback = () => {
    if (audioContextRef.current) {
      audioContextRef.current.suspend();
      setIsPlaying(false);
    }
  };

  const resumeAudioPlayback = () => {
    if (audioContextRef.current) {
      audioContextRef.current.resume();
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (audioContextRef.current) {
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = isMuted ? 1 : 0;
      setIsMuted(!isMuted);
    }
  };

  const estimateTextDuration = (text: string): number => {
    // Rough estimate: ~150 words per minute
    const wordCount = text.split(/\s+/).length;
    return (wordCount / 150) * 60; // seconds
  };

  useEffect(() => {
    if (autoPlay) {
      startAudioPlayback();
    }

    return () => {
      stopAudioPlayback();
    };
  }, [guideText, autoPlay]);

  return (
    <div className="guide-audio-player bg-gray-50 p-4 rounded-lg">
      {/* Visual indicator */}
      <div className="flex items-center gap-3 mb-3">
        <Volume2 className="w-5 h-5 text-blue-500" />
        <div className="flex-1">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-gray-500">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isPlaying ? (
          <button
            onClick={startAudioPlayback}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition"
          >
            <Play className="w-4 h-4" />
            Listen to Guide
          </button>
        ) : (
          <>
            <button
              onClick={pauseAudioPlayback}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
            <button
              onClick={stopAudioPlayback}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Stop
            </button>
          </>
        )}

        <button
          onClick={toggleMute}
          className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Text display (optional, for accessibility) */}
      <div className="mt-3 p-3 bg-white rounded border text-sm text-gray-700">
        {guideText}
      </div>
    </div>
  );
}
```

#### 2. **Update `CallerGuideDialog.tsx`**

```typescript
// frontend/src/components/layout/CallerGuideDialog.tsx

import { GuideAudioPlayer } from '@/components/audio/GuideAudioPlayer';

export function CallerGuideDialog({ caseId, onClose }) {
  const [guide, setGuide] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    // Fetch guide from API
    fetch(`/api/cases/${caseId}/caller-guide`)
      .then(res => res.json())
      .then(data => setGuide(data.guide_text));
  }, [caseId]);

  if (!guide) {
    return <div>Loading guide...</div>;
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Emergency Guidance</DialogTitle>
          <DialogDescription>
            AI-generated survival instructions based on your situation
          </DialogDescription>
        </DialogHeader>

        {/* Toggle audio mode */}
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="audio-mode"
            checked={audioEnabled}
            onChange={(e) => setAudioEnabled(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="audio-mode" className="text-sm text-gray-600">
            Read guide aloud (hands-free mode)
          </label>
        </div>

        {/* Audio player (if enabled) */}
        {audioEnabled && (
          <GuideAudioPlayer
            guideText={guide}
            voiceId="21m00Tcm4TlvDq8ikWAM" // Calm female voice
            autoPlay={false}
          />
        )}

        {/* Text display (always visible for accessibility) */}
        {!audioEnabled && (
          <div className="guide-text">
            <ReactMarkdown>{guide}</ReactMarkdown>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

---

### Backend Changes

#### 1. **TTS Token Generation Endpoint**

```python
# backend/app.py

@router.post("/api/audio/tts-token")
async def generate_tts_token(request: dict):
    """
    Generate single-use token for ElevenLabs Text-to-Speech.
    More secure than exposing API key on client.
    """
    voice_id = request.get("voice_id", "21m00Tcm4TlvDq8ikWAM")

    try:
        # Build WebSocket URL with token
        response = requests.post(
            "https://api.elevenlabs.io/v1/auth/token",
            headers={"xi-api-key": ELEVENLABS_API_KEY},
            json={
                "scope": "text_to_speech",
                "expires_in": 3600  # 1 hour
            }
        )
        response.raise_for_status()
        token = response.json()["token"]

        ws_url = (
            f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?"
            f"authorization={token}&"
            f"model_id=eleven_turbo_v2_5&"  # Fast, high-quality
            f"output_format=pcm_44100&"  # 44.1kHz PCM
            f"enable_logging=true"
        )

        return {"token": token, "ws_url": ws_url}

    except Exception as e:
        logger.error(f"TTS token generation failed: {e}")
        return {"error": str(e)}, 500
```

---

### Voice Selection

ElevenLabs offers various voices optimized for different scenarios:

| Voice ID | Name | Characteristics | Use Case |
|----------|------|----------------|----------|
| `21m00Tcm4TlvDq8ikWAM` | Rachel | Calm, clear, professional | **Caller guides** (soothing) |
| `pNInz6obpgDQGcFmaJgB` | Adam | Authoritative, deep | **Helper guides** (commanding) |
| `EXAVITQu4vr4xnSDxMaL` | Sarah | Warm, empathetic | **Confirmations** (reassuring) |
| `VR6AewLTigWG4xSOukaG` | Arnold | Strong, urgent | **Urgent warnings** |

#### Dynamic Voice Selection

```typescript
// Select voice based on context
const getVoiceForGuide = (urgency: string, role: 'caller' | 'helper') => {
  if (role === 'caller') {
    return urgency === 'critical'
      ? 'VR6AewLTigWG4xSOukaG' // Urgent voice
      : '21m00Tcm4TlvDq8ikWAM'; // Calm voice
  } else {
    return 'pNInz6obpgDQGcFmaJgB'; // Authoritative for helpers
  }
};
```

---

### WebSocket Message Flow (TTS)

#### 1. **Initialize Connection**

```json
// Client → Server (first message)
{
  "text": " ",
  "voice_settings": {
    "stability": 0.7,
    "similarity_boost": 0.8,
    "speed": 1.0
  },
  "xi_api_key": null  // Token in URL, not needed here
}
```

#### 2. **Stream Text Chunks**

```json
// Client → Server (send guide text in sentences)
{
  "text": "1. Stay calm and assess your surroundings.",
  "try_trigger_generation": true
}

// Client → Server (next sentence)
{
  "text": "2. Move away from windows and cover your head.",
  "try_trigger_generation": true
}
```

#### 3. **Receive Audio Chunks**

```json
// Server → Client (multiple messages)
{
  "audio": "base64_encoded_pcm_audio_data...",
  "isFinal": false,
  "normalizedAlignment": {
    "chars": ["S", "t", "a", "y", " ", "c", "a", "l", "m"],
    "charStartTimesMs": [0, 50, 100, 150, 200, 250, 300, 350, 400],
    "charDurationsMs": [50, 50, 50, 50, 50, 50, 50, 50, 50]
  }
}
```

#### 4. **End Stream**

```json
// Client → Server (flush signal)
{
  "text": ""
}

// Server → Client (final message)
{
  "audio": "final_audio_chunk...",
  "isFinal": true
}
```

---

### Configuration Options

```javascript
const ttsConfig = {
  model_id: 'eleven_turbo_v2_5', // Fast model (< 300ms latency)
  output_format: 'pcm_44100', // High quality audio
  enable_logging: true, // For debugging
  enable_ssml_parsing: false, // Not needed for plain text
  auto_mode: true, // Reduces latency for full sentences
  sync_alignment: false, // Don't need word timing (faster)
  apply_text_normalization: 'auto', // Auto-detect numbers/symbols
  inactivity_timeout: 20 // Close connection after 20s idle

  // Voice settings (sent per request)
  voice_settings: {
    stability: 0.7, // 0-1: Higher = more consistent
    similarity_boost: 0.8, // 0-1: Higher = more accurate to voice
    speed: 1.0 // 0.5-2.0: Speech speed multiplier
  }
};
```

---

### Advanced Features

#### 1. **Pause/Resume During Playback**

```typescript
const handlePause = () => {
  if (audioContextRef.current?.state === 'running') {
    audioContextRef.current.suspend();
  } else if (audioContextRef.current?.state === 'suspended') {
    audioContextRef.current.resume();
  }
};
```

#### 2. **Adjustable Speed**

```typescript
const [speed, setSpeed] = useState(1.0);

// When creating new WebSocket, use dynamic speed
ws.send(JSON.stringify({
  text: guideText,
  voice_settings: {
    stability: 0.7,
    similarity_boost: 0.8,
    speed: speed // 0.5 = slow, 1.5 = fast
  }
}));

// UI control
<input
  type="range"
  min="0.5"
  max="2.0"
  step="0.1"
  value={speed}
  onChange={(e) => setSpeed(Number(e.target.value))}
/>
```

#### 3. **Highlight Text as Spoken**

```typescript
// Use alignment data to highlight words
const [currentCharIndex, setCurrentCharIndex] = useState(0);

ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  if (data.normalizedAlignment) {
    const { chars, charStartTimesMs } = data.normalizedAlignment;

    // Schedule highlights based on timing
    charStartTimesMs.forEach((startTime, index) => {
      setTimeout(() => {
        setCurrentCharIndex(index);
      }, startTime);
    });
  }
});

// Render with highlights
<p>
  {guideText.split('').map((char, i) => (
    <span
      key={i}
      className={i === currentCharIndex ? 'bg-yellow-200' : ''}
    >
      {char}
    </span>
  ))}
</p>
```

#### 4. **Background Playback** (Mobile)

```typescript
// Enable background audio on iOS/Android
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Emergency Guide',
    artist: 'Beacon',
    album: 'Survival Instructions',
    artwork: [
      { src: '/icon-96.png', sizes: '96x96', type: 'image/png' },
      { src: '/icon-256.png', sizes: '256x256', type: 'image/png' }
    ]
  });

  navigator.mediaSession.setActionHandler('play', () => startAudioPlayback());
  navigator.mediaSession.setActionHandler('pause', () => pauseAudioPlayback());
  navigator.mediaSession.setActionHandler('stop', () => stopAudioPlayback());
}
```

---

### Error Handling (TTS)

#### 1. **Voice Not Available**

```typescript
ws.addEventListener('error', (error) => {
  console.error('TTS error:', error);

  // Fallback to text-only mode
  toast.error('Voice playback unavailable. Showing text guide.');
  setAudioEnabled(false);
});
```

#### 2. **Network Interruption**

```typescript
// Retry logic
let retryCount = 0;
const MAX_RETRIES = 3;

ws.addEventListener('close', (event) => {
  if (!event.wasClean && retryCount < MAX_RETRIES) {
    setTimeout(() => {
      retryCount++;
      console.log(`Retrying TTS connection (${retryCount}/${MAX_RETRIES})`);
      startAudioPlayback();
    }, 1000 * retryCount); // Exponential backoff
  } else {
    toast.warning('Voice playback interrupted. Text guide available below.');
    setAudioEnabled(false);
  }
});
```

#### 3. **Auto-play Restrictions** (Browser Policy)

```typescript
// Some browsers block auto-play without user interaction
try {
  await audioContextRef.current.resume();
} catch (error) {
  // Show button to manually start
  toast.info('Tap "Listen to Guide" to hear instructions', {
    duration: 10000,
    action: {
      label: 'Play',
      onClick: () => startAudioPlayback()
    }
  });
}
```

---

### Cost Analysis (TTS)

| Plan | Price | Monthly Characters | Cost per 1K chars |
|------|-------|-------------------|-------------------|
| Free | $0 | 10,000 | $0 |
| Starter | $5 | 30,000 | $0.167 |
| Creator | $22 | 100,000 | $0.22 |
| Creator+ | $99 | 500,000 | $0.198 |

**Usage Estimate**:
- Average guide: **300 characters** (3 bullet points × 100 chars each)
- 1,000 cases/month × 30% audio mode = 300 audio guides
- 300 guides × 300 chars = **90,000 characters/month**

**Cost (Creator plan)**: 90,000 chars × $0.22/1K = **$19.80/month**

**Total Audio Cost** (STT + TTS):
- STT: $0.10/month (600 minutes)
- TTS: $19.80/month (90K characters)
- **Total: ~$20/month** for voice features

---

### Accessibility Benefits

1. **Visual Impairment**: Audio guides for users who can't read screens
2. **Hands-Free**: Users can listen while performing tasks (sheltering, first aid)
3. **Multi-Tasking**: Helpers can listen while navigating to location
4. **Language Learning**: Slower speed option for non-native speakers
5. **Elderly Users**: Easier than reading small text on mobile

---

## Combined Voice UX Flow

### Hands-Free Emergency Scenario

```
1. User opens app
   ↓
2. Taps "Request Help via Voice"
   ↓
3. Speaks: "Fire in my apartment, can't reach door, 5th floor"
   ↓ [Speech-to-Text]
4. Sees live transcript appearing
   ↓
5. Taps "Submit"
   ↓
6. Backend AI processes case
   ↓
7. App shows: "🔊 Your guide is ready. Tap to listen."
   ↓ [Text-to-Speech]
8. User taps "Listen to Guide"
   ↓
9. Hears: "1. Stay low to avoid smoke. 2. Wet a cloth and cover your mouth. 3. Signal from window if possible."
   ↓
10. Follows instructions while listening
   ↓
11. Helper arrives (also guided by voice navigation)
```

**Result**: Entire interaction requires only 2 taps + voice input. No typing or reading required.

---

## Conversational Voice Agent Interface

### Overview

Instead of a one-time voice input, we create a **continuous conversational interface** where the caller and AI agent communicate back-and-forth via voice, similar to talking to a 911 operator.

### UX Flow: Voice Conversation Mode

#### 1. **Initial Help Request**

```
User lands on home screen
  ↓
Taps "I Need Help" button
  ↓
Modal appears:
  ┌─────────────────────────────────────┐
  │  How would you like to communicate? │
  │                                     │
  │  [ 💬 Text Chat ]  [ 🎤 Voice Call ]│
  └─────────────────────────────────────┘
```

#### 2. **Voice Mode Selection**

```typescript
// frontend/src/components/layout/HelpRequestModal.tsx

export function HelpRequestModal({ onStart }) {
  const [communicationMode, setCommunicationMode] = useState<'text' | 'voice' | null>(null);

  const handleModeSelection = (mode: 'text' | 'voice') => {
    setCommunicationMode(mode);

    if (mode === 'voice') {
      // Navigate to voice conversation screen
      onStart({ mode: 'voice' });
    } else {
      // Navigate to text input screen
      onStart({ mode: 'text' });
    }
  };

  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Emergency Assistance</DialogTitle>
          <DialogDescription>
            How would you like to communicate with our AI assistant?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Text Option */}
          <button
            onClick={() => handleModeSelection('text')}
            className="flex flex-col items-center gap-3 p-6 border-2 rounded-lg hover:border-blue-500 transition"
          >
            <MessageSquare className="w-12 h-12 text-blue-500" />
            <span className="font-medium">Type Message</span>
            <span className="text-xs text-gray-500 text-center">
              Describe your emergency by typing
            </span>
          </button>

          {/* Voice Option */}
          <button
            onClick={() => handleModeSelection('voice')}
            className="flex flex-col items-center gap-3 p-6 border-2 rounded-lg hover:border-red-500 transition"
          >
            <Phone className="w-12 h-12 text-red-500" />
            <span className="font-medium">Voice Call</span>
            <span className="text-xs text-gray-500 text-center">
              Speak with AI assistant (hands-free)
            </span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 3. **Voice Conversation Screen (Split View)**

When user selects "Voice Call", show a split-screen interface:

```
┌─────────────────────────────────────┐
│  🗺️  Map View (Top Half)           │
│  [User's location with pin]         │
│                                     │
│  Emergency: Wildfire               │
│  Your location: 37.7749, -122.4194 │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  💬 AI Conversation (Bottom Half)   │
│                                     │
│  AI: "I'm here to help. What's     │
│       your emergency?"              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      [🎤 Listening...]      │   │  ← Circular microphone (caller speaks)
│  │    Animated pulsing circle   │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Transcript appears in real-time]  │
└─────────────────────────────────────┘
```

#### 4. **State Transitions**

```
STATE 1: AI Speaking (Agent's turn)
  ┌─────────────────────────────┐
  │     [📢 Agent Speaking]     │
  │   Animated megaphone icon    │
  │   "Stay calm. Where are..."  │
  └─────────────────────────────┘
  [TTS audio plays through speakers]

STATE 2: User Speaking (Caller's turn)
  ┌─────────────────────────────┐
  │      [🎤 Listening...]      │
  │   Animated circular mic      │
  │   "I'm trapped on 5th..."    │
  └─────────────────────────────┘
  [STT captures audio, shows live transcript]

STATE 3: Processing (Agent thinking)
  ┌─────────────────────────────┐
  │     [⏳ Processing...]      │
  │   Spinner or typing dots     │
  └─────────────────────────────┘
  [Backend AI generates response]
```

---

### Implementation

#### 1. **VoiceConversationScreen Component**

```typescript
// frontend/src/components/voice/VoiceConversationScreen.tsx

import { useState, useEffect, useRef } from 'react';
import { Mic, Volume2, MapPin } from 'lucide-react';
import { useGeolocation } from '@/hooks/useGeolocation';

type ConversationState = 'agent_speaking' | 'user_speaking' | 'processing' | 'idle';

interface Message {
  role: 'agent' | 'user';
  content: string;
  timestamp: Date;
}

export function VoiceConversationScreen() {
  const [state, setState] = useState<ConversationState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const { location } = useGeolocation();

  const sttWsRef = useRef<WebSocket | null>(null);
  const ttsWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initialize with AI greeting
    startConversation();
  }, []);

  const startConversation = async () => {
    const greeting = "I'm here to help. Please describe your emergency.";

    setMessages([{
      role: 'agent',
      content: greeting,
      timestamp: new Date()
    }]);

    // Speak greeting
    await speakText(greeting);

    // Then start listening for user response
    startListening();
  };

  const speakText = async (text: string) => {
    setState('agent_speaking');

    // Get TTS token
    const { ws_url } = await fetch('/api/audio/tts-token', {
      method: 'POST',
      body: JSON.stringify({ voice_id: '21m00Tcm4TlvDq8ikWAM' })
    }).then(r => r.json());

    // Initialize TTS WebSocket
    const ttsWs = new WebSocket(ws_url);
    ttsWsRef.current = ttsWs;

    const audioContext = new AudioContext({ sampleRate: 44100 });
    let currentTime = 0;

    ttsWs.onopen = () => {
      // Initialize with voice settings
      ttsWs.send(JSON.stringify({
        text: ' ',
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8,
          speed: 1.0
        }
      }));

      // Send text to speak
      ttsWs.send(JSON.stringify({
        text: text,
        try_trigger_generation: true
      }));

      // Flush
      setTimeout(() => {
        ttsWs.send(JSON.stringify({ text: '' }));
      }, 100);
    };

    ttsWs.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.audio) {
        // Play audio chunk
        const audioData = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
        const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);

        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(currentTime);

        currentTime += audioBuffer.duration;
      }

      if (data.isFinal) {
        // Agent finished speaking, now listen to user
        setTimeout(() => {
          ttsWs.close();
          startListening();
        }, 500);
      }
    };
  };

  const startListening = async () => {
    setState('user_speaking');
    setLiveTranscript('');

    // Get STT token
    const { ws_url } = await fetch('/api/audio/token').then(r => r.json());

    // Request microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // Initialize STT WebSocket
    const sttWs = new WebSocket(ws_url);
    sttWsRef.current = sttWs;

    // Setup audio processing
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (!sttWs || sttWs.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);

      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

      sttWs.send(JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: base64Audio,
        commit: false,
        sample_rate: 16000
      }));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    // Handle STT messages
    sttWs.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.message_type === 'partial_transcript') {
        setLiveTranscript(data.transcript);
      }

      if (data.message_type === 'committed_transcript') {
        // User finished speaking
        const userMessage = data.transcript;

        setMessages(prev => [...prev, {
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        }]);

        setLiveTranscript('');

        // Stop listening
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(track => track.stop());
        sttWs.close();

        // Process with AI agent
        processUserInput(userMessage);
      }
    };

    // Auto-commit after 3 seconds of silence (using VAD)
    // Or add manual "Done Speaking" button
  };

  const processUserInput = async (userText: string) => {
    setState('processing');

    // Send to backend AI agent
    const response = await fetch('/api/voice-agent/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_message: userText,
        location: location,
        conversation_history: messages
      })
    }).then(r => r.json());

    const agentResponse = response.agent_message;

    // Add agent response to conversation
    setMessages(prev => [...prev, {
      role: 'agent',
      content: agentResponse,
      timestamp: new Date()
    }]);

    // Speak agent response
    await speakText(agentResponse);

    // If conversation is complete, navigate to caller guide
    if (response.case_created) {
      setTimeout(() => {
        // Show caller guide with case ID
        window.location.href = `/caller-guide/${response.case_id}`;
      }, 1000);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Map View (Top Half) */}
      <div className="h-1/2 relative">
        <div className="w-full h-full bg-gray-200">
          {/* Map component here */}
          <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-red-500" />
              <span className="font-semibold">Your Location</span>
            </div>
            <p className="text-xs text-gray-600">
              {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Getting location...'}
            </p>
          </div>
        </div>
      </div>

      {/* Conversation View (Bottom Half) */}
      <div className="h-1/2 bg-white flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'agent' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'agent'
                    ? 'bg-blue-100 text-blue-900'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <span className="text-xs text-gray-500 mt-1">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}

          {/* Live transcript (while user is speaking) */}
          {liveTranscript && (
            <div className="flex justify-end">
              <div className="max-w-[80%] p-3 rounded-lg bg-gray-50 text-gray-700 italic border-2 border-dashed">
                <p className="text-sm">{liveTranscript}</p>
              </div>
            </div>
          )}
        </div>

        {/* Voice Status Indicator */}
        <div className="p-6 border-t">
          {state === 'agent_speaking' && (
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                  <Volume2 className="w-10 h-10 text-white" />
                </div>
                <div className="absolute inset-0 w-20 h-20 bg-blue-400 rounded-full animate-ping opacity-75" />
              </div>
              <p className="text-sm text-blue-600 font-medium">Agent is speaking...</p>
            </div>
          )}

          {state === 'user_speaking' && (
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <Mic className="w-10 h-10 text-white" />
                </div>
                <div className="absolute inset-0 w-20 h-20 bg-red-400 rounded-full animate-ping opacity-75" />
              </div>
              <p className="text-sm text-red-600 font-medium">Listening to you...</p>
              <button
                onClick={() => {
                  // Manually commit transcript
                  if (sttWsRef.current) {
                    sttWsRef.current.send(JSON.stringify({
                      message_type: 'input_audio_chunk',
                      audio_base_64: '',
                      commit: true,
                      sample_rate: 16000
                    }));
                  }
                }}
                className="text-xs text-gray-600 underline"
              >
                Tap when done speaking
              </button>
            </div>
          )}

          {state === 'processing' && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-600 font-medium">Processing...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### Backend: Voice Agent Endpoint

```python
# backend/app.py

from pydantic import BaseModel
from typing import List, Dict

class VoiceAgentRequest(BaseModel):
    user_message: str
    location: Dict[str, float]  # {"lat": X, "lng": Y}
    conversation_history: List[Dict[str, str]]

@app.post("/api/voice-agent/process")
async def process_voice_agent(request: VoiceAgentRequest):
    """
    Process user's voice input in conversational mode.
    Agent asks follow-up questions until enough info is gathered.
    """
    user_msg = request.user_message.lower()
    history = request.conversation_history

    # Check if we have enough information to create a case
    has_description = any('fire' in msg['content'] or 'trapped' in msg['content'] for msg in history)
    has_location = request.location is not None

    if not has_description:
        # Ask for more details
        return {
            "agent_message": "I understand. Can you tell me more about what's happening? Are you safe?",
            "case_created": False
        }

    if 'trapped' in user_msg and 'floor' not in user_msg:
        # Ask for floor number
        return {
            "agent_message": "What floor are you on?",
            "case_created": False
        }

    # If we have enough info, create the case
    if has_description and has_location:
        # Extract full description from conversation
        full_description = ' '.join([
            msg['content'] for msg in history if msg['role'] == 'user'
        ])

        # Create case
        case_id = cases.create_case(
            user_id="anonymous",  # Or get from session
            latitude=request.location['lat'],
            longitude=request.location['lng'],
            raw_problem_description=full_description
        )

        return {
            "agent_message": "I've created your emergency case. Help is on the way. Here's what you should do while waiting...",
            "case_created": True,
            "case_id": case_id
        }

    return {
        "agent_message": "Is there anything else you can tell me about your situation?",
        "case_created": False
    }
```

---

### Visual States

#### Microphone Icon (User Speaking)
```css
.mic-listening {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 20px rgba(239, 68, 68, 0);
  }
}
```

#### Megaphone Icon (Agent Speaking)
```css
.megaphone-speaking {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-radius: 50%;
  animation: pulse-blue 1.5s ease-in-out infinite;
}

@keyframes pulse-blue {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 20px rgba(59, 130, 246, 0);
  }
}
```

---

### Benefits of Conversational Mode

1. **Natural Interaction**: Feels like talking to a human operator
2. **Clarifying Questions**: Agent can ask follow-ups to get complete info
3. **Immediate Feedback**: User sees transcript in real-time (knows they're heard)
4. **Guided Process**: Agent walks user through providing necessary details
5. **Reduced Panic**: Voice conversation is calming vs typing in emergency
6. **Accessibility**: Works for elderly, injured, or visually impaired users

---

### Example Conversation Flow

```
Agent: "I'm here to help. Please describe your emergency."
  [User speaks] → [Mic icon pulsing]

User: "There's a fire in my building"
  [Text appears] → [Agent thinking]

Agent: "I understand. Are you safe right now? Can you evacuate?"
  [Megaphone icon] → [TTS plays]

User: "I'm trapped on the 5th floor, can't reach the stairs"
  [Mic icon] → [Transcript appears]

Agent: "Stay calm. I'm creating your emergency case now. Do you have a window you can signal from?"
  [Megaphone icon]

User: "Yes, there's a window"
  [Mic icon]

Agent: "Perfect. Here's what you should do while waiting for help..."
  [Megaphone icon] → [Case created, navigate to caller guide]
```

---

## Testing Strategy (TTS)

### 1. **Unit Tests**

```typescript
// frontend/src/components/audio/__tests__/VoiceRecorder.test.tsx

import { render, fireEvent, waitFor } from '@testing-library/react';
import { VoiceRecorder } from '../VoiceRecorder';

describe('VoiceRecorder', () => {
  it('requests microphone permission on start', async () => {
    const mockGetUserMedia = jest.fn().mockResolvedValue({});
    global.navigator.mediaDevices = { getUserMedia: mockGetUserMedia };

    const { getByText } = render(<VoiceRecorder />);
    fireEvent.click(getByText('Start Speaking'));

    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: expect.any(Object) });
    });
  });

  it('displays partial transcripts', async () => {
    // Mock WebSocket messages
    const { getByText } = render(<VoiceRecorder />);

    // Simulate partial transcript
    mockWebSocket.emit('message', {
      data: JSON.stringify({
        message_type: 'partial_transcript',
        transcript: 'I need help'
      })
    });

    expect(getByText(/I need help/)).toBeInTheDocument();
  });
});
```

### 2. **Integration Tests**

```bash
# Test full flow: audio → transcript → case creation
cd backend
pytest tests/test_audio_mode.py -v

# tests/test_audio_mode.py
def test_voice_input_creates_case():
    # 1. Generate token
    response = client.post("/api/audio/token")
    assert response.status_code == 200
    token = response.json()["token"]

    # 2. Simulate transcript submission
    case_response = client.post("/api/cases", json={
        "user_id": "test-user",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "raw_problem_description": "Trapped in building need rescue",
        "input_method": "voice",
        "audio_metadata": {"session_duration": 12.5, "transcript_length": 35}
    })

    assert case_response.status_code == 200
    assert case_response.json()["input_method"] == "voice"
```

### 3. **Manual Testing Scenarios**

- [ ] Quiet environment, clear speech
- [ ] Noisy environment (sirens, traffic)
- [ ] Whispered speech (injured user)
- [ ] Panicked/rapid speech
- [ ] Multiple languages
- [ ] Microphone permission denial
- [ ] Network interruption mid-recording
- [ ] API quota exceeded
- [ ] Very short transcripts (< 5 words)
- [ ] Very long transcripts (> 500 words)

---

## Cost Analysis

### ElevenLabs Pricing (Speech-to-Text)

| Plan | Price | Monthly Minutes | Cost per Minute |
|------|-------|----------------|----------------|
| Free | $0 | 1,000 | $0 |
| Starter | $5 | 30,000 | $0.00017 |
| Creator | $22 | 100,000 | $0.00022 |
| Pro | $99 | 500,000 | $0.000198 |

### Usage Estimates

Assumptions:
- Average emergency call: **2 minutes** of audio
- 70% of callers use text, 30% use voice
- 1,000 cases per month

**Calculation**:
```
1,000 cases/month × 30% voice = 300 voice cases
300 cases × 2 minutes = 600 minutes/month

Cost (Starter plan): 600 × $0.00017 = $0.10/month
```

**Conclusion**: Extremely affordable. Free tier (1,000 min) likely sufficient for MVP.

### Cost Optimization Strategies

1. **Client-side VAD**: Stop recording during silence to reduce minutes
2. **Compression**: Use Opus codec instead of PCM (not currently supported)
3. **Caching**: Store common phrases ("I'm trapped", "fire") to avoid re-transcription
4. **Fallback to Text**: Automatically suggest text mode if audio fails multiple times

---

## Security Considerations

### 1. **API Key Protection**

**❌ NEVER** expose ElevenLabs API key on frontend:
```typescript
// BAD - Don't do this!
const API_KEY = "sk_abc123...";
```

**✅ ALWAYS** use token generation endpoint:
```typescript
// GOOD - Backend generates short-lived token
const { token } = await fetch('/api/audio/token').then(r => r.json());
```

### 2. **Input Validation**

```python
# Backend validation
@app.post("/api/cases")
async def create_case(request: CreateCaseRequest):
    # Validate transcript length
    if len(request.raw_problem_description) > 2000:
        raise HTTPException(400, "Description too long")

    # Sanitize input (XSS prevention)
    safe_description = bleach.clean(request.raw_problem_description)

    # Check for spam patterns
    if is_spam(safe_description):
        raise HTTPException(400, "Invalid input detected")
```

### 3. **Rate Limiting**

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/audio/token")
@limiter.limit("10/minute")  # Max 10 tokens per minute per IP
async def generate_audio_token():
    ...
```

### 4. **HTTPS Enforcement**

```typescript
// Only allow audio recording over HTTPS
if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
  throw new Error('Audio mode requires HTTPS connection');
}
```

---

## Deployment Checklist

### Frontend

- [ ] Add `VoiceRecorder.tsx` component
- [ ] Update `RequestHelpDialog.tsx` with mode toggle
- [ ] Create `useAudioVisualization` hook
- [ ] Add ElevenLabs token fetch logic
- [ ] Configure CORS for WebSocket
- [ ] Add error boundaries for audio failures
- [ ] Test on iOS Safari, Android Chrome
- [ ] Add analytics tracking (Mixpanel/Amplitude)

### Backend

- [ ] Add `POST /api/audio/token` endpoint
- [ ] Update `.env` with `ELEVENLABS_API_KEY`
- [ ] Add `audio_usage_logs` table migration
- [ ] Implement rate limiting
- [ ] Add monitoring alerts for quota usage
- [ ] Configure logging for audio errors
- [ ] Update API documentation

### Infrastructure

- [ ] Enable HTTPS on frontend (required for microphone)
- [ ] Configure CDN for audio assets
- [ ] Setup error tracking (Sentry)
- [ ] Add health check for ElevenLabs API
- [ ] Configure backup text mode if audio fails
- [ ] Load testing for concurrent audio sessions

---

## Future Enhancements

### 1. **Offline Mode**
- Use Web Speech API as fallback (browser-native)
- Cache transcripts locally
- Sync when connection restored

### 2. **Background Noise Filtering**
- Integrate noise suppression ML models
- Detect sirens/alarms automatically
- Boost speech in noisy environments

### 3. **Emotion Detection**
- Analyze voice tone for panic/distress
- Auto-escalate urgent cases
- Provide calming audio feedback

### 4. **Voice Verification**
- Match caller voice on repeat calls
- Detect potential fraud/prank calls
- Build voice profile for identity

### 5. **Two-Way Voice Communication**
- Add Text-to-Speech for helper guides
- Voice chat between caller and helper
- AI voice agent for immediate guidance

### 6. **Multi-Language Auto-Detection**
- Automatically detect spoken language
- Route to appropriate language model
- Translate for helpers

---

## Success Metrics

Track these KPIs to measure audio mode effectiveness:

1. **Adoption Rate**: % of cases created via voice vs text
2. **Completion Rate**: % of voice sessions that successfully submit
3. **Time to Submit**: Average time from start recording → case created
4. **Transcript Accuracy**: Manual review of transcripts vs actual audio
5. **Error Rate**: % of sessions with WebSocket/API errors
6. **Fallback Rate**: % of users who switch from voice → text
7. **User Satisfaction**: Post-case survey rating

**Target Goals** (3 months post-launch):
- 25% adoption rate for voice mode
- 90% completion rate
- < 30 seconds average time to submit
- 95% transcript accuracy
- < 5% error rate

---

## Summary

This audio mode integration:

✅ **Lowers barrier to entry** for injured/elderly users
✅ **Maintains existing backend logic** (transcript flows through same pipeline)
✅ **Costs < $1/month** for typical usage
✅ **Improves accessibility** significantly
✅ **Adds minimal complexity** (~300 LOC frontend, ~50 LOC backend)
✅ **Degrades gracefully** (falls back to text on failure)

**Recommended Next Steps**:
1. Implement `VoiceRecorder.tsx` component (2 hours)
2. Add token generation endpoint (30 mins)
3. Test on real devices (1 hour)
4. Deploy to staging for internal testing (30 mins)
5. Collect feedback and iterate (ongoing)

**Total Implementation Time**: ~4-6 hours for MVP

---

**Document Version**: 1.0
**Last Updated**: 2025-11-16
**Owner**: Beacon Development Team
**Status**: Ready for Implementation
