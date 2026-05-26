require("@nomicfoundation/hardhat-toolbox");

const PRIVATE_KEY = "4ce1c92b2d6de2bcd4e2dc9ef5bbcc647c20ad38b32a1028c1d19bfd6ce0adea";

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
    },
  },

  networks: {
    ritual: {
      url: "https://rpc.ritualfoundation.org",
      chainId: 1979,
      accounts: [PRIVATE_KEY],
    },
  },
};