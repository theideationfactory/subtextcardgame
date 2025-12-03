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
  borderStyle?: string;        // e.g., "Classic", "Modern", "Vintage", etc.
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
  const borderStyle = card.borderStyle?.trim() || 'Classic';

  // Premium dark elite trading card layout
  const layoutSpec = `
LAYOUT SPEC (Scientific Precision + Emotional Depth Trading Card):
- BACKDROP: Clean gradient background transitioning from deep scientific blue-gray (#1e293b) to rich emotional tone. NEVER pure black or white.
- FRAME: Modern rectangular border inspired by scientific instruments and tarot card elegance. NO cathedral shapes or medieval elements.
  • Style: Implement a ${borderStyle.toLowerCase()} border design that complements the premium trading card aesthetic
  • Gradient border that reflects the card's emotional theme (warm oranges/reds for intensity, cool blues/purples for calm, etc.)
  • Subtle geometric patterns suggesting "hidden forces beneath the surface" - think circuit board traces or molecular diagrams
  • Clean lines with soft lighting and layered depth for premium feel
  • Glossy highlights and modern materials like brushed aluminum or lab-grade glass
- TITLE BAR (TOP SECTION):
  • Text: "${title}" in clean, readable scientific font with subtle glow effect
  • Background: Translucent panel with diagrammatic grid lines and interface-like UI accents
  • Typography: Crisp and elegant, balancing precision with human warmth
  • Color: Matches the emotional gradient theme of the card
- DIAGRAMMATIC ELEMENTS:
  • Subtle gridlines and measurement marks along borders (like scientific instruments)
  • Small glyphs and symbolic markers that suggest analysis and depth
  • Interface-style UI accents that feel modern and premium
  • Geometric patterns hinting at underlying psychological/emotional forces
- TOP-RIGHT CORNER INDICATOR:
  • Clean badge displaying: "${topRight || ' '}"
  • Style: Scientific precision meets tarot elegance
  • Translucent background with subtle geometric patterning
- CENTRAL ART WINDOW (DOMINANT FOCUS ~65% HEIGHT):
  • Showcase: ${art}
  • Frame: Modern rectangular border with soft lighting and depth
  • Keep artwork completely unobstructed and central
  • Enhance with emotional color gradients that complement the subject
  • Soft, layered lighting that adds dreamscape quality while maintaining clarity
  • Style: Fusion of lab instrument precision and emotional expressiveness
- ROLE INDICATOR (BOTTOM-LEFT):
  • Scientific-style label: "${bottomLeft || ' '}"
  • Design: Clean diagrammatic styling with emotional color accents
  • Typography: Precise yet warm, like a compassionate analysis tool
- DESCRIPTION FIELD (LOWER SECTION):
  • Text: "${desc}"
  • Style: Clean, readable scientific documentation with emotional warmth
  • Background: Subtle gradient with diagrammatic grid overlay
  • Typography: Balances quantification with human feeling - crisp but approachable
- TYPE CLASSIFICATION (BOTTOM CENTER):
  • Label: "${bottomCenter || ' '}"
  • Style: Scientific classification meets emotional categorization
  • Clean, precise typography with gradient color coding
AESTHETIC FUSION REQUIREMENTS:
- Inspired by Pokémon, Yu-Gi-Oh!, and Magic: The Gathering but distinctly its own identity
- Feels like a scientific tarot card - modeling hidden forces under life events
- Balances quantification (precise, analytical) with human feeling (warm, expressive)
- Cross between lab instrument interface and dreamscape visualization
- Modern, premium, and symbolic without being cold or clinical
- Emotional tone expressed through expressive color gradients and textural lighting
- Subtle patterns suggest psychological/emotional depth beneath surface events
MATERIALS & VISUAL EFFECTS:
- Gradient borders matching emotional theme (blues for calm, reds for intensity, etc.)
- Soft lighting with glossy highlights for premium feel
- Layered depth with translucent elements
- Geometric patterns suggesting hidden psychological forces
- Interface-like UI accents with scientific precision
- Modern rectangular frame with elegant proportions
FINAL OUTPUT SPECIFICATIONS:
- High-resolution trading card with clean, modern aesthetic
- Scientific precision + emotional depth fusion style
- Same proportions as trading card standard
- Central artwork enhanced but unobstructed
- Crisp, readable, elegant throughout
- Looks like a card from a system that analyzes the hidden emotional/psychological forces in life events
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
    const bucketExists = buckets?.some((b: any) => b.name === BUCKET_NAME);
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