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
    
    const { name, description, type, role, context, format, size, quality } = requestBody;

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
        status: 'queued',
        generation_type: 'enhanced'
      })
      .select()
      .single();

    if (queueError) {
      console.error('❌ Queue error:', queueError);
      console.error('❌ Error details:', JSON.stringify(queueError, null, 2));
      throw new Error(`Failed to queue enhanced generation: ${queueError.message}`);
    }

    console.log('✅ Job inserted successfully:', job);

    // Trigger processing function (don't await, but log any errors)
    supabaseAdmin.functions.invoke('process-enhanced-card-generation', { 
      body: { jobId: job.id } 
    }).then(({ data, error }) => {
      if (error) {
        console.error('❌ Failed to trigger processing function:', error);
      } else {
        console.log('✅ Processing function triggered successfully');
      }
    }).catch(err => {
      console.error('❌ Error triggering processing function:', err);
    });

    console.log('✅ Enhanced card queued successfully:', job.id);

    // Return job info instead of image URL (for polling)
    return new Response(
      JSON.stringify({ 
        jobId: job.id,
        status: 'queued',
        message: 'Enhanced card generation queued successfully'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      },
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
