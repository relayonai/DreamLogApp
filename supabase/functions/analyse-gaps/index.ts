import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Gap {
  section_text: string;
  reason: string;
  position: string;
}

function parseJsonArray(raw: string): Gap[] {
  const cleaned = raw.replace(/```json|```|'''json|'''/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (g: unknown): g is Gap =>
      typeof g === 'object' && g !== null &&
      typeof (g as Gap).section_text === 'string' &&
      typeof (g as Gap).reason === 'string' &&
      typeof (g as Gap).position === 'string',
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

  await supabase.from('dreams').update({ pipeline_step: 'analysing' }).eq('id', dream_id);

  const { data: dream } = await supabase.from('dreams').select('transcription_raw').eq('id', dream_id).single();
  if (!dream?.transcription_raw) {
    await supabase.from('dreams').update({ status: 'failed', pipeline_step: 'failed', failed_reason: 'No transcription found' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: 'No transcription' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  let gaps: Gap[] = [];
  try {
    const message = await callClaudeWithRetry(anthropic, {
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

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    gaps = parseJsonArray(text);
  } catch (err) {
    console.error('analyse-gaps Claude call failed:', err);
    await supabase.from('dreams').update({ status: 'failed', pipeline_step: 'failed', failed_reason: 'Dream analysis failed — try again later' }).eq('id', dream_id);
    return new Response(JSON.stringify({ error: 'Claude API failed' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }

  // Fire-and-forget: split-scenes handles its own errors
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/split-scenes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ dream_id, gaps }),
  }).catch(() => {});

  return new Response(JSON.stringify({ ok: true, gap_count: gaps.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
