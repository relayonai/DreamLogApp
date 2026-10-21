import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchWithRetry } from '../_shared/retry.ts';

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

  await supabase.from('dreams').update({ pipeline_step: 'generating' }).eq('id', dream_id);

  const { data: dream } = await supabase.from('dreams').select('comic_style, user_id').eq('id', dream_id).single();
  const style = dream?.comic_style ?? 'classic';
  const stylePrompt = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.classic;

  const { data: scenes } = await supabase.from('scenes').select('id, text_content').in('id', scene_ids);

  let successCount = 0;

  for (const scene of scenes ?? []) {
    try {
      const dalleResp = await fetchWithRetry('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: `${stylePrompt}. Dream scene: ${scene.text_content.slice(0, 300)}`,
          n: 1, size: '1024x1024', response_format: 'url',
        }),
      });
      const dalleData = await dalleResp.json();

      if (dalleData.error) {
        if (dalleData.error.code === 'content_policy_violation') {
          console.warn(`Panel skipped (content policy) for scene ${scene.id}`);
          continue;
        }
        console.error(`DALL-E error for scene ${scene.id}:`, dalleData.error);
        continue;
      }

      const tempImageUrl = dalleData.data?.[0]?.url;
      if (!tempImageUrl) continue;

      const imgResp = await fetchWithRetry(tempImageUrl, { method: 'GET' });
      const imgBuffer = await imgResp.arrayBuffer();

      const remotePath = `${dream?.user_id}/${dream_id}/${scene.id}.png`;
      await supabase.storage.from('image').upload(remotePath, imgBuffer, { contentType: 'image/png', upsert: true });

      const { data: signedUrlData } = await supabase.storage.from('image').createSignedUrl(remotePath, 60 * 60 * 24 * 365);
      if (signedUrlData?.signedUrl) {
        await supabase.from('scenes').update({ image_url: signedUrlData.signedUrl }).eq('id', scene.id);
      }
      successCount++;
    } catch (err) {
      console.error('Panel generation failed for scene', scene.id, err);
    }
  }

  const finalStatus = successCount > 0 || (scenes ?? []).length === 0 ? 'ready' : 'failed';
  const update: Record<string, unknown> = {
    status: finalStatus,
    pipeline_step: finalStatus === 'ready' ? 'done' : 'failed',
  };
  if (finalStatus === 'failed') {
    update.failed_reason = 'Image generation failed for all scenes — try a different comic style';
  }
  await supabase.from('dreams').update(update).eq('id', dream_id);

  return new Response(JSON.stringify({ ok: true, successCount }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
});
