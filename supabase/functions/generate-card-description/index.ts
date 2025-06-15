// Supabase Edge Function for generating card descriptions using OpenAI
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { OpenAI } from 'https://esm.sh/openai@4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const openai = new OpenAI({
      apiKey: apiKey
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Get the user's ID from the JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    const body = await req.json().catch(() => ({}));
    const { cardName, cardType } = body;

    if (!cardName) {
      return new Response(JSON.stringify({
        error: 'Card name is required',
        details: 'Please provide a card name to generate a description.'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    try {
      // Create a more specific prompt using both card name and type if available
      const typeContext = cardType && cardType !== 'TBD' 
        ? `This is a "${cardType}" type card in a communication-focused card game.` 
        : 'This is a card in a communication-focused card game.';
      
      const prompt = `Generate a concise, insightful description for a card named "${cardName}". ${typeContext} The description should explain what this communication pattern or interpersonal dynamic means and how it affects conversations.`;

      // Call OpenAI's API to generate the description
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that provides concise, insightful descriptions for communication patterns and interpersonal dynamics for a card game about human interaction. Keep your response to 1-3 sentences maximum. Focus on how this pattern affects conversations and relationships."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      const description = response.choices[0]?.message?.content?.trim();
      if (!description) {
        throw new Error('No description generated from OpenAI');
      }

      return new Response(JSON.stringify({
        description
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      throw openaiError;
    }
  } catch (error) {
    console.error('Description generation error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate description',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
