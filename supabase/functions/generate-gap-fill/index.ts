import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  Action:  'Add movement, urgency, and physical energy.',
  Comedy:  'Add absurdist or comedic elements true to dream logic.',
  Love:    'Add warmth, longing, or romantic connection.',
  Drama:   'Add emotional depth and heightened stakes.',
  Horror:  'Add unease, dread, or disturbing imagery.',
  Warmth:  'Add comfort, nostalgia, and gentle sensory detail.',
};

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let original_text: string, tone: string;
  try {
    const body = await req.json();
    original_text = body.original_text;
    tone = body.tone;
    if (!original_text || !tone) throw new Error('missing fields');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

  let text: string;
  try {
    const message = await callClaudeWithRetry(anthropic, {
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Fill a gap in someone's dream narrative using a ${tone} tone.
Original text: "${original_text}"
Rules: keep same person and setting, only expand (do not contradict), ${TONE_INSTRUCTIONS[tone] ?? ''}
Write 2–4 sentences. Return ONLY the filled text — no preamble.`,
      }],
    });
    text = message.content[0].type === 'text' ? message.content[0].text : original_text;
  } catch {
    return new Response(JSON.stringify({ error: 'Gap fill unavailable — try again in a moment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  return new Response(JSON.stringify({ text }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
