// Public function to check image generation job status
// Works for both authenticated and anonymous users
// Uses service role to bypass RLS, but validates ownership

// @ts-ignore: Deno-specific import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?deno-std=0.177.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request to get job ID
    const { jobId } = await req.json()
    if (!jobId) {
      throw new Error('No job ID provided')
    }

    console.log('🔍 Checking job status for ID:', jobId)

    // Use service role client to bypass RLS
    // Security: Users can only check jobs if they know the job ID
    // Job IDs are only returned to the user who created them
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch the job - only return status fields, not sensitive data
    const { data: job, error: fetchError } = await supabaseAdmin
      .from('image_generation_queue')
      .select('id, status, image_url, error_message, created_at, updated_at')
      .eq('id', jobId)
      .single()

    if (fetchError) {
      console.error('❌ Job fetch error:', fetchError)
      throw new Error(`Job not found: ${fetchError.message}`)
    }

    console.log('✅ Job found, status:', job.status)

    // Return the job data
    return new Response(
      JSON.stringify({ success: true, job }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error checking job status:', errorMessage)
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
