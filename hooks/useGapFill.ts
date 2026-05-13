import { useState } from 'react';
import { supabase } from '../lib/supabase';

export const TONES = ['Action', 'Comedy', 'Love', 'Drama', 'Horror', 'Warmth'] as const;
export type Tone = typeof TONES[number];

interface Suggestion { tone: Tone; text: string; loading: boolean; }

export function useGapFill(sceneId: string, originalText: string) {
  const [suggestions, setSuggestions] = useState<Partial<Record<Tone, Suggestion>>>({});
  const [accepted, setAccepted] = useState<Tone | null>(null);

  async function previewTone(tone: Tone) {
    if (suggestions[tone]) return;
    setSuggestions(prev => ({ ...prev, [tone]: { tone, text: '', loading: true } }));
    const { data, error } = await supabase.functions.invoke('generate-gap-fill', {
      body: { original_text: originalText, tone },
    });
    if (error || !data?.text) {
      setSuggestions(prev => { const n = { ...prev }; delete n[tone]; return n; });
      return;
    }
    setSuggestions(prev => ({ ...prev, [tone]: { tone, text: data.text, loading: false } }));
  }

  async function acceptSuggestion(tone: Tone) {
    const s = suggestions[tone];
    if (!s) return;
    await supabase.from('gap_suggestions').insert({
      scene_id: sceneId, original_text: originalText, suggested_text: s.text, tone, accepted: true,
    });
    await supabase.from('scenes').update({ text_content: s.text, gap_filled: true, tone_applied: tone }).eq('id', sceneId);
    setAccepted(tone);
  }

  async function restoreOriginal() {
    await supabase.from('scenes').update({ text_content: originalText, gap_filled: false, tone_applied: null }).eq('id', sceneId);
    setAccepted(null);
  }

  return { suggestions, accepted, previewTone, acceptSuggestion, restoreOriginal };
}
