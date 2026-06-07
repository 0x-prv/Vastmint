/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const PRIVATE_KEY = process.env.PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 50,
      },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    ritual: {
      url: process.env.RITUAL_RPC_URL ?? "https://rpc.ritualfoundation.org",
      chainId: 1979,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};