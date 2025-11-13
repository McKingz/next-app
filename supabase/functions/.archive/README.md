# Archived Edge Functions

This directory contains Edge Functions that are no longer deployed but kept for reference.

## transcribe-chunk-obsolete

**Archived:** 2025-01-16  
**Reason:** Replaced by direct Deepgram WebSocket streaming in `claudeProvider`

### Why it was removed:
- **Old approach:** Mobile → Edge Function → Deepgram API (2 hops, slower)
- **New approach:** Mobile → Deepgram WebSocket (direct, faster)
- The Edge Function added unnecessary latency (~200ms overhead)
- Direct WebSocket streaming is faster and simpler

### What replaced it:
- `lib/voice/claudeProvider.ts` - Direct Deepgram streaming WebSocket
- No Edge Function needed for real-time transcription
- Still use `transcribe-audio` for batch voice notes

### Performance improvement:
- Old: ~700ms (500ms chunk + 200ms Edge Function overhead)
- New: ~100ms (direct streaming)
- **6x faster!**
