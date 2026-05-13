import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

serve(async (req) => {
  const { dream_id, gaps } = await req.json();
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

  const { data: dream } = await supabase.from('dreams').select('transcription_raw').eq('id', dream_id).single();
  if (!dream?.transcription_raw) return new Response(JSON.stringify({ error: 'No transcription' }), { status: 404 });

  const gapTexts = (gaps ?? []).map((g: { section_text: string }) => g.section_text);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
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

  const { data: insertedScenes, error } = await supabase
    .from('scenes').insert(scenes.map(s => ({ ...s, dream_id }))).select();

  if (error) {
    await supabase.from('dreams').update({ status: 'failed' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: 'Scene insert failed' }), { status: 500 });
  }

  await supabase.functions.invoke('generate-panels', {
    body: { dream_id, scene_ids: insertedScenes?.map(s => s.id) ?? [] },
  });
  return new Response(JSON.stringify({ ok: true, scene_count: scenes.length }));
});
