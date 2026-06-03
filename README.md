# VastMint

A Ritual-native NFT launchpad and marketplace built on Ritual Testnet.

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Web3**: Wagmi v2, Viem v2, RainbowKit
- **Chain**: Ritual Testnet (Chain ID 1979)
- **Contracts**: Solidity 0.8.28, Hardhat, OpenZeppelin
- **Storage**: Pinata IPFS

## Getting Started

### 1. Install dependencies

npm install

### 2. Set up environment variables

cp .env.example .env.local

Fill in the required values in .env.local

### 3. Run the development server

npm run dev

Open http://localhost:3000 to view the app.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| PINATA_JWT | Yes | Pinata API JWT for IPFS uploads |
| NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID | Yes | WalletConnect project ID |
| PRIVATE_KEY | For deployment | Wallet private key for Hardhat deploy |
| RITUAL_RPC_URL | No | Defaults to https://rpc.ritualfoundation.org |
| NEXT_PUBLIC_MARKETPLACE_ADDRESS | No | Override default marketplace address |

## Smart Contracts

Deployed on Ritual Testnet (Chain ID 1979):

| Contract | Address |
|----------|---------|
| VastMintNFT | 0x8EBa1c8A529F71e08CB23C0Cda9606eaA1Ac7067 |
| VastMintFactory | 0x5b36c10990e7bAE1f9b92759600e3385058DfC44 |
| VastMintMarketplace | 0x35CFdfD9D7372510Ff26876a5675754A7c343bf6 |

## Scripts

npm run dev        # Start dev server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint

## Contract Deployment

npx hardhat run scripts/deployFactory.js --network ritual
npx hardhat run scripts/deployMarketplace.js --network ritual