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

// v4.0.0 DApp Connector - Flexible wallet detection
export const useMidnightWallet = () => {
  const [accountId, setAccountId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState("idle");
  const [walletProviders, setWalletProviders] = useState<any>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    try {
      const midnight = (window as any).midnight;
      
      if (!midnight) {
        throw new Error("Midnight wallet not detected. Please install Midnight Lace extension.");
      }

      // Try multiple patterns to find the wallet
      let wallet = null;
      let walletName = "";
      
      // Pattern 1: window.midnight.mnLace (v4.0.0)
      if (midnight.mnLace) {
        wallet = midnight.mnLace;
        walletName = "mnLace";
      }
      // Pattern 2: window.midnight.lace (legacy)
      else if (midnight.lace) {
        wallet = midnight.lace;
        walletName = "lace";
      }
      // Pattern 3: window.lace (direct)
      else if ((window as any).lace) {
        wallet = (window as any).lace;
        walletName = "window.lace";
      }
      // Pattern 4: Any value in midnight object
      else if (typeof midnight === 'object') {
        const values = Object.values(midnight);
        if (values.length > 0) {
          wallet = values[0];
          walletName = "midnight[0]";
        }
      }
      
      if (!wallet) {
        throw new Error("Midnight Lace not found. Please ensure the extension is installed and unlocked.");
      }

      console.log("Detected wallet via:", walletName);

      // Connect - try both patterns
      let api = null;
      try {
        // Try .connect() first
        api = await wallet.connect('preprod');
      } catch (e) {
        // Try .enable() as fallback
        try {
          api = await wallet.enable();
        } catch (e2) {
          throw new Error("Wallet connection failed. Please unlock your wallet and try again.");
        }
      }
      
      if (!api) {
        throw new Error("Wallet refused connection.");
      }

      // Get providers
      let providers = null;
      try {
        providers = await api.getProviders();
      } catch (e) {
        providers = api.providers; // Some APIs expose providers directly
      }
      
      if (!providers) {
        console.warn("Could not get providers, continuing anyway");
      }

      // Get address
      let finalAddr = "";
      try {
        const shieldedAddrs = await api.getShieldedAddresses();
        
        if (Array.isArray(shieldedAddrs)) {
          const first = shieldedAddrs[0];
          finalAddr = typeof first === 'string' ? first : (first?.address || first?.shieldedAddress || "");
        } else if (shieldedAddrs?.address) {
          finalAddr = shieldedAddrs.address;
        } else if (shieldedAddrs?.shieldedAddress) {
          finalAddr = shieldedAddrs.shieldedAddress;
        }
      } catch (e) {
        console.warn("Could not get addresses:", e);
      }
      
      // Validate Bech32m format
      if (finalAddr && !finalAddr.startsWith('un1') && !finalAddr.startsWith('mid')) {
        console.log("Address format:", finalAddr.substring(0, 10) + "...");
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
