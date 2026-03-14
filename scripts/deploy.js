// Deploy script for SubtextNFT contract
const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment to Polygon Amoy testnet...\n");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.getBalance();
  console.log("💰 Account balance:", hre.ethers.utils.formatEther(balance), "MATIC\n");

  if (balance.isZero()) {
    console.error("❌ Error: Deployer account has no MATIC!");
    console.log("💡 Get test MATIC from: https://faucet.polygon.technology/");
    process.exit(1);
  }

  // Deploy SubtextNFT contract
  console.log("📝 Deploying SubtextNFT contract...");
  const SubtextNFT = await hre.ethers.getContractFactory("SubtextNFT");
  const nft = await SubtextNFT.deploy();

  await nft.deployed();

  console.log("✅ SubtextNFT deployed to:", nft.address);
  console.log("🔗 View on PolygonScan:", `https://amoy.polygonscan.com/address/${nft.address}`);
  
  // Wait for a few block confirmations
  console.log("\n⏳ Waiting for block confirmations...");
  await nft.deployTransaction.wait(5);
  console.log("✅ Confirmed!\n");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: nft.address,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    transactionHash: nft.deployTransaction.hash,
    blockNumber: nft.deployTransaction.blockNumber
  };

  console.log("📋 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎉 Deployment complete!");
  console.log("\n📌 Next steps:");
  console.log("1. Update your .env file:");
  console.log(`   EXPO_PUBLIC_NFT_CONTRACT_ADDRESS=${nft.address}`);
  console.log("\n2. Verify contract on PolygonScan:");
  console.log(`   npx hardhat verify --network polygon_amoy ${nft.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
