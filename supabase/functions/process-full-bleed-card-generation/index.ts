// Full Bleed Card processing function - COMPLETE TRADING CARD WITH INTEGRATED TEXT
// Full bleed cards with no description text, complete trading card layout with integrated text elements.
// @ts-ignore: Deno-specific import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?deno-std=0.177.0'
// @ts-ignore: Deno-specific import
import OpenAI from 'npm:openai@4.24.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const BUCKET_NAME = 'card_images';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const openai = new OpenAI({ apiKey });
    const requestData = await req.json();
    const { jobId } = requestData;
    if (!jobId) throw new Error('No job ID provided');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update job status to 'processing'
    await supabaseClient
      .from('image_generation_queue')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // Fetch job details
    const { data: job, error: fetchError } = await supabaseClient
      .from('image_generation_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;

    const cardData = job.card_data;
    const { name, description, imageDescription, type, role, context, borderStyle, borderColor, size = '1024x1536', quality = 'auto' } = cardData;

    // Use imageDescription for artwork, fallback to description if not provided
    const artworkDescription = imageDescription || description || 'fantasy artwork';

    // Build enhanced prompt (same logic as original generate-enhanced-card)
    const topLabels = [];
    if (type) topLabels.push(type);
    if (role) topLabels.push(role);
    
    const bottomLabels = [];
    if (context) bottomLabels.push(context);

    const premiumPrompt = [
      `Create a complete trading card with integrated text elements and premium typography.`,
      `Artwork subject: ${artworkDescription}`,
      `Include the title "${name}" prominently displayed in premium display font with subtle metallic or refined glow effect.`,
      borderStyle ? `Border Style: Implement a ${borderStyle.toLowerCase()} border design that complements the premium trading card aesthetic.` : '',
      borderColor ? `Border Color: Use ${borderColor} as the primary border color, incorporating it elegantly into the card's border and frame design.` : '',
      
      // Professional badge specifications
      topLabels.length > 0 ? 
        `Create exactly ${topLabels.length} professional integrated badge${topLabels.length > 1 ? 's' : ''} in the top area for: ${topLabels.join(', ')}. Style as sophisticated rounded rectangular badges with:
         - Dark semi-transparent backgrounds with subtle gradient
         - Clean modern typography in contrasting light text
         - Subtle drop shadows and refined border treatments
         - Positioned in top corners (one per label provided)
         - Do not create any additional empty badges
         - Each badge should feel like a premium UI element, not just text overlay` : '',
      
      bottomLabels.length > 0 ? 
        `Create exactly 1 professional integrated badge in the bottom area for: ${bottomLabels.join(', ')}. Style as sophisticated rounded rectangular badge with:
         - Dark semi-transparent background with subtle gradient
         - Clean modern typography in contrasting light text
         - Subtle drop shadow and refined border treatment  
         - Positioned in bottom corner
         - Do not create any additional empty badges
         - Should feel like a premium UI element integrated into the card design` : '',
      
      // Overall elite styling
      'Visual Style: Elite professional trading card with premium dark theme integration.',
      'Typography: Modern professional fonts with subtle premium effects (metallic shine, refined glow, sophisticated contrast).',
      'Badge Integration: All text badges should look like premium UI elements - professional, balanced, and naturally integrated into the card layout.',
      'Layout: Portrait orientation with sophisticated dark theme, premium borders, and refined depth.',
      'Quality: Ultra-premium print-ready artwork suitable for elite collectible cards with professional badge system.',
      'Color Palette: Rich, sophisticated colors that work harmoniously with dark theme integration.',
      'Professional Standards: Clean, balanced layout with excellent typography hierarchy and premium visual refinement.',
      'Do not include any creation metadata, timestamps, or technical information in the image.',
      'Focus on premium artwork with professionally integrated badge elements that enhance rather than distract from the overall design.'
    ].filter(Boolean).join(' ');

    console.log('Generated enhanced prompt for:', name);

    // Generate image with OpenAI
    console.log('🎨 Starting OpenAI image generation...');
    const abortSignal = AbortSignal.timeout(120_000);
    let imgResp;
    try {
      imgResp = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: premiumPrompt,
        n: 1,
        size,
        quality,
        user: job.user_id
      }, { signal: abortSignal });
      console.log('✅ OpenAI response received');
    } catch (err: any) {
      console.error('❌ OpenAI API error:', err);
      console.error('❌ Error details:', err.message);
      if (err?.status === 403) {
        throw new Error('OpenAI access denied. Please verify your OpenAI API key and organization settings.');
      }
      throw new Error(`OpenAI request failed: ${err.message || String(err)}`);
    }

    if (!imgResp.data?.[0]?.b64_json) {
      throw new Error('No image data in OpenAI response');
    }

    // Convert and upload (same as process-image-generation)
    const base64Data = imgResp.data[0].b64_json;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const imageBlob = new Blob([bytes], { type: 'image/png' });
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const fileName = `${job.user_id}/${Date.now()}-enhanced-${safeName}.png`;

    // Ensure bucket exists
    const { data: buckets } = await supabaseClient.storage.listBuckets();
    const bucketExists = buckets?.some((bucket: any) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      await supabaseClient.storage.createBucket(BUCKET_NAME, {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        fileSizeLimit: 5242880
      });
    }

    // Upload image
    const userFolder = `${job.user_id}/`;
    await supabaseClient.storage.from(BUCKET_NAME).upload(userFolder, new Blob(['']), { upsert: true });

    const { error: uploadError } = await supabaseClient.storage.from(BUCKET_NAME).upload(fileName, imageBlob, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: true
    });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    // Create the card in the database
    console.log('📝 Creating card in database...');
    
    // Get or create a collection for the user
    let collectionId;
    const { data: existingCollections, error: collectionError } = await supabaseClient
      .from('collections')
      .select('id')
      .eq('user_id', job.user_id)
      .limit(1);
    
    if (collectionError) {
      console.error('Error fetching collections:', collectionError);
      throw collectionError;
    }
    
    if (existingCollections && existingCollections.length > 0) {
      collectionId = existingCollections[0].id;
    } else {
      const { data: newCollection, error: createCollectionError } = await supabaseClient
        .from('collections')
        .insert({
          name: 'My Collection',
          user_id: job.user_id,
          visibility: cardData.visibility || ['personal']
        })
        .select('id')
        .single();
      
      if (createCollectionError) {
        console.error('Error creating collection:', createCollectionError);
        throw createCollectionError;
      }
      collectionId = newCollection.id;
    }
    
    // Parse background gradient if it exists
    let backgroundGradient = null;
    if (cardData.backgroundGradient) {
      try {
        const parsed = JSON.parse(cardData.backgroundGradient);
        if (JSON.stringify(parsed) !== JSON.stringify(['#1a1a1a', '#000000'])) {
          backgroundGradient = cardData.backgroundGradient;
        }
      } catch (e) {
        console.error('Error parsing background gradient:', e);
      }
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
      format: cardData.format || 'fullBleed',
      frame_color: '#808080',
      is_premium_generation: true,
      custom_generation_type_id: cardData.customGenerationTypeId || null,
      is_uploaded_image: false,
      generation_type: cardData.generationType || 'classic',
      background_gradient: backgroundGradient,
      user_id: job.user_id,
      collection_id: collectionId,
      is_public: cardData.isPublic || false,
      is_shared_with_friends: cardData.isSharedWithFriends || false
    };
    
    const { data: newCard, error: insertError } = await supabaseClient
      .from('cards')
      .insert(newCardData)
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating card:', insertError);
      throw insertError;
    }
    
    console.log('✅ Card created successfully:', newCard.id);
    
    // If this card is a shadow for another card, link them
    if (cardData.shadowForCardId) {
      const { error: linkError } = await supabaseClient
        .from('cards')
        .update({ shadow_card_id: newCard.id })
        .eq('id', cardData.shadowForCardId)
        .eq('user_id', job.user_id);
      
      if (linkError) {
        console.error('Error linking shadow card:', linkError);
      }
    }

    // Update job status to 'completed' with card ID
    await supabaseClient
      .from('image_generation_queue')
      .update({ status: 'completed', image_url: publicUrl, card_id: newCard.id })
      .eq('id', jobId);

    console.log(`✅ Enhanced job ${jobId} completed with card:`, newCard.id);

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl, cardId: newCard.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error processing enhanced job:', errorMessage);
    console.error('❌ Full error details:', error);
    
    // Try to mark job as failed - get jobId from the already parsed request data
    try {
      // Re-parse the request to get jobId since we might not have it in scope
      const clonedReq = req.clone();
      const { jobId } = await clonedReq.json();
      
      if (jobId) {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseAdmin
          .from('image_generation_queue')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', jobId);
        console.log('❌ Job marked as failed:', jobId);
      }
    } catch (e) {
      console.error('Failed to update job status to failed:', e);
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
