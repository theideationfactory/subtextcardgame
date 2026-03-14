// Premium Elite trading card processing function - DARK FANTASY PARCHMENT LAYOUT
// Inspired by modern TCGs with parchment frame + dark cinematic fantasy art.

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
  type?: string;               // e.g., "INTIMACY" -> top-right diamond (uppercase)
  role?: string;               // e.g., "PROTECTOR" -> bottom-left ribbon (uppercase)
  context?: string;            // e.g., "Intention" -> tiny bottom label (title case)
  borderStyle?: string;        // kept for compatibility
  borderColor?: string;        // e.g., "#5A3AA0" for diamond jewel-tone fill
  size?: '1024x1536' | '1024x1024' | '2048x1536' | string;
  quality?: 'auto' | 'high';
  themeHint?: string;          // optional: extra art direction
  // Fields for automatic card creation
  visibility?: string[];
  backgroundGradient?: string;
  format?: string;
  customGenerationTypeId?: string | null;
  isPublic?: boolean;
  isSharedWithFriends?: boolean;
  shadowForCardId?: string | null;
  generationType?: string;
};

function buildModernParchmentPrompt(card: CardData) {
  const title = card.name?.trim() || 'Untitled';
  
  // Correct field mapping matching Silver Tongue reference card
  const domainLabel = (card.type ?? '').trim().toUpperCase();      // top-right diamond: "INTIMACY"
  const subtypeLabel = (card.role ?? '').trim().toUpperCase();     // bottom-left ribbon: "PROTECTOR"
  const bottomLabel = (card.context ?? '').trim();                 // tiny bottom center: "Intention"
  
  const desc = card.description?.trim() || '';
  const art = (card.imageDescription || card.description || 'dark fantasy creature').trim();
  const theme = card.themeHint?.trim();
  const borderColor = card.borderColor?.trim() || '#5A3AA0'; // Default deep purple jewel tone

  const layoutSpec = `
PREMIUM DARK FANTASY TRADING CARD - SILVER TONGUE STYLE:

OVERALL CARD STRUCTURE:
• Portrait orientation trading card (1024x1536)
• Rounded corners with clean edges
• Warm parchment-colored outer frame (#D4C5B9 to #E8D8B7)
• Thin dark inner outline tracing inside the card edge
• NO distressed texture, aging, tears, or heavy weathering
• Smooth flat parchment color throughout UI elements

TITLE BAR (TOP SECTION):
• Dark charcoal/black horizontal band spanning full card width
• Large serif title "${title}" in light/white text
• Title positioned left-of-center or centered
• High contrast between dark bar and light title text
• Clean, premium typography with good letter spacing

DOMAIN DIAMOND BADGE (TOP-RIGHT):
• Diamond shape (square rotated 45°) overlapping top-right corner of title bar and inner frame
• Jewel-tone fill color: ${borderColor}
• Thin inner border around diamond edge
• Small-caps uppercase serif text: "${domainLabel || 'DOMAIN'}"
• Text centered in diamond, high contrast against fill color
• Badge should feel like a premium game icon

MAIN ART WINDOW (CENTER):
• Large rectangular illustration area (~60-70% of card height)
• Thin parchment-colored inner border framing the art
• NO text or UI elements inside the artwork itself
• Art subject: ${art}
• Style: Cinematic dark fantasy with photorealistic rendering
• Volumetric lighting with dramatic shadows and fog
• Heavy physical environment (stone, metal, gears, chains, carved symbols)
• Subject should be iconic, centered, with strong presence
• Deep contrast between glowing magical elements and dark surroundings
• Rich color grading (dark teals, bronzes, deep blues, warm golds)

SUBTYPE RIBBON (OVERLAPPING LOWER-LEFT OF ART):
• Small horizontal parchment banner overlapping the bottom-left edge of art frame
• Angled notch on right end of ribbon
• Subtle drop shadow for depth
• Small-caps uppercase serif text: "${subtypeLabel || 'SUBTYPE'}"
• Clean flat parchment color matching card frame
• Text in dark ink with good contrast

DESCRIPTION BOX (BOTTOM PANEL):
• Large rectangular panel below art window
• Clean parchment background matching frame color
• Subtle inset border creating shallow dimensional effect
• Book serif body text in dark ink:
  "${desc}"
• Good letter spacing and line height for readability
• Natural line breaks, not cramped
• Left-aligned or centered paragraph text

BOTTOM LABEL (VERY BOTTOM CENTER):
• Tiny centered serif text at extreme bottom of card: "${bottomLabel || ''}"
• Very understated and small
• Title case formatting
• Acts as subtle category tag

TYPOGRAPHY RULES:
• All UI text uses serif fonts
• Diamond and ribbon: UPPERCASE/SMALL-CAPS
• Description: Readable book serif
• NO ornate swashes or decorative flourishes
• Crisp, print-ready, professional quality
• Good contrast and legibility throughout

STRICT CONSTRAINTS:
• NO text or UI overlays inside the main art window
• NO distressed aging, stains, or torn paper effects
• NO sci-fi HUD elements or digital interfaces
• NO watermarks, logos, or branding
• NO neon cyberpunk aesthetics
• Clean, premium fantasy trading card only

FINAL OUTPUT REQUIREMENTS:
• Complete trading card front face with all elements integrated
• High-resolution (1024x1536) with sharp details
• Professional printing quality
• Matches the layout and style of the Silver Tongue reference card exactly
• All text must be legible and properly positioned
• Dark atmospheric art contrasting with light parchment UI
`.trim();

  const extraFlavor = theme ? `\n\nADDITIONAL ART DIRECTION: ${theme}` : '';

  return [
    'PREMIUM DARK FANTASY TRADING CARD (front face) - Silver Tongue layout style.',
    'Create a complete high-resolution fantasy trading card matching the exact layout specifications below:',
    layoutSpec,
    extraFlavor,
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

    // Map fields:
    // cardData.type     -> top-right diamond domain (e.g., "INTIMACY")
    // cardData.role     -> bottom-left subtype ribbon (e.g., "PROTECTOR")
    // cardData.context  -> small bottom label (e.g., "Intention")
    const prompt = buildModernParchmentPrompt(cardData);
    console.log('🎯 Premium dark fantasy card prompt for:', cardData.name);

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

    // Create the card in the database
    console.log('📝 Creating card in database...');
    
    let collectionId;
    const { data: existingCollections, error: collectionError } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', job.user_id)
      .limit(1);
    
    if (collectionError) throw collectionError;
    
    if (existingCollections && existingCollections.length > 0) {
      collectionId = existingCollections[0].id;
    } else {
      const { data: newCollection, error: createCollectionError } = await supabase
        .from('collections')
        .insert({
          name: 'My Collection',
          user_id: job.user_id,
          visibility: cardData.visibility || ['personal']
        })
        .select('id')
        .single();
      
      if (createCollectionError) throw createCollectionError;
      collectionId = newCollection.id;
    }
    
    let backgroundGradient = null;
    if (cardData.backgroundGradient) {
      try {
        const parsed = JSON.parse(cardData.backgroundGradient);
        if (JSON.stringify(parsed) !== JSON.stringify(['#1a1a1a', '#000000'])) {
          backgroundGradient = cardData.backgroundGradient;
        }
      } catch (e) {}
    }
    
    const newCardData = {
      name: cardData.name || 'Untitled Card',
      description: cardData.description || '',
      image_description: cardData.imageDescription || '',
      type: cardData.type || 'Card',
      phenomena: cardData.type || null,
      role: cardData.role || 'General',
      context: cardData.context || 'Fantasy',
      border_style: cardData.borderStyle || 'Classic',
      border_color: cardData.borderColor || '#808080',
      image_url: publicUrl,
      format: cardData.format || 'framed',
      frame_color: '#808080',
      is_premium_generation: true,
      custom_generation_type_id: cardData.customGenerationTypeId || null,
      is_uploaded_image: false,
      generation_type: cardData.generationType || 'modern_parchment',
      background_gradient: backgroundGradient,
      user_id: job.user_id,
      collection_id: collectionId,
      is_public: cardData.isPublic || false,
      is_shared_with_friends: cardData.isSharedWithFriends || false
    };
    
    const { data: newCard, error: insertError } = await supabase
      .from('cards')
      .insert(newCardData)
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    console.log('✅ Card created successfully:', newCard.id);
    
    if (cardData.shadowForCardId) {
      await supabase
        .from('cards')
        .update({ shadow_card_id: newCard.id })
        .eq('id', cardData.shadowForCardId)
        .eq('user_id', job.user_id);
    }

    await supabase.from('image_generation_queue').update({
      status: 'completed',
      image_url: publicUrl,
      card_id: newCard.id,
    }).eq('id', jobId);

    console.log(`✅ Premium card job ${jobId} completed with card:`, newCard.id);

    return new Response(JSON.stringify({ success: true, imageUrl: publicUrl, cardId: newCard.id }), {
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