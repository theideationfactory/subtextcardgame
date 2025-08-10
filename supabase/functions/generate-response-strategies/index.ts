import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== GENERATE RESPONSE STRATEGIES FUNCTION START ===')
    console.log('Request method:', req.method)
    console.log('Request headers:', Object.fromEntries(req.headers.entries()))
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      throw new Error('Invalid token')
    }

    console.log('Authenticated user:', user.id)

    // Parse request body
    const requestBody = await req.json()
    console.log('Request body:', requestBody)
    
    const { speechAct } = requestBody
    
    if (!speechAct) {
      console.error('Missing speechAct in request body')
      throw new Error('Speech act is required')
    }

    console.log('Generating response strategies for speech act:', speechAct)
    
    // Check if OpenAI API key is available
    const openAIKey = Deno.env.get('OPENAI_API_KEY')
    console.log('OpenAI API key present:', !!openAIKey)

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a communication expert. Given a speech act type, generate 3-4 appropriate response strategies that someone could use when responding to that type of communication.

Return only a JSON array of response strategy names. Each strategy should be:
- 2-3 words maximum
- Action-oriented (verb-based)
- Appropriate for the speech act type
- Distinct from the others

Examples:
- For "Question": ["Answer Directly", "Ask Clarification", "Deflect"]
- For "Complaint": ["Acknowledge", "Apologize", "Defend"]
- For "Request": ["Accept", "Negotiate", "Decline"]`
          },
          {
            role: 'user',
            content: `Generate response strategies for the speech act: "${speechAct}"`
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      }),
    })

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${openAIResponse.status}`)
    }

    const openAIData = await openAIResponse.json()
    console.log('OpenAI response:', JSON.stringify(openAIData, null, 2))

    // Extract and parse the response strategies
    const content = openAIData.choices[0]?.message?.content
    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    console.log('Raw OpenAI content:', content)

    // Clean the content to remove potential markdown code blocks
    let cleanContent = content.trim()
    
    // Check if content is wrapped in markdown code blocks
    if (cleanContent.startsWith('```json') && cleanContent.endsWith('```')) {
      console.log('Detected markdown wrapper, cleaning...')
      cleanContent = cleanContent.slice(7, -3).trim() // Remove ```json and ```
      console.log('Cleaned content:', cleanContent)
    } else if (cleanContent.startsWith('```') && cleanContent.endsWith('```')) {
      console.log('Detected generic markdown wrapper, cleaning...')
      cleanContent = cleanContent.slice(3, -3).trim() // Remove ``` and ```
      console.log('Cleaned content:', cleanContent)
    }

    // Parse the JSON response
    let responseStrategies: string[]
    try {
      responseStrategies = JSON.parse(cleanContent)
      if (!Array.isArray(responseStrategies)) {
        throw new Error('Response is not an array')
      }
    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      console.error('Original content:', content)
      console.error('Cleaned content:', cleanContent)
      throw new Error('Failed to parse OpenAI response as JSON')
    }

    console.log('Parsed response strategies:', responseStrategies)

    return new Response(
      JSON.stringify({
        success: true,
        speechAct,
        responseStrategies
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in generate-response-strategies function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
