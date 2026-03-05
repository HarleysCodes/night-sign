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

// v4.0.0 DApp Connector - window.midnight.mnLace
export const useMidnightWallet = () => {
  const [accountId, setAccountId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("idle");
  const [walletProviders, setWalletProviders] = useState<any>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      // Check window.midnight exists first
      const midnight = (window as any).midnight;
      
      if (!midnight) {
        throw new Error("Midnight wallet not detected. Please install Midnight Lace.");
      }

      // v4.0.0: Access via window.midnight.mnLace
      const mnLace = midnight.mnLace;
      
      if (!mnLace) {
        throw new Error("Midnight Lace not found. Please ensure the extension is installed.");
      }

      // Connect using v4.0.0 method
      const api = await mnLace.connect('preprod');
      
      if (!api) {
        throw new Error("Wallet refused connection.");
      }

      // Get providers
      const providers = await api.getProviders();
      if (!providers) {
        throw new Error("Failed to get wallet providers.");
      }

      // Get Bech32m address (un1... format)
      const shieldedAddrs = await api.getShieldedAddresses();
      let finalAddr = "";
      
      if (Array.isArray(shieldedAddrs)) {
        const first = shieldedAddrs[0];
        finalAddr = typeof first === 'string' ? first : (first?.address || first?.shieldedAddress || "");
      } else if (shieldedAddrs?.address) {
        finalAddr = shieldedAddrs.address;
      } else if (shieldedAddrs?.shieldedAddress) {
        finalAddr = shieldedAddrs.shieldedAddress;
      }
      
      // Validate Bech32m format
      if (finalAddr && !finalAddr.startsWith('un1') && !finalAddr.startsWith('mid')) {
        console.warn("Address not in standard Bech32m format:", finalAddr);
      }
      
      setAccountId(finalAddr);
      setWalletProviders(providers);
      setIsConnected(true);
      setStatus("connected");
    } catch (err: any) {
      console.error("Connection failed:", err);
      const msg = (err?.message || '').toLowerCase();
      
      if (msg.includes('rejected') || msg.includes('cancelled')) {
        setStatus("rejected");
      } else if (msg.includes('lock')) {
        setStatus("locked");
      } else {
        setStatus("error");
      }
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
