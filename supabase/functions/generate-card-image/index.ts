// Supabase Edge Functions use Deno runtime
// Suppress TypeScript errors for Deno-specific imports
// @ts-ignore: Deno-specific import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?deno-std=0.177.0';
// @ts-ignore: Deno-specific import
import OpenAI from 'npm:openai@4.24.1';

// @ts-ignore: Deno namespace
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET_NAME = 'card_images';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    // Get the user's ID from the JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    const body = await req.json().catch(() => ({}));
    const { name, description, style = 'fantasy' } = body;
    
    console.log('Received style parameter:', style);

    if (!name || !description) {
      return new Response(
        JSON.stringify({ 
          error: 'Name and description are required',
          details: 'Please provide both a name and description for the card image.'
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

    // Clean and format the description
    const sanitizedDesc = description.trim().replace(/[^\w\s.,!?-]/g, '');

    // Create a more direct and effective prompt for DALL-E 3
    let prompt = '';
    let openaiStyleParam = 'vivid'; // Default OpenAI style parameter
    
    console.log('Using art style:', style);
    
    // Simplified style approach
    switch(style) {
      case 'fantasy':
        prompt = `A high-quality fantasy illustration for a trading card game showing ${sanitizedDesc}. The image should have rich colors, dramatic lighting, and a magical atmosphere. No text or card frames.`;
        break;
      case 'photorealistic':
        prompt = `A photorealistic image for a trading card game showing ${sanitizedDesc}. The image should look like a professional photograph with natural lighting, realistic details, and cinematic composition. No text or card frames.`;
        openaiStyleParam = 'natural'; // Use natural for photorealistic
        break;
      case 'anime':
        prompt = `A high-quality anime-style illustration for a trading card game showing ${sanitizedDesc}. Use bold lines, vibrant colors, and stylized anime aesthetics. No text or card frames.`;
        break;
      case 'digital':
        prompt = `A modern digital art illustration for a trading card game showing ${sanitizedDesc}. Use contemporary digital art techniques with bold colors, creative effects, and a polished finish. No text or card frames.`;
        break;
      default:
        prompt = `A high-quality fantasy illustration for a trading card game showing ${sanitizedDesc}. The image should have rich colors, dramatic lighting, and a magical atmosphere. No text or card frames.`;
    }
    
    // Add a universal suffix to ensure quality and card-appropriate composition
    prompt += ' The artwork should be centered, well-composed, and suitable for a premium trading card game with a single clear subject.';
    
    console.log('Art style selected:', style);
    console.log('Using prompt approach:', style || 'fantasy (fallback)');

    try {
      // Note: 'style' here is OpenAI's parameter (vivid or natural), not our custom art style
      // Our custom art style is implemented through different prompt templates above
      console.log('Full prompt being sent to OpenAI:', prompt.substring(0, 100) + '...');  
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: openaiStyleParam, // Now dynamically set based on the selected style
        response_format: "url"
      });
      
      console.log(`OpenAI request sent with style parameter: ${openaiStyleParam}`);

      if (!response.data?.[0]?.url) {
        throw new Error('No image URL in OpenAI response');
      }

      // Download the image from OpenAI
      const imageResponse = await fetch(response.data[0].url);
      if (!imageResponse.ok) {
        throw new Error('Failed to download image from OpenAI');
      }

      const imageBlob = await imageResponse.blob();
      const fileName = `${user.id}/${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;

      // Check if bucket exists
      const { data: buckets } = await supabase
        .storage
        .listBuckets();

      // @ts-ignore: bucket type
const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);

      if (!bucketExists) {
        const { error: createBucketError } = await supabase
          .storage
          .createBucket(BUCKET_NAME, {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg'],
            fileSizeLimit: 5242880, // 5MB
          });

        if (createBucketError) {
          throw new Error(`Failed to create bucket: ${createBucketError.message}`);
        }
      }

      // Ensure user folder exists
      const userFolder = `${user.id}/`;
      await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(userFolder, new Blob(['']), {
          upsert: true
        });

      // Upload the image
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(fileName, imageBlob, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      if (!publicUrl) {
        throw new Error('Failed to get public URL for uploaded image');
      }

      return new Response(
        JSON.stringify({ imageUrl: publicUrl }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (openaiError) {
      // @ts-ignore: openaiError type
      console.error('OpenAI API error:', openaiError);
      
      // @ts-ignore: openaiError type
      if (openaiError && openaiError.status === 400) {
        return new Response(
          JSON.stringify({ 
            error: 'The image could not be generated. Please try a simpler description.',
            details: 'Avoid specific names, brands, or potentially inappropriate content.'
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          },
        );
      }
      
      throw openaiError;
    }
  } catch (error) {
    // @ts-ignore: error type
    console.error('Image generation error:', error);

    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate image',
        // @ts-ignore: error type
        details: error.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});