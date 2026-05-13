import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { dream_id } = await req.json();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: dream } = await supabase.from('dreams').select('audio_url').eq('id', dream_id).single();
  if (!dream?.audio_url) return new Response(JSON.stringify({ error: 'No audio' }), { status: 404 });

  const audioBlob = await (await fetch(dream.audio_url)).blob();
  const formData = new FormData();
  formData.append('file', audioBlob, 'dream.m4a');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  const whisperData = await (await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
    body: formData,
  })).json();

  if (!whisperData.text) {
    await supabase.from('dreams').update({ status: 'failed' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: 'Transcription failed' }), { status: 500 });
  }

  // Confidence: average no_speech_prob across segments. Threshold 0.4 — calibrate during testing.
  const segments = whisperData.segments ?? [];
  const avgNoSpeech = segments.length > 0
    ? segments.reduce((s: number, seg: { no_speech_prob: number }) => s + seg.no_speech_prob, 0) / segments.length
    : 0;

  await supabase.from('dreams').update({
    transcription_raw: whisperData.text,
    transcription_enhanced: whisperData.text,
    low_confidence: avgNoSpeech > 0.4,
    status: 'processing',
  }).eq('id', dream_id);

  await supabase.functions.invoke('analyse-gaps', { body: { dream_id } });
  return new Response(JSON.stringify({ ok: true }));
});
