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
    console.log('🔄 Processing queue request...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    console.log('✅ Supabase client created');

    const requestBody = await req.json();
    console.log('📥 Request body:', requestBody);
    
    const { cardData, userId } = requestBody;

    if (!cardData || !userId) {
      console.error('❌ Missing required fields:', { cardData: !!cardData, userId: !!userId });
      throw new Error('Missing cardData or userId');
    }

    console.log('✅ Request validation passed');

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
      console.error('❌ Database error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('✅ Job inserted successfully:', job);

    // Asynchronously trigger the appropriate processing function based on generation type
    // We don't await this call.
    let processorFunction;
    if (cardData.generationType === 'classic') {
      processorFunction = 'process-full-bleed-card-generation';
    } else if (cardData.generationType === 'modern_parchment') {
      processorFunction = 'process-modern-parchment-card-generation';
    } else if (cardData.isPremium) {
      processorFunction = 'process-premium-classic-generation';
    } else {
      processorFunction = 'process-image-generation';
    }
    
    console.log(`🎯 Routing to ${processorFunction} for job ${job.id}`);
    supabaseClient.functions.invoke(processorFunction, { body: { jobId: job.id } });

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
