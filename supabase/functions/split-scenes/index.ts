import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  const { data: dream } = await supabase.from('dreams').select('transcription_raw').eq('id', dream_id).single();
  if (!dream?.transcription_raw) return new Response(JSON.stringify({ error: 'No transcription' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  const gapTexts = (gaps ?? []).map((g: unknown) => (g as { section_text: string }).section_text);

  const message = await anthropic.messages.create({
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

  let scenes: Array<{ order_index: number; text_content: string; gap_filled: boolean; tone_applied: null }> = [];
  try {
    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    scenes = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch { scenes = []; }

  // Spec: scene splitting produces unusable output → fall back to single scene
  if (!scenes.length) {
    scenes = [{ order_index: 0, text_content: dream.transcription_raw, gap_filled: false, tone_applied: null }];
  }

  // Dedup guard: delete existing scenes before insert in case of retry
  await supabase.from('scenes').delete().eq('dream_id', dream_id);

  const { data: insertedScenes, error } = await supabase
    .from('scenes').insert(scenes.map(s => ({ ...s, dream_id }))).select();

  if (error) {
    await supabase.from('dreams').update({ status: 'failed' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: 'Scene insert failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  const nextResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-panels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ dream_id, scene_ids: insertedScenes?.map(s => s.id) ?? [] }),
  });
  if (!nextResp.ok) {
    const errBody = await nextResp.text();
    await supabase.from('dreams').update({ status: 'failed' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: `generate-panels handoff failed: ${nextResp.status} ${errBody.slice(0,200)}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
  return new Response(JSON.stringify({ ok: true, scene_count: scenes.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
