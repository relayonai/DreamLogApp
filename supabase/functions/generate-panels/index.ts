import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STYLE_PROMPTS: Record<string, string> = {
  classic: 'bold comic book outlines, halftone dots, dramatic shadows, vibrant colours, vintage superhero style',
  graphic_novel: 'painterly graphic novel style, cinematic composition, moody lighting, detailed backgrounds',
  manga: 'black and white manga style, high contrast, expressive faces, dynamic panel energy, hatching',
  surreal: 'surrealist dreamlike painting, soft edges, unusual colour palette, floating elements, painterly',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let dream_id: string, scene_ids: unknown[];
  try {
    const body = await req.json();
    dream_id = body.dream_id;
    scene_ids = body.scene_ids ?? [];
    if (!dream_id) throw new Error('missing dream_id');
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: dream } = await supabase.from('dreams').select('comic_style, user_id').eq('id', dream_id).single();
  const style = dream?.comic_style ?? 'classic';
  const stylePrompt = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.classic;

  const { data: scenes } = await supabase.from('scenes').select('id, text_content').in('id', scene_ids);

  let successCount = 0;

  for (const scene of scenes ?? []) {
    try {
      const dalleData = await (await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: `${stylePrompt}. Dream scene: ${scene.text_content.slice(0, 300)}`,
          n: 1, size: '1024x1024', response_format: 'url',
        }),
      })).json();

      const imageUrl = dalleData.data?.[0]?.url;
      if (!imageUrl) continue; // Spec: leave image_url null → UI shows placeholder panel

      const imgBuffer = await (await fetch(imageUrl)).arrayBuffer();
      const remotePath = `${dream?.user_id}/${dream_id}/${scene.id}.png`;
      await supabase.storage.from('images').upload(remotePath, imgBuffer, { contentType: 'image/png', upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(remotePath);
      await supabase.from('scenes').update({ image_url: publicUrl }).eq('id', scene.id);
      successCount++;
    } catch {
      // Spec: partial failure → continue, rest of comic renders normally
    }
  }

  const finalStatus = successCount > 0 || (scenes ?? []).length === 0 ? 'ready' : 'failed';
  await supabase.from('dreams').update({ status: finalStatus }).eq('id', dream_id);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
