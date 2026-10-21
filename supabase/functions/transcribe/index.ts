import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchWithRetry } from '../_shared/retry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let dream_id: string;
  try {
    const body = await req.json();
    dream_id = body.dream_id;
    if (!dream_id) throw new Error('missing dream_id');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: dream } = await supabase.from('dreams').select('audio_url, user_id').eq('id', dream_id).single();
  if (!dream?.audio_url) return new Response(JSON.stringify({ error: 'No audio' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  await supabase.from('dreams').update({ pipeline_step: 'transcribing' }).eq('id', dream_id);

  const audioPath = `${dream.user_id}/${dream_id}.m4a`;
  const { data: audioBlob, error: dlErr } = await supabase.storage.from('audio').download(audioPath);
  if (dlErr || !audioBlob) {
    await supabase.from('dreams').update({ status: 'failed', pipeline_step: 'failed', failed_reason: 'Audio file not found — try recording again' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: `audio download failed: ${dlErr?.message ?? 'no blob'}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'dream.m4a');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  let whisperData: Record<string, unknown>;
  try {
    const resp = await fetchWithRetry('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      body: formData,
    });
    whisperData = await resp.json();
  } catch (err) {
    await supabase.from('dreams').update({ status: 'failed', pipeline_step: 'failed', failed_reason: 'Transcription service unavailable — will retry on next open' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: `Whisper failed: ${String(err).slice(0, 200)}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  if (!whisperData.text || (whisperData.text as string).trim() === '') {
    await supabase.from('dreams').update({ status: 'failed', pipeline_step: 'failed', failed_reason: 'Recording was too quiet — try speaking closer to the phone' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: 'Empty transcription' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const segments = (whisperData.segments as Array<{ no_speech_prob: number }>) ?? [];
  const avgNoSpeech = segments.length > 0
    ? segments.reduce((s, seg) => s + seg.no_speech_prob, 0) / segments.length
    : 0;

  await supabase.from('dreams').update({
    transcription_raw: whisperData.text as string,
    transcription_enhanced: whisperData.text as string,
    low_confidence: avgNoSpeech > 0.4,
    status: 'processing',
  }).eq('id', dream_id);

  // Fire-and-forget: analyse-gaps is responsible for its own error handling
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyse-gaps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ dream_id }),
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
