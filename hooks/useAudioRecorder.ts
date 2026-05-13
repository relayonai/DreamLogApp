import { useState, useRef } from 'react';
import { Audio } from 'expo-av';
import { File, Directory, Paths } from 'expo-file-system';
import { createDream } from '../lib/dreams';
import { enqueueAudioUpload } from '../lib/storage';

type RecorderState = 'idle' | 'recording' | 'stopping' | 'saved';
export interface StopResult { dreamId: string | null; tooShort: boolean; }

export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [showSilenceNudge, setShowSilenceNudge] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function startRecording() {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    recordingRef.current = recording;
    setState('recording');
    setDurationMs(0);
    setShowSilenceNudge(false);
    timerRef.current = setInterval(() => setDurationMs(d => d + 1000), 1000);
    // Spec: silence after 10 seconds → nudge "We're listening…"
    silenceTimerRef.current = setTimeout(() => setShowSilenceNudge(true), 10000);
  }

  async function stopRecording(): Promise<StopResult> {
    if (!recordingRef.current) return { dreamId: null, tooShort: false };
    setState('stopping');
    if (timerRef.current) clearInterval(timerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setShowSilenceNudge(false);

    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;

    if (!uri) return { dreamId: null, tooShort: false };
    // Spec: under 5 seconds → prompt user
    if (durationMs < 5000) return { dreamId: null, tooShort: true };

    const dream = await createDream({ recorded_at: new Date().toISOString(), status: 'pending_sync' });
    const dreamsDir = new Directory(Paths.document, 'dreams');
    if (!dreamsDir.exists) dreamsDir.create();
    const dest = new File(dreamsDir, `${dream.id}.m4a`);
    const srcFile = new File(uri);
    srcFile.move(dest);
    await enqueueAudioUpload(dream.id, dest.uri);
    setState('saved');
    return { dreamId: dream.id, tooShort: false };
  }

  return { state, durationMs, showSilenceNudge, startRecording, stopRecording };
}
