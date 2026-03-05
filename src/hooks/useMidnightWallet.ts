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

// v4.0.0 DApp Connector API - Unified window.midnight provider
export const useMidnightWallet = () => {
  const [accountId, setAccountId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("idle");
  const [walletProviders, setWalletProviders] = useState<any>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      // v4.0.0 DApp Connector: Use window.midnight unified provider
      const midnight = (window as any).midnight;
      
      if (!midnight) {
        throw new Error("Midnight wallet not detected. Please install Midnight Lace extension.");
      }

      // Unified API: midnight.enable() returns the wallet API directly
      const api = await midnight.enable?.();
      if (!api) {
        // Fallback: try legacy lace pattern
        const lace = midnight.lace?.() || midnight.lacePreview?.();
        if (lace) {
          const legacyApi = await lace.enable?.() || await lace.connect?.();
          if (legacyApi) {
            await setupConnection(legacyApi);
            return;
          }
        }
        throw new Error("Wallet refused connection.");
      }

      await setupConnection(api);
    } catch (err: any) {
      console.error("Connection failed:", err);
      setStatus("error");
      throw err;
    }
  }, []);

  const setupConnection = async (api: any) => {
    // Get providers
    const providers = await api.getProviders?.() || await api.getProviders();
    if (!providers) {
      throw new Error("Failed to get wallet providers.");
    }

    // Get Bech32m address (un1... format)
    const shieldedAddrs = await api.getShieldedAddresses?.() || await api.getShieldedAddresses?.('default');
    let finalAddr = "";
    
    if (Array.isArray(shieldedAddrs)) {
      const first = shieldedAddrs[0];
      if (typeof first === 'string') {
        finalAddr = first;
      } else if (first?.address) {
        finalAddr = first.address;
      } else if (first?.shieldedAddress) {
        finalAddr = first.shieldedAddress;
      }
    } else if (shieldedAddrs?.address) {
      finalAddr = shieldedAddrs.address;
    } else if (shieldedAddrs?.shieldedAddress) {
      finalAddr = shieldedAddrs.shieldedAddress;
    }
    
    // Validate Bech32m format (un1...)
    if (finalAddr && !finalAddr.startsWith('un1') && !finalAddr.startsWith('mid')) {
      console.warn("Address may not be in Bech32m format:", finalAddr);
    }
    
    setAccountId(finalAddr);
    setWalletProviders(providers);
    setIsConnected(true);
    setStatus("connected");
  };

  return { 
    accountId, 
    isConnected, 
    status, 
    connect, 
    walletProviders
  };
};
