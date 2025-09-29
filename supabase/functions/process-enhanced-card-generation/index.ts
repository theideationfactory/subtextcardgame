// Enhanced card processing function - uses premium prompts
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
    const { jobId } = await req.json();
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
    const { name, description, type, role, context, size = '1024x1536', quality = 'auto' } = cardData;

    // Build enhanced prompt (same logic as original generate-enhanced-card)
    const topLabels = [];
    if (type) topLabels.push(type);
    if (role) topLabels.push(role);
    
    const bottomLabels = [];
    if (context) bottomLabels.push(context);

    const premiumPrompt = [
      `Create a premium trading card artwork featuring "${name}" with ${description}.`,
      `Design as a complete trading card with integrated card name and attribute labels in a fantasy card game style.`,
      `Include the title "${name}" prominently displayed at the bottom of the card.`,
      topLabels.length > 0 ? `Show these attributes as elegant text labels in the TOP corners: ${topLabels.join(' in top-left, ')} in top-right.` : '',
      bottomLabels.length > 0 ? `Show this attribute as an elegant text label in a BOTTOM corner: ${bottomLabels.join(', ')}.` : '',
      'Style: professional trading card illustration, cinematic lighting, rich colors, sharp details.',
      'Layout: portrait orientation, decorative borders and frames.',
      'Quality: print-ready artwork suitable for collectible card game, similar to Magic: The Gathering or Pokémon cards.',
      'Do not include any creation metadata, timestamps, or technical information in the image.',
      'Focus purely on the fantasy artwork and card design elements.'
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

    // Update job status to 'completed'
    await supabaseClient
      .from('image_generation_queue')
      .update({ status: 'completed', image_url: publicUrl })
      .eq('id', jobId);

    console.log(`✅ Enhanced job ${jobId} completed:`, publicUrl);

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error processing enhanced job:', errorMessage);
    
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
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
