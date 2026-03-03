import { useState, useCallback, useRef } from 'react';
import { createProof } from '../managed/contracts';

export const useMidnightWallet = () => {
  const [accountId, setAccountId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [networkId] = useState<number | null>(null);
  const apiRef = useRef<any>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    
    try {
      // @ts-ignore
      if (typeof window === 'undefined' || !window.midnight) throw new Error("No window.midnight object");
      // @ts-ignore
      const providers = Object.values(window.midnight);
      if (providers.length === 0) throw new Error("No providers found in window.midnight");

      const wallet = providers[0] as any;
      let api;
      
      if (typeof wallet.connect === 'function') {
        try { api = await wallet.connect('preprod'); }
        catch (e0) { try { api = await wallet.connect('preview'); } catch (e1) { try { api = await wallet.connect('undeployed'); } catch (e2) { try { api = await wallet.connect('TestNet'); } catch (e3) { throw new Error("All network connect() attempts rejected."); } } } }
      } else if (typeof wallet.enable === 'function') {
        api = await wallet.enable();
      } else {
        api = wallet;
      }
      
      if (!api) throw new Error("API object is null after connection.");
      apiRef.current = api;

      let addresses;
      if (typeof api.getShieldedAddresses === 'function') {
        addresses = await api.getShieldedAddresses();
      } else if (typeof api.state === 'function') {
        const state = await api.state();
        addresses = state.address;
      } else {
        throw new Error("No valid address function found on API.");
      }

      if (Array.isArray(addresses) && addresses.length > 0) setAccountId(addresses[0]);
      else if (addresses && addresses.shieldedAddress) setAccountId(addresses.shieldedAddress);
      else if (typeof addresses === 'string') setAccountId(addresses);
      else throw new Error("Could not parse address: " + JSON.stringify(addresses));
      
      setIsConnected(true);
      setStatus("connected");
    } catch (err: any) {
      console.error("Wallet connection failed:", err);
      setStatus("error");
      setError(err?.message || JSON.stringify(err));
      alert("Connection Error: " + (err?.message || JSON.stringify(err)));
    }
  }, []);

  // Sign using the contract - generates ZK proof then submits
  const submitTransaction = useCallback(async (circuitName: string, documentHash: string): Promise<string | null> => {
    if (!apiRef.current || !accountId) {
      alert("Wallet not connected. Please connect first.");
      return null;
    }

    try {
      // 1. Generate ZK proof locally using the contract bindings
      const zkProof = await createProof(documentHash, accountId);
      
      // 2. Submit to wallet for final approval
      const tx = await apiRef.current.submitTransaction({
        contract: "document_signer",
        method: circuitName,
        proof: zkProof.proof,
        publicSignals: zkProof.publicSignals,
        from: accountId,
      });
      
      return tx?.id || tx?.txId || "tx_" + Date.now();
    } catch (err: any) {
      console.error("Transaction failed:", err);
      alert("Transaction Error: " + (err?.message || JSON.stringify(err)));
      return null;
    }
  }, [accountId]);

  const clearError = useCallback(() => setError(null), []);

  const getNetworkName = useCallback((id: number | null) => {
    if (id === 1) return "Mainnet";
    if (id === 2) return "Testnet";
    if (id === 3) return "Devnet";
    return "Unknown";
  }, []);

  const isCorrectNetwork = useCallback((id: number | null, expected: number) => id === expected, []);

  return { 
    accountId, isConnected, status, error, networkId, 
    connect, submitTransaction, clearError, getNetworkName, isCorrectNetwork 
  };
};
