const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const HTTP = "0x0000000000000000000000000000000000000801";
const SECRETS = "0xf9BF1BC8A3e79B9EBeD0fa2Db70D0513fecE32FD";
const HASH = "0x" + "11".repeat(32);

function response(status, body, error = "") {
  const actual = ethers.AbiCoder.defaultAbiCoder().encode(["tuple(uint16 statusCode,string[] headerKeys,string[] headerValues,bytes body,string errorMessage)"], [[status, [], [], body, error]]);
  return ethers.AbiCoder.defaultAbiCoder().encode(["bytes", "bytes"], ["0x", actual]);
}

describe("VastMintSecretAllowlist", function () {
  async function fixture() {
    const [owner, creator, user, other] = await ethers.getSigners();
    const NFT = await ethers.getContractFactory("VastMintNFT");
    const nft = await NFT.deploy("Test", "TST", "desc", "", "", 100, 0, 0, 0, ethers.ZeroHash, creator.address);
    const Allow = await ethers.getContractFactory("VastMintSecretAllowlist");
    const allow = await Allow.deploy([await nft.factory()]);
    await network.provider.send("hardhat_setCode", [SECRETS, "0x600160005260206000f3"]); // placeholder, real suite should mock checkAccess ABI
    return { owner, creator, user, other, nft, allow };
  }

  it("rejects unauthorized configuration", async function () {
    const { other, nft, allow } = await fixture();
    await expect(allow.connect(other).configureAllowlist(await nft.getAddress(), "cid", HASH, other.address, "https://vastmint.vercel.app/api/allowlist/verify", true, 60, [], [])).to.be.revertedWith("Not collection authority");
  });

  it("allows collection owner configuration and version invalidation", async function () {
    const { creator, nft, allow } = await fixture();
    await expect(allow.connect(creator).configureAllowlist(await nft.getAddress(), "cid", HASH, creator.address, "https://vastmint.vercel.app/api/allowlist/verify", true, 60, [], [])).to.emit(allow, "AllowlistConfigured");
    let cfg = await allow.collectionAllowlist(await nft.getAddress());
    expect(cfg.configured).to.equal(true);
    await allow.connect(creator).setActive(await nft.getAddress(), false);
    cfg = await allow.collectionAllowlist(await nft.getAddress());
    expect(cfg.active).to.equal(false);
    expect(cfg.version).to.equal(2n);
  });

  it("decodes fulfilled replay and bool body", async function () {
    const { allow } = await fixture();
    const body = ethers.AbiCoder.defaultAbiCoder().encode(["bool"], [true]);
    const out = await allow.decodeFulfilledReplay(response(200, body));
    const resp = await allow.decodeHTTPOutput(out);
    expect(resp.statusCode).to.equal(200n);
    expect(await allow.decodeBoolBody(resp.body)).to.equal(true);
  });

  it("rejects malformed wrapper, HTTP output, and bool body", async function () {
    const { allow } = await fixture();
    await expect(allow.decodeFulfilledReplay("0x1234")).to.be.reverted;
    await expect(allow.decodeHTTPOutput("0x1234")).to.be.reverted;
    await expect(allow.decodeBoolBody("0x1234")).to.be.reverted;
  });
});
