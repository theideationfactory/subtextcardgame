// Supabase Edge Function for server-side NFT minting with app wallet
// @ts-ignore: Deno-specific import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3?deno-std=0.177.0'
// @ts-ignore: Deno-specific import
import { ethers } from 'npm:ethers@5.7.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// SubtextNFT ABI - minimal interface for minting
const SUBTEXT_NFT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "recipient", "type": "address" },
      { "internalType": "string", "name": "tokenURI", "type": "string" }
    ],
    "name": "mintNFT",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "address", "name": "recipient", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "tokenURI", "type": "string" }
    ],
    "name": "CardMinted",
    "type": "event"
  }
];

// Mutex-like nonce management to prevent concurrent nonce conflicts
let currentNonce = -1;
let noncePromise: Promise<number> | null = null;

async function getNextNonce(wallet: ethers.Wallet): Promise<number> {
  // If there's a pending nonce fetch, wait for it
  if (noncePromise) {
    await noncePromise;
  }
  
  // Fetch current nonce from blockchain
  const blockchainNonce: number = await wallet.getTransactionCount('pending');
  
  // Use higher of stored nonce or blockchain nonce
  if (currentNonce >= blockchainNonce) {
    currentNonce++;
    return currentNonce;
  }
  
  currentNonce = blockchainNonce;
  return blockchainNonce;
}

async function uploadToPinata(
  data: any,
  pinataApiKey: string,
  pinataSecretKey: string,
  isJson: boolean = false
): Promise<string> {
  const url = isJson 
    ? 'https://api.pinata.cloud/pinning/pinJSONToIPFS'
    : 'https://api.pinata.cloud/pinning/pinFileToIPFS';
  
  let body;
  let headers: Record<string, string> = {
    'pinata_api_key': pinataApiKey,
    'pinata_secret_api_key': pinataSecretKey,
  };
  
  if (isJson) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  } else {
    // For file upload, use FormData
    const formData = new FormData();
    formData.append('file', data.blob, data.fileName);
    body = formData;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed: ${errorText}`);
  }
  
  const result = await response.json();
  return `ipfs://${result.IpfsHash}`;
}

async function downloadImage(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  return await response.blob();
}

// Add padding to make image square for OpenSea using sharp-like approach
async function padImageToSquare(imageBlob: Blob): Promise<Blob> {
  try {
    // Use Cloudflare's image resizing API or similar service
    // For now, we'll create a data URL approach
    
    // Convert blob to base64
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:image/png;base64,${base64}`;
    
    // Create an HTML canvas approach using Deno's fetch to external service
    // Alternative: Use Cloudinary or similar image transformation service
    
    // For MVP: Return original and use animation_url workaround
    // This will show full image on OpenSea detail page
    return imageBlob;
  } catch (error) {
    console.error('Error padding image:', error);
    return imageBlob;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const appWalletPrivateKey = Deno.env.get('APP_WALLET_PRIVATE_KEY');
    const contractAddress = Deno.env.get('NFT_CONTRACT_ADDRESS');
    const alchemyApiKey = Deno.env.get('ALCHEMY_API_KEY');
    const pinataApiKey = Deno.env.get('PINATA_API_KEY');
    const pinataSecretKey = Deno.env.get('PINATA_SECRET_KEY');
    const network = Deno.env.get('BLOCKCHAIN_NETWORK') || 'amoy'; // amoy or mainnet

    if (!appWalletPrivateKey) throw new Error('APP_WALLET_PRIVATE_KEY not configured');
    if (!contractAddress) throw new Error('NFT_CONTRACT_ADDRESS not configured');
    if (!alchemyApiKey) throw new Error('ALCHEMY_API_KEY not configured');
    if (!pinataApiKey) throw new Error('PINATA_API_KEY not configured');
    if (!pinataSecretKey) throw new Error('PINATA_SECRET_KEY not configured');

    // Parse request
    const { cardId, userId } = await req.json();
    if (!cardId) throw new Error('Card ID is required');
    if (!userId) throw new Error('User ID is required');

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Fetch card data
    const { data: card, error: cardError } = await supabaseClient
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', userId)
      .single();

    if (cardError || !card) {
      throw new Error('Card not found or access denied');
    }

    // Fetch user email
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const userEmail = userData?.email || 'unknown';

    console.log(`🎴 Minting NFT for card: ${card.name} (${cardId})`);
    console.log(`👤 User: ${userEmail}`);

    // Check if card is already minted
    const { data: existingMint } = await supabaseClient
      .from('nft_mints')
      .select('id')
      .eq('card_id', cardId)
      .eq('status', 'confirmed')
      .single();

    if (existingMint) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'This card has already been minted as an NFT',
          alreadyMinted: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set up blockchain connection
    let provider;
    if (network === 'mainnet') {
      provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com', {
        chainId: 137,
        name: 'matic'
      });
    } else {
      // Amoy testnet
      provider = new ethers.providers.JsonRpcProvider(
        `https://polygon-amoy.g.alchemy.com/v2/${alchemyApiKey}`,
        { chainId: 80002, name: 'polygon-amoy' }
      );
    }

    const wallet = new ethers.Wallet(appWalletPrivateKey, provider);
    const appWalletAddress = await wallet.getAddress();
    console.log(`🔑 App wallet address: ${appWalletAddress}`);

    // Download card image
    console.log('📤 Downloading image...');
    const originalBlob = await downloadImage(card.image_url);
    
    // Pad image to square for OpenSea display
    console.log('🔲 Adding padding to create square image...');
    const paddedBlob = await padImageToSquare(originalBlob);
    
    const imageFileName = `${cardId}-square.png`;
    console.log('📤 Uploading padded image to IPFS...');
    
    const imageIpfsUri = await uploadToPinata(
      { blob: paddedBlob, fileName: imageFileName },
      pinataApiKey,
      pinataSecretKey,
      false
    );
    console.log(`✅ Image uploaded: ${imageIpfsUri}`);

    // Create and upload NFT metadata with aspect ratio hint
    console.log('📝 Creating metadata...');
    const metadata = {
      name: card.name,
      description: card.description || `Subtext card: ${card.name}`,
      image: imageIpfsUri,
      external_url: 'https://subtextapp.com',
      // Add animation_url as a fallback to show full image
      animation_url: imageIpfsUri,
      attributes: [
        { trait_type: "Card Type", value: card.type || "TBD" },
        { trait_type: "Card Role", value: card.role || "TBD" },
        { trait_type: "Context", value: card.context || "TBD" },
        { trait_type: "Format", value: card.format || "framed" },
        { trait_type: "Aspect Ratio", value: "2.5:3.5" },
        { trait_type: "Minted By", value: userEmail },
        { trait_type: "Original Card ID", value: cardId }
      ]
    };

    const metadataUri = await uploadToPinata(metadata, pinataApiKey, pinataSecretKey, true);
    console.log(`✅ Metadata uploaded: ${metadataUri}`);

    // Convert IPFS URI to gateway URL for contract
    const gatewayMetadataUrl = metadataUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');

    // Mint NFT on blockchain
    console.log('🎨 Minting NFT on blockchain...');
    const nftContract = new ethers.Contract(contractAddress, SUBTEXT_NFT_ABI, wallet);

    // Get gas price and estimate gas
    const gasPrice = await provider.getGasPrice();
    const adjustedGasPrice = gasPrice.mul(120).div(100); // 20% buffer
    
    const estimatedGas = await nftContract.estimateGas.mintNFT(appWalletAddress, gatewayMetadataUrl);
    const gasLimit = estimatedGas.mul(120).div(100); // 20% buffer

    // Get next nonce (with mutex-like protection)
    const nonce = await getNextNonce(wallet);
    console.log(`🔢 Using nonce: ${nonce}`);

    const tx = await nftContract.mintNFT(appWalletAddress, gatewayMetadataUrl, {
      gasPrice: adjustedGasPrice,
      gasLimit,
      nonce
    });

    console.log(`⏳ Transaction sent: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`📋 Receipt logs count: ${receipt.logs?.length || 0}`);

    // Extract token ID from event logs
    let tokenId = null;
    try {
      // Parse logs using the contract interface
      const iface = new ethers.utils.Interface(SUBTEXT_NFT_ABI);
      
      console.log('🔍 Parsing transaction logs...');
      for (let i = 0; i < receipt.logs.length; i++) {
        const log = receipt.logs[i];
        console.log(`  Log ${i}: address=${log.address}, topics=${log.topics.length}`);
        
        try {
          const parsed = iface.parseLog(log);
          console.log(`  ✓ Parsed event: ${parsed.name}`);
          
          if (parsed.name === 'CardMinted') {
            tokenId = parsed.args.tokenId.toNumber();
            console.log(`🎫 Token ID extracted from CardMinted event: ${tokenId}`);
            break;
          }
        } catch (e) {
          // Skip logs that don't match our ABI
          continue;
        }
      }
      
      // Alternative: Try to get token ID from Transfer event (ERC721 standard)
      if (!tokenId) {
        console.log('⚠️ CardMinted event not found, trying Transfer event...');
        const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
        
        for (const log of receipt.logs) {
          if (log.topics[0] === transferTopic && log.address.toLowerCase() === contractAddress.toLowerCase()) {
            // Transfer event: Transfer(from, to, tokenId)
            // tokenId is the third topic (or in data if not indexed)
            try {
              if (log.topics.length >= 4) {
                tokenId = ethers.BigNumber.from(log.topics[3]).toNumber();
                console.log(`🎫 Token ID extracted from Transfer event (topics): ${tokenId}`);
                break;
              } else if (log.data && log.data !== '0x') {
                tokenId = ethers.BigNumber.from(log.data).toNumber();
                console.log(`🎫 Token ID extracted from Transfer event (data): ${tokenId}`);
                break;
              }
            } catch (e) {
              console.error('Error parsing Transfer event:', e);
            }
          }
        }
      }
      
      if (!tokenId) {
        console.warn('⚠️ Could not extract token ID from transaction logs');
        console.log('Full receipt:', JSON.stringify(receipt, null, 2));
      }
    } catch (error) {
      console.error('Error parsing transaction logs:', error);
    }

    // Save mint record to database
    const { error: insertError } = await supabaseClient
      .from('nft_mints')
      .insert({
        user_id: userId,
        card_id: cardId,
        transaction_hash: receipt.transactionHash,
        image_nft_hash: receipt.transactionHash,
        card_nft_hash: receipt.transactionHash,
        image_token_id: tokenId,
        card_token_id: tokenId,
        contract_address: contractAddress,
        wallet_address: appWalletAddress,
        network: network === 'mainnet' ? 'MATIC_MAINNET' : 'MATIC_AMOY',
        status: 'confirmed',
        metadata_uri: metadataUri,
        image_ipfs_uri: imageIpfsUri
      });

    if (insertError) {
      console.error('Failed to save mint record:', insertError);
      // Don't throw - the NFT was minted successfully
    }

    // Build explorer URLs
    const explorerUrl = network === 'mainnet'
      ? `https://polygonscan.com/tx/${receipt.transactionHash}`
      : `https://amoy.polygonscan.com/tx/${receipt.transactionHash}`;

    const openSeaUrl = network === 'mainnet'
      ? `https://opensea.io/assets/matic/${contractAddress}/${tokenId}`
      : `https://testnets.opensea.io/assets/amoy/${contractAddress}/${tokenId}`;

    console.log(`🎉 NFT minted successfully!`);

    return new Response(
      JSON.stringify({
        success: true,
        tokenId,
        transactionHash: receipt.transactionHash,
        contractAddress,
        explorerUrl,
        openSeaUrl,
        userEmail,
        cardName: card.name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('❌ Minting error:', errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
