const {
  ethers,
  RITUAL_WALLET,
  walletAbi,
  TEE_SERVICE_REGISTRY,
  HTTP_CAPABILITY,
  registryAbi,
} = require("./_config");

async function main() {
  const [signer] = await ethers.getSigners();

  const user =
    process.env.RITUAL_WALLET_USER || signer.address;

  const wallet = await ethers.getContractAt(
    walletAbi,
    RITUAL_WALLET,
  );

  const registry = await ethers.getContractAt(
    registryAbi,
    TEE_SERVICE_REGISTRY,
  );

  const currentBlock =
    await ethers.provider.getBlockNumber();

  const balance = await wallet.balanceOf(user);
  const lockUntil = await wallet.lockUntil(user);

  const services =
    await registry.getServicesByCapability(
      HTTP_CAPABILITY,
      true,
    );

  console.log(
    JSON.stringify(
      {
        user,
        currentBlock,
        balance: balance.toString(),
        lockUntil: lockUntil.toString(),
        requiredTtl:
          process.env.RITUAL_TTL || "100",
        executorAvailable: services.length > 0,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});