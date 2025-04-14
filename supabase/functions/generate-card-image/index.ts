import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import OpenAI from 'npm:openai@4.24.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET_NAME = 'card_images';

Deno.serve(async (req) => {
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
    const { name, description } = body;

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

    const prompt = `Create a high-quality digital illustration for a fantasy trading card game, inspired by Magic: The Gathering art style. The image should depict: ${sanitizedDesc}

    Key artistic elements:
    - Epic fantasy art style
    - Rich, vibrant colors
    - Dramatic lighting and shadows
    - Detailed character or scene design
    - Mystical/magical atmosphere
    - No text or card frames
    - Clean, professional composition
    - Focus on the main subject

    The artwork should be suitable for a premium trading card game.`;

    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid",
        response_format: "url"
      });

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

      const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);

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
      console.error('OpenAI API error:', openaiError);
      
      if (openaiError.status === 400) {
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
    console.error('Image generation error:', error);

    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate image',
        details: error.message
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