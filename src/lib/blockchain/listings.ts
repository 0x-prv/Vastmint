import type { PublicClient } from "viem";
import { VASTMINT_MARKETPLACE_ABI } from "@/lib/blockchain/abi";
import { VASTMINT_MARKETPLACE_ADDRESS } from "@/lib/blockchain/contracts";

export type MarketplaceListing = {
  listingId: bigint;
  seller: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  price: bigint;
  active: boolean;
  createdAt: bigint;
};

type ListingFilter = {
  seller?: `0x${string}`;
  nftContract?: `0x${string}`;
};

const marketplaceContract = {
  address: VASTMINT_MARKETPLACE_ADDRESS as `0x${string}`,
  abi: VASTMINT_MARKETPLACE_ABI,
} as const;

function normalizeListing(
  listing:
    | readonly [
        bigint,
        `0x${string}`,
        `0x${string}`,
        bigint,
        bigint,
        boolean,
        bigint
      ]
    | MarketplaceListing
): MarketplaceListing {
  if (Array.isArray(listing)) {
    const [listingId, seller, nftContract, tokenId, price, active, createdAt] =
      listing;
    return {
      listingId,
      seller,
      nftContract,
      tokenId,
      price,
      active,
      createdAt,
    };
  }

  return listing as MarketplaceListing;
}

export async function fetchMarketplaceListings(
  publicClient: PublicClient,
  filter: ListingFilter = {}
): Promise<MarketplaceListing[]> {
  const nextListingId = await publicClient.readContract({
    ...marketplaceContract,
    functionName: "nextListingId",
  });

  if (nextListingId <= 1n) return [];

  const listingIds = Array.from(
    { length: Number(nextListingId - 1n) },
    (_, index) => BigInt(index + 1)
  );

  const results = await publicClient.multicall({
    contracts: listingIds.map((listingId) => ({
      ...marketplaceContract,
      functionName: "listings",
      args: [listingId],
    })),
    allowFailure: true,
  });

  const seller = filter.seller?.toLowerCase();
  const nftContract = filter.nftContract?.toLowerCase();

  return results
    .flatMap((result) => {
      if (result.status !== "success") return [];
      return [normalizeListing(result.result as unknown as MarketplaceListing)];
    })
    .filter((listing) => listing.active)
    .filter((listing) => !seller || listing.seller.toLowerCase() === seller)
    .filter(
      (listing) =>
        !nftContract || listing.nftContract.toLowerCase() === nftContract
    );
}
