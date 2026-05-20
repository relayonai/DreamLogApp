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
    const message = await anthropic.messages.create({
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
    return new Response(JSON.stringify({ error: 'AI generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  return new Response(JSON.stringify({ text }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
