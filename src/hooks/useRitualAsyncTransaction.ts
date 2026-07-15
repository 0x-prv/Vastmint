"use client";

import { useCallback, useState } from "react";
import { encodeFunctionData, type Address } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { SECRET_ALLOWLIST_ABI, parseAllowlistEvent } from "@/lib/ritual/secretAllowlist";

export type RitualAsyncStatus = "idle" | "checking" | "submitting" | "waiting" | "resolved" | "not_allowlisted" | "failed";

export function useRitualAsyncTransaction() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState<RitualAsyncStatus>("idle");
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => { setStatus("idle"); setTxHash(undefined); setError(null); }, []);

  const verifyAllowlist = useCallback(async ({ contract, collection, executor }: { contract: Address; collection: Address; executor: Address }) => {
    if (!walletClient || !publicClient) throw new Error("Connect wallet first");
    setError(null);
    try {
      setStatus("submitting");
      const data = encodeFunctionData({ abi: SECRET_ALLOWLIST_ABI, functionName: "requestVerification", args: [collection, executor] });
      const hash = await walletClient.sendTransaction({ to: contract, data, gas: 2_000_000n, maxFeePerGas: 30_000_000_000n, maxPriorityFeePerGas: 2_000_000_000n });
      setTxHash(hash);
      setStatus("waiting");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Contract reverted");
      const event = parseAllowlistEvent(receipt.logs);
      if (event?.kind === "resolved") { setStatus(event.allowed ? "resolved" : "not_allowlisted"); return event; }
      if (event?.kind === "failed") throw new Error(event.reason);
      setStatus("resolved");
      return event;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ritual transaction failed";
      setError(message.includes("User rejected") || message.includes("rejected") ? "Transaction rejected by wallet." : message.includes("insufficient") || message.includes("RitualWallet") || message.includes("lock") ? "RitualWallet balance or lock is insufficient for async execution." : message);
      setStatus("failed");
      throw err;
    }
  }, [publicClient, walletClient]);

  return { status, txHash, error, verifyAllowlist, reset };
}
