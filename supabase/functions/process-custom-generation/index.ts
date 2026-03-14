// Custom Generation Type Processing Function
// Uses existing premium generation with user-defined theme and special instructions
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

interface CustomGenerationType {
  id: string;
  name: string;
  description: string;
  theme: string;
  special_instructions: string;
  is_active: boolean;
  user_id: string;
}

interface CardData {
  name: string;
  description: string;
  imageDescription: string;
  type: string;
  role: string;
  context: string;
  customGenerationTypeId: string;
}

function buildEnhancedPrompt(cardData: CardData, customType: CustomGenerationType): string {
  // Extract card data like the premium function does
  const title = cardData.name?.trim() || 'Untitled';
  const topRight = (cardData.context ?? '').trim();   // context label in diamond (e.g., "Friendship")
  const bottomLeft = (cardData.role ?? '').trim();    // role badge (e.g., "Protector")
  const bottomCenter = (cardData.type ?? '').trim();  // type label at bottom center
  const desc = cardData.description?.trim() || '';
  const art = (cardData.imageDescription || cardData.description || 'fantasy creature').trim();
  const userTheme = customType.theme?.trim();
  const specialInstructions = customType.special_instructions?.trim();

  // Build the enhanced prompt with user's theme and instructions
  const basePrompt = `
LAYOUT SPEC (Custom Theme Trading Card - ${userTheme || 'Custom'}):
- BACKDROP: Clean gradient background with ${userTheme || 'custom'} aesthetic theme. NEVER pure black or white.
- FRAME: Modern rectangular border inspired by ${userTheme || 'custom'} styling and premium trading card elegance.
  • Style: Implement a border design that reflects the ${userTheme || 'custom'} theme
  • Gradient border that complements the ${userTheme || 'custom'} aesthetic
  • Subtle patterns and elements that evoke ${userTheme || 'custom'} imagery
  • Clean lines with soft lighting and layered depth for premium feel
  • Materials and textures that match ${userTheme || 'custom'} style
- TITLE BAR (TOP SECTION):
  • Text: "${title}" in font style that matches ${userTheme || 'custom'} aesthetic
  • Background: Translucent panel with ${userTheme || 'custom'} themed accents
  • Typography: Crisp and elegant, reflecting ${userTheme || 'custom'} style
  • Color: Matches the ${userTheme || 'custom'} theme of the card
- DIAGRAMMATIC ELEMENTS:
  • Subtle patterns and marks that reflect ${userTheme || 'custom'} imagery
  • Small glyphs and symbolic markers that suggest ${userTheme || 'custom'} elements
  • Interface-style accents that fit the ${userTheme || 'custom'} aesthetic
  • Patterns hinting at ${userTheme || 'custom'} themes and concepts
- TOP-RIGHT CORNER INDICATOR:
  • Clean badge displaying: "${topRight || ' '}"
  • Style: ${userTheme || 'custom'} themed design
  • Translucent background with ${userTheme || 'custom'} patterning
- CENTRAL ART WINDOW (DOMINANT FOCUS ~65% HEIGHT):
  • Showcase: ${art}
  • Frame: ${userTheme || 'custom'} styled border with soft lighting and depth
  • Keep artwork completely unobstructed and central
  • Enhance with ${userTheme || 'custom'} color palette and lighting
  • Style: Fusion of ${userTheme || 'custom'} aesthetic and premium trading card quality
- ROLE INDICATOR (BOTTOM-LEFT):
  • ${userTheme || 'custom'} styled label: "${bottomLeft || ' '}"
  • Design: ${userTheme || 'custom'} themed styling with appropriate accents
  • Typography: Matches ${userTheme || 'custom'} aesthetic
- DESCRIPTION FIELD (LOWER SECTION):
  • Text: "${desc}"
  • Style: ${userTheme || 'custom'} themed documentation design
  • Background: Subtle gradient with ${userTheme || 'custom'} themed overlay
  • Typography: Reflects ${userTheme || 'custom'} aesthetic while remaining readable
- TYPE CLASSIFICATION (BOTTOM CENTER):
  • Label: "${bottomCenter || ' '}"
  • Style: ${userTheme || 'custom'} themed classification design
  • Typography: Matches ${userTheme || 'custom'} aesthetic with appropriate styling
AESTHETIC REQUIREMENTS:
- Inspired by premium trading cards but distinctly ${userTheme || 'custom'} themed
- Feels like a professional trading card with ${userTheme || 'custom'} styling
- Balances premium quality with ${userTheme || 'custom'} aesthetic
- Modern, premium, and symbolic within ${userTheme || 'custom'} theme constraints
- ${userTheme || 'Custom'} tone expressed through color gradients, textures, and lighting
- Patterns and elements that suggest ${userTheme || 'custom'} themes
MATERIALS & VISUAL EFFECTS:
- Color palette and gradients matching ${userTheme || 'custom'} theme
- Soft lighting with premium highlights for professional finish
- Layered depth with ${userTheme || 'custom'} themed elements
- Patterns and textures that evoke ${userTheme || 'custom'} imagery
- Accents and details that reinforce ${userTheme || 'custom'} aesthetic
`;

  // Add special instructions if provided
  const instructionsSection = specialInstructions ? `
SPECIAL INSTRUCTIONS:
${specialInstructions}
` : '';

  return `${basePrompt}${instructionsSection}`.trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const openai = new OpenAI({ apiKey });

    const { jobId } = await req.json();
    if (!jobId) throw new Error('No job ID provided');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Update job status to 'processing'
    await supabase
      .from('image_generation_queue')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // Fetch job details
    const { data: job, error: fetchError } = await supabase
      .from('image_generation_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;

    const cardData: CardData = job.card_data;
    
    if (!cardData.customGenerationTypeId) {
      throw new Error('No custom generation type ID provided');
    }

    // Fetch the custom generation type
    const { data: customType, error: typeError } = await supabase
      .from('custom_generation_types')
      .select('*')
      .eq('id', cardData.customGenerationTypeId)
      .eq('user_id', job.user_id)
      .single();

    if (typeError || !customType) {
      throw new Error('Custom generation type not found or access denied');
    }

    if (!customType.is_active) {
      throw new Error('Custom generation type is not active');
    }

    // Build the enhanced prompt with theme and instructions
    const prompt = buildEnhancedPrompt(cardData, customType);
    console.log('🎨 Custom generation prompt for:', cardData.name, 'using theme:', customType.theme);
    console.log('📝 Generated prompt length:', prompt.length);

    // Generate with OpenAI using premium settings
    const abortSignal = AbortSignal.timeout(180_000); // 3 minutes for custom generation

    let imgResp;
    try {
      imgResp = await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1536', // Use premium portrait size
        quality: 'auto',
        user: job.user_id,
      }, { signal: abortSignal });
      
      console.log('✅ OpenAI response received for custom generation');
    } catch (err: any) {
      console.error('❌ OpenAI API error:', err?.message || err);
      if (err?.status === 403) {
        throw new Error('OpenAI access denied. Please verify your OpenAI API key and organization settings.');
      }
      throw new Error(`OpenAI request failed: ${err.message || String(err)}`);
    }

    const b64 = imgResp?.data?.[0]?.b64_json;
    if (!b64) throw new Error('No image data in OpenAI response');

    // Convert base64 to binary data
    const binaryString = atob(b64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: 'image/png' });

    // Create filename
    const safeName = (cardData.name || 'custom-card').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const fileName = `${job.user_id}/${Date.now()}-custom-${customType.id}-${safeName}.png`;

    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket: any) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createBucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        fileSizeLimit: 10 * 1024 * 1024, // 10MB for custom cards
      });
      if (createBucketError) {
        throw new Error(`Failed to create bucket: ${createBucketError.message}`);
      }
    }

    // Ensure user folder exists
    await supabase.storage.from(BUCKET_NAME).upload(`${job.user_id}/.keep`, new Blob(['']), { upsert: true });

    // Upload the image
    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(fileName, imageBlob, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: true,
    });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    // Create the card in the database
    console.log('📝 Creating card in database...');
    
    // Get or create a collection for the user
    let collectionId;
    const { data: existingCollections, error: collectionError } = await supabase
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
      const { data: newCollection, error: createCollectionError } = await supabase
        .from('collections')
        .insert({
          name: 'My Collection',
          user_id: job.user_id,
          visibility: (job.card_data as any).visibility || ['personal']
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
    const fullCardData = job.card_data as any;
    if (fullCardData.backgroundGradient) {
      try {
        const parsed = JSON.parse(fullCardData.backgroundGradient);
        if (JSON.stringify(parsed) !== JSON.stringify(['#1a1a1a', '#000000'])) {
          backgroundGradient = fullCardData.backgroundGradient;
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
      border_style: fullCardData.borderStyle || 'Classic',
      border_color: fullCardData.borderColor || '#808080',
      image_url: publicUrl,
      format: fullCardData.format || 'framed',
      frame_color: '#808080',
      is_premium_generation: true,
      custom_generation_type_id: cardData.customGenerationTypeId || null,
      is_uploaded_image: false,
      generation_type: fullCardData.generationType || 'custom',
      background_gradient: backgroundGradient,
      user_id: job.user_id,
      collection_id: collectionId,
      is_public: fullCardData.isPublic || false,
      is_shared_with_friends: fullCardData.isSharedWithFriends || false
    };
    
    const { data: newCard, error: insertError } = await supabase
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
    if (fullCardData.shadowForCardId) {
      const { error: linkError } = await supabase
        .from('cards')
        .update({ shadow_card_id: newCard.id })
        .eq('id', fullCardData.shadowForCardId)
        .eq('user_id', job.user_id);
      
      if (linkError) {
        console.error('Error linking shadow card:', linkError);
      }
    }

    // Update job status to 'completed' with card ID
    await supabase
      .from('image_generation_queue')
      .update({ 
        status: 'completed', 
        image_url: publicUrl,
        card_id: newCard.id,
      })
      .eq('id', jobId);

    console.log(`✅ Custom generation job ${jobId} completed with card:`, newCard.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: publicUrl,
        cardId: newCard.id,
        customTypeName: customType.name,
        theme: customType.theme,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('❌ Error processing custom generation job:', errorMessage);

    // Try to mark job as failed
    try {
      const { jobId } = await req.json();
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

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
