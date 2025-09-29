// Supabase Edge Functions use Deno runtime
// Suppress TypeScript errors for Deno-specific imports
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

    const openai = new OpenAI({
      apiKey: apiKey
    });

    const { jobId } = await req.json();
    if (!jobId) throw new Error('No job ID provided');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // 1. Update job status to 'processing'
    await supabaseClient
      .from('image_generation_queue')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // 2. Fetch job details
    const { data: job, error: fetchError } = await supabaseClient
      .from('image_generation_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;

    const cardData = job.card_data;
    const { name, description } = cardData;

    // Create literal prompt from description only (matching existing function)
    const prompt = description.trim().replace(/[^\w\s.,!?-]/g, '');
    console.log('Generated prompt:', prompt);

    const abortSignal = AbortSignal.timeout(120_000); // 2 minutes for gpt-image-1
    let imgResp;
    try {
      imgResp = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'auto',
        user: job.user_id
      }, {
        signal: abortSignal
      });
    } catch (err: any) {
      console.error('OpenAI API error:', err);
      if (err?.status === 403) {
        throw new Error('OpenAI access denied. Please verify your OpenAI API key and organization settings.');
      }
      throw new Error(`OpenAI request failed: ${err.message || String(err)}`);
    }

    console.log('OpenAI response received:', {
      dataLength: imgResp.data?.length,
      hasB64Json: !!imgResp.data?.[0]?.b64_json,
      b64Length: imgResp.data?.[0]?.b64_json?.length
    });

    if (!imgResp.data?.[0]?.b64_json) {
      console.error('OpenAI response structure:', JSON.stringify(imgResp, null, 2));
      throw new Error('No image data in OpenAI response');
    }

    // Convert base64 to binary data
    const base64Data = imgResp.data[0].b64_json;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const imageBlob = new Blob([bytes], { type: 'image/png' });
    const fileName = `${job.user_id}/${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;

    // Check if bucket exists
    const { data: buckets } = await supabaseClient.storage.listBuckets();
    // @ts-ignore: bucket type
    const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createBucketError } = await supabaseClient.storage.createBucket(BUCKET_NAME, {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg'],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createBucketError) {
        throw new Error(`Failed to create bucket: ${createBucketError.message}`);
      }
    }

    // Ensure user folder exists
    const userFolder = `${job.user_id}/`;
    await supabaseClient.storage.from(BUCKET_NAME).upload(userFolder, new Blob(['']), { upsert: true });

    // Upload the image
    const { data: uploadData, error: uploadError } = await supabaseClient.storage.from(BUCKET_NAME).upload(fileName, imageBlob, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: true
    });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get the public URL
    const { data: { publicUrl } } = supabaseClient.storage.from(BUCKET_NAME).getPublicUrl(fileName);
    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    const imageUrl = publicUrl;

    // 4. Update job status to 'completed'
    await supabaseClient
      .from('image_generation_queue')
      .update({ status: 'completed', image_url: imageUrl })
      .eq('id', jobId);

    // 5. (Future Step) Trigger push notification
    // await supabaseClient.functions.invoke('send-push-notification', { body: { userId: job.user_id, imageUrl } });
    
    console.log(`✅ Job ${jobId} completed successfully with image: ${imageUrl}`);
    console.log('Successfully generated and uploaded image:', imageUrl);

    return new Response(
      JSON.stringify({ success: true, imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error processing job:', errorMessage);
    
    // Try to get jobId from the original request to mark as failed
    let jobId;
    try {
      const body = await req.json();
      jobId = body.jobId;
    } catch (e) {
      console.error('Could not parse request body for error handling:', e);
    }
    
    if (jobId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabaseAdmin
          .from('image_generation_queue')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', jobId);
      } catch (e) {
        console.error('Failed to update job status to failed:', e);
      }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
