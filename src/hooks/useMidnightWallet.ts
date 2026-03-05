import { useState, useCallback } from 'react';

export const getNetworkName = (id: number | null): string => {
  switch (id) {
    case 1: return 'Mainnet';
    case 2: return 'Testnet';
    case 3: return 'Devnet';
    default: return 'Unknown';
  }
};

export const isCorrectNetwork = (id: number | null, expected: number = 2): boolean => {
  return id === expected;
};

export const useMidnightWallet = () => {
  const [accountId, setAccountId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("idle");
  const [walletProviders, setWalletProviders] = useState<any>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      // v5.0.0 Wallet SDK pattern with optional chaining (guard against undefined)
      const midnight = (window as any).midnight;
      if (!midnight) {
        throw new Error("Midnight wallet not detected. Please install the Midnight Lace extension.");
      }
      
      // Try lacePreview first (Preview wallet), then lace, then any available
      // Use optional chaining to prevent crashes during lock/unlock
      const wallet = midnight.lacePreview?.() || midnight.lace?.() || Object.values(midnight || {})?.[0];
      if (!wallet) {
        throw new Error("No Midnight wallet found. Please ensure the extension is installed and unlocked.");
      }
      
      // Enable wallet connection (v5.0.0 pattern)
      const api = await wallet.enable?.() || await wallet.connect?.();
      if (!api) {
        throw new Error("Wallet refused connection.");
      }

      // Get providers (v5.0.0 modular architecture)
      const providers = await api.getProviders?.() || await api.getProviders();
      if (!providers) {
        throw new Error("Failed to get wallet providers.");
      }

      // Get addresses - handle both old and new API patterns
      const shieldedAddrs = await api.getShieldedAddresses?.() || await api.getShieldedAddresses?.('default');
      let finalAddr = "";
      
      if (Array.isArray(shieldedAddrs)) {
        const first = shieldedAddrs[0];
        // Handle various return formats
        if (typeof first === 'string') {
          finalAddr = first;
        } else if (first?.address) {
          finalAddr = first.address;
        } else if (first?.shieldedAddress) {
          finalAddr = first.shieldedAddress;
        }
      } else if (typeof shieldedAddrs === 'object' && shieldedAddrs !== null) {
        finalAddr = shieldedAddrs.address || shieldedAddrs.shieldedAddress || String(shieldedAddrs);
      } else if (shieldedAddrs) {
        finalAddr = String(shieldedAddrs);
      }
      
      if (!finalAddr) {
        throw new Error("No valid address returned from wallet.");
      }
      
      setAccountId(finalAddr);
      setWalletProviders(providers);
      setIsConnected(true);
      setStatus("connected");
    } catch (err: any) {
      console.error("Connection failed:", err);
      setStatus("error");
      throw err;
    }
  }, []);

  return { 
    accountId, 
    isConnected, 
    status, 
    connect, 
    walletProviders
  };
};
