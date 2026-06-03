import type { AbiEvent, PublicClient } from "viem";
import { VASTMINT_NFT_ADDRESS } from "@/lib/blockchain/contracts";

const MAX_SAFE_LOG_BLOCK_RANGE = 50_000n;
const FALLBACK_LOG_LOOKBACK_BLOCKS = 99_999n;

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
};

const CONTRACT_DEPLOYMENT_BLOCKS: Record<string, bigint | undefined> = {
  [VASTMINT_NFT_ADDRESS.toLowerCase()]: undefined,
};

function getScanStartBlock(
  contractAddress: `0x${string}`,
  latestBlock: bigint
) {
  const configuredStart =
    CONTRACT_DEPLOYMENT_BLOCKS[contractAddress.toLowerCase()];
  if (configuredStart !== undefined) return configuredStart;

  return latestBlock > FALLBACK_LOG_LOOKBACK_BLOCKS
    ? latestBlock - FALLBACK_LOG_LOOKBACK_BLOCKS
    : 0n;
}

export async function getLogsInSafeChunks(
  publicClient: PublicClient,
  parameters: SafeGetLogsParameters
): Promise<SafeLog[]> {
  const latestBlock = await publicClient.getBlockNumber();
  const startBlock = getScanStartBlock(parameters.address, latestBlock);
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

    const chunkLogs = await publicClient.getLogs({
      ...parameters,
      fromBlock,
      toBlock,
    } as GetLogsParameters);

    logs.push(...(chunkLogs as unknown as SafeLog[]));
  }

  return logs;
}
