import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resvg, initWasm } from 'https://esm.sh/@resvg/resvg-wasm@2.4.1';
import resvgWasm from 'https://esm.sh/@resvg/resvg-wasm@2.4.1/resvgjs_bg.wasm?module';
import { fetchWithRetry } from '../_shared/retry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PANEL_W = 1024, CAPTION_H = 160, PANEL_H = PANEL_W + CAPTION_H, PAD = 16, FONT = 22;
const BG: Record<string, string> = { classic: '#ffffff', graphic_novel: '#111111', manga: '#ffffff', surreal: '#1a0a2e' };
const FG: Record<string, string> = { classic: '#000000', graphic_novel: '#eeeeee', manga: '#000000', surreal: '#e0d0ff' };
const BORDER_STYLES = new Set(['classic', 'manga']);

let wasmInitialized = false;

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (test.length > maxChars) { if (line) lines.push(line); line = word; } else { line = test; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSvg(scenes: Array<{ image_url: string | null; text_content: string | null; gap_filled: boolean | null; order_index: number }>, style: string): string {
  const bg = BG[style] ?? '#fff';
  const fg = FG[style] ?? '#000';
  const totalH = scenes.length * (PANEL_H + PAD) + PAD;
  const hasBorder = BORDER_STYLES.has(style);

  const panelSvgs = scenes.map((scene, i) => {
    const y = i * (PANEL_H + PAD) + PAD;
    const capY = y + PANEL_W;
    const text = scene.text_content ?? '';
    // ~13px avg char width × 65 ≈ 845px, within the 992px (PANEL_W - 2×PAD) line budget
    const lines = wrapText(text, 65);

    const imageEl = scene.image_url
      ? `<image href="${escapeXml(scene.image_url)}" x="0" y="${y}" width="${PANEL_W}" height="${PANEL_W}" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect x="0" y="${y}" width="${PANEL_W}" height="${PANEL_W}" fill="#2a2a3e"/>
         <text x="${PANEL_W / 2}" y="${y + PANEL_W / 2 + 16}" font-size="48" text-anchor="middle" fill="${fg}" font-family="sans-serif">✦</text>`;

    const aiTag = scene.gap_filled
      ? `<text x="${PAD}" y="${capY + PAD + FONT - 6}" font-size="${FONT - 6}" font-weight="bold" fill="#6c63ff" font-family="sans-serif">✦ AI enhanced</text>`
      : '';
    const textOffsetY = scene.gap_filled ? FONT : 0;

    const textLines = lines.map((l, li) =>
      `<text x="${PAD}" y="${capY + PAD + FONT + textOffsetY + li * (FONT + 6)}" font-size="${FONT}" fill="${escapeXml(fg)}" font-family="sans-serif">${escapeXml(l)}</text>`
    ).join('\n');

    const border = hasBorder
      ? `<rect x="0" y="${y}" width="${PANEL_W}" height="${PANEL_H}" fill="none" stroke="#000" stroke-width="3"/>`
      : '';

    return `
      ${imageEl}
      <rect x="0" y="${capY}" width="${PANEL_W}" height="${CAPTION_H}" fill="${escapeXml(bg)}"/>
      ${aiTag}
      ${textLines}
      ${border}
    `;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${PANEL_W}" height="${totalH}">
    <rect width="${PANEL_W}" height="${totalH}" fill="${escapeXml(bg)}"/>
    ${panelSvgs}
  </svg>`;
}

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

  // Verify caller owns the dream before generating (service role bypasses RLS)
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  const { data: dream } = await supabase.from('dreams').select('comic_style, user_id, export_url').eq('id', dream_id).single();
  if (!dream) return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

  if (dream.user_id !== user.id) return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
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

  // wasmInitialized guards the per_worker local dev policy; in production each isolate
  // is cold-started, so this is effectively always false — harmless but not a warm-module win.
  if (!wasmInitialized) {
    await initWasm(resvgWasm);
    wasmInitialized = true;
  }

  let pngBuffer: Uint8Array;
  try {
    const svg = buildSvg(scenes, dream.comic_style ?? 'classic');
    const resvg = new Resvg(svg, { font: { loadSystemFonts: false } });

    // resvg-wasm is synchronous and makes no network requests — pre-fetch panel images
    const hrefs = resvg.imagesToResolve();
    await Promise.all(hrefs.map(async (href) => {
      try {
        const res = await fetchWithRetry(href, { method: 'GET' }, { maxRetries: 2, baseDelayMs: 500 });
        resvg.resolveImage(href, new Uint8Array(await res.arrayBuffer()));
      } catch { /* leave panel blank — same fallback as original canvas approach */ }
    }));

    pngBuffer = resvg.render().asPng();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Render failed', detail: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

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
