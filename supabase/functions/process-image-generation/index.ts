import { createClient } from 'npm:@supabase/supabase-js@2'
import OpenAI from 'npm:openai@4.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')!,
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { jobId } = await req.json();
    if (!jobId) throw new Error('No job ID provided');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Update job status to 'processing'
    await supabaseAdmin
      .from('image_generation_queue')
      .update({ status: 'processing' })
      .eq('id', jobId);

    // 2. Fetch job details
    const { data: job, error: fetchError } = await supabaseAdmin
      .from('image_generation_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;

    const { name, description } = job.card_data;

    // 3. Generate the image with OpenAI
    const completion = await openai.images.generate({
        model: 'dall-e-3',
        prompt: `Trading card art for a card named "${name}". Description: "${description}". Style: digital art, fantasy.`,
        n: 1,
        size: '1024x1024',
        response_format: 'url',
    });

    if (!completion.data || !completion.data[0] || !completion.data[0].url) {
      console.error('Invalid response from OpenAI:', completion);
      throw new Error('Failed to get image URL from OpenAI response.');
    }

    const imageUrl = completion.data[0].url;

    // 4. Update job status to 'completed'
    await supabaseAdmin
      .from('image_generation_queue')
      .update({ status: 'completed', image_url: imageUrl })
      .eq('id', jobId);

    // 5. (Future Step) Trigger push notification
    // await supabaseAdmin.functions.invoke('send-push-notification', { body: { userId: job.user_id, ... } });

    return new Response(JSON.stringify({ success: true, imageUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error processing job:', errorMessage);

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
