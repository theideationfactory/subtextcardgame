import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { 
      message, 
      responseId, 
      cardName, 
      originalDescription, 
      cardImageUrl
    } = await req.json()

    if (!message) {
      throw new Error('Message is required')
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }
    
    // Build the conversation messages for Chat Completions API
    let messages: any[] = [
      {
        role: "system",
        content: `You are an AI assistant helping users refine their card images. The user has generated an image for a card named "${cardName}" with the description "${originalDescription}". 

When the user asks for changes, you should:
1. Look at the current image they show you
2. Generate a new image that incorporates their feedback
3. Provide a brief explanation of what you changed

Always be helpful in interpreting their requests for image modifications. When generating new images, keep the prompt literal and direct based on exactly what the user asks for.`
      }
    ]

    // Add the user's message with the current image
    let userContent: any[] = [
      {
        type: "text",
        text: `Here's my current card image and what I'd like to change: ${message}`
      }
    ]
    
    // Include the current image if we have it
    if (cardImageUrl) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: cardImageUrl
        }
      })
    }
    
    messages.push({
      role: "user",
      content: userContent
    })

    let chatPayload: any = {
      model: "gpt-4o",
      messages: messages,
      tools: [
        {
          type: "function",
          function: {
            name: "generate_image",
            description: "Generate a new image based on the user's feedback",
            parameters: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "The image generation prompt incorporating the user's feedback. Keep it simple and literal as requested."
                }
              },
              required: ["prompt"]
            }
          }
        }
      ],
      tool_choice: "auto"
    }

    // Call OpenAI Chat Completions API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatPayload),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text()
      console.error('OpenAI API error:', errorData)
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const chatResult = await openaiResponse.json()
    console.log('OpenAI chat result:', JSON.stringify(chatResult, null, 2))

    let assistantMessage = chatResult.choices[0].message.content || "I'll help you refine your image."
    let newImageUrl = null

    // Check if the assistant wants to generate an image
    if (chatResult.choices[0].message.tool_calls) {
      const toolCall = chatResult.choices[0].message.tool_calls[0]
      if (toolCall.function.name === 'generate_image') {
        const functionArgs = JSON.parse(toolCall.function.arguments)
        // Use literal prompt as requested
        const imagePrompt = functionArgs.prompt

        console.log('Generating image with prompt:', imagePrompt)

        // Generate the image using GPT Image 1
        const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: imagePrompt,
            n: 1,
            size: "1024x1024",
            quality: "auto", // auto quality for best results
          }),
        })

        if (!imageResponse.ok) {
          const errorData = await imageResponse.text()
          console.error('Image generation error:', errorData)
          throw new Error(`Image generation failed: ${imageResponse.status}`)
        }

        const imageResult = await imageResponse.json()
        const imageBase64 = imageResult.data[0].b64_json

        // Convert base64 to buffer for upload
        const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))
        
        // Generate a unique filename (matching existing structure)
        const timestamp = Date.now()
        const filename = `${user.id}/${timestamp}-refined.png`
        const BUCKET_NAME = 'card_images'
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
          .from(BUCKET_NAME)
          .upload(filename, imageBuffer, {
            contentType: 'image/png',
            upsert: false
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error('Failed to upload image')
        }

        // Get the public URL
        const { data: urlData } = supabaseClient.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filename)

        newImageUrl = urlData.publicUrl
        console.log('New image uploaded:', newImageUrl)
      }
    }

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        imageUrl: newImageUrl
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in chat-image-generation function:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        details: String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
