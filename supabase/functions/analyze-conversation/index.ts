import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.24.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { conversationText } = await req.json()
    
    if (!conversationText) {
      throw new Error('No conversation text provided')
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
      // @ts-ignore - Required for Deno
      fetch: (...args) => fetch(...args)
    })

    // Create the prompt for card generation
    const prompt = `You are an expert in communication patterns and relationships. 
    Analyze the following conversation description and suggest 5 card concepts that represent key communication dynamics.
    
    For each card, provide a JSON array with objects containing:
    1. name: A short, impactful title (2-4 words)
    2. type: One of ["Impact", "Protect", "Connect", "Request", "Percept"]
    3. description: A 1-2 sentence explanation of this communication pattern
    4. role: A role that might use this pattern (e.g., "Listener", "Mediator", "Protector")
    5. context: Where this pattern might occur (e.g., "Conflict Resolution", "Therapy", "Workplace")
    
    Conversation: "${conversationText}"
    
    Return ONLY valid JSON, no other text.
    `

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that analyzes conversations and suggests communication patterns as trading cards."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })

    // Parse the response
    const responseText = completion.choices[0]?.message?.content || '[]'
    let cards = []
    
    try {
      cards = JSON.parse(responseText)
    } catch (e) {
      console.error('Failed to parse OpenAI response:', responseText)
      throw new Error('Failed to process AI response')
    }

    return new Response(
      JSON.stringify({ success: true, cards }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
  }
})
