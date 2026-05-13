# DreamLog — Claude Context

## What This Is

iOS app that captures dreams via audio from the lock screen and transforms them into AI-generated personal comic books. Built with React Native + Expo (managed workflow with a Swift native module).

## Tech Stack

- **React Native + Expo SDK 51+** with expo-router (file-based routing, scheme `dreamlog://`)
- **Supabase**: PostgreSQL + Storage + Edge Functions + Realtime
- **Deno Edge Functions**: transcribe → analyse-gaps → split-scenes → generate-panels pipeline
- **OpenAI Whisper**: transcription with `verbose_json` for `no_speech_prob` confidence
- **Anthropic Claude** (`claude-sonnet-4-20250514`): gap analysis and scene splitting
- **DALL-E 3**: per-scene image generation (4 styles: classic, graphic_novel, manga, surreal)
- **Swift native module** (`native/DreamLogRecorder/`): AVAudioRecorder, ActivityKit Live Activity, WidgetKit lock screen widget, WakeWordDetector, UNUserNotificationCenter smart alarm
- **WatchOS companion** (`watch/DreamLogWatch/`): HRV REM-exit detection via HealthKit + WatchConnectivity

## Critical: expo-file-system v2

This project uses **expo-file-system v2**. The legacy API (`FileSystem.documentDirectory`, `readAsStringAsync`, `moveAsync`) is **deprecated and throws at runtime**. Always use the class-based API:

```typescript
import { File, Directory, Paths } from 'expo-file-system/next';
```

## Key Files

| File | Purpose |
|------|---------|
| `types/database.ts` | Hand-written Supabase types (no CLI available) — includes `Relationships`, `Views`, `Functions` required by GenericSchema |
| `lib/supabase.ts` | Supabase client with ExpoSecureStoreAdapter, runtime env var guard |
| `lib/storage.ts` | Offline upload queue (AsyncStorage), expo-file-system v2, concurrency guard |
| `hooks/useAudioRecorder.ts` | Recording state machine with durationRef, silence nudge, 5s minimum |
| `app/_layout.tsx` | Auth guard, magic-link PKCE, `dreamlog://record` + `dreamlog://stop` deep links |
| `supabase/migrations/001_initial_schema.sql` | All 4 tables, RLS, `handle_new_user` trigger (critical — without it auth signup never creates public.users) |
| `supabase/functions/` | 6 edge functions: transcribe, analyse-gaps, split-scenes, generate-panels, generate-gap-fill, generate-export |
| `native/DreamLogRecorder/` | Expo native module (Swift) — recording, Live Activity, wake word, smart alarm |
| `watch/DreamLogWatch/` | WatchOS app — HRV observer, WCSession bridge |
| `docs/e2e-checklist.md` | Full E2E test checklist with manual step notes |

## Database Schema

4 tables: `users`, `dreams`, `scenes`, `gap_suggestions`. All have RLS enabled.

- `dreams.status`: `'pending' | 'processing' | 'ready' | 'failed'`
- `dreams.comic_style`: `'classic' | 'graphic_novel' | 'manga' | 'surreal'`
- `dreams.transcription_raw`: immutable — pipeline never writes to it after transcribe
- `dreams.export_url`: cached PNG strip URL — set once by generate-export
- `users.preferences`: `{ default_comic_style, wake_word_enabled, watch_enabled, alarm_window_start }`

## Pipeline

```
Audio upload → transcribe (Whisper) → analyse-gaps (Claude) → split-scenes (Claude) → generate-panels (DALL-E 3)
```

Each step invokes the next via `supabase.functions.invoke`. All steps check `invokeErr` and mark dream `'failed'` on error. `generate-panels` tracks `successCount` — marks failed if all scenes fail.

## Supabase Storage Buckets

- `dreams` — audio files (`{user_id}/{dream_id}.m4a`)
- `panels` — DALL-E images re-uploaded to avoid temp URL expiry
- `exports` — PNG strips from generate-export (must be **public** bucket)

## Manual Steps Required (Cannot Be Automated)

These require the developer to run manually:

1. **Supabase deploy**: `supabase db push` + `supabase functions deploy` for all 6 functions
2. **Xcode build**: `npx expo prebuild` then open in Xcode — required for native module, WidgetKit extension, ActivityKit capability
3. **Xcode capabilities**: Push Notifications, Background Modes, Activity (Live Activities), HealthKit (Watch target)
4. **Info.plist additions**: `NSSpeechRecognitionUsageDescription`, `NSMicrophoneUsageDescription`, `NSMotionUsageDescription`
5. **WidgetKit extension target**: DreamLogWidget must be added as a separate Xcode target
6. **WatchOS target**: File → New → Target → watchOS → Watch App named `DreamLogWatch`
7. **Apple Watch pairing**: Required for HRV/REM detection tests

## Environment Variables

Set in Expo config or `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Edge functions use `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (set in Supabase dashboard → Edge Functions → Secrets).

## TypeScript

No `supabase gen types` — types are hand-written in `types/database.ts`. The `tsconfig.json` excludes `supabase/functions` (Deno, not tsc). Run `npx tsc --noEmit` to verify.

## Remote

`https://github.com/relayonai/DreamLogApp.git` (`main` branch)
