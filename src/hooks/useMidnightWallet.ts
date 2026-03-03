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
      if (typeof window === 'undefined' || !window.midnight) {
        setStatus("error");
        setError("Midnight wallet object not found on window.");
        alert("Midnight wallet not detected! Please install the Lace extension.");
        return;
      }

      // @ts-ignore
      const providers = Object.values(window.midnight);
      if (providers.length === 0) {
        setStatus("error");
        setError("Midnight wallet found, but no provider API is injected.");
        alert("Midnight wallet found, but no provider API is injected.");
        return;
      }

      const walletProvider = providers[0] as any;
      
      // 1. Use Midnight's .connect() method instead of .enable()
      const api = await walletProvider.connect();
      
      // 2. Use Midnight's shielded address method
      const addresses = await api.getShieldedAddresses();
      
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
