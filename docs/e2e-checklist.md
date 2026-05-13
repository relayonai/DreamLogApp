# DreamLog — End-to-End Integration Checklist

This checklist covers the full user-facing flows for DreamLog v1.
All items require a fully configured environment (see Prerequisites below).
Items that cannot be automated are marked **[MANUAL]**.

---

## Prerequisites

Before running any checklist item, ensure the following are in place:

| Requirement | Command / Note |
|---|---|
| Supabase project deployed | `supabase db push` + `supabase functions deploy` for all 6 Edge Functions |
| Environment variables set | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` in `.env` and Supabase secrets |
| Native build produced | `npx expo prebuild --clean` then `npx expo run:ios` (requires macOS + Xcode 15+) |
| Physical iOS device or simulator | WidgetKit and UNUserNotificationCenter require iOS 16+ |
| Apple Watch paired (optional) | Required only for REM detection / Smart Alarm flow |
| Test account created | Sign up once; use the same account for persistence tests |

---

## Recording & Processing

- [ ] **[MANUAL]** Record a dream longer than 5 seconds → processing card appears in the list → status transitions through `processing` → `ready` → dream entry is visible in Library.
- [ ] **[MANUAL]** Record for less than 5 seconds → "That was a short one" alert appears → tap **Add more** → recording restarts → tap **Save as is** → short dream is saved successfully.
- [ ] **[MANUAL]** Begin recording, stay silent for 10 seconds → silence nudge banner appears → tap **Cancel** → recording stops with no entry created.
- [ ] **[MANUAL]** Start recording, force-quit the app mid-recording → reopen the app → the pending audio is found in the upload queue → upload resumes automatically → pipeline runs to `ready` status.

---

## Comic Viewer

- [ ] **[MANUAL]** Open a completed dream from the Library → comic panels render with AI-generated images and captions for every panel.
- [ ] **[MANUAL]** Open a dream whose transcription confidence is below the threshold → a yellow ⚠️ low-confidence banner is visible at the top of the Comic Viewer.

---

## Shape (AI Editing)

- [ ] **[MANUAL]** In the Comic Viewer, tap **Shape** → tap a tone chip (e.g. "Whimsical") → AI suggestion loads → tap **Accept** → panel text in the Comic Viewer updates to the suggested text.
- [ ] **[MANUAL]** After accepting an AI suggestion, tap **Restore original** → panel text reverts to the original transcription-derived text.
- [ ] **[MANUAL]** In Shape, change the comic style (e.g. "Manga") → return to Comic Viewer → the style label in the viewer header reflects the new style.

---

## Library Views

- [ ] **[MANUAL]** In the Library, switch to the **Calendar** view → the recorded dream appears on its date tile → tap it → navigates to the Comic Viewer.
- [ ] **[MANUAL]** Switch to **Feed** view → the dream card is visible → tap it → navigates to the Comic Viewer.
- [ ] **[MANUAL]** Switch to **Grid** view → the dream thumbnail is visible → tap it → navigates to the Comic Viewer.

---

## Settings

- [ ] **[MANUAL]** Open **Settings** → toggle **Wake Word** off and back on → verify the preference is persisted to `users.preferences` in Supabase (check via Supabase Studio or a direct query).
- [ ] **[MANUAL]** Toggle **Smart Alarm** on → open iOS Settings > Notifications or run `UNUserNotificationCenter.current().getPendingNotificationRequests` in a debug build → confirm a pending notification with identifier `dreamlog.wake.start` exists.

---

## Lock Screen Widget

- [ ] **[MANUAL]** On a physical device, long-press the Lock Screen → tap **Customize** → add a widget → confirm the DreamLog widget appears in the widget picker → add it → tap the widget → verify it triggers the `dreamlog://record` deep link and opens the recording UI.

---

## Persistence & Auth

- [ ] **[MANUAL]** Sign out of the app → sign back in with the same credentials → confirm all previously recorded dreams are still present in the Library.

---

## Share

- [ ] **[MANUAL]** On a completed dream in the Comic Viewer, tap **↑ Share** → a loading spinner appears briefly → the iOS Share Sheet opens containing a PNG URL → open the URL in Safari → confirm a valid PNG image loads.
- [ ] **[MANUAL]** Tap **↑ Share** again on the same dream → no spinner appears (cached URL) → the Share Sheet opens immediately.

---

## Notes

- All checklist items are **[MANUAL]** because they require a native iOS build, live Supabase backend, and real or simulated device hardware (microphone, WidgetKit, push notifications).
- TypeScript compilation (`npx tsc --noEmit`) is the only step that can be validated in CI without the above infrastructure.
- A fully automated Detox or XCTest suite is out of scope for v1 but is recommended before a production App Store release.
