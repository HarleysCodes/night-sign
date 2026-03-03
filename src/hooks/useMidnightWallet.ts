import { useState, useCallback } from 'react';

export const useMidnightWallet = () => {
  const [accountId, setAccountId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [networkId] = useState<number | null>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    
    try {
      // @ts-ignore
      if (typeof window === 'undefined' || !window.midnight || !window.midnight.mnl) {
        setStatus("error");
        setError("Midnight Lace wallet extension not detected!");
        alert("Midnight Lace wallet extension not detected! Please install and unlock it.");
        return;
      }

      // @ts-ignore
      const api = await window.midnight.mnl.enable();
      const addresses = await api.state?.getUsedAddresses() || await api.getUsedAddresses();
      
      if (addresses && addresses.length > 0) {
        setAccountId(addresses[0]);
        setIsConnected(true);
        setStatus("connected");
      } else {
        setStatus("error");
        setError("No addresses found");
      }
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Connection failed");
      alert("Wallet connection rejected or failed.");
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getNetworkName = useCallback((id: number | null) => {
    if (id === 1) return "Mainnet";
    if (id === 2) return "Testnet";
    if (id === 3) return "Devnet";
    return "Unknown";
  }, []);

  const isCorrectNetwork = useCallback((id: number | null, expected: number) => {
    return id === expected;
  }, []);

  return { 
    accountId, 
    isConnected,
    status,
    error,
    networkId,
    connect,
    clearError,
    getNetworkName,
    isCorrectNetwork
  };
};
