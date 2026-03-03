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
        setError("Midnight wallet object not found.");
        alert("Midnight wallet not detected! Please install the Lace extension.");
        return;
      }

      // @ts-ignore
      const providers = Object.values(window.midnight);
      if (providers.length === 0) {
        setStatus("error");
        setError("No provider API found.");
        return;
      }

      const walletProvider = providers[0] as any;
      
      let api;
      try {
        // The Midnight API REQUIRES a network string.
        api = await walletProvider.connect('TestNet');
      } catch (e1) {
        try {
          api = await walletProvider.connect('preview');
        } catch (e2) {
          api = await walletProvider.connect('undeployed');
        }
      }
      
      if (!api) {
        alert("Wallet connection rejected. Check Lace network settings.");
        return;
      }

      // Midnight's shielded addresses are returned as an object, not an array
      const addresses = await api.getShieldedAddresses();
      
      if (addresses && addresses.shieldedAddress) {
        setAccountId(addresses.shieldedAddress);
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
