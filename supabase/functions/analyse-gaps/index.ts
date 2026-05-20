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
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

  const { data: dream } = await supabase.from('dreams').select('transcription_raw').eq('id', dream_id).single();
  if (!dream?.transcription_raw) return new Response(JSON.stringify({ error: 'No transcription' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are analysing a dream transcription from someone waking from sleep. Speech may be mumbled.

Transcription:
"""
${dream.transcription_raw}
"""

Identify sections that are thin, vague, or narratively incomplete.
Return ONLY a JSON array. Each object:
- "section_text": exact verbatim text of the gap
- "reason": one sentence why it is a gap
- "position": "start" | "middle" | "end"

If no gaps, return []. Return ONLY the JSON array — no preamble.`,
    }],
  });

  let gaps: Array<{ section_text: string; reason: string; position: string }> = [];
  try {
    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    gaps = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch { gaps = []; }

  const nextResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/split-scenes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ dream_id, gaps }),
  });
  if (!nextResp.ok) {
    const errBody = await nextResp.text();
    await supabase.from('dreams').update({ status: 'failed' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: `split-scenes handoff failed: ${nextResp.status} ${errBody.slice(0,200)}` }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
  return new Response(JSON.stringify({ ok: true, gap_count: gaps.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
