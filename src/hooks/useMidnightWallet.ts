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
      // CRITICAL: Check window.midnight exists first to prevent crash
      const midnight = (window as any).midnight;
      
      if (!midnight || typeof midnight === 'undefined') {
        throw new Error("Midnight wallet not detected. Please install Midnight Lace extension.");
      }

      // v4.0.0: Access via window.midnight.mnLace
      const mnLace = midnight.mnLace;
      
      if (!mnLace || typeof mnLace === 'undefined') {
        throw new Error("Midnight Lace (mnLace) not found. Please ensure the v4.0.0 extension is installed.");
      }

      // Connect using the new unified method
      const api = await mnLace.connect('preprod');
      
      if (!api || typeof api === 'undefined') {
        throw new Error("Wallet connection failed. Please unlock your wallet and try again.");
      }

      // Get providers
      const providers = await api.getProviders();
      if (!providers) {
        throw new Error("Failed to retrieve wallet providers.");
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
      
      // Validate Bech32m format (un1...)
      if (finalAddr && !finalAddr.startsWith('un1') && !finalAddr.startsWith('mid')) {
        console.warn("Address may not be in standard Bech32m format:", finalAddr);
      }
      
      setAccountId(finalAddr);
      setWalletProviders(providers);
      setIsConnected(true);
      setStatus("connected");
    } catch (err: any) {
      console.error("Wallet connection error:", err);
      
      const errorMsg = (err?.message || '').toLowerCase();
      
      if (errorMsg.includes('rejected') || errorMsg.includes('cancelled') || errorMsg.includes('user')) {
        setStatus("rejected");
      } else if (errorMsg.includes('lock')) {
        setStatus("locked");
      } else if (errorMsg.includes('not detected') || errorMsg.includes('not found') || errorMsg.includes('not installed')) {
        setStatus("not-installed");
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
