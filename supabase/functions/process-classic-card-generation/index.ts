// Premium Elite trading card processing function - SOPHISTICATED DARK PREMIUM LAYOUT  
// Elite dark design with premium typography, signature accent colors, refined textures, distinctive identity.
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

  // Premium dark elite trading card layout
  const layoutSpec = `
LAYOUT SPEC (premium dark elite trading card design):
- BACKDROP: MANDATORY deep black (#000000) background with subtle dark gray gradient. NEVER use white or light colors for the background.
- FRAME: Sophisticated rounded rectangular border with faint outer rim light and micro-texture (brushed metal, carbon fiber, or soft holographic sheen) for elevated visual hierarchy. Dark gray (#2a2a2a) to black (#000000) gradient with premium finish.
- TITLE BAR (TOP FULL-WIDTH):
  • Text: "${title}" in premium display font (sleek serif, techno-lux, or minimalist geometric), centered, single line only.
  • Typography: Distinctive, intentional, elite-level font treatment with subtle metallic or neon-edge glow.
  • Background: Dark gray panel (#2a2a2a to #1a1a1a gradient) with refined edges and premium styling.
  • Text Effect: Subtle glow or metallic finish to read as intentional and elite, not neutral.
  • IMPORTANT: Ensure full title text is completely visible and readable with premium contrast.
- SIGNATURE ACCENT COLOR:
  • Each card features one unique signature accent color as a thin line or micro-glow for identity and pizzazz.
  • Color should be vibrant but restrained (electric blue, neon purple, gold, cyan, or emerald).
  • Applied as subtle accent line along frame edge or micro-glow on key elements.
  • Maintains modern, restrained overall style while adding distinctive character.
- TOP-RIGHT CORNER TAG:
  • Refined rounded rectangle badge positioned in TOP RIGHT CORNER, carefully placed to NOT overlap title text.
  • Text: "${topRight || ' '}" in premium uppercase lettering with sophisticated typography.
  • Style: Dark background with signature accent color highlight - elite and distinctive.
  • Position in empty space to the right of title, preserving full title visibility.
- CENTRAL ART WINDOW (UPPER ~60% HEIGHT - DOMINATES):
  • Clear, well-lit illustration: ${art}.
  • Framing: Premium rectangular border with subtle premium frame treatment and refined depth.
  • Palette: Vibrant colors that pop against the sophisticated dark frame and background.
  • Style: Well-lit central subject with premium dark framing - emphasizes content with elegance.
  • Lighting: Excellent contrast lighting that showcases the subject clearly against sophisticated surroundings.
- ROLE ACCENT PANEL (BOTTOM-LEFT):
  • Premium rectangular badge with refined corners: "${bottomLeft || ' '}".
  • Style: Dark background with signature accent color trim and premium text treatment.
  • Typography: Distinctive, premium lettering that's instantly readable and sophisticated.
  • Integration: Harmonizes with overall elite aesthetic while maintaining clear hierarchy.
- DESCRIPTION FIELD (LOWER THIRD):
  • Premium dark field (#2a2a2a) with sophisticated text area for card information.
  • Body text: "${desc}" in refined typography with proper line spacing and premium feel.
  • Text Color: High-contrast white with subtle premium glow for excellent readability.
  • Design: Sophisticated rectangular field with premium border and balanced spacing.
  • Typography: Left-aligned, premium margins, refined grid system - optimized for elite readability.
- BOTTOM TYPE INTEGRATION:
  • Text: "${bottomCenter || ' '}" displayed in premium typography with signature accent color at bottom center.
  • Style: Sophisticated text treatment integrated into the premium bottom border area.
  • Typography: Elite lettering with precise alignment and premium spacing.
PREMIUM DARK ELITE AESTHETIC:
- Sophisticated, contemporary dark design focused on premium quality and distinctive identity.
- Subtle premium textures (brushed metal, carbon fiber, holographic) and refined glows for elevated depth.
- Balanced composition with clear hierarchy and premium dark theme readability.
- Signature accent color system: each card gets one distinctive accent for identity while maintaining restraint.
- Everything aligns with premium dark UI principles and elite presentation standards.
- DO: Premium fonts, signature accent colors, refined textures, sophisticated glows, elite spacing, distinctive identity.
- DO NOT: Plain sans-serif fonts, neutral appearance, overly flashy effects, gaudy colors, amateur styling.
- CRITICAL: All text elements perfectly readable with premium contrast and distinctive, intentional styling.
MATERIALS & FINISH:
- Borders: Premium rounded rectangles with sophisticated textures and refined outer rim lights.
- Text: Elite display fonts with metallic/neon glow effects and excellent readability.
- Accents: Signature color system with premium backgrounds and sophisticated contrast.
- Overall: Premium, elite dark card design with distinctive identity and sophisticated modern restraint.
OUTPUT:
- Single premium dark elite trading card, front face only, sophisticated design with signature accent color and distinctive identity.
  `.trim();

  // Optional stylistic hinting
  const extraFlavor = theme ? `ADDITIONAL ART DIRECTION: ${theme}` : '';

  return [
    'PROFESSIONAL TRADING CARD (front face) - MUST HAVE DARK BLACK BACKGROUND.',
    'CRITICAL: The entire card background MUST be dark black or very dark gray - NO WHITE BACKGROUNDS.',
    'IMPORTANT: All card elements (borders, panels, backgrounds) must use dark colors only.',
    layoutSpec,
    extraFlavor,
    'FINAL REMINDER: Generate a card with DARK BLACK background - absolutely no white or light backgrounds anywhere on the card.'
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
    console.log('🎯 Premium dark elite card prompt for:', cardData.name);

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