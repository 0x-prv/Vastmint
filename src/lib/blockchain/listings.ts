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

const FALLBACK_RPC_BATCH_SIZE = 25;
const FALLBACK_MAX_LISTING_READS = 250;

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
    return { listingId, seller, nftContract, tokenId, price, active, createdAt };
  }
  return listing as MarketplaceListing;
}

export async function fetchMarketplaceListings(
  publicClient: PublicClient,
  filter: ListingFilter = {}
): Promise<MarketplaceListing[]> {
  try {
    const result = await publicClient.readContract({
      ...marketplaceContract,
      functionName: "getActiveListings",
    });

    const seller = filter.seller?.toLowerCase();
    const nftContract = filter.nftContract?.toLowerCase();

    return (result as unknown[])
      .map((item) => normalizeListing(item as unknown as MarketplaceListing))
      .filter((listing) => listing.active)
      .filter((listing) => !seller || listing.seller.toLowerCase() === seller)
      .filter(
        (listing) =>
          !nftContract || listing.nftContract.toLowerCase() === nftContract
      );
  } catch {
    // Fallback sa old method kung hindi supported ang getActiveListings
    const nextListingId = await publicClient.readContract({
      ...marketplaceContract,
      functionName: "nextListingId",
    });

    if (nextListingId <= 1n) return [];

    const totalListings = Number(nextListingId - 1n);
    const listingReadCount = Math.min(totalListings, FALLBACK_MAX_LISTING_READS);
    const startListingId = totalListings - listingReadCount + 1;
    const listingIds = Array.from(
      { length: listingReadCount },
      (_, index) => BigInt(startListingId + index)
    );

    const results = [];
    for (
      let index = 0;
      index < listingIds.length;
      index += FALLBACK_RPC_BATCH_SIZE
    ) {
      const batch = listingIds.slice(index, index + FALLBACK_RPC_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (listingId) => {
          try {
            return await publicClient.readContract({
              ...marketplaceContract,
              functionName: "listings",
              args: [listingId],
            });
          } catch {
            return null;
          }
        })
      );
      results.push(...batchResults);
    }

    const seller = filter.seller?.toLowerCase();
    const nftContract = filter.nftContract?.toLowerCase();

    return results
      .flatMap((result) => {
        if (!result) return [];
        return [normalizeListing(result as unknown as MarketplaceListing)];
      })
      .filter((listing) => listing.active)
      .filter((listing) => !seller || listing.seller.toLowerCase() === seller)
      .filter(
        (listing) =>
          !nftContract || listing.nftContract.toLowerCase() === nftContract
      );
  }
}