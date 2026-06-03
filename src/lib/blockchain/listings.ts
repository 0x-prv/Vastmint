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

  const results = await Promise.all(
    listingIds.map(async (listingId) => {
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

import { parseAbiItem } from "viem";

type SafeChunkParams = {
  address: `0x${string}`;
  event: ReturnType<typeof parseAbiItem>;
  args?: Record<string, unknown>;
  fromBlock?: bigint;
};

export async function getLogsInSafeChunks(
  publicClient: PublicClient,
  params: SafeChunkParams
) {
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock =
    params.fromBlock ??
    (latestBlock > 99_999n ? latestBlock - 99_999n : 0n);

  const chunkSize = 2_000n;
  const allLogs: unknown[] = [];

  for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
    const end =
      start + chunkSize - 1n > latestBlock
        ? latestBlock
        : start + chunkSize - 1n;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logs = await (publicClient as any).getLogs({
        address: params.address,
        event: params.event,
        args: params.args,
        fromBlock: start,
        toBlock: end,
      });
      allLogs.push(...logs);
    } catch {
      // skip failed chunk
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return allLogs as any[];
}