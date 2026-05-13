import { File, Directory, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_KEY = 'dreamlog:upload_queue';

interface QueueEntry { dreamId: string; localUri: string; remotePath: string; }

export async function enqueueAudioUpload(dreamId: string, localUri: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const remotePath = `${user.id}/${dreamId}.m4a`;
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: QueueEntry[] = raw ? JSON.parse(raw) : [];
  queue.push({ dreamId, localUri, remotePath });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  await flushUploadQueue();
}

export async function flushUploadQueue(): Promise<void> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const queue: QueueEntry[] = JSON.parse(raw);
  const remaining: QueueEntry[] = [];

  for (const entry of queue) {
    try {
      const file = new File(entry.localUri);
      if (!file.exists) continue;

      const bytes = await file.bytes();

      const { error } = await supabase.storage
        .from('audio').upload(entry.remotePath, bytes, { contentType: 'audio/m4a', upsert: true });

      if (error) { remaining.push(entry); continue; }

      const { data: { publicUrl } } = supabase.storage.from('audio').getPublicUrl(entry.remotePath);
      await supabase.from('dreams').update({ audio_url: publicUrl, status: 'processing' }).eq('id', entry.dreamId);
      await supabase.functions.invoke('transcribe', { body: { dream_id: entry.dreamId } });
    } catch {
      remaining.push(entry);
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}
