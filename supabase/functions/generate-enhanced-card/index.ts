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
    console.log('Processing enhanced card generation request...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    console.log('Supabase client created');

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('User authenticated:', user.id);

    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    
    const { name, description, type, role, context, borderStyle, borderColor, format, size, quality } = requestBody;

    if (!name || !description) {
      console.error('Missing required fields:', { name: !!name, description: !!description });
      return new Response(
        JSON.stringify({ 
          error: 'Name and description are required',
          details: 'Please provide both a name and image description for premium generation.'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    console.log('Request validation passed');
    console.log('Queueing enhanced card generation for:', name);

    // Prepare card data for the queue (including enhanced prompt info)
    const cardData = {
      name,
      description,
      type,
      role,
      context,
      borderStyle,
      borderColor,
      format,
      size,
      quality,
      generation_type: 'enhanced' // Mark as enhanced generation
    };

    // Create admin client for queue operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    // Insert into queue using admin client
    const { data: job, error: queueError } = await supabaseAdmin
      .from('image_generation_queue')
      .insert({
        user_id: user.id,
        card_data: cardData,
        status: 'queued'
      })
      .select()
      .single();

    if (queueError) {
      console.error('❌ Queue error:', queueError);
      console.error('❌ Error details:', JSON.stringify(queueError, null, 2));
      throw new Error(`Failed to queue enhanced generation: ${queueError.message}`);
    }

    console.log('✅ Job inserted successfully:', job);

    // Call processing function directly via HTTP
    // This is more reliable than supabase.functions.invoke() from within an Edge Function
    // Use full-bleed processor for fullBleed format cards
    const processingUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-full-bleed-card-generation`;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    console.log('🔧 Triggering full-bleed processing function for job:', job.id);
    
    // Don't await - let it process in background
    fetch(processingUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ jobId: job.id })
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Processing function failed:', error);
      } else {
        console.log('✅ Processing function triggered successfully');
      }
    }).catch((err) => {
      console.error('❌ Error calling processing function:', err);
    });

    console.log('✅ Enhanced card queued successfully:', job.id);

    return new Response(
      JSON.stringify({ jobId: job.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('❌ Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
