import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCanvas, loadImage } from 'https://esm.sh/@napi-rs/canvas@0.1.44';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PANEL_W = 1024, CAPTION_H = 160, PANEL_H = PANEL_W + CAPTION_H, PAD = 16, FONT = 22;
const BG: Record<string, string> = { classic: '#ffffff', graphic_novel: '#111111', manga: '#ffffff', surreal: '#1a0a2e' };
const FG: Record<string, string> = { classic: '#000000', graphic_novel: '#eeeeee', manga: '#000000', surreal: '#e0d0ff' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

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

  const { data: dream } = await supabase.from('dreams').select('comic_style, user_id, export_url').eq('id', dream_id).single();
  if (!dream) return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  // Spec: pre-rendered and cached — return instantly if already generated
  if (dream.export_url) return new Response(JSON.stringify({ export_url: dream.export_url }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  const { data: scenes } = await supabase.from('scenes').select('image_url, text_content, gap_filled, order_index').eq('dream_id', dream_id).order('order_index');
  if (!scenes?.length) return new Response(JSON.stringify({ error: 'No scenes' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  const style = dream.comic_style ?? 'classic';
  const canvas = createCanvas(PANEL_W, scenes.length * (PANEL_H + PAD) + PAD);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG[style] ?? '#fff';
  ctx.fillRect(0, 0, PANEL_W, canvas.height);

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const y = i * (PANEL_H + PAD) + PAD;

    if (scene.image_url) {
      try { ctx.drawImage(await loadImage(scene.image_url), 0, y, PANEL_W, PANEL_W); }
      catch {
        ctx.fillStyle = '#2a2a3e'; ctx.fillRect(0, y, PANEL_W, PANEL_W);
        ctx.fillStyle = FG[style] ?? '#000'; ctx.font = '48px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('✦', PANEL_W / 2, y + PANEL_W / 2 + 16);
      }
    } else {
      ctx.fillStyle = '#2a2a3e'; ctx.fillRect(0, y, PANEL_W, PANEL_W);
    }

    const capY = y + PANEL_W;
    ctx.fillStyle = BG[style] ?? '#fff'; ctx.fillRect(0, capY, PANEL_W, CAPTION_H);
    let textY = capY + PAD + FONT;

    if (scene.gap_filled) {
      ctx.fillStyle = '#6c63ff'; ctx.font = `bold ${FONT - 6}px sans-serif`; ctx.textAlign = 'left';
      ctx.fillText('✦ AI enhanced', PAD, capY + PAD + FONT - 6);
      textY += FONT;
    }

    ctx.fillStyle = FG[style] ?? '#000'; ctx.font = `${FONT}px sans-serif`; ctx.textAlign = 'left';
    const words = scene.text_content.split(' ');
    const lines: string[] = []; let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > PANEL_W - PAD * 2) { if (line) lines.push(line); line = word; } else { line = test; }
    }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((l, li) => ctx.fillText(l, PAD, textY + li * (FONT + 6)));

    if (style === 'classic' || style === 'manga') {
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeRect(0, y, PANEL_W, PANEL_H);
    }
  }

  const pngBuffer = canvas.toBuffer('image/png');
  const remotePath = `${dream.user_id}/${dream_id}/export.png`;
  const { error: uploadError } = await supabase.storage.from('exports').upload(remotePath, pngBuffer, { contentType: 'image/png', upsert: true });
  if (uploadError) return new Response(JSON.stringify({ error: 'Upload failed' }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  const { data: { publicUrl } } = supabase.storage.from('exports').getPublicUrl(remotePath);
  await supabase.from('dreams').update({ export_url: publicUrl }).eq('id', dream_id);
  return new Response(JSON.stringify({ export_url: publicUrl }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
