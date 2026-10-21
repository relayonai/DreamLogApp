import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Scene {
  order_index: number;
  text_content: string;
  gap_filled: boolean;
  tone_applied: null;
}

function parseSceneArray(raw: string): Scene[] {
  const cleaned = raw.replace(/```json|```|'''json|'''/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (s: unknown): s is Scene =>
      typeof s === 'object' && s !== null &&
      typeof (s as Scene).order_index === 'number' &&
      typeof (s as Scene).text_content === 'string' &&
      (s as Scene).text_content.trim() !== '' &&
      typeof (s as Scene).gap_filled === 'boolean',
  );
}

async function callClaudeWithRetry(
  anthropic: Anthropic,
  params: Anthropic.MessageCreateParams,
  maxRetries = 3,
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt === maxRetries) throw err;
      const delay = 1000 * 2 ** attempt * (0.75 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let dream_id: string, gaps: unknown[];
  try {
    const body = await req.json();
    dream_id = body.dream_id;
    gaps = body.gaps ?? [];
    if (!dream_id) throw new Error('missing dream_id');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

  await supabase.from('dreams').update({ pipeline_step: 'splitting' }).eq('id', dream_id);

  const { data: dream } = await supabase.from('dreams').select('transcription_raw').eq('id', dream_id).single();
  if (!dream?.transcription_raw) {
    await supabase.from('dreams').update({ status: 'failed', pipeline_step: 'failed', failed_reason: 'No transcription found' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: 'No transcription' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const gapTexts = (gaps ?? []).map((g: unknown) => (g as { section_text: string }).section_text);

  let scenes: Scene[] = [];
  try {
    const message = await callClaudeWithRetry(anthropic, {
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `Split this dream into comic panels on narrative beats, location changes, action shifts.
Target 2–9 scenes. Under ~50 words: produce 1 scene.
Mark scenes containing these gap texts as gap_filled=true: ${JSON.stringify(gapTexts)}

Transcription:
"""
${dream.transcription_raw}
"""

Return ONLY a JSON array. Each object:
- "order_index": integer starting at 0
- "text_content": verbatim text from the transcription
- "gap_filled": boolean
- "tone_applied": null

Return ONLY the JSON array — no preamble.`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    scenes = parseSceneArray(text);
  } catch (err) {
    console.error('split-scenes Claude call failed:', err);
    await supabase.from('dreams').update({ status: 'failed', pipeline_step: 'failed', failed_reason: 'Scene splitting failed — try again later' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: 'Claude API failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  if (!scenes.length) {
    scenes = [{ order_index: 0, text_content: dream.transcription_raw, gap_filled: false, tone_applied: null }];
  }

  await supabase.from('scenes').delete().eq('dream_id', dream_id);

  const { data: insertedScenes, error } = await supabase
    .from('scenes').insert(scenes.map(s => ({ ...s, dream_id }))).select();

  if (error) {
    await supabase.from('dreams').update({ status: 'failed', pipeline_step: 'failed', failed_reason: 'Failed to save scenes' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: 'Scene insert failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  // Fire-and-forget: generate-panels handles its own errors
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-panels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ dream_id, scene_ids: insertedScenes?.map(s => s.id) ?? [] }),
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: true, scene_count: scenes.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
