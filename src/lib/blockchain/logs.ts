import type { AbiEvent, PublicClient } from "viem";
import {
  VASTMINT_NFT_ADDRESS,
  VASTMINT_FACTORY_ADDRESS,
} from "@/lib/blockchain/contracts";

const MAX_SAFE_LOG_BLOCK_RANGE = 50_000n;

type GetLogsParameters = Parameters<PublicClient["getLogs"]>[0];

export type SafeLog = {
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
  transactionHash?: `0x${string}` | null;
};

type SafeGetLogsParameters = {
  address: `0x${string}`;
  event: AbiEvent;
  args?: Record<string, unknown>;
  fromBlock?: bigint;
};

// Deployment blocks para sa known contracts.
// Kung undefined — mag-scan mula block 0 (safe para sa testnet).
// I-update mo ang values kapag alam na ang exact deployment blocks.

const CONTRACT_DEPLOYMENT_BLOCKS: Record<string, bigint | undefined> = {
  [VASTMINT_NFT_ADDRESS.toLowerCase()]: 27_000_000n,
  [VASTMINT_FACTORY_ADDRESS.toLowerCase()]: 27_000_000n,
};

function getScanStartBlock(
  contractAddress: `0x${string}`,
): bigint {
  const configured = CONTRACT_DEPLOYMENT_BLOCKS[contractAddress.toLowerCase()];
  // Kung may configured deployment block — gamitin yun
  // Kung wala — mula block 0 para hindi mawala ang lumang NFTs
  return configured ?? 27_000_000n;
}

export async function getLogsInSafeChunks(
  publicClient: PublicClient,
  parameters: SafeGetLogsParameters
): Promise<SafeLog[]> {
  const latestBlock = await publicClient.getBlockNumber();

  // Pwedeng i-override ang fromBlock kung kailangan
  const startBlock = parameters.fromBlock ?? getScanStartBlock(parameters.address);

  const logs: SafeLog[] = [];

  for (
    let fromBlock = startBlock;
    fromBlock <= latestBlock;
    fromBlock += MAX_SAFE_LOG_BLOCK_RANGE + 1n
  ) {
    const toBlock =
      fromBlock + MAX_SAFE_LOG_BLOCK_RANGE > latestBlock
        ? latestBlock
        : fromBlock + MAX_SAFE_LOG_BLOCK_RANGE;

    try {
      const chunkLogs = await publicClient.getLogs({
        ...parameters,
        fromBlock,
        toBlock,
      } as GetLogsParameters);

      logs.push(...(chunkLogs as unknown as SafeLog[]));
    } catch (err) {
      // Skip failed chunk — hindi natin gusto na mag-crash ang buong scan
      console.warn(`Log scan failed for blocks ${fromBlock}-${toBlock}:`, err);
    }
  }

  return logs;
}