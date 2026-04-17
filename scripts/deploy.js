const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const network = hre.network.name;
  console.log(`\n🎮 Deploying PIXELCHESS ChessWager to ${network}...\n`);

  const [deployer] = await ethers.getSigners();
  console.log(`📍 Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  const ChessWager = await ethers.getContractFactory("ChessWagerPvP");
  const contract = await ChessWager.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ ChessWager deployed at: ${address}`);
  console.log(`\n🔗 Basescan: https://basescan.org/address/${address}`);

  // Fund the bankroll (optional — 0.05 ETH initial bankroll)
  // Uncomment below if you want to fund on deploy:
  // const fundTx = await contract.fund({ value: ethers.parseEther("0.05") });
  // await fundTx.wait();
  // console.log("💸 Bankroll funded with 0.05 ETH");

  console.log("\n📋 Next steps:");
  console.log(`1. Add CONTRACT_ADDRESS=${address} to your .env`);
  console.log("2. Update frontend/js/config.js with the contract address");
  console.log("3. Verify on Basescan:");
  console.log(`   npx hardhat verify --network ${network} ${address}`);
  console.log("4. Fund the bankroll via fund() function");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
