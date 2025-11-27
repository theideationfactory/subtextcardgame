// Classic trading card processing function - PREMIUM FANTASY LAYOUT
// Title top, top-right diamond context, central art, bottom-left role badge, parchment description box.
//
// @ts-ignore: Deno-specific import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?deno-std=0.177.0';
// @ts-ignore: Deno-specific import
import OpenAI from 'npm:openai@4.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET_NAME = 'card_images';

type CardData = {
  name: string;                // e.g., "Silver Tongue"
  description: string;         // e.g., "Cunning linguistic attacks..."
  imageDescription?: string;   // optional vivid art brief
  type?: string;               // e.g., "Intimacy"  -> top-right diamond
  role?: string;               // e.g., "Protector" -> bottom-left badge
  context?: string;            // optional extra tag (unused in layout, but can flavor)
  size?: '1024x1536' | '1024x1024' | '2048x1536' | string;
  quality?: 'auto' | 'high';
  themeHint?: string;          // optional: extra art direction
};

function buildPremiumPrompt(card: CardData) {
  const title = card.name?.trim() || 'Untitled';
  const topRight = (card.context ?? '').trim();   // context label in diamond (e.g., "Friendship")
  const bottomLeft = (card.role ?? '').trim();    // role badge (e.g., "Protector")
  const bottomCenter = (card.type ?? '').trim();  // type label at bottom center
  const desc = card.description?.trim() || '';
  const art = (card.imageDescription || card.description || 'fantasy creature').trim();
  const theme = card.themeHint?.trim();

  // Cathedral window inspired premium trading card layout
  const layoutSpec = `
LAYOUT SPEC (cathedral window inspired premium fantasy trading card):
- BACKDROP: Deep atmospheric background that breathes - dark charcoal to black gradient that makes the card feel forged rather than printed.
- FRAME: THICK BEVELED BORDERS in brushed metallic tone (brass/bronze/steel) with substantial heft and weight. Gently rounded corners that feel collectible, not cursed. Sharp enough to feel dangerous but refined enough to be premium.
- TITLE BAR (TOP FULL-WIDTH):
  • Text: "${title}" in elegant serif font with perfect spacing, centered, single line only.
  • Background: Ornate metallic panel that echoes the border craftsmanship with subtle carved details.
  • Typography: Disciplined grid system with symmetrical margins and confident spacing.
  • IMPORTANT: Ensure full title text is completely visible and readable with high contrast.
- TOP-RIGHT DIAMOND TAG:
  • Rune-like diamond badge positioned in TOP RIGHT CORNER, carefully placed to NOT overlap title text.
  • Text: "${topRight || ' '}" in carved uppercase lettering that hints at ancient secrets.
  • Style: Metallic accent panel that feels screwed onto a vault door - manufactured mysticism.
  • Position in empty space to the right of title, preserving full title visibility.
- CENTRAL ART WINDOW (UPPER ~60% HEIGHT - DOMINATES):
  • Atmospheric illustration: ${art}.
  • Framing: Faux-ancient metallic lines that hint at runes, vaults, and locked secrets.
  • Palette: Deep blues and warm brass, pushing the subject forward like a stage actor in spotlight.
  • Style: Atmospheric rather than busy - space around the subject breathes with ominous presence.
  • Lighting: Single dramatic spotlight effect with rich shadows and depth.
- ROLE ACCENT PANEL (BOTTOM-LEFT):
  • Small metallic plate that looks screwed onto vault door: "${bottomLeft || ' '}".
  • Style: Visually pegged metal accent that adds hierarchy without hogging attention.
  • Typography: Clean, disciplined lettering that signals role/class with manufactured mysticism.
  • Integration: Ties to overall forged aesthetic while maintaining visual balance.
- DESCRIPTION FIELD (LOWER THIRD):
  • Calm parchment field where card mechanics live - provides visual exhale after dramatic art.
  • Body text: "${desc}" in clean, well-spaced typography.
  • Design: Subtle corner notches and carved inner lines echo ornate top without clutter.
  • Typography: Centered, symmetrical margins, disciplined grid system - nothing bleeds where it shouldn't.
- BOTTOM TYPE INTEGRATION:
  • Text: "${bottomCenter || ' '}" integrated into the bottom border's metallic framework.
  • Style: Carved into the border itself as part of the cathedral window architecture.
  • Typography: Confident lettering that knows its grid system and maintains perfect alignment.
MANUFACTURED MYSTICISM AESTHETIC:
- Premium fantasy vibes with discipline - born in forgotten catacombs, designed with precision.
- Thick, substantial borders that feel forged and collectible.
- Cathedral window composition with dramatic art dominating, calm rule-space below.
- Deep blues and warm brass palette with atmospheric lighting.
- Everything aligns cleanly with symmetrical margins and disciplined typography.
- DO: Beveled metallic borders, atmospheric depth, carved details, rune-like accents, parchment textures.
- DO NOT: Flat colors, cartoon styling, busy compositions, poor typography hierarchy.
- CRITICAL: All text elements perfectly aligned and readable - manufactured precision meets mystical atmosphere.
MATERIALS & FINISH:
- Borders: Thick beveled metallic (brass/bronze/steel) with brushed finish and substantial weight.
- Text: High contrast elegant typography with perfect spacing and grid discipline.
- Accents: Carved metallic details that feel screwed-on rather than printed.
- Overall: Premium collectible that whispers ancient secrets while maintaining typographic confidence.
OUTPUT:
- Single cathedral window inspired trading card, front face only, premium fantasy with manufactured mysticism and disciplined design.
  `.trim();

  // Optional stylistic hinting
  const extraFlavor = theme ? `ADDITIONAL ART DIRECTION: ${theme}` : '';

  return [
    'PROFESSIONAL TRADING CARD (front face).',
    layoutSpec,
    extraFlavor
  ].filter(Boolean).join('\n\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OpenAI API key is not configured');

    const openai = new OpenAI({ apiKey });

    const { jobId } = await req.json();
    if (!jobId) throw new Error('No job ID provided');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('image_generation_queue').update({ status: 'processing' }).eq('id', jobId);

    const { data: job, error: fetchError } =
      await supabase.from('image_generation_queue').select('*').eq('id', jobId).single();
    if (fetchError) throw fetchError;

    const cardData: CardData = job.card_data ?? {};
    const size = cardData.size || '1024x1536';
    const quality = cardData.quality || 'auto';

    // Map your existing fields to the premium layout:
    // cardData.type     -> top-right diamond (e.g., "Intimacy")
    // cardData.role     -> bottom-left badge (e.g., "Protector")
    // name/description/imageDescription behave as before
    const prompt = buildPremiumPrompt(cardData);
    console.log('🎯 Premium card prompt for:', cardData.name);

    // Generate with OpenAI
    console.log('🎨 Calling OpenAI image generation…');
    const abortSignal = AbortSignal.timeout(180_000);

    let imgResp;
    try {
      imgResp = await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size,
        quality,
        user: job.user_id, // keeps your per-user tracing
      }, { signal: abortSignal });
      console.log('✅ OpenAI response received');
    } catch (err: any) {
      console.error('❌ OpenAI API error:', err?.message || err);
      if (err?.status === 403) {
        throw new Error('OpenAI access denied. Please verify your OpenAI API key and organization settings.');
      }
      throw new Error(`OpenAI request failed: ${err?.message || String(err)}`);
    }

    const b64 = imgResp?.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image data in OpenAI response');

    // Convert and upload
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const imageBlob = new Blob([bytes], { type: 'image/png' });

    const safeName = (cardData.name || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const fileName = `${job.user_id}/${Date.now()}-premium-${safeName}.png`;

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        fileSizeLimit: 8 * 1024 * 1024, // 8MB
      });
    }

    // Ensure user folder path exists (cheap no-op upload)
    await supabase.storage.from(BUCKET_NAME).upload(`${job.user_id}/.keep`, new Blob(['']), { upsert: true });

    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, imageBlob, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: true,
    });
    if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    if (!publicUrl) throw new Error('Failed to get public URL for uploaded image');

    await supabase.from('image_generation_queue').update({
      status: 'completed',
      image_url: publicUrl,
    }).eq('id', jobId);

    console.log(`✅ Premium card job ${jobId} completed:`, publicUrl);

    return new Response(JSON.stringify({ success: true, imageUrl: publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error processing premium card job:', errorMessage);

    // Best-effort mark failed
    try {
      const { jobId } = await req.json();
      if (jobId) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseAdmin.from('image_generation_queue').update({
          status: 'failed',
          error_message: errorMessage,
        }).eq('id', jobId);
        console.log('❌ Job marked as failed:', jobId);
      }
    } catch (_) { /* swallow */ }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});