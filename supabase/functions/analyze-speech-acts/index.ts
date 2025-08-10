// Supabase Edge Function for analyzing speech acts in messages using OpenAI
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

    const { messageId, messageContent } = await req.json();
    
    console.log('Received request:', { messageId, messageContent });
    
    if (!messageId || !messageContent) {
      throw new Error('Message ID and content are required');
    }

    // Generate speech act analysis using OpenAI
    console.log('Calling OpenAI with message:', messageContent);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a speech act analyzer for a social card game. Analyze the given message and identify the primary speech acts it contains. 

Speech acts are the intentions behind utterances - what the speaker is trying to do with their words. Common speech acts include:
- Assertive: stating, claiming, describing, explaining, informing
- Directive: requesting, commanding, asking, inviting, suggesting
- Commissive: promising, threatening, offering, vowing
- Expressive: thanking, apologizing, congratulating, complaining
- Declarative: declaring, pronouncing, naming, appointing

Return ONLY a JSON array of 1-3 speech act names that best represent the message. Use concise, clear names like "Request", "Compliment", "Question", "Suggestion", "Complaint", "Promise", etc.

Example responses:
["Request", "Explanation"]
["Compliment"] 
["Question", "Suggestion"]
["Apology", "Promise"]`
        },
        {
          role: 'user',
          content: messageContent
        }
      ],
      temperature: 0.3,
      max_tokens: 100
    });

    console.log('OpenAI completion response:', completion);
    
    const speechActsText = completion.choices[0]?.message?.content?.trim();
    console.log('Raw OpenAI response:', speechActsText);
    
    if (!speechActsText) {
      throw new Error('Failed to generate speech acts');
    }

    // Parse the JSON response
    let speechActs: string[];
    try {
      speechActs = JSON.parse(speechActsText);
      console.log('Parsed speech acts:', speechActs);
      
      if (!Array.isArray(speechActs)) {
        console.error('Response is not an array:', speechActs);
        throw new Error('Invalid response format');
      }
    } catch (parseError) {
      console.error('Failed to parse speech acts:', speechActsText);
      console.error('Parse error:', parseError);
      throw new Error('Failed to parse speech acts response');
    }

    // Update the message with speech acts
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        speech_acts: speechActs,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId)
      .eq('receiver_id', user.id); // Only allow updating messages sent to the current user

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        speechActs: speechActs,
        messageId: messageId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in analyze-speech-acts function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
