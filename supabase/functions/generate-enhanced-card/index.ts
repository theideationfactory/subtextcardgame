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
    const {
      name,
      description,
      type,
      role,
      context,
      format = 'framed',
      size = '1024x1536', // Closest to 2.5:3.5 card ratio, OpenAI supported
      quality = 'auto'
    } = body;

    if (!name || !description) {
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

    // Build an enhanced prompt for premium card art - clean image without text overlays
    const labels: string[] = [];
    if (type) labels.push(`Type: ${type}`);
    if (role) labels.push(`Role: ${role}`);
    if (context) labels.push(`Context: ${context}`);

    const premiumPrompt = [
      `Create a premium trading card featuring "${name}" with ${description}.`,
      `Design as a complete trading card with integrated text elements in a fantasy card game style.`,
      `Include the title "${name}" prominently displayed at the top or bottom of the card.`,
      labels.length > 0 ? `Show these card attributes as elegant text labels: ${labels.join(', ')}.` : '',
      'Style: professional trading card illustration, cinematic lighting, rich colors, sharp details.',
      'Layout: portrait orientation, leave space for card name and attribute text integrated into the design.',
      'Quality: print-ready artwork suitable for collectible card game, similar to Magic: The Gathering or Pokémon cards.',
      'Include decorative borders, frames, or design elements that enhance the trading card aesthetic.'
    ].filter(Boolean).join(' ');

    const abortSignal = AbortSignal.timeout(120_000); // 2 minutes for gpt-image-1
    let imgResp;
    try {
      imgResp = await openai.images.generate(
        {
          model: 'gpt-image-1',
          prompt: premiumPrompt,
          n: 1,
          size,
          quality,
          user: user.id,
        },
        { signal: abortSignal },
      );
    } catch (err: any) {
      console.error('OpenAI API error (enhanced):', err);
      if (err?.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: 'OpenAI access denied',
            details: 'Please verify your OpenAI API key and organization settings.'
          }),
          {
            status: 403,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          },
        );
      }
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI request failed',
          details: err.message || String(err)
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    if (!imgResp.data?.[0]?.b64_json) {
      console.error('OpenAI response structure (enhanced):', JSON.stringify(imgResp, null, 2));
      throw new Error('No image data in OpenAI response');
    }

    // Convert base64 to binary data
    const base64Data = imgResp.data[0].b64_json;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: 'image/png' });
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const fileName = `${user.id}/${Date.now()}-enhanced-${safeName}.png`;

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    // @ts-ignore bucket type
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createBucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
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
    await supabase.storage.from(BUCKET_NAME).upload(userFolder, new Blob(['']), { upsert: true });

    // Upload the image
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .upload(fileName, imageBlob, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error (enhanced):', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
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
  } catch (error: any) {
    console.error('Enhanced image generation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate enhanced image',
        details: error?.message || 'Unknown error'
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
