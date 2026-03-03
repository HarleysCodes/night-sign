/**
 * useMidnightWallet.ts
 * 
 * Custom hook for Midnight Lace wallet integration.
 * Uses official Midnight Network DApp API (no getNetworkId).
 */

import { useState, useCallback, useEffect } from "react";

// ============ TYPES ============

// Any possible wallet provider
interface WalletProvider {
  enable?(network?: string): Promise<any>;
  connect?(network?: string): Promise<any>;
  api?: any;
  getShieldedAddresses?(): Promise<string[]>;
  getUsedAddresses?(): Promise<string[]>;
  getRewardAddresses?(): Promise<string[]>;
  state?(): Promise<any>;
  signData?(address: string, payload: string): Promise<string>;
  submitTransaction?(transaction: Uint8Array): Promise<string>;
  getBalance?(): Promise<{ tai: string; dust: string }>;
}

// Active API after initialization
interface LaceActiveApi {
  getShieldedAddresses?(): Promise<string[]>;
  getUsedAddresses?(): Promise<string[]>;
  getRewardAddresses?(): Promise<string[]>;
  state?(): Promise<any>;
  signData(address: string, payload: string): Promise<string>;
  submitTransaction(transaction: Uint8Array): Promise<string>;
  getBalance?(): Promise<{ tai: string; dust: string }>;
}

// Wallet State
interface WalletState {
  isConnected: boolean;
  accountId: string | null;
  networkId: number | null;
  status: "idle" | "connecting" | "connected" | "error";
  error: string | null;
  taiBalance: string | null;
  dustBalance: string | null;
}

// ============ CONSTANTS ============

const MIDNIGHT_MAINNET = 1;
const MIDNIGHT_TESTNET = 2;
const MIDNIGHT_DEVNET = 3;

// ============ HOOK ============

export function useMidnightWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    accountId: null,
    networkId: null,
    status: "idle",
    error: null,
    taiBalance: null,
    dustBalance: null,
  });

  const [activeApi, setActiveApi] = useState<LaceActiveApi | null>(null);

  // Detect and initialize wallet
  useEffect(() => {
    const detectWallet = async () => {
      const win = window as any;
      let baseProvider: WalletProvider | null = null;
      
      // Try window.midnight
      if (win.midnight && typeof win.midnight === 'object') {
        const keys = Object.keys(win.midnight);
        
        for (const key of keys) {
          if (win.midnight[key] && typeof win.midnight[key] === 'object') {
            baseProvider = win.midnight[key];
            break;
          }
        }
      }

      // Fallback
      if (!baseProvider && win.lace) {
        baseProvider = win.lace;
      }

      if (!baseProvider) {
        setState(prev => ({
          ...prev,
          error: "Midnight wallet not installed. Please install Lace extension.",
        }));
        return;
      }

      try {
        let api: any = null;
        const targetNetwork = "preprod";

        // Initialize
        if (baseProvider.enable && typeof baseProvider.enable === 'function') {
          api = await baseProvider.enable(targetNetwork);
        } else if (baseProvider.connect && typeof baseProvider.connect === 'function') {
          api = await baseProvider.connect(targetNetwork);
        } else if (baseProvider.api) {
          api = baseProvider.api;
        } else {
          api = baseProvider;
        }

        if (!api) {
          throw new Error("Wallet API is null after initialization");
        }

        // Set API immediately
        setActiveApi(api);

        // Fetch address using Midnight's native shielded methods
        let userAddress: string = "";
        
        try {
          // 1. Try official shielded address fetcher
          if (typeof api.getShieldedAddresses === 'function') {
            const addrs = await api.getShieldedAddresses();
            if (addrs && addrs.length > 0) {
              userAddress = addrs[0].substring(0, 16) + "...";
            }
          }
          // 2. Fallback to wallet state object
          else if (typeof api.state === 'function') {
            const walletState = await api.state();
            
            if (walletState?.coinPublicKey) {
              userAddress = walletState.coinPublicKey.substring(0, 16) + "...";
            } else if (walletState?.addresses?.[0]) {
              userAddress = walletState.addresses[0].substring(0, 16) + "...";
            }
          }
          // 3. Legacy fallback
          else if (typeof api.getUsedAddresses === 'function') {
            const addrs = await api.getUsedAddresses();
            if (addrs?.length > 0) {
              userAddress = addrs[0].substring(0, 16) + "...";
            }
          }
        } catch (addrErr) {
          // Graceful fallback - wallet is connected even if address fetch fails
        }

        // Try to get balance
        try {
          if (api.getBalance) {
            const bal = await api.getBalance();
            setState(prev => ({ 
              ...prev, 
              taiBalance: bal?.tai || null,
              dustBalance: bal?.dust || null
            }));
          }
        } catch (e) {
          // Balance fetch optional
        }

        // Update UI - connected state
        setState(prev => ({ 
          ...prev, 
          accountId: userAddress,
          networkId: 2,
          isConnected: true,
          status: "connected",
          error: null 
        }));

      } catch (error: any) {
        setState(prev => ({
          ...prev,
          status: "error",
          error: error.message || "Failed to connect wallet",
        }));
      }
    };

    const timer = setTimeout(detectWallet, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Connect (manual retry) - Real Midnight Lace API
  // Connect - Real Midnight Lace API
  const connect = async () => {
    try {
      // 1. Check if the extension exists in the browser
      // @ts-ignore
      if (typeof window === 'undefined' || !window.midnight || !window.midnight.mnl) {
        alert("Midnight Lace wallet extension not detected! Please install and unlock it.");
        return;
      }

      // 2. Actually trigger the pop-up and wait for the user to approve
      // @ts-ignore
      const api = await window.midnight.mnl.enable();

      // 3. Get the real cryptographic address
      const addresses = await api.state?.getUsedAddresses() || await api.getUsedAddresses();
      if (addresses && addresses.length > 0) {
        setState(prev => ({ ...prev, accountId: addresses[0], isConnected: true, status: "connected", error: null }));
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
      alert("Wallet connection rejected or failed.");
    }
  };

  // Sign document
  const signDocument = useCallback(async (
    documentHash: string,
    _proof: Uint8Array
  ): Promise<{ txHash: string; proof: string } | null> => {
    if (!activeApi || !state.accountId) {
      return null;
    }

    try {
      const payload = JSON.stringify({
        type: "zk-document-signature",
        documentHash,
        timestamp: Date.now(),
      });

      const signature = await activeApi.signData(state.accountId, payload);

      return {
        txHash: signature,
        proof: payload,
      };
    } catch (error: any) {
      if (error.message?.includes("rejected") || error.code === 4001) {
        setState(prev => ({
          ...prev,
          error: "Signature rejected by user",
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: error.message || "Signing failed",
        }));
      }

      return null;
    }
  }, [activeApi, state.accountId]);

  // Disconnect
  const disconnect = useCallback(() => {
    setActiveApi(null);
    setState({
      isConnected: false,
      accountId: null,
      networkId: null,
      status: "idle",
      error: null,
      taiBalance: null,
      dustBalance: null,
    });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    isConnected: state.isConnected,
    accountId: state.accountId,
    networkId: state.networkId,
    status: state.status,
    error: state.error,
    taiBalance: state.taiBalance,
    dustBalance: state.dustBalance,
    isTestnet: state.networkId === MIDNIGHT_TESTNET,
    isDevnet: state.networkId === MIDNIGHT_DEVNET,
    connect,
    disconnect,
    signDocument,
    clearError,
  };
}

// ============ HELPERS ============

export function getNetworkName(networkId: number): string {
  switch (networkId) {
    case MIDNIGHT_MAINNET: return "Mainnet";
    case MIDNIGHT_TESTNET: return "Testnet";
    case MIDNIGHT_DEVNET: return "Devnet";
    default: return `Unknown (${networkId})`;
  }
}

export function isCorrectNetwork(networkId: number | null): boolean {
  return networkId === MIDNIGHT_TESTNET || networkId === MIDNIGHT_DEVNET;
}
