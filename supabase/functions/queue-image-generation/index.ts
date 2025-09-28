import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { cardData, userId } = await req.json();

    if (!cardData || !userId) {
      throw new Error('Missing cardData or userId');
    }

    // Insert a new job into the queue
    const { data: job, error } = await supabaseClient
      .from('image_generation_queue')
      .insert({
        user_id: userId,
        card_data: cardData,
        status: 'queued'
      })
      .select()
      .single();

    if (error) {
      console.error('Error queueing job:', error);
      throw error;
    }

    // Asynchronously trigger the processing function without waiting for it to complete.
    // We don't await this call.
    supabaseClient.functions.invoke('process-image-generation', { body: { jobId: job.id } });

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId: job.id,
        message: 'Image generation has been successfully queued.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
